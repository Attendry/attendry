/**
 * Pipeline Fallback Integration
 * 
 * Integration with existing search system and graceful fallback handling
 */

import type { EventCandidate, EventPipelineConfig, PipelineContext, SpeakerInfo } from './types';
import { EventPipeline } from './orchestrator';
import { isNewPipelineEnabled, getPipelineConfig } from './config';
import { logger } from '@/utils/logger';
import { getCountryContext, deriveLocale } from '@/lib/utils/country';
import { buildEffectiveQuery } from '@/search/query';

export class PipelineFallback {
  constructor(
    private newPipeline: EventPipeline,
    private legacySearch: any
  ) {}

  async search(context: PipelineContext): Promise<any> {
    const useNewPipeline = isNewPipelineEnabled();
    
    if (useNewPipeline) {
      try {
        logger.info({ message: '[fallback] Using new pipeline',
          query: context.query,
          country: context.country
        });
        
        const result = await this.newPipeline.process(context);
        return this.convertToLegacyFormat(result, context);
      } catch (error) {
        logger.error({ message: '[fallback] New pipeline failed, returning empty result',
          error: (error as any).message,
          query: context.query,
          country: context.country
        });
        
        // Return empty result instead of falling back to legacy search
        // to avoid Supabase dependency issues
        return {
          events: [],
          provider: 'new_pipeline',
          count: 0,
          pipeline_metrics: {
            totalCandidates: 0,
            prioritizedCandidates: 0,
            parsedCandidates: 0,
            extractedCandidates: 0,
            publishedCandidates: 0,
            rejectedCandidates: 0,
            failedCandidates: 0,
            totalDuration: 0,
            averageConfidence: 0,
            sourceBreakdown: {}
          },
          logs: [{
            stage: 'error',
            message: 'New pipeline failed',
            error: (error as any).message,
            timestamp: new Date().toISOString()
          }]
        };
      }
    } else {
      logger.info({ message: '[fallback] Using legacy search',
        query: context.query,
        country: context.country
      });
      
      return await this.legacySearch(context.query, context.country);
    }
  }

