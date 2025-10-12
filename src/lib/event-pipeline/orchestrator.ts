/**
 * Event Pipeline Orchestrator
 * 
 * Main coordinator for the event discovery and extraction pipeline
 */

import { EventCandidate, EventPipelineConfig, PipelineContext, PipelineMetrics } from './types';
import { EventDiscoverer } from './discover';
import { EventPrioritizer } from './prioritize';
import { EventParser } from './parse';
import { EventExtractor } from './extract';
import { EventPublisher, PublishedEvent } from './publish';
import { logger } from '@/utils/logger';

export class EventPipeline {
  private discoverer: EventDiscoverer;
  private prioritizer: EventPrioritizer;
  private parser: EventParser;
  private extractor: EventExtractor;
  private publisher: EventPublisher;

  constructor(
    private config: EventPipelineConfig,
    cseService: any,
    firecrawlService: any,
    geminiService: any,
    curatedService?: any
  ) {
    this.discoverer = new EventDiscoverer(config, cseService, firecrawlService, curatedService);
    this.prioritizer = new EventPrioritizer(config, geminiService);
    this.parser = new EventParser(config);
    this.extractor = new EventExtractor(config, geminiService);
    // Publisher will be initialized with context in process method
    this.publisher = new EventPublisher(config, { query: '', country: '', dateFrom: undefined, dateTo: undefined, locale: 'de', startTime: new Date(), config });
  }

