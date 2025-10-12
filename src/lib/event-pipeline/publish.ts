/**
 * Event Publish Stage
 * 
 * Final event formatting, quality control, and output generation
 */

import { EventCandidate, ExtractResult, PipelineContext } from './types';
import { logger } from '@/utils/logger';

export interface PublishedEvent {
  id: string;
  title: string;
  description: string;
  source_url: string;
  starts_at: string;
  location: string;
  venue?: string;
  country: string;
  city: string;
  speakers: Array<{
    name: string;
    title?: string;
    org?: string;
    bio?: string;
    confidence: number;
  }>;
  sessions?: string[];
  agenda?: string[];
  confidence: number;
  confidence_reason: string;
  pipeline_metadata: {
    source: string;
    priorityScore: number;
    parseMethod: string;
    evidence: number;
    processingTime: number;
    llmEnhanced: boolean;
    schemaValidated: boolean;
    enhancementNotes?: string;
    qualityScore: number;
    publishTimestamp: string;
  };
}

export class EventPublisher {
  constructor(
    private config: any,
    private context: PipelineContext
  ) {}

  async publish(candidate: EventCandidate): Promise<PublishedEvent | null> {
    const startTime = Date.now();
    logger.info({ message: '[publish] Starting event publishing', url: candidate.url });
    
    try {
      if (!candidate.extractResult && !candidate.parseResult) {
        throw new Error('No extraction or parse result available for publishing');
      }

      const result = candidate.extractResult || candidate.parseResult!;
      
      // Apply quality control
      const qualityCheck = this.performQualityControl(candidate, result as ExtractResult);
      if (!qualityCheck.passed) {
        logger.warn({ message: '[publish] Quality control failed',
          url: candidate.url,
          reasons: qualityCheck.reasons
        });
        candidate.status = 'rejected';
        return null;
      }
      
      // Format and standardize event data
      const formattedEvent = this.formatEvent(candidate, result as ExtractResult);
      
      // Calculate final quality score
      const qualityScore = this.calculateQualityScore(formattedEvent, result as ExtractResult);
      
      // Create published event
      const publishedEvent: PublishedEvent = {
        id: candidate.id,
        title: formattedEvent.title,
        description: formattedEvent.description,
        source_url: candidate.url,
        starts_at: formattedEvent.starts_at,
        location: formattedEvent.location,
        venue: formattedEvent.venue,
        country: formattedEvent.country,
        city: formattedEvent.city,
        speakers: formattedEvent.speakers,
        sessions: formattedEvent.sessions,
        agenda: formattedEvent.agenda,
        confidence: formattedEvent.confidence || 0.5,
        confidence_reason: this.generateConfidenceReason(result as ExtractResult, qualityScore),
        pipeline_metadata: {
          source: candidate.source,
          priorityScore: candidate.priorityScore || 0,
          parseMethod: result.parseMethod,
          evidence: result.evidence?.length || 0,
          processingTime: candidate.metadata.processingTime || (Date.now() - startTime),
          llmEnhanced: candidate.extractResult?.llmEnhanced || false,
          schemaValidated: candidate.extractResult?.schemaValidated || false,
          enhancementNotes: result.enhancementNotes,
          qualityScore,
          publishTimestamp: new Date().toISOString()
        }
      };
      
      candidate.status = 'published';
      candidate.metadata.processingTime = Date.now() - startTime;
      if (!candidate.metadata.stageTimings) {
        candidate.metadata.stageTimings = {};
      }
      (candidate.metadata.stageTimings as any).publishing = Date.now() - startTime;
      
      logger.info({ message: '[publish] Event published successfully',
        url: candidate.url,
        qualityScore,
        confidence: publishedEvent.confidence,
        duration: Date.now() - startTime
      });
      
      return publishedEvent;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ message: '[publish] Event publishing failed',
        url: candidate.url,
        error: (error as any).message,
        duration
      });
      
      candidate.status = 'failed';
      candidate.metadata.processingTime = Date.now() - startTime;
      
