import { RetryService } from "./retry-service";
import { GeminiService } from "./gemini-service";

/**
 * Batch Gemini Service
 * 
 * Provides efficient batch processing for Gemini API calls to reduce
 * token usage and improve performance through intelligent batching.
 */

export interface BatchProcessingConfig {
  batchSize: number;
  maxRetries: number;
  delayBetweenBatches: number;
}

export interface BatchResult<T> {
  results: T[];
  stats: {
    totalProcessed: number;
    successfulBatches: number;
    failedBatches: number;
    totalTokensUsed: number;
    processingTime: number;
  };
}

export interface SpeakerExtractionBatch {
  events: Array<{
    id: string;
    title: string;
    description: string;
    starts_at?: string;
    location?: string;
    city?: string;
  }>;
}

export interface SpeakerExtractionResult {
  eventId: string;
  speakers: Array<{
    name: string;
    org: string;
    title: string;
    session_title: string;
    confidence: number;
  }>;
  success: boolean;
  error?: string;
}

export interface UrlPrioritizationBatch {
  searchResults: Array<{
    title: string;
    link: string;
    snippet: string;
  }>;
  searchConfig: any;
  country: string;
}

export interface UrlPrioritizationResult {
  prioritizedUrls: string[];
  reasons: Array<{
    url: string;
    score: number;
    reason: string;
  }>;
  success: boolean;
  error?: string;
}

/**
 * Batch Gemini Service Class
 */
export class BatchGeminiService {
  private static readonly DEFAULT_CONFIG: BatchProcessingConfig = {
    batchSize: 5,
    maxRetries: 2,
    delayBetweenBatches: 1000 // 1 second between batches
  };

  private static readonly OPTIMIZED_PROMPTS = {
    SPEAKER_EXTRACTION: `Extract speakers from events. Return JSON: {"speakers": [{"name": "John Doe", "org": "Company", "title": "CEO", "session_title": "Keynote", "confidence": 0.9}]}`,
    
    URL_PRIORITIZATION: `Prioritize URLs for events in {industry}, {country}. Score 0.9-1.0: direct event pages, 0.7-0.8: event aggregators, 0.5-0.6: company calendars, 0.0-0.4: news/jobs. Exclude: news, jobs, social media. Return top 15 URLs with scores.`,
    
    EVENT_FILTERING: `Filter events in {country}. Keep: conferences, workshops, seminars. Exclude: jobs, news, social. Return: {"decisions": [{"index": 0, "isEvent": true, "reason": "Conference"}]}`
  };

  /**
   * Process events in batches for speaker extraction
   */
  static async processSpeakerExtractionBatch(
    events: Array<{
      id: string;
      title: string;
      description: string;
      starts_at?: string;
      location?: string;
      city?: string;
      speakers?: Array<{
        name: string;
        org: string;
        title: string;
        session_title: string;
        confidence: number;
      }>;
    }>,
    config: Partial<BatchProcessingConfig> = {}
  ): Promise<BatchResult<SpeakerExtractionResult>> {
    const startTime = Date.now();
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    const stats = {
      totalProcessed: 0,
      successfulBatches: 0,
      failedBatches: 0,
      totalTokensUsed: 0,
      processingTime: 0
    };

    const results: SpeakerExtractionResult[] = [];

    // Skip events that already have speakers
    const eventsNeedingProcessing = events.filter(event => 
      !event.speakers || event.speakers.length === 0
    );

    if (eventsNeedingProcessing.length === 0) {
      return {
        results: events.map(event => ({
          eventId: event.id,
          speakers: (event.speakers || []).map(speaker => ({
            name: speaker.name,
            org: speaker.org || '',
            title: speaker.title || '',
            session_title: speaker.session_title || '',
            confidence: speaker.confidence || 0
          })),
          success: true
        })),
        stats: {
          ...stats,
          totalProcessed: events.length,
          processingTime: Date.now() - startTime
        }
      };
    }

    // Process in batches
    const batches = this.chunk(eventsNeedingProcessing, finalConfig.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        console.log(`Processing speaker extraction batch ${i + 1}/${batches.length} with ${batch.length} events`);
        
        const batchResult = await this.processSpeakerBatch(batch);
        results.push(...batchResult);
        stats.successfulBatches++;
        stats.totalProcessed += batch.length;
        
        // Add delay between batches to respect rate limits
        if (i < batches.length - 1) {
          await this.sleep(finalConfig.delayBetweenBatches);
        }
        
      } catch (error: any) {
        console.error(`Speaker extraction batch ${i + 1} failed:`, error.message);
        stats.failedBatches++;
        
        // Add failed results with error information
        const failedResults = batch.map(event => ({
          eventId: event.id,
          speakers: [],
          success: false,
          error: error.message
        }));
        results.push(...failedResults);
        stats.totalProcessed += batch.length;
      }
    }

