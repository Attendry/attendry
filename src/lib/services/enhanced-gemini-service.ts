/**
 * Enhanced Gemini Service with Strict JSON
 * 
 * This module provides enhanced Gemini integration with strict JSON responses,
 * robust parsing, and improved error handling for legal events processing.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { safeParseJson, logParseAttempt } from '@/lib/utils/json-parser';

// Type definitions for strict JSON responses
export interface RankedItem {
  url: string;
  title: string;
  reason: string;
  legalConfidence: number;   // 0..1
  eventConfidence: number;   // 0..1
  country: 'DE' | 'AT' | 'CH' | 'OTHER';
  dateISO?: string;          // YYYY-MM-DD if detected
}

export interface RankingResponse {
  version: '1.0';
  items: RankedItem[];
}

export interface Speaker {
  name: string;
  title?: string;
  company?: string;
  talkTitle?: string;
  talkTrack?: string;
  talkDateISO?: string;
  profileUrl?: string;
}

export interface SpeakersResponse {
  version: '1.0';
  url: string;
  speakers: Speaker[];
}

export interface PrioritizationOptions {
  maxRetries?: number;
  chunkSize?: number;
}

export interface SpeakerExtractionOptions {
  maxRetries?: number;
  chunkSize?: number;
}

/**
 * Enhanced Gemini service with strict JSON responses
 */
