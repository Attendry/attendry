/**
 * Event Extract-upgrade Stage
 * 
 * LLM enhancement of deterministic parsing results with schema validation
 */

import { EventCandidate, ParseResult, ExtractResult, Evidence } from './types';
import { logger } from '@/utils/logger';

export class EventExtractor {
  constructor(
    private config: any,
    private geminiService: any
  ) {}

  async extract(candidate: EventCandidate): Promise<ExtractResult> {
    const startTime = Date.now();
    logger.info({ message: '[extract] Starting LLM enhancement', url: candidate.url });
    
    try {
      if (!candidate.parseResult) {
        throw new Error('No parse result available for extraction');
      }

      const parseResult = candidate.parseResult;
      
      // Enhance with LLM
      const enhancedResult = await this.enhanceWithLLM(parseResult, candidate.url);
      
      // Validate schema
      const validationResult = this.validateSchema(enhancedResult);
      
      // Calculate final confidence
      const finalConfidence = this.calculateFinalConfidence(enhancedResult, validationResult);
      
      const extractResult: ExtractResult = {
        ...enhancedResult,
        llmEnhanced: true,
        schemaValidated: validationResult.isValid,
        validationErrors: validationResult.errors,
        llmConfidence: enhancedResult.confidence,
        enhancementNotes: enhancedResult.enhancementNotes,
        confidence: finalConfidence
      };
      
      candidate.extractResult = extractResult;
      candidate.status = 'extracted';
      candidate.metadata.processingTime = Date.now() - startTime;
      candidate.metadata.stageTimings.extraction = Date.now() - startTime;
      
      logger.info({ message: '[extract] LLM enhancement completed',
        url: candidate.url,
        confidence: finalConfidence,
        schemaValid: validationResult.isValid,
        duration: Date.now() - startTime
      });
      
      return extractResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ message: '[extract] LLM enhancement failed',
        url: candidate.url,
        error: (error as any).message,
        duration
      });
      
      // Return fallback result with original parse data
      const fallbackResult: ExtractResult = {
        ...candidate.parseResult!,
        llmEnhanced: false,
        schemaValidated: false,
        validationErrors: ['LLM enhancement failed'],
        confidence: candidate.parseResult!.confidence * 0.7 // Reduce confidence for fallback
      };
      
      candidate.extractResult = fallbackResult;
      candidate.status = 'extracted';
      candidate.metadata.processingTime = Date.now() - startTime;
      