    // Add events that already had speakers
    const eventsWithSpeakers = events.filter(event => 
      event.speakers && event.speakers.length > 0
    );
    
    for (const event of eventsWithSpeakers) {
      results.push({
        eventId: event.id,
        speakers: event.speakers || [],
        success: true
      });
    }

    stats.processingTime = Date.now() - startTime;

    console.log(`Batch speaker extraction complete: ${stats.successfulBatches}/${batches.length} batches successful, ${stats.totalProcessed} events processed`);

    return { results, stats };
  }

  /**
   * Process a single batch of events for speaker extraction
   */
  private static async processSpeakerBatch(
    events: Array<{
      id: string;
      title: string;
      description: string;
      starts_at?: string;
      location?: string;
      city?: string;
    }>
  ): Promise<SpeakerExtractionResult[]> {
    // Build optimized batch prompt
    const batchPrompt = this.buildSpeakerExtractionBatchPrompt(events);
    
    // Call Gemini API with retry logic
    const response = await RetryService.executeWithRetry(
      "gemini",
      "batch_speaker_extraction",
      async () => {
        return await GeminiService['callGeminiAPI'](batchPrompt);
      }
    );

    // Parse batch response
    const parsed = this.parseSpeakerExtractionBatchResponse(response.data, events);
    
    return parsed;
  }

  /**
   * Build optimized batch prompt for speaker extraction
   */
  private static buildSpeakerExtractionBatchPrompt(
    events: Array<{
      id: string;
      title: string;
      description: string;
      starts_at?: string;
      location?: string;
      city?: string;
    }>
  ): string {
    const eventsData = events.map((event, index) => ({
      id: event.id,
      index,
      title: event.title,
      description: event.description?.substring(0, 500) || '', // Limit description length
      date: event.starts_at,
      location: event.location || event.city
    }));

    return `Extract speakers from these event pages. Look for:
- Speaker names (people presenting, moderating, or speaking)
- Their organizations/companies
- Job titles/roles
- Session titles or topics they're speaking about
- Panelists, moderators, keynote speakers, workshop leaders

IMPORTANT: Look for speakers in various formats:
- "Speaker: John Doe, Acme Inc" (explicit speaker designation)
- "John Doe, Acme Inc" (session owner/presenter, likely a speaker)
- "Bruce Banner, Acme Inc" (in session context, probably a speaker)
- Attendee lists where people are clearly presenting or leading sessions
- Participant directories where roles indicate speaking/presenting

EVENTS:
${JSON.stringify(eventsData, null, 2)}

Return format:
[
  {
    "eventId": "event_id",
    "speakers": [
      {
        "name": "Speaker Name",
        "org": "Organization",
        "title": "Job Title",
        "session_title": "Session Title",
        "confidence": 0.9
      }
    ]
  }
]

Extract speakers even if not explicitly labeled as "Speaker". Use context clues to identify presenters, session owners, and session leaders. If no speakers found, return empty array.`;
  }

  /**
   * Parse batch response for speaker extraction
   */
  private static parseSpeakerExtractionBatchResponse(
    response: any,
    originalEvents: Array<{
      id: string;
      title: string;
      description: string;
      starts_at?: string;
      location?: string;
      city?: string;
    }>
  ): SpeakerExtractionResult[] {
    try {
      const text = response.candidates[0].content.parts[0].text;
      
      // Try multiple JSON extraction methods
      let jsonMatch = text.match(/\[[\s\S]*?\]/);
      
      if (!jsonMatch) {
        // Try to find JSON object instead of array
        jsonMatch = text.match(/\{[\s\S]*?\}/);
      }
      
      if (!jsonMatch) {
        // Try to find JSON with code block markers
        jsonMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
        if (jsonMatch) {
          jsonMatch = [jsonMatch[1]];
        }
      }
      
      if (!jsonMatch) {
        // Try to find JSON object with code block markers
        jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          jsonMatch = [jsonMatch[1]];
        }
      }
      
      if (!jsonMatch) {
        console.warn("No JSON found in Gemini response, returning empty results");
        return originalEvents.map(event => ({
          eventId: event.id,
          speakers: [],
          success: false,
          error: "No JSON found in response"
        }));
      }
      
      // Clean up the JSON string
      let jsonString = jsonMatch[0];
      
      // Remove any trailing text after the JSON
      const lastBrace = jsonString.lastIndexOf('}');
      const lastBracket = jsonString.lastIndexOf(']');
      const endIndex = Math.max(lastBrace, lastBracket);
      
      if (endIndex > 0) {
        jsonString = jsonString.substring(0, endIndex + 1);
      }
      
      // Additional cleanup for common JSON issues
      jsonString = jsonString
        .replace(/,\s*}/g, '}') // Remove trailing commas before closing braces
        .replace(/,\s*]/g, ']') // Remove trailing commas before closing brackets
        .replace(/,\s*$/, '') // Remove trailing commas at end
        .replace(/\n\s*/g, ' ') // Normalize whitespace
        .replace(/\s+/g, ' ') // Normalize multiple spaces
        .trim();
      
      let parsed;
      try {
        parsed = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('Error parsing speaker extraction batch response:', parseError);
        console.error('JSON string that failed to parse:', jsonString);
        throw new Error(`Failed to parse JSON: ${parseError}`);
      }
      
      // Validate and map results
      const results: SpeakerExtractionResult[] = [];
      
      for (const event of originalEvents) {
        const eventResult = parsed.find((r: any) => r.eventId === event.id);
        
        if (eventResult && eventResult.speakers) {
          results.push({
            eventId: event.id,
            speakers: eventResult.speakers,
            success: true
          });
        } else {
          results.push({
            eventId: event.id,
            speakers: [],
            success: true
          });
        }
      }
      
      return results;
      
    } catch (error) {
      console.error("Error parsing speaker extraction batch response:", error);
      
      // Fallback: return empty results for all events
      return originalEvents.map(event => ({
        eventId: event.id,
        speakers: [],
        success: false,
        error: "Failed to parse batch response"
      }));
    }
  }

  /**
   * Process URL prioritization in batches
   */
  static async processUrlPrioritizationBatch(
    searchResults: Array<{
      title: string;
      link: string;
      snippet: string;
    }>,
    searchConfig: any,
    country: string,
    config: Partial<BatchProcessingConfig> = {}
  ): Promise<BatchResult<UrlPrioritizationResult>> {
    const startTime = Date.now();
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    const stats = {
      totalProcessed: 0,
      successfulBatches: 0,
      failedBatches: 0,
      totalTokensUsed: 0,
      processingTime: 0
    };

    const results: UrlPrioritizationResult[] = [];

    // Process in batches
    const batches = this.chunk(searchResults, finalConfig.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        console.log(`Processing URL prioritization batch ${i + 1}/${batches.length} with ${batch.length} URLs`);
        
        const batchResult = await this.processUrlPrioritizationBatchInternal(batch, searchConfig, country);
        results.push(batchResult);
        stats.successfulBatches++;
        stats.totalProcessed += batch.length;
        
        // Add delay between batches
        if (i < batches.length - 1) {
          await this.sleep(finalConfig.delayBetweenBatches);
        }
        
      } catch (error: any) {
        console.error(`URL prioritization batch ${i + 1} failed:`, error.message);
        stats.failedBatches++;
        
        // Add failed result
        results.push({
          prioritizedUrls: batch.slice(0, 5).map(item => item.link), // Fallback: take first 5
          reasons: [],
          success: false,
          error: error.message
        });
        stats.totalProcessed += batch.length;
      }
    }

    stats.processingTime = Date.now() - startTime;

    console.log(`Batch URL prioritization complete: ${stats.successfulBatches}/${batches.length} batches successful, ${stats.totalProcessed} URLs processed`);

    return { results, stats };
  }

  /**
   * Process a single batch of URLs for prioritization
   */
  private static async processUrlPrioritizationBatchInternal(
    urls: Array<{
      title: string;
      link: string;
      snippet: string;
    }>,
    searchConfig: any,
    country: string
  ): Promise<UrlPrioritizationResult> {
    // Build optimized batch prompt
    const batchPrompt = this.buildUrlPrioritizationBatchPrompt(urls, searchConfig, country);
    
    // Call Gemini API
    const response = await RetryService.executeWithRetry(
      "gemini",
      "batch_url_prioritization",
      async () => {
        return await GeminiService['callGeminiAPI'](batchPrompt);
      }
    );

    // Parse batch response
    const parsed = this.parseUrlPrioritizationBatchResponse(response.data, urls);
    
    return parsed;
  }

  /**
   * Build optimized batch prompt for URL prioritization
   */
  private static buildUrlPrioritizationBatchPrompt(
    urls: Array<{
      title: string;
      link: string;
      snippet: string;
    }>,
    searchConfig: any,
    country: string
  ): string {
    const industry = searchConfig?.industry || 'business';
    const countryName = country === 'de' ? 'Germany' : country === 'us' ? 'United States' : country;
    
    const urlsData = urls.map((url, index) => ({
      index,
      title: url.title,
      link: url.link,
      snippet: url.snippet?.substring(0, 200) || '' // Limit snippet length
    }));

    return `You are a professional event curator for ${industry} industry events in ${countryName}.

CONTEXT: We are searching for professional ${industry} events that would be relevant for:
- Legal professionals, compliance officers, general counsel
- Regulatory affairs professionals, risk management experts
- Data protection officers, cybersecurity professionals
- Internal audit teams, investigation specialists
- Legal technology professionals, e-discovery experts

PRIORITIZE URLs that contain:
- Professional conferences, summits, or forums with ${industry} focus
- Regulatory compliance training, workshops, or seminars
- Legal technology conferences, data protection events
- Risk management summits, audit conferences
- Professional development events for legal/compliance teams
- Industry association events, professional networking events
- Events with clear agendas, speaker lists, and professional content

EXCLUDE URLs that are:
- Entertainment events (music, festivals, cultural events, parties)
- Tourism or travel-related events
- Generic event calendars without professional focus
- Company marketing pages or general business websites
- News articles, blog posts, or press releases
- Job postings or recruitment events
- Non-professional recreational activities

URLS:
${JSON.stringify(urlsData, null, 2)}

SCORING CRITERIA:
- Score 0.9-1.0: Professional ${industry} conferences with clear agendas and speakers
- Score 0.7-0.8: Industry-specific training, workshops, or professional events
- Score 0.5-0.6: General business events that might have ${industry} relevance
- Score 0.0-0.4: Entertainment, tourism, or non-professional events

Return JSON:
{
  "prioritizedUrls": ["url1", "url2"],
  "reasons": [
    {
      "url": "url1",
      "score": 0.9,
      "reason": "Professional compliance conference with legal focus"
    }
  ]
}

Return the top 8-12 most promising URLs for event extraction. Focus on professional relevance to ${industry} industry.`;
  }

  /**
   * Parse batch response for URL prioritization
   */
  private static parseUrlPrioritizationBatchResponse(
    response: any,
    originalUrls: Array<{
      title: string;
      link: string;
      snippet: string;
    }>
  ): UrlPrioritizationResult {
    try {
      const text = response.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        prioritizedUrls: parsed.prioritizedUrls || [],
        reasons: parsed.reasons || [],
        success: true
      };
      
    } catch (error) {
      console.error("Error parsing URL prioritization batch response:", error);
      
      // Fallback: return first 5 URLs
      return {
        prioritizedUrls: originalUrls.slice(0, 5).map(item => item.link),
        reasons: [],
        success: false,
        error: "Failed to parse batch response"
      };
    }
  }

  /**
   * Utility function to chunk array into batches
   */
  private static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Utility function to sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get service health status
   */
  static async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    batchProcessingEnabled: boolean;
    lastError?: string;
  }> {
    try {
      // Test with a simple batch operation
      const testEvents = [{
        id: 'test',
        title: 'Test Event',
        description: 'Test description',
        starts_at: '2025-01-01',
        location: 'Test Location'
      }];

      await this.processSpeakerExtractionBatch(testEvents, { batchSize: 1 });
      
      return {
        status: 'healthy',
        batchProcessingEnabled: true
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        batchProcessingEnabled: false,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