  async process(context: PipelineContext): Promise<{
    candidates: EventCandidate[];
    publishedEvents: PublishedEvent[];
    metrics: PipelineMetrics;
    logs: any[];
  }> {
    const startTime = Date.now();
    const logs: any[] = [];
    
    logger.info({ message: '[pipeline] Starting event discovery pipeline',
      query: context.query,
      country: context.country,
      config: {
        maxCandidates: this.config.limits.maxCandidates,
        maxExtractions: this.config.limits.maxExtractions,
        prioritizationThreshold: this.config.thresholds.prioritization
      }
    });
    
    try {
      // Stage 1: Discover
      const discoveryStart = Date.now();
      logger.info('[pipeline] Stage 1: Discovering URLs');
      
      const candidates = await this.discoverer.discover(context.query, context.country);
      const discoveryDuration = Date.now() - discoveryStart;
      
      logs.push({
        stage: 'discovery',
        duration: discoveryDuration,
        candidatesFound: candidates.length,
        timestamp: new Date().toISOString()
      });
      
      logger.info({ message: '[pipeline] Discovery completed',
        candidatesFound: candidates.length,
        duration: discoveryDuration
      });
      
      if (candidates.length === 0) {
        logger.warn({ message: '[pipeline] No candidates found, returning empty result' });
        return {
          candidates: [],
          publishedEvents: [],
          metrics: this.createEmptyMetrics(),
          logs
        };
      }
      
      // Stage 2: Prioritize
      const prioritizationStart = Date.now();
      logger.info('[pipeline] Stage 2: Prioritizing candidates');
      
      const prioritized = await this.prioritizer.prioritize(candidates);
      const prioritizationDuration = Date.now() - prioritizationStart;
      
      logs.push({
        stage: 'prioritization',
        duration: prioritizationDuration,
        inputCandidates: candidates.length,
        outputCandidates: prioritized.length,
        rejectedCandidates: candidates.length - prioritized.length,
        timestamp: new Date().toISOString()
      });
      
      logger.info({ message: '[pipeline] Prioritization completed',
        inputCandidates: candidates.length,
        outputCandidates: prioritized.length,
        rejectedCandidates: candidates.length - prioritized.length,
        duration: prioritizationDuration
      });
      
      if (prioritized.length === 0) {
        logger.warn({ message: '[pipeline] No candidates passed prioritization' });
        return {
          candidates: [],
          publishedEvents: [],
          metrics: this.createMetrics(candidates, [], [], [], []),
          logs
        };
      }
      
      // Stage 3: Parse
      const parsingStart = Date.now();
      logger.info({ message: '[pipeline] Stage 3: Parsing candidates' });
      
      const parsed = await this.parseCandidates(prioritized);
      const parsingDuration = Date.now() - parsingStart;
      
      logs.push({
        stage: 'parsing',
        duration: parsingDuration,
        inputCandidates: prioritized.length,
        outputCandidates: parsed.length,
        failedCandidates: prioritized.length - parsed.length,
        timestamp: new Date().toISOString()
      });
      
      logger.info({ message: '[pipeline] Parsing completed',
        inputCandidates: prioritized.length,
        outputCandidates: parsed.length,
        failedCandidates: prioritized.length - parsed.length,
        duration: parsingDuration
      });
      
      if (parsed.length === 0) {
        logger.warn({ message: '[pipeline] No candidates passed parsing' });
        return {
          candidates: [],
          publishedEvents: [],
          metrics: this.createMetrics(candidates, prioritized, parsed, [], []),
          logs
        };
      }
      
      // Stage 4: Extract (LLM Enhancement)
      const extractionStart = Date.now();
      logger.info({ message: '[pipeline] Stage 4: LLM enhancement' });
      
      const extracted = await this.extractCandidates(parsed);
      const extractionDuration = Date.now() - extractionStart;
      
      logs.push({
        stage: 'extraction',
        duration: extractionDuration,
        inputCandidates: parsed.length,
        outputCandidates: extracted.length,
        failedCandidates: parsed.length - extracted.length,
        timestamp: new Date().toISOString()
      });
      
      logger.info({ message: '[pipeline] LLM enhancement completed',
        inputCandidates: parsed.length,
        outputCandidates: extracted.length,
        failedCandidates: parsed.length - extracted.length,
        duration: extractionDuration
      });
      
      if (extracted.length === 0) {
        logger.warn({ message: '[pipeline] No candidates passed extraction' });
        return {
          candidates: extracted,
          publishedEvents: [],
          metrics: this.createMetrics(candidates, prioritized, parsed, extracted, []),
          logs
        };
      }
      
      // Stage 5: Publish (Final formatting and quality control)
      const publishingStart = Date.now();
      logger.info({ message: '[pipeline] Stage 5: Publishing events' });
      
      // Reinitialize publisher with current context
      this.publisher = new EventPublisher(this.config, context);
      
      const published = await this.publishCandidates(extracted);
      const publishingDuration = Date.now() - publishingStart;
      
      logs.push({
        stage: 'publishing',
        duration: publishingDuration,
        inputCandidates: extracted.length,
        outputCandidates: published.length,
        failedCandidates: extracted.length - published.length,
        timestamp: new Date().toISOString()
      });
      
      logger.info({ message: '[pipeline] Publishing completed',
        inputCandidates: extracted.length,
        outputCandidates: published.length,
        failedCandidates: extracted.length - published.length,
        duration: publishingDuration
      });
      
      const totalDuration = Date.now() - startTime;
      const metrics = this.createMetrics(candidates, prioritized, parsed, extracted, published);
      
      logger.info({ message: '[pipeline] Pipeline completed successfully',
        totalDuration,
        finalCandidates: published.length,
        averageConfidence: metrics.averageConfidence,
        sourceBreakdown: metrics.sourceBreakdown
      });
      
      return {
        candidates: extracted,
        publishedEvents: published,
        metrics,
        logs
      };
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      logger.error({ message: '[pipeline] Pipeline failed',
        error: (error as any).message,
        duration: totalDuration
      });
      
      logs.push({
        stage: 'error',
        error: (error as any).message,
        duration: totalDuration,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  private async parseCandidates(candidates: EventCandidate[]): Promise<EventCandidate[]> {
    const parsed: EventCandidate[] = [];
    
    // Process in parallel with concurrency limit to avoid overwhelming servers
    const concurrency = 3;
    const batches = [];
    
    for (let i = 0; i < candidates.length; i += concurrency) {
      batches.push(candidates.slice(i, i + concurrency));
    }
    
    for (const batch of batches) {
      const batchPromises = batch.map(candidate => 
        this.parser.parse(candidate)
          .then(() => candidate)
          .catch(error => {
            logger.error({ message: '[pipeline] Parse failed for candidate',
              url: candidate.url,
              error: (error as any).message
            });
            candidate.status = 'failed';
            return null;
          })
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Filter out failed candidates
      batchResults.forEach(result => {
        if (result && result.status === 'parsed') {
          parsed.push(result);
        }
      });
      
      // Add small delay between batches to be respectful to target servers
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return parsed;
  }

  private async extractCandidates(candidates: EventCandidate[]): Promise<EventCandidate[]> {
    const extracted: EventCandidate[] = [];
    
    // Process in parallel with concurrency limit for LLM calls
    const concurrency = 2; // Lower concurrency for LLM calls
    const batches = [];
    
    for (let i = 0; i < candidates.length; i += concurrency) {
      batches.push(candidates.slice(i, i + concurrency));
    }
    
    for (const batch of batches) {
      const batchPromises = batch.map(candidate => 
        this.extractor.extract(candidate)
          .then(() => candidate)
          .catch(error => {
            logger.error({ message: '[pipeline] Extract failed for candidate',
              url: candidate.url,
              error: (error as any).message
            });
            candidate.status = 'failed';
            return null;
          })
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Filter out failed candidates
      batchResults.forEach(result => {
        if (result && result.status === 'extracted') {
          extracted.push(result);
        }
      });
      
      // Add delay between batches for LLM rate limiting
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return extracted;
  }

  private async publishCandidates(candidates: EventCandidate[]): Promise<PublishedEvent[]> {
    const published: PublishedEvent[] = [];
    
    // Process in parallel with concurrency limit
    const concurrency = 3;
    const batches = [];
    
    for (let i = 0; i < candidates.length; i += concurrency) {
      batches.push(candidates.slice(i, i + concurrency));
    }
    
    for (const batch of batches) {
      const batchPromises = batch.map(candidate => 
        this.publisher.publish(candidate)
          .then(result => result)
          .catch(error => {
            logger.error({ message: '[pipeline] Publish failed for candidate',
              url: candidate.url,
              error: (error as any).message
            });
            candidate.status = 'failed';
            return null;
          })
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Filter out failed candidates
      batchResults.forEach(result => {
        if (result) {
          published.push(result);
        }
      });
      
      // Add small delay between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    return published;
  }

  private createMetrics(
    discovered: EventCandidate[],
    prioritized: EventCandidate[],
    parsed: EventCandidate[],
    extracted: EventCandidate[],
    published: PublishedEvent[]
  ): PipelineMetrics {
    const sourceBreakdown: Record<string, number> = {};
    let totalConfidence = 0;
    let confidenceCount = 0;
    
    // Calculate source breakdown
    discovered.forEach(candidate => {
      sourceBreakdown[candidate.source] = (sourceBreakdown[candidate.source] || 0) + 1;
    });
    
    // Calculate average confidence from published events
    published.forEach(event => {
      totalConfidence += event.confidence;
      confidenceCount++;
    });
    
    return {
      totalCandidates: discovered.length,
      prioritizedCandidates: prioritized.length,
      parsedCandidates: parsed.length,
      extractedCandidates: extracted.length,
      publishedCandidates: published.length,
      rejectedCandidates: discovered.length - prioritized.length,
      failedCandidates: prioritized.length - parsed.length,
      totalDuration: 0, // Will be set by caller
      averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
      sourceBreakdown
    };
  }

  private createEmptyMetrics(): PipelineMetrics {
    return {
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
    };
  }
}