  private convertToLegacyFormat(pipelineResult: {
    candidates: EventCandidate[];
    publishedEvents: any[];
    metrics: any;
    logs: any[];
  }, context?: PipelineContext): any {
    const { candidates, publishedEvents, metrics, logs } = pipelineResult;
    
    // Use published events if available (Phase 3), otherwise convert candidates
    let events;
    
    if (publishedEvents && publishedEvents.length > 0) {
      // Use published events directly (Phase 3)
      events = publishedEvents;
    } else {
      // Fallback to converting candidates (Phase 1 & 2)
      const config = getPipelineConfig();
      const qualityCandidates = candidates.filter(candidate => {
        // Use extractResult if available (Phase 2), otherwise fall back to parseResult
        const result = candidate.extractResult || candidate.parseResult;
        return result && 
               (result.confidence ?? 0.5) >= config.thresholds.confidence &&
               (candidate.status === 'extracted' || candidate.status === 'parsed' || candidate.status === 'discovered');
      });
      
      // Convert to legacy format
      events = qualityCandidates.map(candidate => {
        // Use extractResult if available (Phase 2), otherwise fall back to parseResult
        const result = candidate.extractResult || candidate.parseResult;

        const mapSpeakerToLegacy = (speaker: SpeakerInfo | string): {
          name: string;
          title: string | null;
          org: string | null;
          bio: string | null;
          confidence: number;
        } => {
          if (typeof speaker === 'string') {
            return {
              name: speaker,
              title: null,
              org: null,
              bio: null,
              confidence: 0.5
            };
          }

          const normalizedName = speaker.name?.trim();
          if (!normalizedName) {
            return {
              name: 'Unknown Speaker',
              title: null,
              org: null,
              bio: null,
              confidence: 0.1
            };
          }

          const derivedOrg = speaker.company || (speaker as { org?: string }).org || (speaker as { organization?: string }).organization || null;

          return {
            name: normalizedName,
            title: speaker.title?.trim() || null,
            org: derivedOrg ? derivedOrg.trim() : null,
            bio: null,
            confidence: 0.6
          };
        };

        const rawSpeakers = Array.isArray(result?.speakers) ? (result?.speakers as Array<SpeakerInfo | string>) : [];
        const speakers = rawSpeakers.map(mapSpeakerToLegacy);

        return {
          id: candidate.id,
          title: result?.title || 'Event',
          source_url: candidate.url,
          description: result?.description,
          starts_at: result?.date,
          location: result?.location,
          venue: result?.venue,
          speakers,
          confidence: result?.confidence || 0.5,
          confidence_reason: 'new_pipeline',
          // Additional pipeline metadata
          pipeline_metadata: {
            source: candidate.source,
            priorityScore: candidate.priorityScore,
            parseMethod: result?.parseMethod,
            evidence: result?.evidence?.length || 0,
            processingTime: candidate.metadata.processingTime,
            // Phase 2 specific metadata
            llmEnhanced: candidate.extractResult?.llmEnhanced || false,
            schemaValidated: candidate.extractResult?.schemaValidated || false,
            enhancementNotes: result?.enhancementNotes
          }
        };
      });
    }
    
    // Apply country filtering if target country is specified
    if (context && context.country && context.country !== 'EU') {
      const originalCount = events.length;
      events = events.filter((event: any) => {
        const eventCountry = event.country;
        const eventCity = event.city;
        const eventLocation = event.location;
        const eventUrl = event.source_url;

        // Normalize country codes for comparison (same logic as enhanced orchestrator)
        const normalizeCountryCode = (code: string | null | undefined): string | null => {
          if (!code) return null;
          const upper = code.toUpperCase();
          // Map common country code variations
          if (upper === 'UK') return 'GB';
          if (upper === 'USA' || upper === 'US') return 'US';
          if (upper === 'DEUTSCHLAND') return 'DE';
          return upper;
        };

        const normalizedEventCountry = normalizeCountryCode(eventCountry);
        const normalizedTargetCountry = normalizeCountryCode(context.country);

        const matchesTarget = normalizedEventCountry === normalizedTargetCountry;
        const mentionsTarget = context.country ? eventLocation?.toLowerCase().includes(context.country.toLowerCase()) ?? false : false;
        const urlSuggestsTarget = context.country ? (eventUrl.toLowerCase().includes('.' + context.country.toLowerCase()) ||
          eventUrl.toLowerCase().includes('germany') ||
          eventUrl.toLowerCase().includes('deutschland') ||
          (context.country.toLowerCase() === 'gb' && (eventUrl.toLowerCase().includes('uk') || eventUrl.toLowerCase().includes('britain')))) : false;

        const hasCity = Boolean(eventCity);
        const europeanHint = (event.description?.toLowerCase().includes('europe') || event.title?.toLowerCase().includes('europe') || eventUrl.toLowerCase().includes('european'));

        // Additional checks for US events that should be rejected for German searches
        const isUSEvent = normalizedEventCountry === 'US' || 
          eventUrl.toLowerCase().includes('.us/') ||
          eventUrl.toLowerCase().includes('united-states') ||
          eventUrl.toLowerCase().includes('usa') ||
          eventLocation?.toLowerCase().includes('united states') ||
          eventLocation?.toLowerCase().includes('usa') ||
          eventLocation?.toLowerCase().includes('america');

        const isUKEvent = normalizedEventCountry === 'GB' || 
          eventUrl.toLowerCase().includes('.uk/') ||
          eventUrl.toLowerCase().includes('united-kingdom') ||
          eventLocation?.toLowerCase().includes('united kingdom') ||
          eventLocation?.toLowerCase().includes('england') ||
          eventLocation?.toLowerCase().includes('scotland') ||
          eventLocation?.toLowerCase().includes('wales');

        // For German searches, explicitly reject US and UK events unless they explicitly mention Germany
        if (context.country && context.country.toUpperCase() === 'DE') {
          if (isUSEvent && !mentionsTarget && !urlSuggestsTarget) {
          logger.info({ message: '[fallback] Filtering out US event for German search', 
            url: eventUrl, 
            eventCountry, 
            eventLocation 
          });
            return false;
          }
          if (isUKEvent && !mentionsTarget && !urlSuggestsTarget) {
            logger.info({ message: '[fallback] Filtering out UK event for German search', 
              url: eventUrl, 
              eventCountry, 
              eventLocation 
            });
            return false;
          }
        }

        // For other country searches, apply general country matching
        if (!matchesTarget && !mentionsTarget && !urlSuggestsTarget && !europeanHint) {
          logger.info({ message: '[fallback] Filtering out event not matching target country', 
            url: eventUrl, 
            eventCountry, 
            targetCountry: context.country,
            eventLocation 
          });
          return false;
        }

        return true;
      });
      
      if (originalCount !== events.length) {
        logger.info({ message: '[fallback] Country filtering applied', 
          originalCount, 
          filteredCount: events.length,
          targetCountry: context.country
        });
      }
    }

    // Apply date filtering if dateFrom/dateTo are provided
    if (context && (context.dateFrom || context.dateTo)) {
      const originalCount = events.length;
      const today = new Date();
      const dateFrom = context.dateFrom ? new Date(context.dateFrom) : new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const dateTo = context.dateTo ? new Date(context.dateTo) : new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
      
      events = events.filter((event: any) => {
        const eventDate = event.starts_at;
        if (!eventDate) return true; // Keep events without dates
        
        const eventDateObj = new Date(eventDate);
        if (isNaN(eventDateObj.getTime())) return true; // Keep events with invalid dates
        
        // More lenient date filtering - allow events within a reasonable range
        if (eventDateObj < dateFrom) {
          // Only filter out events that are more than 6 months old
          const sixMonthsAgo = new Date(today.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
          if (eventDateObj < sixMonthsAgo) {
            logger.info({ message: '[fallback] Filtering out event before date range', 
              url: event.source_url, 
              eventDate, 
              dateFrom: context.dateFrom 
            });
            return false;
          }
        }
        if (eventDateObj > dateTo) {
          // Only filter out events that are more than 2 years in the future
          const twoYearsFromNow = new Date(today.getTime() + 2 * 365 * 24 * 60 * 60 * 1000);
          if (eventDateObj > twoYearsFromNow) {
            logger.info({ message: '[fallback] Filtering out event after date range', 
              url: event.source_url, 
              eventDate, 
              dateTo: context.dateTo 
            });
            return false;
          }
        }
        return true;
      });
      
      if (originalCount !== events.length) {
        logger.info({ message: '[fallback] Date filtering applied', 
          originalCount, 
          filteredCount: events.length,
          dateFrom: context.dateFrom,
          dateTo: context.dateTo
        });
      }
    }
    
    return {
      events,
      provider: 'new_pipeline',
      count: events.length,
      pipeline_metrics: {
        totalCandidates: metrics.totalCandidates,
        prioritizedCandidates: metrics.prioritizedCandidates,
        parsedCandidates: metrics.parsedCandidates,
        extractedCandidates: metrics.extractedCandidates,
        publishedCandidates: metrics.publishedCandidates,
        averageConfidence: metrics.averageConfidence,
        sourceBreakdown: metrics.sourceBreakdown
      },
      logs: logs.map(log => ({
        stage: log.stage,
        duration: log.duration,
        timestamp: log.timestamp,
        ...log
      }))
    };
  }
}

// Factory function to create pipeline with fallback
export async function createPipelineWithFallback(): Promise<PipelineFallback> {
  const config = getPipelineConfig();
  
  // Import services dynamically to avoid circular dependencies
  const { cseSearch } = await import('@/services/search/cseService');
  const { firecrawlSearch } = await import('@/services/search/firecrawlService');

  // Create Gemini service wrapper that provides generateContent method
  const geminiServiceWrapper = {
    generateContent: async (prompt: string): Promise<string> => {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY not configured");
      }

      const modelPath = process.env.GEMINI_MODEL_PATH || 'v1beta/models/gemini-2.0-flash:generateContent';
      const response = await fetch(`https://generativelanguage.googleapis.com/${modelPath}?key=${apiKey}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API failed: ${response.status} ${response.statusText}`);
      }

      const rawText = await response.text();
      const data = JSON.parse(rawText) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error("No content in Gemini response");
      }
      
