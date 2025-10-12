/**
 * Event Parsing Stage
 * 
 * Deterministic HTML/PDF parsing with microdata, hCalendar, and regex patterns
 */

import { EventCandidate, ParseResult, Evidence, ParsingError } from './types';
import { logger } from '@/utils/logger';

export class EventParser {
  constructor(private config: any) {}

  async parse(candidate: EventCandidate): Promise<ParseResult> {
    const startTime = Date.now();
    logger.info({ message: '[parse] Starting parsing', url: candidate.url });
    
    try {
      const html = await this.fetchHTML(candidate.url);
      const result: ParseResult = {
        confidence: 0,
        evidence: [],
        parseMethod: 'deterministic',
        parseErrors: []
      };
      
      // Extract using deterministic rules
      result.title = this.extractTitle(html);
      result.description = this.extractDescription(html);
      result.date = this.extractDate(html);
      result.location = this.extractLocation(html);
      result.venue = this.extractVenue(html);
      result.speakers = this.extractSpeakers(html);
      result.agenda = this.extractAgenda(html);
      
      // Calculate confidence based on successful extractions
      result.confidence = this.calculateConfidence(result);
      
      // Add evidence for each extracted field
      result.evidence = this.buildEvidence(result, html);
      
      candidate.parseResult = result;
      candidate.status = 'parsed';
      candidate.metadata.processingTime = Date.now() - startTime;
      candidate.metadata.stageTimings.parsing = Date.now() - startTime;
      
      logger.info({ message: '[parse] Parsing completed',
        url: candidate.url,
        confidence: result.confidence,
        fieldsExtracted: Object.keys(result).filter(key => 
          key !== 'confidence' && key !== 'evidence' && key !== 'parseMethod' && key !== 'parseErrors' && 
          result[key as keyof ParseResult] !== undefined
        ).length,
        duration: Date.now() - startTime
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ message: '[parse] Parsing failed', 
        url: candidate.url, 
        error: (error as any).message, 
        duration 
      });
      candidate.status = 'failed';
      throw new ParsingError(`Parsing failed: ${(error as any).message}`, candidate, error as Error);
    }
  }

