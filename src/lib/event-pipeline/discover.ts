/**
 * Event Discovery Stage
 * 
 * Multi-source URL discovery using CSE, Firecrawl, and curated sources
 */

import { EventCandidate, EventPipelineConfig, DiscoveryService, DiscoveryError } from './types';
import { logger } from '@/utils/logger';

export class EventDiscoverer {
  constructor(
    private config: EventPipelineConfig,
    private cseService: DiscoveryService,
    private firecrawlService: DiscoveryService,
    private curatedService?: DiscoveryService
  ) {}

  async discover(query: string, country: string | null): Promise<EventCandidate[]> {
    const startTime = Date.now();
    logger.info({ message: '[discover] Starting multi-source discovery', query, country });
    
    const candidates: EventCandidate[] = [];
    
    try {
      // Parallel discovery from all enabled sources
      const discoveryPromises: Promise<EventCandidate[]>[] = [];
      
      if (this.config.sources.cse) {
        discoveryPromises.push(
          this.discoverFromCSE(query, country).catch((error: any) => {
            logger.error({ message: '[discover] CSE discovery failed', error: error.message });
            return [];
          })
        );
      }
      
      if (this.config.sources.firecrawl) {
        discoveryPromises.push(
          this.discoverFromFirecrawl(query, country).catch((error: any) => {
            logger.error({ message: '[discover] Firecrawl discovery failed', error: error.message });
            return [];
          })
        );
      }
      
      if (this.config.sources.curated && this.curatedService) {
        discoveryPromises.push(
          this.discoverFromCurated(query, country).catch((error: any) => {
            logger.error({ message: '[discover] Curated discovery failed', error: error.message });
            return [];
          })
        );
      }
      
      // Wait for all discovery sources with timeout
      const discoveryTimeout = new Promise<EventCandidate[]>((_, reject) => {
        setTimeout(() => reject(new Error('Discovery timeout')), this.config.timeouts.discovery);
      });
      
      const results = await Promise.race([
        Promise.all(discoveryPromises),
        discoveryTimeout
      ]) as EventCandidate[][];
      
      // Flatten results from all sources
      results.forEach(sourceResults => {
        if (Array.isArray(sourceResults)) {
          candidates.push(...sourceResults);
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

  private async discoverFromCSE(query: string, country: string | null): Promise<EventCandidate[]> {
    const startTime = Date.now();
    logger.info({ message: '[discover:cse] Starting CSE discovery', query, country });
    
    try {
      const results = await this.cseService.search({ 
        q: query, 
        country,
        limit: Math.min(20, this.config.limits.maxCandidates)
      });
      
      const candidates = results.items.map((item: any, index: number) => ({
        id: `cse_${Date.now()}_${index}`,
        url: item.url,
        source: 'cse' as const,
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

  private async discoverFromFirecrawl(query: string, country: string | null): Promise<EventCandidate[]> {
    const startTime = Date.now();
    logger.info({ message: '[discover:firecrawl] Starting Firecrawl discovery', query, country });
    
    try {
      const results = await this.firecrawlService.search({ 
        q: query, 
        country,
        limit: Math.min(20, this.config.limits.maxCandidates)
      });
      
      const candidates = results.items.map((item: any, index: number) => ({
        id: `firecrawl_${Date.now()}_${index}`,
        url: item.url,
        source: 'firecrawl' as const,
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

  private async discoverFromCurated(query: string, country: string | null): Promise<EventCandidate[]> {
    if (!this.curatedService) {
      logger.warn({ message: '[discover:curated] Curated service not available' });
      return [];
    }
    
    const startTime = Date.now();
    logger.info({ message: '[discover:curated] Starting curated discovery', query, country });
    
    try {
      const results = await this.curatedService.search({ 
        q: query, 
        country,
        limit: Math.min(10, this.config.limits.maxCandidates)
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
