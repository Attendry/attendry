/**
 * Deduplication and Canonicalisation System
 * 
 * Implements canonical keys and near-duplicate detection for events and speakers
 */

export interface EventRecord {
  source_url: string;
  title?: string;
  description?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  city?: string | null;
  country?: string | null;
  location?: string | null;
  venue?: string | null;
  organizer?: string | null;
  topics?: string[] | null;
  speakers?: Array<{ name: string; org?: string; title?: string }>;
  confidence?: number | null;
}

export interface SpeakerRecord {
  name: string;
  org?: string;
  title?: string;
  source_url?: string;
  confidence?: number;
}

export interface CanonicalKey {
  type: 'event' | 'speaker';
  key: string;
  confidence: number;
  sources: string[];
}

export interface DeduplicationResult<T> {
  canonical: T[];
  duplicates: Array<{
    canonical: T;
    duplicates: T[];
    reason: string;
    confidence: number;
  }>;
  stats: {
    total: number;
    canonical: number;
    duplicates: number;
    deduplicationRate: number;
  };
}

/**
 * Canonical Key Generator
 */
export class CanonicalKeyGenerator {
  /**
   * Generate canonical key for events: {normalized_title}|{venue}|{start_date}
   */
  static generateEventKey(event: EventRecord): CanonicalKey {
    const normalizedTitle = this.normalizeEventTitle(event.title || '');
    const normalizedVenue = this.normalizeVenue(event.venue || event.location || '');
    const startDate = this.normalizeDate(event.starts_at);
    
    const key = `${normalizedTitle}|${normalizedVenue}|${startDate}`;
    
    return {
      type: 'event',
      key,
      confidence: this.calculateEventKeyConfidence(event),
      sources: [event.source_url]
    };
  }

  /**
   * Generate canonical key for speakers: {name}|{org}
   */
  static generateSpeakerKey(speaker: SpeakerRecord): CanonicalKey {
    const normalizedName = this.normalizeSpeakerName(speaker.name);
    const normalizedOrg = this.normalizeOrganization(speaker.org || '');
    
    const key = `${normalizedName}|${normalizedOrg}`;
    
    return {
      type: 'speaker',
      key,
      confidence: this.calculateSpeakerKeyConfidence(speaker),
      sources: speaker.source_url ? [speaker.source_url] : []
    };
  }