export class EnhancedGeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 4096,
      }
    });
  }

  /**
   * Prioritizes URLs with strict JSON response
   */
  async prioritizeUrls(
    urls: Array<{ url: string; title: string; snippet?: string }>,
    options: PrioritizationOptions = {}
  ): Promise<{ prioritizedUrls: string[]; prioritizationStats: any; repairUsed: boolean }> {
    const { maxRetries = 2, chunkSize = 8 } = options;
    let repairUsed = false;

    // Chunk URLs to avoid token limits
    const chunks = this.chunkArray(urls, chunkSize);
    const allRankedItems: RankedItem[] = [];

    for (const chunk of chunks) {
      let attempts = 0;
      let success = false;

      while (attempts < maxRetries && !success) {
        try {
          const prompt = this.buildPrioritizationPrompt(chunk);
          const result = await this.model.generateContent(prompt);
          const responseText = result.response.text();

          // Try to parse JSON
          const parsed = safeParseJson<RankingResponse>(responseText);
          if (parsed && parsed.version === '1.0' && Array.isArray(parsed.items)) {
            allRankedItems.push(...parsed.items);
            success = true;
            logParseAttempt(responseText, parsed, 'direct');
          } else {
            // Try repair path
            const repaired = this.repairJsonResponse(responseText);
            const repairedParsed = safeParseJson<RankingResponse>(repaired);
            if (repairedParsed && repairedParsed.version === '1.0' && Array.isArray(repairedParsed.items)) {
              allRankedItems.push(...repairedParsed.items);
              success = true;
              repairUsed = true;
              logParseAttempt(responseText, repairedParsed, 'repair');
            }
          }

          if (!success) {
            attempts++;
            if (attempts < maxRetries) {
              console.warn(`Prioritization attempt ${attempts} failed, retrying...`);
              await this.delay(1000 * attempts); // Exponential backoff
            }
          }

        } catch (error) {
          console.error('Error in prioritization:', error);
          attempts++;
          if (attempts < maxRetries) {
            await this.delay(1000 * attempts);
          }
        }
      }

      if (!success) {
        console.error(`Failed to prioritize chunk after ${maxRetries} attempts`);
        // Fallback to direct heuristics
        const fallbackItems = this.createFallbackRankings(chunk);
        allRankedItems.push(...fallbackItems);
      }
    }

    // Filter and sort results
    const filteredItems = allRankedItems.filter(item => 
      item.eventConfidence >= 0.6 && 
      item.legalConfidence >= 0.5 && 
      item.country === 'DE'
    );

    const sortedItems = filteredItems.sort((a, b) => 
      (b.eventConfidence + b.legalConfidence) - (a.eventConfidence + a.legalConfidence)
    );

    const prioritizedUrls = sortedItems.map(item => item.url);

    const prioritizationStats = {
      total: urls.length,
      prioritized: prioritizedUrls.length,
      reasons: sortedItems.map(item => item.reason)
    };

    return { prioritizedUrls, prioritizationStats, repairUsed };
  }

  /**
   * Extracts speakers with strict JSON response
   */
  async extractSpeakers(
    url: string,
    content: string,
    options: SpeakerExtractionOptions = {}
  ): Promise<{ speakers: Speaker[]; repairUsed: boolean }> {
    const { maxRetries = 2, chunkSize = 12000 } = options;
    let repairUsed = false;

    // Chunk content if too large
    const contentChunks = this.chunkContent(content, chunkSize);
    const allSpeakers: Speaker[] = [];

    for (const chunk of contentChunks) {
      let attempts = 0;
      let success = false;

      while (attempts < maxRetries && !success) {
        try {
          const prompt = this.buildSpeakerExtractionPrompt(url, chunk);
          const result = await this.model.generateContent(prompt);
          const responseText = result.response.text();

          // Try to parse JSON
          const parsed = safeParseJson<SpeakersResponse>(responseText);
          if (parsed && parsed.version === '1.0' && Array.isArray(parsed.speakers)) {
            allSpeakers.push(...parsed.speakers);
            success = true;
            logParseAttempt(responseText, parsed, 'direct');
          } else {
            // Try repair path
            const repaired = this.repairJsonResponse(responseText);
            const repairedParsed = safeParseJson<SpeakersResponse>(repaired);
            if (repairedParsed && repairedParsed.version === '1.0' && Array.isArray(repairedParsed.speakers)) {
              allSpeakers.push(...repairedParsed.speakers);
              success = true;
              repairUsed = true;
              logParseAttempt(responseText, repairedParsed, 'repair');
            }
          }

          if (!success) {
            attempts++;
            if (attempts < maxRetries) {
              console.warn(`Speaker extraction attempt ${attempts} failed, retrying...`);
              await this.delay(1000 * attempts);
            }
          }

        } catch (error) {
          console.error('Error in speaker extraction:', error);
          attempts++;
          if (attempts < maxRetries) {
            await this.delay(1000 * attempts);
          }
        }
      }

      if (!success) {
        console.error(`Failed to extract speakers from chunk after ${maxRetries} attempts`);
      }
    }

    // Deduplicate speakers
    const uniqueSpeakers = this.deduplicateSpeakers(allSpeakers);

    return { speakers: uniqueSpeakers, repairUsed };
  }

  /**
   * Builds prioritization prompt
   */
  private buildPrioritizationPrompt(urls: Array<{ url: string; title: string; snippet?: string }>): string {
    const urlList = urls.map(u => `URL: ${u.url}\nTitle: ${u.title}\nSnippet: ${u.snippet || 'N/A'}`).join('\n\n');

    return `You are ranking potential LEGAL/COMPLIANCE EVENTS in Germany for enterprise legal teams.
Return ONLY JSON matching the schema.

Rules:
- Prefer Germany (DE). Exclude general news, finance-deal roundups, tourism, student bulletins.
- Event signals: words like Veranstaltung, Konferenz, Kongress, Tagung, Seminar, Workshop, Forum, Summit, Symposium, Fortbildung.
- Legal signals: Compliance, Datenschutz/DSGVO, eDiscovery/E-Discovery, Interne Untersuchung, Geldwäsche/AML, Whistleblowing, Legal Operations, Wirtschaftsstrafrecht.
- Extract an event date if present (convert to YYYY-MM-DD). If multiple dates, pick the start date.
- country must be 'DE' unless the page clearly indicates AT or CH; otherwise 'OTHER'.

Return JSON only, no markdown, no prose:
{"version":"1.0","items":[...]}

URLs to rank:
${urlList}`;
  }

  /**
   * Builds speaker extraction prompt
   */
  private buildSpeakerExtractionPrompt(url: string, content: string): string {
    return `Extract speakers from the provided HTML/text for a legal/compliance event. Return ONLY JSON per schema.
Normalize dates to YYYY-MM-DD; if month names are German, parse correctly. Omit duplicates.

Return JSON only, no markdown, no prose:
{"version":"1.0","url":"${url}","speakers":[...]}

Content:
${content}`;
  }

  /**
   * Repairs common JSON issues
   */
  private repairJsonResponse(input: string): string {
    let repaired = input.trim();
    
    // Remove markdown code blocks
    repaired = repaired.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    repaired = repaired.replace(/^```\s*/, '').replace(/\s*```$/, '');
    
    // Fix common issues
    repaired = repaired
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
      .replace(/'/g, '"')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    
    return repaired;
  }

  /**
   * Creates fallback rankings using heuristics
   */
  private createFallbackRankings(urls: Array<{ url: string; title: string; snippet?: string }>): RankedItem[] {
    return urls.map(({ url, title, snippet }) => {
      const content = `${title} ${snippet || ''}`.toLowerCase();
      
      // Heuristic scoring
      let eventConfidence = 0.3;
      let legalConfidence = 0.3;
      
      // Event signals
      if (content.includes('konferenz') || content.includes('tagung') || content.includes('seminar')) {
        eventConfidence += 0.4;
      }
      
      // Legal signals
      if (content.includes('compliance') || content.includes('datenschutz') || content.includes('dsgvo')) {
        legalConfidence += 0.4;
      }
      
      return {
        url,
        title,
        reason: 'heuristic fallback',
        legalConfidence: Math.min(legalConfidence, 1),
        eventConfidence: Math.min(eventConfidence, 1),
        country: 'DE' as const
      };
    });
  }

  /**
   * Deduplicates speakers by name
   */
  private deduplicateSpeakers(speakers: Speaker[]): Speaker[] {
    const seen = new Set<string>();
    return speakers.filter(speaker => {
      const key = speaker.name.toLowerCase().trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Chunks content for processing
   */
  private chunkContent(content: string, maxSize: number): string[] {
    if (content.length <= maxSize) {
      return [content];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < content.length) {
      let end = start + maxSize;
      
      // Try to break at a reasonable point
      if (end < content.length) {
        const breakPoint = content.lastIndexOf('\n', end);
        if (breakPoint > start + maxSize * 0.8) {
          end = breakPoint;
        }
      }

      chunks.push(content.slice(start, end));
      start = end;
    }

    return chunks;
  }

  /**
   * Utility to chunk arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