      return null;
    }
  }

  private performQualityControl(candidate: EventCandidate, result: ExtractResult): { passed: boolean; reasons: string[] } {
    const reasons: string[] = [];
    
    // Check minimum confidence threshold
    if (result.confidence < this.config.thresholds.confidence) {
      reasons.push(`Confidence too low: ${result.confidence} < ${this.config.thresholds.confidence}`);
    }
    
    // Check required fields
    if (!result.title || result.title.trim().length < 3) {
      reasons.push('Title is missing or too short');
    }
    
    if (!result.description || result.description.trim().length < 10) {
      reasons.push('Description is missing or too short');
    }
    
    // Check for spam indicators
    if (this.isSpam(result.title, result.description)) {
      reasons.push('Content appears to be spam');
    }
    
    // Check for duplicate content
    if (this.isDuplicate(result.title, result.description)) {
      reasons.push('Content appears to be duplicate');
    }
    
    // Check date validity
    if (result.date && !this.isValidDate(result.date)) {
      reasons.push('Invalid date format');
    }
    
    // Check location validity
    if (result.location && !this.isValidLocation(result.location)) {
      reasons.push('Invalid location format');
    }
    
    // Check for impossible country/location combinations
    if (result.location && this.context.country) {
      const extractedCountry = this.extractCountry(result.location, this.context.country);
      if (this.isImpossibleCountryLocationCombination(extractedCountry, result.location, this.context.country)) {
        reasons.push('Impossible country/location combination');
      }
    }
    
    return {
      passed: reasons.length === 0,
      reasons
    };
  }

  private formatEvent(candidate: EventCandidate, result: ExtractResult): any {
    return {
      title: this.cleanText(result.title || 'Untitled Event'),
      description: this.cleanText(result.description || 'No description available'),
      starts_at: this.formatDate(result.date),
      location: this.formatLocation(result.location),
      venue: result.venue ? this.cleanText(result.venue) : undefined,
      country: this.extractCountry(result.location, this.context.country),
      city: this.extractCity(result.location),
      speakers: this.formatSpeakers(result.speakers || []),
      sessions: result.agenda || [],
      agenda: result.agenda || [],
      confidence: result.confidence
    };
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-.,!?()]/g, '')
      .trim();
  }

  private formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    } catch {
      return '';
    }
  }

  private formatLocation(location?: string): string {
    if (!location) return '';
    
    // Clean and standardize location format
    return location
      .replace(/\s+/g, ' ')
      .replace(/,+/g, ', ')
      .trim();
  }

  private extractCountry(location?: string, defaultCountry?: string): string {
    if (!location) return defaultCountry || 'Unknown';
    
    // Enhanced country extraction logic with proper country codes
    const countryPatterns = {
      'de': ['germany', 'deutschland', 'de', 'berlin', 'munich', 'frankfurt', 'hamburg', 'cologne', 'stuttgart', 'düsseldorf', 'leipzig'],
      'fr': ['france', 'fr', 'paris', 'lyon', 'marseille', 'toulouse', 'nice', 'nantes'],
      'gb': ['united kingdom', 'uk', 'england', 'scotland', 'wales', 'london', 'manchester', 'birmingham', 'glasgow', 'edinburgh'],
      'es': ['spain', 'es', 'madrid', 'barcelona', 'valencia', 'seville', 'bilbao'],
      'it': ['italy', 'it', 'rome', 'milan', 'naples', 'turin', 'florence', 'venice'],
      'nl': ['netherlands', 'nederland', 'nl', 'amsterdam', 'rotterdam', 'the hague', 'utrecht'],
      'us': ['united states', 'usa', 'us', 'america', 'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia'],
      'vn': ['vietnam', 'vn', 'ho chi minh city', 'hanoi', 'da nang', 'hue'],
      'at': ['austria', 'at', 'vienna', 'salzburg', 'innsbruck', 'graz'],
      'ch': ['switzerland', 'ch', 'zurich', 'geneva', 'basel', 'bern', 'lausanne'],
      'be': ['belgium', 'be', 'brussels', 'antwerp', 'ghent', 'bruges'],
      'dk': ['denmark', 'dk', 'copenhagen', 'aarhus', 'odense'],
      'se': ['sweden', 'se', 'stockholm', 'gothenburg', 'malmo'],
      'no': ['norway', 'no', 'oslo', 'bergen', 'trondheim'],
      'fi': ['finland', 'fi', 'helsinki', 'tampere', 'turku'],
      'pl': ['poland', 'pl', 'warsaw', 'krakow', 'gdansk', 'wroclaw'],
      'cz': ['czech republic', 'cz', 'prague', 'brno', 'ostrava'],
      'hu': ['hungary', 'hu', 'budapest', 'debrecen', 'szeged'],
      'sk': ['slovakia', 'sk', 'bratislava', 'kosice'],
      'si': ['slovenia', 'si', 'ljubljana', 'maribor'],
      'hr': ['croatia', 'hr', 'zagreb', 'split', 'dubrovnik'],
      'bg': ['bulgaria', 'bg', 'sofia', 'plovdiv', 'varna'],
      'ro': ['romania', 'ro', 'bucharest', 'cluj-napoca', 'timisoara'],
      'ee': ['estonia', 'ee', 'tallinn', 'tartu'],
      'lv': ['latvia', 'lv', 'riga', 'daugavpils'],
      'lt': ['lithuania', 'lt', 'vilnius', 'kaunas', 'klaipeda'],
      'mt': ['malta', 'mt', 'valletta', 'sliema'],
      'cy': ['cyprus', 'cy', 'nicosia', 'limassol'],
      'ie': ['ireland', 'ie', 'dublin', 'cork', 'galway'],
      'pt': ['portugal', 'pt', 'lisbon', 'porto', 'coimbra']
    };
    
    const locationLower = location.toLowerCase();
    
    // Check for exact country matches first
    for (const [countryCode, patterns] of Object.entries(countryPatterns)) {
      if (patterns.some(pattern => locationLower.includes(pattern.toLowerCase()))) {
        return countryCode;
      }
    }
    
    // If no match found, return default country
    return defaultCountry || 'Unknown';
  }

  private extractCity(location?: string): string {
    if (!location) return '';
    
    // Extract city from location (first part before comma)
    const parts = location.split(',');
    return parts[0]?.trim() || '';
  }

  private formatSpeakers(speakers: any[] | string[]): Array<{ name: string; title?: string; org?: string; bio?: string; confidence: number }> {
    return speakers.map(speaker => {
      if (typeof speaker === 'string') {
        // Legacy string format
        return {
          name: this.cleanText(speaker),
          title: undefined,
          org: undefined,
          bio: undefined,
          confidence: this.calculateSpeakerConfidence(speaker)
        };
      } else if (typeof speaker === 'object' && speaker.name) {
        // New object format with comprehensive data
        return {
          name: this.cleanText(speaker.name),
          title: speaker.title ? this.cleanText(speaker.title) : undefined,
          org: speaker.company ? this.cleanText(speaker.company) : undefined,
          bio: undefined,
          confidence: this.calculateSpeakerConfidence(speaker.name)
        };
      } else {
        // Fallback for invalid data
        return {
          name: 'Unknown Speaker',
          title: undefined,
          org: undefined,
          bio: undefined,
          confidence: 0.1
        };
      }
    });
  }

  private calculateSpeakerConfidence(speaker: string): number {
    // Higher confidence for well-formatted names
    if (/^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(speaker)) {
      return 0.9; // High confidence for proper First Last format
    }
    
    // Medium confidence for names with middle initials or multiple parts
    if (/^[A-Z][a-z]+(\s+[A-Z]\.?\s+)?[A-Z][a-z]+$/.test(speaker)) {
      return 0.8;
    }
    
    // Lower confidence for other formats
    return 0.6;
  }

  private isImpossibleCountryLocationCombination(extractedCountry: string, location: string, targetCountry: string): boolean {
    // Check for obvious mismatches
    const locationLower = location.toLowerCase();
    
    // Ho Chi Minh City should never be mapped to Germany
    if (locationLower.includes('ho chi minh city') && extractedCountry === 'de') {
      return true;
    }
    
    // Barcelona should never be mapped to Germany
    if (locationLower.includes('barcelona') && extractedCountry === 'de') {
      return true;
    }
    
    // Vietnam locations should not be mapped to European countries
    if (locationLower.includes('vietnam') && ['de', 'fr', 'gb', 'es', 'it'].includes(extractedCountry)) {
      return true;
    }
    
    // Spanish locations should not be mapped to Germany
    if (locationLower.includes('spain') && extractedCountry === 'de') {
      return true;
    }
    
    return false;
  }

  private calculateQualityScore(event: any, result: ExtractResult): number {
    let score = 0;
    
    // Base score from extraction confidence
    score += result.confidence * 0.4;
    
    // Completeness score
    const fields = ['title', 'description', 'starts_at', 'location', 'venue'];
    const presentFields = fields.filter(field => event[field] && event[field].trim().length > 0);
    score += (presentFields.length / fields.length) * 0.3;
    
    // Data quality score
    if (event.title && event.title.length > 10) score += 0.1;
    if (event.description && event.description.length > 50) score += 0.1;
    if (event.speakers && event.speakers.length > 0) score += 0.05;
    if (event.venue && event.venue.length > 0) score += 0.05;
    
    // LLM enhancement bonus
    if (result.parseMethod === 'llm_enhanced') score += 0.1;
    
    return Math.min(score, 1.0);
  }

  private generateConfidenceReason(result: ExtractResult, qualityScore: number): string {
    const reasons = [];
    
    if (result.parseMethod === 'llm_enhanced') {
      reasons.push('LLM enhanced');
    }
    
    if (result.confidence > 0.8) {
      reasons.push('high confidence extraction');
    } else if (result.confidence > 0.6) {
      reasons.push('moderate confidence extraction');
    }
    
    if (qualityScore > 0.8) {
      reasons.push('high quality data');
    }
    
    if (result.evidence && result.evidence.length > 5) {
      reasons.push('strong evidence');
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'standard processing';
  }

  private isSpam(title?: string, description?: string): boolean {
    if (!title && !description) return false;
    
    const spamIndicators = [
      'click here', 'buy now', 'free money', 'make money fast',
      'viagra', 'casino', 'lottery', 'winner', 'congratulations'
    ];
    
    const text = `${title || ''} ${description || ''}`.toLowerCase();
    return spamIndicators.some(indicator => text.includes(indicator));
  }

  private isDuplicate(title?: string, description?: string): boolean {
    // Simple duplicate detection based on title similarity
    // In a real implementation, this would use more sophisticated algorithms
    if (!title) return false;
    
    const normalizedTitle = title.toLowerCase().replace(/[^\w\s]/g, '');
    return normalizedTitle.length < 10; // Very short titles might be duplicates
  }

  private isValidDate(dateStr: string): boolean {
    try {
      const date = new Date(dateStr);
      return !isNaN(date.getTime()) && date > new Date('1900-01-01');
    } catch {
      return false;
    }
  }

  private isValidLocation(location: string): boolean {
    return location.trim().length >= 3 && !/^\d+$/.test(location);
  }
}
