/**
 * PHASE 2 OPTIMIZATION: Evidence Validation
 * 
 * Validates that extracted event data has proper evidence tags
 * and implements hallucination guards to auto-null fields without evidence.
 */

export interface EvidenceTag {
  field: string;
  source_url: string;
  source_section: string; // "title", "description", "header", "body"
  snippet: string; // Max 500 chars
  confidence: number; // 0-1
  extracted_at: string; // ISO timestamp
}

export interface EventWithEvidence {
  title?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  city?: string | null;
  country?: string | null;
  venue?: string | null;
  organizer?: string | null;
  topics?: string[];
  speakers?: any[];
  sponsors?: any[];
  participating_organizations?: string[];
  partners?: string[];
  competitors?: string[];
  confidence?: number | null;
  evidence?: EvidenceTag[];
}

/**
 * Validate that all non-null fields have evidence tags
 * 
 * @param event Event data with evidence
 * @returns Validation result
 */
export function validateExtraction(event: EventWithEvidence): {
  isValid: boolean;
  missingEvidence: string[];
  warnings: string[];
} {
  const missingEvidence: string[] = [];
  const warnings: string[] = [];
  
  if (!event.evidence || !Array.isArray(event.evidence)) {
    // No evidence array - all non-null fields are suspect
    const fieldsWithData = getFieldsWithData(event);
    if (fieldsWithData.length > 0) {
      warnings.push(`No evidence array provided. ${fieldsWithData.length} fields have data but no evidence.`);
    }
    return {
      isValid: false,
      missingEvidence: fieldsWithData,
      warnings
    };
  }
  
  // Check required fields
  const requiredFields = ['title'];
  requiredFields.forEach(field => {
    if (!event[field as keyof EventWithEvidence]) {
      missingEvidence.push(field);
    } else if (!hasEvidenceForField(event.evidence, field)) {
      missingEvidence.push(field);
    }
  });
  
  // Check optional fields that have data
  const optionalFields = [
    'starts_at', 'ends_at', 'city', 'country', 'venue', 'organizer',
    'topics', 'speakers', 'sponsors', 'participating_organizations',
    'partners', 'competitors'
  ];
  
  optionalFields.forEach(field => {
    const value = event[field as keyof EventWithEvidence];
    if (value !== null && value !== undefined) {
      // Check if it's an array
      if (Array.isArray(value) && value.length > 0) {
        if (!hasEvidenceForField(event.evidence, field)) {
          warnings.push(`Field "${field}" has data but no evidence tag`);
        }
      } else if (typeof value === 'string' && value.trim().length > 0) {
        if (!hasEvidenceForField(event.evidence, field)) {
          warnings.push(`Field "${field}" has data but no evidence tag`);
        }
      }
    }
  });
  
  return {
    isValid: missingEvidence.length === 0,
    missingEvidence,
    warnings
  };
}

/**
 * Check if evidence array has a tag for a specific field
 */
function hasEvidenceForField(evidence: EvidenceTag[], field: string): boolean {
  return evidence.some(tag => tag.field === field);
}

/**
 * Get all fields that have non-null data
 */
function getFieldsWithData(event: EventWithEvidence): string[] {
  const fields: string[] = [];
  
  if (event.title) fields.push('title');
  if (event.starts_at) fields.push('starts_at');
  if (event.ends_at) fields.push('ends_at');
  if (event.city) fields.push('city');
  if (event.country) fields.push('country');
  if (event.venue) fields.push('venue');
  if (event.organizer) fields.push('organizer');
  if (event.topics && event.topics.length > 0) fields.push('topics');
  if (event.speakers && event.speakers.length > 0) fields.push('speakers');
  if (event.sponsors && event.sponsors.length > 0) fields.push('sponsors');
  if (event.participating_organizations && event.participating_organizations.length > 0) {
    fields.push('participating_organizations');
  }
  if (event.partners && event.partners.length > 0) fields.push('partners');
  if (event.competitors && event.competitors.length > 0) fields.push('competitors');
  
  return fields;
}

/**
 * Calculate confidence score based on evidence quality
 * 
 * @param event Event with evidence
 * @returns Confidence score (0-1)
 */
