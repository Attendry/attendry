/**
 * Enhanced Search Service - Main Orchestrator
 * 
 * This module orchestrates the entire enhanced search pipeline for legal events,
 * combining query building, multi-strategy search, Gemini processing, and result filtering.
 */

import { buildEnhancedQuery, QueryTier } from './enhanced-query-builder';
import { runMultiStrategySearch, SearchResult, SearchTrace } from './multi-strategy-search';
import { EnhancedGeminiService, RankingResponse, SpeakersResponse } from './enhanced-gemini-service';
import { EnhancedFirecrawlService } from './enhanced-firecrawl-service';
import { inferCountryAndDate } from '@/lib/utils/country-date-inference';
import { SEARCH_THRESHOLDS } from '@/config/search-legal-de';
import { ensureCorrelation } from '@/lib/obs/corr';
import { stageCounter, logSuppressedSamples, type Reason } from '@/lib/obs/triage-metrics';

export interface EnhancedSearchConfig {
  baseQuery: string;
  fromISO: string;
  toISO: string;
  country?: string;
  allowUndated?: boolean;
  maxResults?: number;
}

export interface EnhancedSearchResult {
  events: Array<{
    url: string;
    title: string;
    snippet?: string;
    dateISO?: string;
    country: string;
    legalConfidence: number;
    eventConfidence: number;
    speakers?: Array<{
      name: string;
      title?: string;
      company?: string;
      talkTitle?: string;
    }>;
  }>;
  trace: EnhancedSearchTrace;
}

export interface EnhancedSearchTrace extends SearchTrace {
  prioritization: {
    model: string;
    repairUsed: boolean;
    stats: any;
  };
  extract: {
    stats: {
      polledAttempts: number;
      timedOut: number;
      batchSize: number;
      successful: number;
      failed: number;
    };
  };
  filtering: {
    countryDate: {
      before: number;
      after: number;
      reasons: string[];
    };
  };
}

/**
 * Enhanced Search Service - Main orchestrator
 */
export class EnhancedSearchService {
  private geminiService: EnhancedGeminiService;
  private firecrawlService: EnhancedFirecrawlService;

  constructor(geminiApiKey: string, firecrawlApiKey: string) {
    this.geminiService = new EnhancedGeminiService(geminiApiKey);
    this.firecrawlService = new EnhancedFirecrawlService(firecrawlApiKey);
  }

  /**
   * Main search method that orchestrates the entire pipeline
   */
  async search(config: EnhancedSearchConfig): Promise<EnhancedSearchResult> {
    const correlationId = ensureCorrelation();
    console.log(JSON.stringify({ correlationId, at: 'enhanced_search_start', config }));

    const trace: EnhancedSearchTrace = {
      finalQueries: [],
      urls: { checked: 0, kept: 0, filtered: [] },
      tiers: {},
      filters: { reasons: [] },
      prioritization: {
        model: 'gemini-1.5-flash',
        repairUsed: false,
        stats: {}
      },
      extract: {
        stats: {
          polledAttempts: 0,
          timedOut: 0,
          batchSize: SEARCH_THRESHOLDS.MAX_BATCH_SIZE,
          successful: 0,
          failed: 0
        }
      },
      filtering: {
        countryDate: {
          before: 0,
          after: 0,
          reasons: []
        }
      }
    };

    try {
      // Step 1: Build enhanced queries
      const finalQueries = buildEnhancedQuery(config);
      trace.finalQueries = finalQueries.map(q => ({ 
        name: q.name, 
        query: q.query, 
        length: q.query.length 
      }));

      // Step 2: Run multi-strategy search
      const searchResults = await runMultiStrategySearch(finalQueries, {
        fromISO: config.fromISO,
        toISO: config.toISO,
        country: config.country,
        maxResults: config.maxResults
      });

      // Merge search trace
      Object.assign(trace, searchResults.trace);

      // Allow pipeline to proceed even when search results are empty so the caller can evaluate fallback behaviour.

      // Step 3: Prioritize URLs with Gemini
      const prioritizationResult = await this.geminiService.prioritizeUrls(
        searchResults.results.map(r => ({ url: r.url, title: r.title, snippet: r.snippet }))
      );
      stageCounter('prioritization', searchResults.results, prioritizationResult.prioritizedUrls, [{ key: 'prioritized', count: prioritizationResult.prioritizedUrls.length, samples: prioritizationResult.prioritizedUrls.slice(0,3) }]);

      trace.prioritization.repairUsed = prioritizationResult.repairUsed;
      trace.prioritization.stats = prioritizationResult.prioritizationStats;

      // Step 4: Extract content from prioritized URLs
      const extractResults = await this.firecrawlService.extractContent(
        prioritizationResult.prioritizedUrls.slice(0, 20) // Limit to top 20
      );

      // Update extract stats
      for (const [url, result] of extractResults) {
        trace.extract.stats.polledAttempts += result.polledAttempts;
        if (result.timedOut) trace.extract.stats.timedOut++;
        if (result.success) trace.extract.stats.successful++;
        else trace.extract.stats.failed++;
      }

      // Step 5: Process extracted content
      const processedEvents = await this.processExtractedContent(
        extractResults,
        config,
        trace
      );

      // Step 6: Apply final relevance guardrails
      const finalEvents = this.applyRelevanceGuardrails(processedEvents, trace);

      stageCounter('final_events', processedEvents, finalEvents, [{ key: 'kept', count: finalEvents.length, samples: finalEvents.slice(0,3) }]);

      console.log('Enhanced search completed:', {
        totalEvents: finalEvents.length,
        trace: {
          queries: trace.finalQueries.length,
          urlsChecked: trace.urls.checked,
          urlsKept: trace.urls.kept,
          prioritizationRepairUsed: trace.prioritization.repairUsed,
          extractStats: trace.extract.stats
        }
      });

      return { events: finalEvents, trace };

    } catch (error) {
      console.error('Enhanced search failed:', error);
      throw error;
    }
  }

