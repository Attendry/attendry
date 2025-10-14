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
import { metrics } from '@/search/metrics';
import { evaluateLocation } from './location';

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
    this.publisher = new EventPublisher(config, { query: '', country: null, dateFrom: undefined, dateTo: undefined, locale: 'de', startTime: new Date(), config });
  }

  async process(context: PipelineContext): Promise<{
    candidates: EventCandidate[];
    publishedEvents: PublishedEvent[];
    metrics: PipelineMetrics;
    logs: any[];
    providersTried: string[];
  }> {
    const startTime = Date.now();
    const logs: any[] = [];
    
    // Early termination configuration
    const EARLY_TERMINATION_THRESHOLD = 8; // Stop when we have 8 high-quality events
    const MIN_CONFIDENCE_FOR_EARLY_TERMINATION = 0.8; // High confidence threshold
    
    metrics.pipelineStageLatency.observe({ stage: 'pipeline_start' }, 0);
    logger.info({ message: '[pipeline] Starting event discovery pipeline',
      query: context.query,
      country: context.country,
      config: {
        maxCandidates: this.config.limits.maxCandidates,
        maxExtractions: this.config.limits.maxExtractions,
        prioritizationThreshold: this.config.thresholds.prioritization,
        earlyTerminationThreshold: EARLY_TERMINATION_THRESHOLD
      }
    });
    
    try {
      const providersTried: string[] = [];
      // Stage 1: Discover
      const discoveryStart = Date.now();
      logger.info('[pipeline] Stage 1: Discovering URLs');
      const discoveryResult = await this.discoverer.discover(context.query, context.country, context);
      const { candidates, providers } = discoveryResult;
      providersTried.push(...providers);
      const discoveryDuration = Date.now() - discoveryStart;
      metrics.discoveryLatency.observe(discoveryDuration);
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
          logs,
          providersTried
        };
      }
      
      // Stage 2: Prioritize (with parallel parsing preparation)
      const prioritizationStart = Date.now();
      logger.info('[pipeline] Stage 2: Prioritizing candidates');
      
      // Start prioritization and prepare for parallel parsing
      const prioritizationPromise = this.prioritizer.prioritize(candidates, context.country);
      
      // Wait for prioritization to complete
      const prioritized = await prioritizationPromise;
      const prioritizationDuration = Date.now() - prioritizationStart;
      metrics.pipelineStageLatency.observe({ stage: 'prioritization' }, prioritizationDuration);
      metrics.pipelineStageOutputs.inc({ stage: 'prioritization' }, prioritized.length);
      
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
          logs,
          providersTried
        };
      }
      
      // Stage 3: Parse
      const parsingStart = Date.now();
      logger.info({ message: '[pipeline] Stage 3: Parsing candidates' });
      
      const parsed = await this.parseCandidates(prioritized);
      const parsingDuration = Date.now() - parsingStart;
      metrics.pipelineStageLatency.observe({ stage: 'parsing' }, parsingDuration);
      metrics.pipelineStageOutputs.inc({ stage: 'parsing' }, parsed.length);
      
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
          logs,
          providersTried
        };
      }
      
        // Stage 4: Extract (LLM Enhancement)
        const extractionStart = Date.now();
        logger.info({ message: '[pipeline] Stage 4: LLM enhancement' });
        
        const extracted = await this.extractCandidates(parsed, EARLY_TERMINATION_THRESHOLD, MIN_CONFIDENCE_FOR_EARLY_TERMINATION);
        const extractionDuration = Date.now() - extractionStart;
        metrics.pipelineStageLatency.observe({ stage: 'extraction' }, extractionDuration);
        metrics.pipelineStageOutputs.inc({ stage: 'extraction' }, extracted.length);
      
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
          logs,
          providersTried
        };
      }
      
      // Stage 5: Publish (Final formatting and quality control)
      const publishingStart = Date.now();
      logger.info({ message: '[pipeline] Stage 5: Publishing events' });
      
      // Reinitialize publisher with current context
      this.publisher = new EventPublisher(this.config, context);
      
      const published = await this.publishCandidates(extracted);
      const publishingDuration = Date.now() - publishingStart;
      metrics.pipelineStageLatency.observe({ stage: 'publishing' }, publishingDuration);
      metrics.pipelineStageOutputs.inc({ stage: 'publishing' }, published.length);
      
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
      const pipelineMetrics = this.createMetrics(candidates, prioritized, parsed, extracted, published);
      metrics.pipelineStageLatency.observe({ stage: 'pipeline_total' }, totalDuration);
      
      logger.info({ message: '[pipeline] Pipeline completed successfully',
        totalDuration,
        finalCandidates: published.length,
        averageConfidence: pipelineMetrics.averageConfidence,
        sourceBreakdown: pipelineMetrics.sourceBreakdown
      });
      
      return {
        candidates: extracted,
        publishedEvents: published,
        metrics: pipelineMetrics,
        logs,
        providersTried
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
    
    // Smart batch sizing based on candidate count for optimal performance
    const concurrency = this.calculateOptimalConcurrency(candidates.length, 8, 3); // Max 8, min 3
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
      
      // Further reduced delay between batches for better performance
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 100ms to 50ms
      }
    }
    
    return parsed;
  }

  private async extractCandidates(
    candidates: EventCandidate[], 
    earlyTerminationThreshold: number = 10,
    minConfidenceForEarlyTermination: number = 0.8
  ): Promise<EventCandidate[]> {
    const extracted: EventCandidate[] = [];
    
    // Smart batch sizing for LLM calls based on candidate count
    const concurrency = this.calculateOptimalConcurrency(candidates.length, 4, 2); // Max 4, min 2 for LLM
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
      
      // Filter out failed candidates and check for early termination
      batchResults.forEach(result => {
        if (result && result.status === 'extracted') {
          extracted.push(result);
        }
      });
      
      // Check for early termination - stop if we have enough high-quality events
      const highQualityEvents = extracted.filter(candidate => 
        candidate.extractResult?.confidence && candidate.extractResult.confidence >= minConfidenceForEarlyTermination
      );
      
      if (highQualityEvents.length >= earlyTerminationThreshold) {
        logger.info({ message: '[pipeline] Early termination triggered',
          highQualityEvents: highQualityEvents.length,
          threshold: earlyTerminationThreshold,
          totalExtracted: extracted.length,
          remainingBatches: batches.length - batches.indexOf(batch) - 1
        });
        break; // Stop processing remaining batches
      }
      
      // Further reduced delay between batches for better performance
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300)); // Reduced from 500ms to 300ms
      }
    }
    
    return extracted;
  }

  private async publishCandidates(candidates: EventCandidate[]): Promise<PublishedEvent[]> {
    const published: PublishedEvent[] = [];
    
    // Smart batch sizing for publishing based on candidate count
    const concurrency = this.calculateOptimalConcurrency(candidates.length, 5, 2); // Max 5, min 2
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
      
      // Further reduced delay between batches for better performance
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 100ms to 50ms
      }
    }
    
    return published;
  }

  /**
   * Calculate optimal concurrency based on candidate count
   * Uses adaptive sizing for better performance
   */
  private calculateOptimalConcurrency(candidateCount: number, maxConcurrency: number, minConcurrency: number): number {
    if (candidateCount <= 5) {
      return Math.min(candidateCount, minConcurrency);
    } else if (candidateCount <= 15) {
      return Math.min(Math.ceil(candidateCount / 2), maxConcurrency);
    } else {
      return maxConcurrency;
    }
  }

  /**
   * Memory optimization: Process candidates in chunks for large datasets
   * Prevents memory issues with very large candidate sets
   */
  private shouldUseStreamingProcessing(candidateCount: number): boolean {
    return candidateCount > 50; // Use streaming for large datasets
  }

  /**
   * Get optimal chunk size for streaming processing
   */
  private getOptimalChunkSize(candidateCount: number): number {
    if (candidateCount <= 20) return candidateCount;
    if (candidateCount <= 50) return 20;
    return 30; // Max chunk size for memory efficiency
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
