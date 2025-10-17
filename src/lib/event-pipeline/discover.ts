/**
 * Event Discovery Stage
 * 
 * Multi-source URL discovery using CSE, Firecrawl, and curated sources
 */

import { EventCandidate, EventPipelineConfig, DiscoveryService, DiscoveryError, PipelineContext } from './types';
import { logger } from '@/utils/logger';
import { metrics } from '@/search/metrics';
import { getCountryContext, type CountryContext } from '@/lib/utils/country';

export class EventDiscoverer {
  constructor(
    private config: EventPipelineConfig,
    private cseService: DiscoveryService,
    private firecrawlService: DiscoveryService,
    private curatedService?: DiscoveryService
  ) {}

  async discover(query: string, country: string | null, context?: PipelineContext): Promise<{ candidates: EventCandidate[]; providers: string[] }> {
    const startTime = Date.now();
    logger.info({ message: '[discover] Starting multi-source discovery', query, country, locale: context?.locale });
    const providersUsed: string[] = [];
    
    const candidates: EventCandidate[] = [];
    
    try {
      // Try Firecrawl first (like enhanced orchestrator), then CSE if needed
      let allResults: { candidates: EventCandidate[]; provider: string }[] = [];
      
      // Try Firecrawl first
      if (this.config.sources.firecrawl) {
        try {
          metrics.discoveryProvidersAttempt.inc({ provider: 'firecrawl' });
          const firecrawlResult = await this.discoverFromFirecrawl(query, country, context);
          metrics.discoveryProvidersSuccess.inc({ provider: 'firecrawl' });
          metrics.discoveryProvidersLatency.observe({ provider: 'firecrawl' }, Date.now() - startTime);
          allResults.push(firecrawlResult);
          logger.info({ message: '[discover] Firecrawl found candidates', count: firecrawlResult.candidates.length });
        } catch (error: any) {
          metrics.discoveryProvidersFailure.inc({ provider: 'firecrawl' });
          logger.error({ message: '[discover] Firecrawl discovery failed', error: error.message });
        }
      }
      
      // Try CSE if Firecrawl didn't return enough (like enhanced orchestrator)
      const totalCandidates = allResults.reduce((sum, result) => sum + result.candidates.length, 0);
      if (this.config.sources.cse && totalCandidates < 10) {
        try {
          metrics.discoveryProvidersAttempt.inc({ provider: 'cse' });
          const cseResult = await this.discoverFromCSE(query, country, context);
          metrics.discoveryProvidersSuccess.inc({ provider: 'cse' });
          metrics.discoveryProvidersLatency.observe({ provider: 'cse' }, Date.now() - startTime);
          allResults.push(cseResult);
          logger.info({ message: '[discover] CSE found candidates', count: cseResult.candidates.length });
        } catch (error: any) {
          metrics.discoveryProvidersFailure.inc({ provider: 'cse' });
          logger.error({ message: '[discover] CSE discovery failed', error: error.message });
        }
      }
      
      // Try curated if still not enough
      const updatedTotalCandidates = allResults.reduce((sum, result) => sum + result.candidates.length, 0);
      if (this.config.sources.curated && this.curatedService && updatedTotalCandidates < 10) {
        try {
          metrics.discoveryProvidersAttempt.inc({ provider: 'curated' });
          const curatedResult = await this.discoverFromCurated(query, country, context);
          metrics.discoveryProvidersSuccess.inc({ provider: 'curated' });
          metrics.discoveryProvidersLatency.observe({ provider: 'curated' }, Date.now() - startTime);
          allResults.push(curatedResult);
          logger.info({ message: '[discover] Curated found candidates', count: curatedResult.candidates.length });
        } catch (error: any) {
          metrics.discoveryProvidersFailure.inc({ provider: 'curated' });
          logger.error({ message: '[discover] Curated discovery failed', error: error.message });
        }
      }
      
      const results = allResults;

      // Flatten results from all sources
      results.forEach((result, index) => {
        if (result && Array.isArray(result.candidates)) {
          logger.info({ message: '[discover] Source result', sourceIndex: index, candidateCount: result.candidates.length });
          candidates.push(...result.candidates);
          if (result.provider) {
            providersUsed.push(result.provider);
          }
        } else if (Array.isArray(result)) {
          logger.info({ message: '[discover] Source result', sourceIndex: index, candidateCount: result.length });
          candidates.push(...result);
        } else {
          logger.warn({ message: '[discover] Unexpected result shape from source', sourceIndex: index, resultType: typeof result });
        }
      });
      
      // Deduplicate and limit
      const finalCandidates = this.deduplicateAndLimit(candidates);
      
      const duration = Date.now() - startTime;
      metrics.discoveryLatency.observe(duration);
      logger.info({ message: '[discover] Discovery completed',
        totalCandidates: candidates.length,
        finalCandidates: finalCandidates.length,
        duration,
        sources: {
          cse: this.config.sources.cse,
          firecrawl: this.config.sources.firecrawl,
          curated: this.config.sources.curated
        }
      });
      
      return { candidates: finalCandidates, providers: providersUsed };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ message: '[discover] Discovery failed', error: (error as any).message, duration });
      throw new DiscoveryError(`Discovery failed: ${(error as any).message}`, undefined, error as Error);
    }
  }

  private async discoverFromCSE(query: string, country: string | null, context?: PipelineContext): Promise<{ candidates: EventCandidate[]; provider: string }> {
    const startTime = Date.now();
    logger.info({ message: '[discover:cse] Starting CSE discovery', query, country, locale: context?.locale });
    
    try {
      const results = await this.cseService.search({ 
        q: query, 
        country,
        limit: Math.min(20, this.config.limits.maxCandidates),
        countryContext: context?.countryContext ?? null,
      });
      
      // Debug logging to see what CSE returns
      logger.info({ message: '[discover:cse] CSE results structure', 
        itemsCount: results.items?.length || 0,
        firstItem: results.items?.[0] ? JSON.stringify(results.items[0], null, 2) : 'No items'
      });
      
      const candidates = results.items
        .filter((item: any) => {
          // Filter out items without URLs
          if (!item.url && !item.link) {
            logger.warn({ message: '[discover:cse] Item missing URL', item: JSON.stringify(item, null, 2) });
            return false;
          }
          return true;
        })
        .map((item: any, index: number) => ({
          id: `cse_${Date.now()}_${index}`,
          url: item.url || item.link, // Try both url and link fields
          source: 'cse' as const,
          discoveredAt: new Date(),
          relatedUrls: (Array.isArray(item.relatedUrls) ? item.relatedUrls : (item.metadata?.relatedUrls ?? [])).filter((value: unknown): value is string => typeof value === 'string'),
          status: 'discovered' as const,
          metadata: {
            originalQuery: query,
            country,
            processingTime: Date.now() - startTime,
            stageTimings: {
              discovery: Date.now() - startTime
            }
          }
        }));
      
      logger.info({ message: '[discover:cse] CSE discovery completed',
        candidatesFound: candidates.length,
        duration: Date.now() - startTime
      });
      
      return { candidates, provider: 'cse' };
    } catch (error) {
      logger.error({ message: '[discover:cse] CSE discovery failed', error: (error as any).message });
      throw new DiscoveryError(`CSE discovery failed: ${(error as any).message}`, undefined, error as Error);
    }
  }

  private async discoverFromFirecrawl(query: string, country: string | null, context?: PipelineContext): Promise<{ candidates: EventCandidate[]; provider: string }> {
    const startTime = Date.now();
    logger.info({ message: '[discover:firecrawl] Starting Firecrawl discovery', query, country, locale: context?.locale });
    
    try {
      // Use the same approach as enhanced orchestrator - simple query with retry and circuit breaker
      const { RetryService } = await import('@/lib/services/retry-service');
      const { executeWithCircuitBreaker, CIRCUIT_BREAKER_CONFIGS } = await import('@/lib/services/circuit-breaker');
      const { search: firecrawlSearch } = await import('@/providers/firecrawl');
      
          const firecrawlRes = await RetryService.executeWithRetry(
            'firecrawl',
            'search',
            () => executeWithCircuitBreaker(
              'firecrawl',
              () => firecrawlSearch({ 
                q: query, 
                dateFrom: context?.dateFrom || undefined, 
                dateTo: context?.dateTo || undefined,
                country: country || undefined,
                limit: 15, // Reduced limit since we're scraping content
                scrapeContent: true // Enable content scraping for better prioritization
              }),
              CIRCUIT_BREAKER_CONFIGS.FIRECRAWL
            )
          );
      
      const items = firecrawlRes.data?.items || [];
      
      logger.info({ message: '[discover:firecrawl] Firecrawl search completed',
        itemsFound: items.length,
        retryAttempts: firecrawlRes.metrics.attempts,
        totalDelayMs: firecrawlRes.metrics.totalDelayMs,
        duration: Date.now() - startTime
      });
      
      const candidates = items
        .map((item: any, index: number) => ({
          id: `firecrawl_${Date.now()}_${index}`,
          url: typeof item === 'string' ? item : item.url,
          source: 'firecrawl' as const,
          discoveredAt: new Date(),
          relatedUrls: [],
          status: 'discovered' as const,
          metadata: {
            originalQuery: query,
            country,
            processingTime: Date.now() - startTime,
            stageTimings: {
              discovery: Date.now() - startTime
            },
            // Include scraped content if available
            ...(typeof item === 'object' && {
              title: item.title,
              description: item.description,
              scrapedContent: item.content,
              scrapedLinks: item.links
            })
          }
        }));
      
      logger.info({ message: '[discover:firecrawl] Firecrawl discovery completed',
        candidatesFound: candidates.length,
        duration: Date.now() - startTime
      });
      
      return { candidates, provider: 'firecrawl' };
    } catch (error) {
      logger.error({ message: '[discover:firecrawl] Firecrawl discovery failed', error: (error as any).message });
      throw new DiscoveryError(`Firecrawl discovery failed: ${(error as any).message}`, undefined, error as Error);
    }
  }

  private async discoverFromCurated(query: string, country: string | null, context?: PipelineContext): Promise<{ candidates: EventCandidate[]; provider: string }> {
    if (!this.curatedService) {
      logger.warn({ message: '[discover:curated] Curated service not available' });
      return { candidates: [], provider: 'curated' };
    }
    
    const startTime = Date.now();
    logger.info({ message: '[discover:curated] Starting curated discovery', query, country, locale: context?.locale });
    
    try {
      const results = await this.curatedService.search({ 
        q: query, 
        country,
        limit: Math.min(10, this.config.limits.maxCandidates),
        countryContext: context?.countryContext ?? null,
      });
      
      const candidates = results.items.map((item: any, index: number) => ({
        id: `curated_${Date.now()}_${index}`,
        url: item.url,
        source: 'curated' as const,
        discoveredAt: new Date(),
        status: 'discovered' as const,
        metadata: {
          originalQuery: query,
          country,
          processingTime: Date.now() - startTime,
          stageTimings: {
            discovery: Date.now() - startTime
          }
        }
      }));
      
      logger.info({ message: '[discover:curated] Curated discovery completed',
        candidatesFound: candidates.length,
        duration: Date.now() - startTime
      });
      
      return { candidates, provider: 'curated' };
    } catch (error) {
      logger.error({ message: '[discover:curated] Curated discovery failed', error: (error as any).message });
      throw new DiscoveryError(`Curated discovery failed: ${(error as any).message}`, undefined, error as Error);
    }
  }

  private deduplicateAndLimit(candidates: EventCandidate[]): EventCandidate[] {
    const seen = new Set<string>();
    const deduplicated = candidates.filter(candidate => {
      if (seen.has(candidate.url)) {
        logger.info({ message: '[discover] Duplicate URL filtered out', url: candidate.url });
        return false;
      }
      seen.add(candidate.url);
      return true;
    });
    
    const limited = deduplicated.slice(0, this.config.limits.maxCandidates);
    
    if (limited.length < deduplicated.length) {
      logger.info({ message: '[discover] Candidates limited',
        original: deduplicated.length,
        limited: limited.length,
        maxCandidates: this.config.limits.maxCandidates
      });
    }
    
    return limited;
  }
}