      // Extract JSON from markdown if present
      let jsonContent = content.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      return jsonContent;
    }
  };

  // Create new pipeline
  const newPipeline = new EventPipeline(
    config,
    {
      search: async ({ q, country, limit, countryContext }: { q: string; country: string | null; limit?: number; countryContext?: ReturnType<typeof getCountryContext> | null }) =>
        cseSearch({
          baseQuery: q,
          userText: q,
          countryContext: countryContext ?? (country ? getCountryContext(country) : undefined),
          locale: countryContext?.locale,
          num: limit,
        }).then((res) => ({
          items: res.items.map((item: any) => ({
            url: item.url,
            title: item.title,
            description: item.snippet,
          })),
        }))
    },
    {
      search: async ({ q, country, limit, countryContext }: { q: string; country: string | null; limit?: number; countryContext?: ReturnType<typeof getCountryContext> | null }) =>
        firecrawlSearch({
          baseQuery: q,
          userText: '', // Don't duplicate the query
          countryContext: countryContext ?? (country ? getCountryContext(country) : undefined),
          locale: countryContext?.locale,
          location: countryContext?.countryNames?.[0],
          limit,
        }).then((res) => ({
          items: res.items.map((item: any) => ({
            url: item.url,
            title: item.title,
            description: item.snippet,
          })),
        }))
    },
    geminiServiceWrapper
  );
  
  // Create legacy search wrapper
  const legacySearch = async (query: string, country: string) => {
    // Import and use existing enhanced orchestrator as fallback
    const { executeEnhancedSearch } = await import('@/common/search/enhanced-orchestrator');
    return await executeEnhancedSearch({
      userText: query,
      country,
      dateFrom: null,
      dateTo: null,
      locale: 'de'
    });
  };
  
  return new PipelineFallback(newPipeline, legacySearch);
}

