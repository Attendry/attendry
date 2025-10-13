/**
 * Pipeline Fallback Integration
 * 
 * Integration with existing search system and graceful fallback handling
 */

import { EventCandidate, EventPipelineConfig, PipelineContext, SpeakerInfo } from './types';
import { EventPipeline } from './orchestrator';
import { isNewPipelineEnabled, getPipelineConfig } from './config';
import { logger } from '@/utils/logger';

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
               result.confidence >= config.thresholds.confidence &&
               (candidate.status === 'extracted' || candidate.status === 'parsed');
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
      events = events.filter((event: any) => {
        const eventDate = event.starts_at;
        if (!eventDate) return true; // Keep events without dates
        
        if (context.dateFrom && eventDate < context.dateFrom) {
          logger.info({ message: '[fallback] Filtering out event before date range', 
            url: event.source_url, 
            eventDate, 
            dateFrom: context.dateFrom 
          });
          return false;
        }
        if (context.dateTo && eventDate > context.dateTo) {
          logger.info({ message: '[fallback] Filtering out event after date range', 
            url: event.source_url, 
            eventDate, 
            dateTo: context.dateTo 
          });
          return false;
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
  const { GeminiService } = await import('@/lib/services/gemini-service');
  
  // Create service wrappers that match the DiscoveryService interface
  const cseService = {
    search: async (params: { q: string; country: string | null; limit?: number }) => {
      const result = await cseSearch({ 
        baseQuery: params.q, 
        userText: params.q, 
        crCountry: params.country ? `country${params.country}` : undefined 
      });
      return {
        items: result.items.map((item: any) => ({
          url: item.url,
          title: item.title,
          description: item.snippet
        }))
      };
    }
  };
  
  const firecrawlService = {
    search: async (params: { q: string; country: string | null; limit?: number }) => {
      const result = await firecrawlSearch({ 
        baseQuery: params.q, 
        userText: params.q, 
        location: params.country || undefined 
      });
      return {
        items: result.items.map((item: any) => ({
          url: item.url,
          title: item.title,
          description: item.snippet
        }))
      };
    }
  };
  
  const geminiService = {
    generateContent: async (prompt: string) => {
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
    cseService,
    firecrawlService,
    geminiService
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

// Helper function to add country-specific search bias
function addCountrySpecificBias(query: string, country: string): string {
  const countryBias = getCountrySpecificBias(country);
  if (!countryBias) return query;
  
  // Add country-specific terms to the query
  const enhancedQuery = `${query} ${countryBias.searchTerms}`;
  
  // Add location context if available
  if (countryBias.locationContext) {
    return `${enhancedQuery} ${countryBias.locationContext}`;
  }
  
  return enhancedQuery;
}

// Country-specific bias configuration
function getCountrySpecificBias(country: string): { searchTerms: string; locationContext?: string } | null {
  const countryUpper = country.toUpperCase();
  
  const biasConfig: Record<string, { searchTerms: string; locationContext?: string }> = {
    'DE': {
      searchTerms: 'Germany Deutschland Berlin Munich Frankfurt Hamburg Cologne Stuttgart Düsseldorf Leipzig',
      locationContext: 'site:.de OR "in Germany" OR "in Deutschland"'
    },
    'FR': {
      searchTerms: 'France Paris Lyon Marseille Toulouse Nice Nantes',
      locationContext: 'site:.fr OR "in France" OR "en France"'
    },
    'GB': {
      searchTerms: 'United Kingdom UK England Scotland Wales London Manchester Birmingham Glasgow Edinburgh',
      locationContext: 'site:.uk OR "in UK" OR "in United Kingdom" OR "in England"'
    },
    'ES': {
      searchTerms: 'Spain España Madrid Barcelona Valencia Seville Bilbao',
      locationContext: 'site:.es OR "in Spain" OR "en España"'
    },
    'IT': {
      searchTerms: 'Italy Italia Rome Milan Naples Turin Florence Venice',
      locationContext: 'site:.it OR "in Italy" OR "in Italia"'
    },
    'NL': {
      searchTerms: 'Netherlands Nederland Amsterdam Rotterdam The Hague Utrecht',
      locationContext: 'site:.nl OR "in Netherlands" OR "in Nederland"'
    },
    'AT': {
      searchTerms: 'Austria Österreich Vienna Wien Salzburg Innsbruck Graz',
      locationContext: 'site:.at OR "in Austria" OR "in Österreich"'
    },
    'CH': {
      searchTerms: 'Switzerland Schweiz Zurich Geneva Basel Bern Lausanne',
      locationContext: 'site:.ch OR "in Switzerland" OR "in Schweiz"'
    },
    'BE': {
      searchTerms: 'Belgium Belgique Brussels Bruxelles Antwerp Ghent Bruges',
      locationContext: 'site:.be OR "in Belgium" OR "in Belgique"'
    },
    'DK': {
      searchTerms: 'Denmark Danmark Copenhagen København Aarhus Odense',
      locationContext: 'site:.dk OR "in Denmark" OR "i Danmark"'
    },
    'SE': {
      searchTerms: 'Sweden Sverige Stockholm Gothenburg Göteborg Malmö',
      locationContext: 'site:.se OR "in Sweden" OR "i Sverige"'
    },
    'NO': {
      searchTerms: 'Norway Norge Oslo Bergen Trondheim',
      locationContext: 'site:.no OR "in Norway" OR "i Norge"'
    },
    'FI': {
      searchTerms: 'Finland Suomi Helsinki Tampere Turku',
      locationContext: 'site:.fi OR "in Finland" OR "Suomessa"'
    },
    'PL': {
      searchTerms: 'Poland Polska Warsaw Warszawa Krakow Gdansk Wroclaw',
      locationContext: 'site:.pl OR "in Poland" OR "w Polsce"'
    },
    'CZ': {
      searchTerms: 'Czech Republic Czechia Praha Prague Brno Ostrava',
      locationContext: 'site:.cz OR "in Czech Republic" OR "v České republice"'
    },
    'HU': {
      searchTerms: 'Hungary Magyarország Budapest Debrecen Szeged',
      locationContext: 'site:.hu OR "in Hungary" OR "Magyarországon"'
    },
    'SK': {
      searchTerms: 'Slovakia Slovensko Bratislava Kosice',
      locationContext: 'site:.sk OR "in Slovakia" OR "na Slovensku"'
    },
    'SI': {
      searchTerms: 'Slovenia Slovenija Ljubljana Maribor',
      locationContext: 'site:.si OR "in Slovenia" OR "v Sloveniji"'
    },
    'HR': {
      searchTerms: 'Croatia Hrvatska Zagreb Split Dubrovnik',
      locationContext: 'site:.hr OR "in Croatia" OR "u Hrvatskoj"'
    },
    'BG': {
      searchTerms: 'Bulgaria България Sofia София Plovdiv Varna',
      locationContext: 'site:.bg OR "in Bulgaria" OR "в България"'
    },
    'RO': {
      searchTerms: 'Romania România Bucharest București Cluj Timisoara',
      locationContext: 'site:.ro OR "in Romania" OR "în România"'
    },
    'EE': {
      searchTerms: 'Estonia Eesti Tallinn Tartu',
      locationContext: 'site:.ee OR "in Estonia" OR "Eestis"'
    },
    'LV': {
      searchTerms: 'Latvia Latvija Riga Daugavpils',
      locationContext: 'site:.lv OR "in Latvia" OR "Latvijā"'
    },
    'LT': {
      searchTerms: 'Lithuania Lietuva Vilnius Kaunas Klaipeda',
      locationContext: 'site:.lt OR "in Lithuania" OR "Lietuvoje"'
    },
    'MT': {
      searchTerms: 'Malta Valletta Sliema',
      locationContext: 'site:.mt OR "in Malta"'
    },
    'CY': {
      searchTerms: 'Cyprus Κύπρος Nicosia Λευκωσία Limassol',
      locationContext: 'site:.cy OR "in Cyprus" OR "στην Κύπρο"'
    },
    'IE': {
      searchTerms: 'Ireland Éire Dublin Cork Galway',
      locationContext: 'site:.ie OR "in Ireland" OR "in Éire"'
    },
    'PT': {
      searchTerms: 'Portugal Lisbon Lisboa Porto Coimbra',
      locationContext: 'site:.pt OR "in Portugal" OR "em Portugal"'
    }
  };
  
  return biasConfig[countryUpper] || null;
}

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
  let effectiveQuery = args.userText;
  
  // If userText is empty, use baseQuery from config (same as enhanced orchestrator)
  if (!effectiveQuery || effectiveQuery.trim() === '') {
    try {
      const { loadActiveConfig } = await import('@/common/search/config');
      const { buildSearchQuery } = await import('@/common/search/queryBuilder');
      
      const cfg = await loadActiveConfig();
      const baseQuery = cfg.baseQuery;
      const excludeTerms = cfg.excludeTerms || '';
      
      // Build query using the same logic as enhanced orchestrator
      effectiveQuery = buildSearchQuery({ baseQuery, userText: '', excludeTerms });
      
      logger.info({ message: '[executeNewPipeline] Using baseQuery for empty userText', 
        baseQuery: effectiveQuery.substring(0, 100) + '...' 
      });
    } catch (error) {
      logger.warn({ message: '[executeNewPipeline] Failed to load config, using fallback query', 
        error: (error as any).message 
      });
      // Fallback to a basic legal compliance query
      effectiveQuery = 'legal compliance conference event summit workshop';
    }
  }
  
  // Add country-specific search bias when a specific country is selected
  if (args.country && args.country !== 'EU' && args.country !== '') {
    effectiveQuery = addCountrySpecificBias(effectiveQuery, args.country);
    logger.info({ message: '[executeNewPipeline] Added country-specific bias', 
      country: args.country,
      enhancedQuery: effectiveQuery.substring(0, 150) + '...' 
    });
  }
  
  const context: PipelineContext = {
    query: effectiveQuery,
    country: args.country,
    dateFrom: args.dateFrom,
    dateTo: args.dateTo,
    locale: args.locale || 'de',
    startTime: new Date(),
    config: getPipelineConfig()
  };
  
  return await pipelineWithFallback.search(context);
}