export function calculateConfidence(event: EventWithEvidence): number {
  if (!event.evidence || event.evidence.length === 0) {
    console.log('[phase2-evidence-confidence] No evidence provided, using low confidence:', {
      eventTitle: event.title,
      confidence: 0.3
    });
    return 0.3; // Low confidence if no evidence
  }
  
  // Base confidence from evidence quality
  const avgEvidenceConfidence = event.evidence.reduce((sum, tag) => sum + tag.confidence, 0) / event.evidence.length;
  
  // Bonus for having evidence for key fields
  let bonus = 0;
  const keyFields = ['title', 'starts_at', 'city', 'venue'];
  keyFields.forEach(field => {
    if (hasEvidenceForField(event.evidence, field)) {
      bonus += 0.1;
    }
  });
  
  // Penalty for missing evidence on fields with data
  const fieldsWithData = getFieldsWithData(event);
  const fieldsWithEvidence = event.evidence.map(tag => tag.field);
  const missingEvidenceCount = fieldsWithData.filter(field => !fieldsWithEvidence.includes(field)).length;
  const penalty = missingEvidenceCount * 0.05;
  
  const confidence = Math.min(1.0, Math.max(0.0, avgEvidenceConfidence + bonus - penalty));
  const finalConfidence = Math.round(confidence * 100) / 100;
  
  console.log('[phase2-evidence-confidence] Calculated confidence:', {
    eventTitle: event.title,
    avgEvidenceConfidence: avgEvidenceConfidence.toFixed(2),
    bonus: bonus.toFixed(2),
    penalty: penalty.toFixed(2),
    missingEvidenceCount,
    finalConfidence
  });
  
  return finalConfidence;
}

/**
 * Hallucination guard: Auto-null fields without evidence
 * 
 * @param event Event data
 * @param evidence Evidence tags
 * @returns Event with hallucinated fields nulled
 */
export function applyHallucinationGuard(
  event: EventWithEvidence,
  evidence: EvidenceTag[]
): EventWithEvidence {
  const guarded = { ...event };
  const evidenceFields = new Set(evidence.map(tag => tag.field));
  const nulledFields: string[] = [];
  
  // Fields that require evidence (if they have data)
  const fieldsToCheck = [
    'starts_at', 'ends_at', 'city', 'country', 'venue', 'organizer'
  ];
  
  fieldsToCheck.forEach(field => {
    const value = guarded[field as keyof EventWithEvidence];
    if (value !== null && value !== undefined) {
      // Check if it's a string with content
      if (typeof value === 'string' && value.trim().length > 0) {
        if (!evidenceFields.has(field)) {
          // No evidence for this field - null it out
          (guarded as any)[field] = null;
          nulledFields.push(field);
        }
      }
    }
  });
  
  // For arrays, check if we have evidence for at least some items
  const arrayFields = ['topics', 'speakers', 'sponsors', 'participating_organizations', 'partners', 'competitors'];
  arrayFields.forEach(field => {
    const value = guarded[field as keyof EventWithEvidence];
    if (Array.isArray(value) && value.length > 0) {
      if (!evidenceFields.has(field)) {
        // No evidence for this array field - clear it
        (guarded as any)[field] = [];
        nulledFields.push(field);
      }
    }
  });
  
  if (nulledFields.length > 0) {
    console.log('[phase2-hallucination-guard] Nulled fields without evidence:', {
      eventTitle: event.title,
      nulledFields,
      evidenceFields: Array.from(evidenceFields)
    });
  }
  
  return guarded;
}

/**
 * Validate evidence tag structure
 */
export function validateEvidenceTag(tag: any): tag is EvidenceTag {
  if (!tag || typeof tag !== 'object') return false;
  
  return (
    typeof tag.field === 'string' &&
    typeof tag.source_url === 'string' &&
    typeof tag.source_section === 'string' &&
    typeof tag.snippet === 'string' &&
    tag.snippet.length <= 500 &&
    typeof tag.confidence === 'number' &&
    tag.confidence >= 0 &&
    tag.confidence <= 1 &&
    typeof tag.extracted_at === 'string'
  );
}