  /**
   * Processes extracted content and extracts speakers
   */
  private async processExtractedContent(
    extractResults: Map<string, any>,
    config: EnhancedSearchConfig,
    trace: EnhancedSearchTrace
  ): Promise<any[]> {
    const processedEvents: any[] = [];

    for (const [url, extractResult] of extractResults) {
      if (!extractResult.success || !extractResult.content) {
        continue;
      }

      try {
        // Infer country and date
        const countryDateResult = inferCountryAndDate(
          url,
          extractResult.content,
          config.fromISO,
          config.toISO,
          config.allowUndated
        );

        trace.filtering.countryDate.before++;
        
        if (countryDateResult.confidence < 0.5) {
          trace.filtering.countryDate.reasons.push(`Low confidence for ${url}: ${countryDateResult.confidence}`);
          continue;
        }

        if (countryDateResult.country !== 'DE' && config.country === 'DE') {
          trace.filtering.countryDate.reasons.push(`Non-German country for ${url}: ${countryDateResult.country}`);
          continue;
        }

        trace.filtering.countryDate.after++;

        // Extract speakers
        const speakerResult = await this.geminiService.extractSpeakers(
          url,
          extractResult.content
        );

        // Create event object
        const event = {
          url,
          title: this.extractTitle(extractResult.content),
          snippet: this.extractSnippet(extractResult.content),
          dateISO: countryDateResult.dateISO,
          country: countryDateResult.country,
          legalConfidence: 0.7, // Default, could be improved with better analysis
          eventConfidence: 0.8, // Default, could be improved with better analysis
          speakers: speakerResult.speakers.map(s => ({
            name: s.name,
            title: s.title,
            company: s.company,
            talkTitle: s.talkTitle
          }))
        };

        processedEvents.push(event);

      } catch (error) {
        console.error(`Error processing ${url}:`, error);
        trace.extract.stats.failed++;
      }
    }

    return processedEvents;
  }

  /**
   * Applies final relevance guardrails
   */
  private applyRelevanceGuardrails(events: any[], trace: EnhancedSearchTrace): any[] {
    const filtered = events
      .filter(event => {
      // Check confidence thresholds
      if (event.eventConfidence < SEARCH_THRESHOLDS.MIN_EVENT_CONFIDENCE) {
        trace.filters.reasons.push(`Low event confidence: ${event.eventConfidence}`);
        return false;
      }

      if (event.legalConfidence < SEARCH_THRESHOLDS.MIN_LEGAL_CONFIDENCE) {
        trace.filters.reasons.push(`Low legal confidence: ${event.legalConfidence}`);
        return false;
      }

        return true;
      })
      .sort((a, b) => (b.eventConfidence + b.legalConfidence) - (a.eventConfidence + a.legalConfidence));

    return filtered;
  }

  /**
   * Extracts title from content
   */
  private extractTitle(content: string): string {
    // Try to find H1 tag
    const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (h1Match) {
      return h1Match[1].replace(/<[^>]*>/g, '').trim();
    }

    // Try to find title tag
    const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) {
      return titleMatch[1].replace(/<[^>]*>/g, '').trim();
    }

    // Fallback to first line
    const firstLine = content.split('\n')[0];
    return firstLine.replace(/<[^>]*>/g, '').trim().substring(0, 100);
  }

  /**
   * Extracts snippet from content
   */
  private extractSnippet(content: string): string {
    // Try to find meta description
    const metaMatch = content.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    if (metaMatch) {
      return metaMatch[1].trim();
    }

    // Fallback to first paragraph
    const pMatch = content.match(/<p[^>]*>(.*?)<\/p>/i);
    if (pMatch) {
      return pMatch[1].replace(/<[^>]*>/g, '').trim().substring(0, 200);
    }

    // Fallback to first 200 chars
    return content.replace(/<[^>]*>/g, '').trim().substring(0, 200);
  }
}
