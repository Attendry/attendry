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
        speakers: this.validateAndFilterSpeakers(enhancement.speakers || parseResult.speakers),
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
      3. Improving location formatting (City, Country)
      4. Extracting additional speaker information if possible - ONLY include actual person names (First Last format), NOT job titles, organizations, or generic terms
      5. Validating that this is actually an event page
      
      Return JSON with enhanced fields:
      {
        "title": "Enhanced title or original if good",
        "description": "Enhanced description or original if good", 
        "date": "YYYY-MM-DD format or original if good",
        "location": "City, Country format or original if good",
        "venue": "Enhanced venue name or original if good",
        "speakers": ["John Smith", "Jane Doe", ...], // ONLY actual person names, NOT job titles or organizations
        "agenda": ["Session 1", "Session 2", ...],
        "confidence": 0.0-1.0,
        "notes": "Brief description of enhancements made"
      }
      
      Only enhance fields that need improvement. Keep original values if they're already good.
    `;
  }

  private validateAndFilterSpeakers(speakers: string[] | undefined): string[] {
    if (!speakers || !Array.isArray(speakers)) return [];
    
    // Common job titles and generic terms to filter out
    const invalidTerms = [
      'compliance officer', 'regulatory affairs', 'ethics officer', 'legal counsel',
      'general counsel', 'chief executive', 'ceo', 'cfo', 'cto', 'cmo',
      'director', 'manager', 'senior', 'junior', 'associate', 'partner',
      'representative', 'specialist', 'expert', 'advisor', 'consultant',
      'speaker', 'presenter', 'moderator', 'panelist', 'keynote',
      'legal', 'compliance', 'regulatory', 'ethics', 'governance',
      'risk management', 'audit', 'investigation', 'whistleblowing',
      'data protection', 'privacy', 'cybersecurity', 'regtech', 'esg',
      'banking union', 'european commission', 'central bank', 'supervisory board',
      'board member', 'director general', 'chief justice', 'ratings department',
      'investment forum', 'climate rating', 'foreign trade', 'business school',
      'menarini group', 'menarini spain', 'legal europe', 'urban mobility',
      'banknote solutions', 'solution counselling', 'los angeles', 'latin america',
      'development challenges', 'el salvador', 'law module', 'sierra leone',
      'williams wall', 'chambers westgarth', 'withers bergman', 'addleshaw goddard'
    ];
    
    return speakers.filter(speaker => {
      if (!speaker || typeof speaker !== 'string') return false;
      
      const speakerLower = speaker.toLowerCase().trim();
      
      // Must be at least 5 characters
      if (speakerLower.length < 5) return false;
      
      // Must match FirstName LastName pattern
      if (!/^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(speaker)) return false;
      
      // Must not contain invalid terms
      if (invalidTerms.some(term => speakerLower.includes(term))) return false;
      
      // Must not be just job titles or organizations
      if (speakerLower.includes('(likely') || speakerLower.includes('representing')) return false;
      
      return true;
    });
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
      const invalidSpeakers = result.speakers.filter(speaker => 
        !speaker || speaker.trim().length < 2
      );
      if (invalidSpeakers.length > 0) {
        errors.push(`Invalid speakers found: ${invalidSpeakers.join(', ')}`);
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