  private async fetchHTML(url: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeouts.parsing);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EventBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.text();
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as any).name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  private extractTitle(html: string): string | undefined {
    const patterns = [
      // Microdata
      { pattern: /itemprop="name"[^>]*content="([^"]+)"/i, source: 'microdata' as const },
      // OpenGraph
      { pattern: /property="og:title"[^>]*content="([^"]+)"/i, source: 'html' as const },
      // Twitter Cards
      { pattern: /name="twitter:title"[^>]*content="([^"]+)"/i, source: 'html' as const },
      // H1 tags (most specific)
      { pattern: /<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/i, source: 'html' as const },
      { pattern: /<h1[^>]*>([^<]+)<\/h1>/i, source: 'html' as const },
      // Title tag (fallback)
      { pattern: /<title[^>]*>([^<]+)<\/title>/i, source: 'html' as const }
    ];
    
    for (const { pattern, source } of patterns) {
      const match = html.match(pattern);
      if (match && match[1].trim().length > 0) {
        const title = match[1].trim();
        // Filter out generic titles
        if (!this.isGenericTitle(title)) {
          return title;
        }
      }
    }
    
    return undefined;
  }

  private extractDescription(html: string): string | undefined {
    const patterns = [
      // Microdata
      { pattern: /itemprop="description"[^>]*content="([^"]+)"/i, source: 'microdata' as const },
      // OpenGraph
      { pattern: /property="og:description"[^>]*content="([^"]+)"/i, source: 'html' as const },
      // Meta description
      { pattern: /name="description"[^>]*content="([^"]+)"/i, source: 'html' as const },
      // First paragraph
      { pattern: /<p[^>]*>([^<]{50,500})<\/p>/i, source: 'html' as const }
    ];
    
    for (const { pattern, source } of patterns) {
      const match = html.match(pattern);
      if (match && match[1].trim().length > 20) {
        const description = match[1].trim();
        if (!this.isGenericDescription(description)) {
          return description;
        }
      }
    }
    
    return undefined;
  }

  private extractDate(html: string): string | undefined {
    const patterns = [
      // ISO dates
      { pattern: /(\d{4}-\d{2}-\d{2})/g, source: 'regex' as const },
      // Common formats
      { pattern: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g, source: 'regex' as const },
      // Month names
      { pattern: /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi, source: 'regex' as const },
      // Microdata dates
      { pattern: /itemprop="startDate"[^>]*content="([^"]+)"/i, source: 'microdata' as const },
      { pattern: /itemprop="datePublished"[^>]*content="([^"]+)"/i, source: 'microdata' as const },
      // Event-specific patterns
      { pattern: /(?:date|when)[^>]*>([^<]*(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)[^<]*))/i, source: 'html' as const }
    ];
    
    for (const { pattern, source } of patterns) {
      const match = html.match(pattern);
      if (match) {
        const dateStr = match[0] || match[1];
        if (this.isValidDate(dateStr)) {
          return dateStr;
        }
      }
    }
    
    return undefined;
  }

  private extractLocation(html: string): string | undefined {
    const patterns = [
      // Microdata
      { pattern: /itemprop="location"[^>]*content="([^"]+)"/i, source: 'microdata' as const },
      { pattern: /itemprop="address"[^>]*content="([^"]+)"/i, source: 'microdata' as const },
      // Structured data patterns
      { pattern: /"location"[^>]*>([^<]*(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s*[A-Z]{2,3}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*))</i, source: 'structured' as const },
      // Event-specific location patterns (avoid CSS)
      { pattern: /(?:location|venue|where)[^>]*>([^<]*(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s*[A-Z]{2,3}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*))</i, source: 'html' as const },
      // Address patterns
      { pattern: /(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Place|Pl)[^<]*)/i, source: 'html' as const }
    ];
    
    for (const { pattern, source } of patterns) {
      const match = html.match(pattern);
      if (match && match[1].trim().length > 3) {
        const location = match[1].trim();
        if (this.isValidLocation(location)) {
          return location;
        }
      }
    }
    
    return undefined;
  }

  private extractVenue(html: string): string | undefined {
    const patterns = [
      // Microdata
      { pattern: /itemprop="name"[^>]*content="([^"]*venue[^"]*)"/i, source: 'microdata' as const },
      // Venue-specific patterns
      { pattern: /(?:venue|location)[^>]*>([^<]*(?:Center|Centre|Hall|Theater|Theatre|Convention|Hotel|Resort|Arena|Stadium|Auditorium)[^<]*)/i, source: 'html' as const },
      // Common venue names
      { pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Center|Centre|Hall|Theater|Theatre|Convention|Hotel|Resort|Arena|Stadium|Auditorium)))/i, source: 'html' as const }
    ];
    
    for (const { pattern, source } of patterns) {
      const match = html.match(pattern);
      if (match && match[1].trim().length > 3) {
        const venue = match[1].trim();
        if (this.isValidVenue(venue)) {
          return venue;
        }
      }
    }
    
    return undefined;
  }

  private extractSpeakers(html: string): string[] {
    const speakers: string[] = [];
    
    // Speaker-specific patterns
    const patterns = [
      // Speaker lists
      { pattern: /(?:speaker|presenter|keynote)[^>]*>([^<]*(?:[A-Z][a-z]+\s+[A-Z][a-z]+)[^<]*)/gi, source: 'html' as const },
      // Name patterns
      { pattern: /([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s*[,;]\s*|$)/g, source: 'regex' as const }
    ];
    
    for (const { pattern, source } of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const name = match[1].trim();
        if (this.isValidSpeakerName(name) && !speakers.includes(name)) {
          speakers.push(name);
        }
      }
    }
    
    return speakers.slice(0, 10); // Limit to 10 speakers
  }

  private extractAgenda(html: string): string[] {
    const agenda: string[] = [];
    
    // Agenda-specific patterns
    const patterns = [
      // Session titles
      { pattern: /(?:session|track|workshop)[^>]*>([^<]{10,100})<\/[^>]*>/gi, source: 'html' as const },
      // Time-based agenda items
      { pattern: /(\d{1,2}:\d{2}[^<]*[A-Za-z][^<]{10,80})/gi, source: 'html' as const }
    ];
    
    for (const { pattern, source } of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const item = match[1].trim();
        if (this.isValidAgendaItem(item) && !agenda.includes(item)) {
          agenda.push(item);
        }
      }
    }
    
    return agenda.slice(0, 20); // Limit to 20 agenda items
  }

  private calculateConfidence(result: ParseResult): number {
    let confidence = 0;
    if (result.title) confidence += 0.3;
    if (result.description) confidence += 0.2;
    if (result.date) confidence += 0.2;
    if (result.location) confidence += 0.15;
    if (result.venue) confidence += 0.1;
    if (result.speakers && result.speakers.length > 0) confidence += 0.05;
    
    return Math.min(confidence, 1);
  }

  private buildEvidence(result: ParseResult, html: string): Evidence[] {
    const evidence: Evidence[] = [];
    
    Object.entries(result).forEach(([field, value]) => {
      if (value && typeof value === 'string' && field !== 'confidence' && field !== 'parseMethod' && field !== 'parseErrors') {
        evidence.push({
          field,
          value,
          source: 'html',
          quotedText: value,
          confidence: 0.8,
          timestamp: new Date()
        });
      } else if (Array.isArray(value) && value.length > 0) {
        evidence.push({
          field,
          value: value.join(', '),
          source: 'html',
          quotedText: value.join(', '),
          confidence: 0.7,
          timestamp: new Date()
        });
      }
    });
    
    return evidence;
  }

  // Helper validation methods
  private isGenericTitle(title: string): boolean {
    const genericTitles = ['home', 'about', 'contact', 'news', 'blog', 'events', 'conference', 'summit'];
    return genericTitles.some(generic => title.toLowerCase().includes(generic)) && title.length < 20;
  }

  private isGenericDescription(description: string): boolean {
    const genericDescriptions = ['welcome to', 'this is the', 'learn more', 'read more', 'click here'];
    return genericDescriptions.some(generic => description.toLowerCase().includes(generic));
  }

  private isValidDate(dateStr: string): boolean {
    // Basic date validation
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && date.getFullYear() >= 2020 && date.getFullYear() <= 2030;
  }

  private isValidLocation(location: string): boolean {
    // Enhanced location validation to filter out CSS and invalid content
    if (location.length < 3 || location.length > 200) return false;
    if (!/[A-Za-z]/.test(location)) return false;
    if (location.includes('http') || location.includes('www.')) return false;
    
    // Filter out CSS-related content
    if (location.includes('{') || location.includes('}') || location.includes(';')) return false;
    if (location.includes('var(') || location.includes('--wp-') || location.includes('color:')) return false;
    if (location.includes('margin:') || location.includes('padding:') || location.includes('font-')) return false;
    
    // Filter out HTML tags and attributes
    if (location.includes('<') || location.includes('>') || location.includes('class=')) return false;
    
    // Must contain at least one letter and be reasonable length
    return /^[A-Za-z\s,.-]+$/.test(location) && location.trim().length > 3;
  }

  private isValidVenue(venue: string): boolean {
    // Basic venue validation
    return venue.length > 3 && /[A-Za-z]/.test(venue) && !venue.includes('http');
  }

  private isValidSpeakerName(name: string): boolean {
    // Basic speaker name validation
    return name.length > 5 && 
           /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(name) && 
           !name.includes('http') &&
           !name.includes('@') &&
           !name.includes('www');
  }

  private isValidAgendaItem(item: string): boolean {
    // Basic agenda item validation
    return item.length > 10 && 
           item.length < 100 && 
           /[A-Za-z]/.test(item) && 
           !item.includes('http');
  }
}