      return fallbackResult;
    }
  }

  private async enhanceWithLLM(parseResult: ParseResult, url: string): Promise<ParseResult> {
    const prompt = this.buildEnhancementPrompt(parseResult, url);
    
    try {
      const response = await this.geminiService.generateContent(prompt);
      const enhancement = JSON.parse(response);
      
      // Merge LLM enhancements with original parse result
      const enhanced: ParseResult = {
        ...parseResult,
        title: enhancement.title || parseResult.title,
        description: enhancement.description || parseResult.description,
        date: enhancement.date || parseResult.date,
        location: enhancement.location || parseResult.location,
        venue: enhancement.venue || parseResult.venue,
        speakers: this.processSpeakerObjects(enhancement.speakers || parseResult.speakers),
        agenda: enhancement.agenda || parseResult.agenda,
        confidence: Math.max(parseResult.confidence, enhancement.confidence || 0),
        evidence: [
          ...parseResult.evidence,
          ...this.createLLMEvidence(enhancement)
        ],
        parseMethod: 'llm_enhanced',
        enhancementNotes: enhancement.notes || 'LLM enhancement applied'
      };
      
      return enhanced;
    } catch (error) {
      logger.warn({ message: '[extract] LLM enhancement failed, using original parse result',
        url,
        error: (error as any).message
      });
      
      return {
        ...parseResult,
        parseMethod: 'deterministic',
        enhancementNotes: 'LLM enhancement failed, using deterministic result'
      };
    }
  }

  private buildEnhancementPrompt(parseResult: ParseResult, url: string): string {
    return `
      Enhance and validate this event data extracted from: ${url}
      
      Current extracted data:
      - Title: ${parseResult.title || 'Not found'}
      - Description: ${parseResult.description || 'Not found'}
      - Date: ${parseResult.date || 'Not found'}
      - Location: ${parseResult.location || 'Not found'}
      - Venue: ${parseResult.venue || 'Not found'}
      - Speakers: ${parseResult.speakers?.join(', ') || 'Not found'}
      - Agenda: ${parseResult.agenda?.join(', ') || 'Not found'}
      
      Please enhance this data by:
      1. Correcting any obvious errors or inconsistencies
      2. Standardizing date formats (use YYYY-MM-DD)
      3. Improving location formatting (City, Country) - be very specific about the actual location
      4. Extracting additional speaker information if possible - ONLY include actual person names (First Last format), NOT job titles, organizations, or generic terms
      5. Validating that this is actually an event page
      
      IMPORTANT LOCATION RULES:
      - If the event is in Ho Chi Minh City, Vietnam, set location to "Ho Chi Minh City, Vietnam"
      - If the event is in Barcelona, Spain, set location to "Barcelona, Spain"  
      - If the event is in Frankfurt, Germany, set location to "Frankfurt, Germany"
      - Be precise about country names - use full country names, not just city names
      - If location is unclear, set to null rather than guessing
      
      IMPORTANT SPEAKER RULES:
      - Extract ALL speakers from the page - look for speaker lists, speaker sections, and individual speaker mentions
      - Extract comprehensive speaker information: Firstname Lastname, Job Title, and Company
      - INCLUDE actual person names in "First Last" format
      - INCLUDE job titles like "CEO", "Director", "Manager", "Legal Counsel", "Partner", "General Counsel"
      - INCLUDE company/organization names
      - Look for patterns like "Mr. John Smith, Chief Compliance Officer, ABC Corp"
      - Look for bullet points or lists of speakers
      - Look for speaker sections with multiple names
      - EXCLUDE generic terms like "Speaker", "Presenter", "Panelist" (unless they are actual names)
      - If no actual person names are found, return empty array []
      
      Return JSON with enhanced fields:
      {
        "title": "Enhanced title or original if good",
        "description": "Enhanced description or original if good", 
        "date": "YYYY-MM-DD format or original if good",
        "location": "City, Country format or null if unclear",
        "venue": "Enhanced venue name or original if good",
        "speakers": [
          {
            "name": "John Smith",
            "title": "General Counsel", 
            "company": "ABC Corporation"
          },
          {
            "name": "Jane Doe",
            "title": "Partner",
            "company": "XYZ Law Firm"
          }
        ],
        "agenda": ["Session 1", "Session 2", ...],
        "confidence": 0.0-1.0,
        "notes": "Brief description of enhancements made"
      }
      
      Only enhance fields that need improvement. Keep original values if they're already good.
    `;
  }

  private processSpeakerObjects(speakers: any[] | string[] | undefined): string[] {
    if (!speakers || !Array.isArray(speakers)) return [];
    
    // Handle both object format (from LLM) and string format (from parsing)
    return speakers.map(speaker => {
      if (typeof speaker === 'string') {
        // Legacy string format - validate and return if it's a proper name
        return this.validateSpeakerName(speaker) ? speaker : null;
      } else if (typeof speaker === 'object' && speaker.name) {
        // New object format - extract name and validate
        return this.validateSpeakerName(speaker.name) ? speaker.name : null;
      }
      return null;
    }).filter(Boolean) as string[];
  }

  private validateSpeakerName(speaker: string): boolean {
    if (!speaker || typeof speaker !== 'string') return false;
    
    const speakerLower = speaker.toLowerCase().trim();
    
    // Must be at least 5 characters
    if (speakerLower.length < 5) return false;
    
    // Must match FirstName LastName pattern
    if (!/^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(speaker)) return false;
    
    // Must not be just job titles or organizations
    if (speakerLower.includes('(likely') || speakerLower.includes('representing')) return false;
    
    return true;
  }

  private createLLMEvidence(enhancement: any): Evidence[] {
    const evidence: Evidence[] = [];
    
    Object.entries(enhancement).forEach(([field, value]) => {
      if (value && typeof value === 'string' && field !== 'confidence' && field !== 'notes') {
        evidence.push({
          field,
          value: value as string,
          source: 'llm',
          quotedText: value as string,
          confidence: enhancement.confidence || 0.8,
          timestamp: new Date(),
          context: 'LLM enhancement'
        });
      } else if (Array.isArray(value) && value.length > 0) {
        evidence.push({
          field,
          value: value.join(', '),
          source: 'llm',
          quotedText: value.join(', '),
          confidence: enhancement.confidence || 0.8,
          timestamp: new Date(),
          context: 'LLM enhancement'
        });
      }
    });
    
    return evidence;
  }

  private validateSchema(result: ParseResult): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Required fields validation
    if (!result.title || result.title.trim().length === 0) {
      errors.push('Title is required');
    }
    
    if (!result.description || result.description.trim().length < 10) {
      errors.push('Description must be at least 10 characters');
    }
    
    // Date validation
    if (result.date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(result.date)) {
        errors.push('Date must be in YYYY-MM-DD format');
      } else {
        const date = new Date(result.date);
        if (isNaN(date.getTime())) {
          errors.push('Date is not a valid date');
        }
      }
    }
    
    // Location validation
    if (result.location && result.location.trim().length < 3) {
      errors.push('Location must be at least 3 characters');
    }
    
    // Speaker validation
    if (result.speakers) {
      const invalidSpeakers = result.speakers.filter(speaker => {
        if (typeof speaker === 'string') {
          return !speaker || speaker.trim().length < 2;
        } else if (typeof speaker === 'object' && speaker.name) {
          return !speaker.name || speaker.name.trim().length < 2;
        }
        return true; // Invalid format
      });
      if (invalidSpeakers.length > 0) {
        errors.push(`Invalid speakers found: ${invalidSpeakers.length} invalid entries`);
      }
    }
    
    // Confidence validation
    if (result.confidence < 0 || result.confidence > 1) {
      errors.push('Confidence must be between 0 and 1');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private calculateFinalConfidence(result: ParseResult, validation: { isValid: boolean; errors: string[] }): number {
    let confidence = result.confidence;
    
    // Boost confidence for valid schema
    if (validation.isValid) {
      confidence = Math.min(confidence + 0.1, 1.0);
    } else {
      // Reduce confidence for validation errors
      confidence = Math.max(confidence - (validation.errors.length * 0.05), 0.1);
    }
    
    // Boost confidence for complete data
    const fields = ['title', 'description', 'date', 'location', 'venue'];
    const presentFields = fields.filter(field => result[field as keyof ParseResult]);
    const completeness = presentFields.length / fields.length;
    
    confidence = confidence * (0.7 + completeness * 0.3);
    
    return Math.round(confidence * 100) / 100; // Round to 2 decimal places
  }
}