  /**
   * Normalize event title by removing noise
   */
  private static normalizeEventTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/\b(conference|summit|workshop|seminar|meeting|event|forum|symposium|exhibition|expo)\b/g, '')
      .replace(/\b(2024|2025|2026|2027|2028|2029|2030)\b/g, '')
      .replace(/\b(annual|yearly|monthly|weekly|daily)\b/g, '')
      .replace(/\b(rd|th|st|nd)\b/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize venue name
   */
  private static normalizeVenue(venue: string): string {
    return venue
      .toLowerCase()
      .replace(/\b(conference center|convention center|hotel|venue|location|place)\b/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize date to YYYY-MM-DD format
   */
  private static normalizeDate(dateStr: string | null | undefined): string {
    if (!dateStr) return 'unknown';
    
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return 'unknown';
    }
  }

  /**
   * Normalize speaker name
   */
  private static normalizeSpeakerName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(dr|prof|professor|mr|mrs|ms|sir|dame)\b\.?\s*/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize organization name
   */
  private static normalizeOrganization(org: string): string {
    return org
      .toLowerCase()
      .replace(/\b(ltd|llc|inc|corp|corporation|company|co|gmbh|ag|sa|bv|nv)\b\.?\s*/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate confidence for event key
   */
  private static calculateEventKeyConfidence(event: EventRecord): number {
    let confidence = 0.5; // Base confidence
    
    if (event.title) confidence += 0.2;
    if (event.venue || event.location) confidence += 0.2;
    if (event.starts_at) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate confidence for speaker key
   */
  private static calculateSpeakerKeyConfidence(speaker: SpeakerRecord): number {
    let confidence = 0.6; // Base confidence
    
    if (speaker.name) confidence += 0.3;
    if (speaker.org) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }
}

/**
 * Near-Duplicate Detection
 */
export class NearDuplicateDetector {
  private static readonly LEVENSHTEIN_THRESHOLD = 0.8;
  private static readonly JACCARD_THRESHOLD = 0.7;

  /**
   * Detect near-duplicate events
   */
  static detectNearDuplicateEvents(events: EventRecord[]): DeduplicationResult<EventRecord> {
    const canonical: EventRecord[] = [];
    const duplicates: Array<{ canonical: EventRecord; duplicates: EventRecord[]; reason: string; confidence: number }> = [];
    const processed = new Set<string>();

    for (let i = 0; i < events.length; i++) {
      if (processed.has(events[i].source_url)) continue;

      const canonicalEvent = events[i];
      const canonicalKey = CanonicalKeyGenerator.generateEventKey(canonicalEvent);
      const duplicateGroup = [canonicalEvent];
      processed.add(canonicalEvent.source_url);

      // Find near-duplicates
      for (let j = i + 1; j < events.length; j++) {
        if (processed.has(events[j].source_url)) continue;

        const similarity = this.calculateEventSimilarity(canonicalEvent, events[j]);
        
        if (similarity.score >= this.LEVENSHTEIN_THRESHOLD) {
          duplicateGroup.push(events[j]);
          processed.add(events[j].source_url);
        }
      }

      if (duplicateGroup.length > 1) {
        // Choose best canonical event (prefer official sites, newer dates, HTTPS)
        const bestCanonical = this.selectBestCanonicalEvent(duplicateGroup);
        canonical.push(bestCanonical);
        
        const duplicates_only = duplicateGroup.filter(e => e.source_url !== bestCanonical.source_url);
        duplicates.push({
          canonical: bestCanonical,
          duplicates: duplicates_only,
          reason: `Near-duplicate detected (similarity: ${similarity.score.toFixed(2)})`,
          confidence: similarity.score
        });
      } else {
        canonical.push(canonicalEvent);
      }
    }

    return {
      canonical,
      duplicates,
      stats: {
        total: events.length,
        canonical: canonical.length,
        duplicates: events.length - canonical.length,
        deduplicationRate: events.length > 0 ? (events.length - canonical.length) / events.length : 0
      }
    };
  }

  /**
   * Calculate similarity between two events
   */
  private static calculateEventSimilarity(event1: EventRecord, event2: EventRecord): { score: number; method: string } {
    // Title similarity (Levenshtein)
    const titleSimilarity = this.levenshteinSimilarity(
      event1.title || '',
      event2.title || ''
    );

    // Venue similarity
    const venueSimilarity = this.levenshteinSimilarity(
      event1.venue || event1.location || '',
      event2.venue || event2.location || ''
    );

    // Date similarity
    const dateSimilarity = this.calculateDateSimilarity(event1.starts_at, event2.starts_at);

    // Combined score (weighted)
    const combinedScore = (
      titleSimilarity * 0.5 +
      venueSimilarity * 0.3 +
      dateSimilarity * 0.2
    );

    return {
      score: combinedScore,
      method: 'weighted_levenshtein'
    };
  }

  /**
   * Calculate Levenshtein similarity (0-1)
   */
  private static levenshteinSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }

    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (matrix[str2.length][str1.length] / maxLength);
  }

  /**
   * Calculate date similarity
   */
  private static calculateDateSimilarity(date1: string | null | undefined, date2: string | null | undefined): number {
    if (!date1 || !date2) return 0.5; // Neutral if dates missing
    
    try {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      const diffDays = Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24);
      
      // Same day = 1.0, within 7 days = 0.8, within 30 days = 0.5, etc.
      if (diffDays === 0) return 1.0;
      if (diffDays <= 7) return 0.8;
      if (diffDays <= 30) return 0.5;
      if (diffDays <= 90) return 0.2;
      return 0.0;
    } catch {
      return 0.0;
    }
  }

  /**
   * Select best canonical event from duplicates
   */
  private static selectBestCanonicalEvent(events: EventRecord[]): EventRecord {
    return events.reduce((best, current) => {
      let score = 0;
      
      // Prefer HTTPS over HTTP
      if (current.source_url.startsWith('https://')) score += 10;
      if (best.source_url.startsWith('https://')) score -= 10;
      
      // Prefer official domains
      const officialDomains = ['.org', '.edu', '.gov'];
      const currentIsOfficial = officialDomains.some(domain => current.source_url.includes(domain));
      const bestIsOfficial = officialDomains.some(domain => best.source_url.includes(domain));
      
      if (currentIsOfficial && !bestIsOfficial) score += 5;
      if (!currentIsOfficial && bestIsOfficial) score -= 5;
      
      // Prefer newer dates
      if (current.starts_at && best.starts_at) {
        const currentDate = new Date(current.starts_at);
        const bestDate = new Date(best.starts_at);
        if (currentDate > bestDate) score += 3;
        if (currentDate < bestDate) score -= 3;
      }
      
      // Prefer higher confidence
      if ((current.confidence || 0) > (best.confidence || 0)) score += 2;
      if ((current.confidence || 0) < (best.confidence || 0)) score -= 2;
      
      return score > 0 ? current : best;
    });
  }
}

/**
 * URL Canonicalisation
 */
export class URLCanonicalizer {
  /**
   * Canonicalize URL to standard form
   */
  static canonicalize(url: string): string {
    try {
      const parsed = new URL(url);
      
      // Remove common tracking parameters
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'ref', 'source', 'campaign', 'affiliate'
      ];
      
      trackingParams.forEach(param => {
        parsed.searchParams.delete(param);
      });
      
      // Remove trailing slash
      if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
        parsed.pathname = parsed.pathname.slice(0, -1);
      }
      
      // Convert to lowercase hostname
      parsed.hostname = parsed.hostname.toLowerCase();
      
      return parsed.toString();
    } catch {
      return url; // Return original if parsing fails
    }
  }
}
