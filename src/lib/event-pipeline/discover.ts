/**
 * Event Discovery Stage
 * 
 * Multi-source URL discovery using CSE, Firecrawl, and curated sources
 */

import { EventCandidate, EventPipelineConfig, DiscoveryService, DiscoveryError, PipelineContext } from './types';
import { logger } from '@/utils/logger';

export class EventDiscoverer {
  constructor(
    private config: EventPipelineConfig,
    private cseService: DiscoveryService,
    private firecrawlService: DiscoveryService,
    private curatedService?: DiscoveryService
  ) {}

  async discover(query: string, country: string | null, context?: PipelineContext): Promise<EventCandidate[]> {
    const startTime = Date.now();
    logger.info({ message: '[discover] Starting multi-source discovery', query, country, locale: context?.locale });
    
    const candidates: EventCandidate[] = [];
    
    try {
      // Parallel discovery from all enabled sources
      const discoveryPromises: Promise<EventCandidate[]>[] = [];
      
      if (this.config.sources.cse) {
        discoveryPromises.push(
          this.discoverFromCSE(query, country, context).catch((error: any) => {
            logger.error({ message: '[discover] CSE discovery failed', error: error.message });
            return [];
          })
        );
      }
      
      if (this.config.sources.firecrawl) {
        discoveryPromises.push(
          this.discoverFromFirecrawl(query, country, context).catch((error: any) => {
            logger.error({ message: '[discover] Firecrawl discovery failed', error: error.message });
            return [];
          })
        );
      }
      
      if (this.config.sources.curated && this.curatedService) {
        discoveryPromises.push(
          this.discoverFromCurated(query, country, context).catch((error: any) => {
            logger.error({ message: '[discover] Curated discovery failed', error: error.message });
            return [];
          })
        );
      }
      
      // Wait for all discovery sources with timeout
      const results = await Promise.all(discoveryPromises);

      // Flatten results from all sources
      results.forEach((result, index) => {
        if (Array.isArray(result)) {
          logger.info({ message: '[discover] Source result', sourceIndex: index, candidateCount: result.length });
          candidates.push(...result);
        } else {
          logger.warn({ message: '[discover] Unexpected result shape from source', sourceIndex: index, resultType: typeof result });
        }
      });
      
      // Deduplicate and limit
      const finalCandidates = this.deduplicateAndLimit(candidates);
      
      const duration = Date.now() - startTime;
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
      
      return finalCandidates;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ message: '[discover] Discovery failed', error: (error as any).message, duration });
      throw new DiscoveryError(`Discovery failed: ${(error as any).message}`, undefined, error as Error);
    }
  }

  private async discoverFromCSE(query: string, country: string | null, context?: PipelineContext): Promise<EventCandidate[]> {
    const startTime = Date.now();
    logger.info({ message: '[discover:cse] Starting CSE discovery', query, country, locale: context?.locale });
    
    try {
      const results = await this.cseService.search({ 
        q: query, 
        country,
        limit: Math.min(20, this.config.limits.maxCandidates),
        countryContext: context?.countryContext ?? null,
      });
      
      const candidates = results.items.map((item: any, index: number) => ({
        id: `cse_${Date.now()}_${index}`,
        url: item.url,
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
      
      return candidates;
    } catch (error) {
      logger.error({ message: '[discover:cse] CSE discovery failed', error: (error as any).message });
      throw new DiscoveryError(`CSE discovery failed: ${(error as any).message}`, undefined, error as Error);
    }
  }

  private async discoverFromFirecrawl(query: string, country: string | null, context?: PipelineContext): Promise<EventCandidate[]> {
    const startTime = Date.now();
    logger.info({ message: '[discover:firecrawl] Starting Firecrawl discovery', query, country, locale: context?.locale });
    
    try {
      const results = await this.firecrawlService.search({ 
        q: query, 
        country,
        limit: Math.min(20, this.config.limits.maxCandidates),
        countryContext: context?.countryContext ?? null,
      });
      
      const candidates = results.items.map((item: any, index: number) => ({
        id: `firecrawl_${Date.now()}_${index}`,
        url: item.url,
        source: 'firecrawl' as const,
        discoveredAt: new Date(),
        relatedUrls: item.relatedUrls ?? [],
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
      
      logger.info({ message: '[discover:firecrawl] Firecrawl discovery completed',
        candidatesFound: candidates.length,
        duration: Date.now() - startTime
      });
      
      return candidates;
    } catch (error) {
      logger.error({ message: '[discover:firecrawl] Firecrawl discovery failed', error: (error as any).message });
      throw new DiscoveryError(`Firecrawl discovery failed: ${(error as any).message}`, undefined, error as Error);
    }
  }

  private async discoverFromCurated(query: string, country: string | null, context?: PipelineContext): Promise<EventCandidate[]> {
    if (!this.curatedService) {
      logger.warn({ message: '[discover:curated] Curated service not available' });
      return [];
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
      
      return candidates;
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