// Country-specific bias is now handled by the CountryContext system in the query builder

// Old country-specific bias configuration removed - now handled by CountryContext system

// Main entry point for the new pipeline
export async function executeNewPipeline(args: {
  userText: string;
  country: string | null;
  dateFrom?: string;
  dateTo?: string;
  locale?: string;
}): Promise<any> {
  const pipelineWithFallback = await createPipelineWithFallback();
  
  // Build query using the same logic as enhanced orchestrator
  const ctx = getCountryContext(args.country);
  let baseQuery = args.userText && args.userText.trim() ? args.userText.trim() : '';

  if (!baseQuery) {
    try {
      const { loadActiveConfig } = await import('@/common/search/config');
      const cfg = await loadActiveConfig();
      baseQuery = cfg.baseQuery;
      logger.info({ message: '[executeNewPipeline] Using baseQuery for empty userText', baseQuery: baseQuery.substring(0, 100) + '...' });
    } catch (error) {
      logger.warn({ message: '[executeNewPipeline] Failed to load config, using fallback query', error: (error as any).message });
      baseQuery = 'legal compliance conference event summit workshop';
    }
  }

  const finalQuery = buildEffectiveQuery({ baseQuery, userText: args.userText, countryContext: ctx });
  const context: PipelineContext = {
    query: finalQuery,
    country: args.country,
    dateFrom: args.dateFrom,
    dateTo: args.dateTo,
    locale: args.locale || 'de',
    startTime: new Date(),
    config: getPipelineConfig(),
    countryContext: ctx
  };
  
  return await pipelineWithFallback.search(context);
}
