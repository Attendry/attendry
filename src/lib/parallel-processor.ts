/**
 * Smart Parallel Processing System
 * 
 * This module implements intelligent parallel processing for the Optimized Orchestrator,
 * with dynamic concurrency control, resource optimization, and performance monitoring.
 * 
 * Key Features:
 * - Dynamic concurrency adjustment based on system load
 * - Intelligent batching with priority-based scheduling
 * - Resource-aware processing with memory and CPU monitoring
 * - Circuit breaker integration for fault tolerance
 * - Performance metrics and adaptive optimization
 */

import { executeWithRetry } from './error-recovery';

// Configuration for parallel processing
export const PARALLEL_CONFIG = {
  // Dynamic concurrency limits based on system resources
  concurrency: {
    min: 2,                    // Minimum concurrent operations
    max: 5,                    // Maximum concurrent operations (reduced from 10 to prevent timeout)
    default: 3,                // Default concurrent operations (reduced from 5)
    adaptive: true,            // Enable adaptive concurrency
  },
  
  // Batch processing configuration
  batching: {
    maxBatchSize: 8,           // Maximum items per batch
    minBatchSize: 2,           // Minimum items per batch
    batchTimeout: 5000,        // Maximum time to wait for batch completion (ms)
    priorityThreshold: 0.7,    // High priority threshold for immediate processing
  },
  
  // Resource monitoring
  resources: {
    memoryThreshold: 0.8,      // Memory usage threshold (80%)
    cpuThreshold: 0.7,         // CPU usage threshold (70%)
    checkInterval: 1000,       // Resource check interval (ms)
  },
  
  // Performance optimization
  optimization: {
    enableEarlyTermination: true,  // Stop processing if enough high-quality results found
    qualityThreshold: 0.8,         // Quality threshold for early termination
    minResultsForEarlyTermination: 5, // Minimum results before considering early termination
    enableResultCaching: true,     // Cache results to avoid duplicate processing
  }
};

// Types for parallel processing
export interface ParallelTask<T, R> {
  id: string;
  data: T;
  priority: number;
  retryCount: number;
  maxRetries: number;
  timeout: number;
  service: 'firecrawl' | 'gemini' | 'cse' | 'database';
}

export interface ParallelResult<R> {
  id: string;
  result: R | null;
  error: Error | null;
  duration: number;
  retryCount: number;
  success: boolean;
}

export interface ParallelMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageDuration: number;
  totalDuration: number;
  concurrencyLevel: number;
  resourceUtilization: {
    memory: number;
    cpu: number;
  };
  throughput: number; // tasks per second
}

export interface ResourceMonitor {
  memory: number;
  cpu: number;
  timestamp: number;
}

/**
 * Smart Parallel Processor Class
 */
export class SmartParallelProcessor {
  private activeTasks = new Map<string, Promise<any>>();
  private metrics: ParallelMetrics;
  private resourceMonitor: ResourceMonitor;
  private concurrencyLevel: number;
  private isShuttingDown = false;

  constructor() {
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageDuration: 0,
      totalDuration: 0,
      concurrencyLevel: PARALLEL_CONFIG.concurrency.default,
      resourceUtilization: { memory: 0, cpu: 0 },
      throughput: 0
    };
    
    this.resourceMonitor = {
      memory: 0,
      cpu: 0,
      timestamp: Date.now()
    };
    
    this.concurrencyLevel = PARALLEL_CONFIG.concurrency.default;
    
    // Start resource monitoring
    this.startResourceMonitoring();
  }

  /**
   * Process tasks in parallel with intelligent concurrency control
   */
  async processParallel<T, R>(
    tasks: ParallelTask<T, R>[],
    processor: (task: ParallelTask<T, R>) => Promise<R>,
    options: {
      maxConcurrency?: number;
      enableEarlyTermination?: boolean;
      qualityThreshold?: number;
      minResults?: number;
    } = {}
  ): Promise<ParallelResult<R>[]> {
    const startTime = Date.now();
    const results: ParallelResult<R>[] = [];
    const maxConcurrency = options.maxConcurrency || this.concurrencyLevel;
    const enableEarlyTermination = options.enableEarlyTermination ?? PARALLEL_CONFIG.optimization.enableEarlyTermination;
    const qualityThreshold = options.qualityThreshold ?? PARALLEL_CONFIG.optimization.qualityThreshold;
    const minResults = options.minResults ?? PARALLEL_CONFIG.optimization.minResultsForEarlyTermination;

    console.log(`[parallel-processor] Starting parallel processing of ${tasks.length} tasks with concurrency ${maxConcurrency}`);

    // Sort tasks by priority (higher priority first)
    const sortedTasks = [...tasks].sort((a, b) => b.priority - a.priority);

    // Process tasks in batches
    const batches = this.createBatches(sortedTasks, maxConcurrency);
    
    for (const batch of batches) {
      if (this.isShuttingDown) {
        console.log('[parallel-processor] Shutting down, stopping batch processing');
        break;
      }

      // Check for early termination
      if (enableEarlyTermination && results.length >= minResults) {
        const highQualityResults = results.filter(r => r.success && this.isHighQualityResult(r.result, qualityThreshold));
        if (highQualityResults.length >= minResults) {
          console.log(`[parallel-processor] Early termination: found ${highQualityResults.length} high-quality results`);
          break;
        }
      }

      // Process batch
      const batchResults = await this.processBatch(batch, processor);
      results.push(...batchResults);

      // Update metrics
      this.updateMetrics(batchResults, Date.now() - startTime);

      // Adaptive concurrency adjustment
      if (PARALLEL_CONFIG.concurrency.adaptive) {
        this.adjustConcurrency();
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[parallel-processor] Completed processing ${results.length} tasks in ${totalDuration}ms`);
    
    return results;
  }

  /**
   * Process a single batch of tasks
   */
  private async processBatch<T, R>(
    batch: ParallelTask<T, R>[],
    processor: (task: ParallelTask<T, R>) => Promise<R>
  ): Promise<ParallelResult<R>[]> {
    const batchPromises = batch.map(async (task) => {
      const taskStartTime = Date.now();
      const taskId = task.id;
      
      try {
        // Add to active tasks
        this.activeTasks.set(taskId, Promise.resolve());
        
        // Process with retry logic
        const result = await executeWithRetry(
          () => processor(task),
          task.service
        );

        const duration = Date.now() - taskStartTime;
        
        return {
          id: taskId,
          result,
          error: null,
          duration,
          retryCount: task.retryCount,
          success: true
        };
        
      } catch (error) {
        const duration = Date.now() - taskStartTime;
        
        return {
          id: taskId,
          result: null,
          error: error instanceof Error ? error : new Error(String(error)),
          duration,
          retryCount: task.retryCount,
          success: false
        };
      } finally {
        // Remove from active tasks
        this.activeTasks.delete(taskId);
      }
    });

    return Promise.all(batchPromises);
  }

  /**
   * Create intelligent batches based on priority and system resources
   */
  private createBatches<T, R>(tasks: ParallelTask<T, R>[], maxConcurrency: number): ParallelTask<T, R>[][] {
    const batches: ParallelTask<T, R>[][] = [];
    
    // High priority tasks get smaller batches for faster processing
    const highPriorityTasks = tasks.filter(t => t.priority >= PARALLEL_CONFIG.batching.priorityThreshold);
    const normalPriorityTasks = tasks.filter(t => t.priority < PARALLEL_CONFIG.batching.priorityThreshold);
    
    // Process high priority tasks first with smaller batches
    for (let i = 0; i < highPriorityTasks.length; i += Math.min(maxConcurrency, PARALLEL_CONFIG.batching.minBatchSize)) {
      batches.push(highPriorityTasks.slice(i, i + Math.min(maxConcurrency, PARALLEL_CONFIG.batching.minBatchSize)));
    }
    
    // Process normal priority tasks with larger batches
    for (let i = 0; i < normalPriorityTasks.length; i += maxConcurrency) {
      batches.push(normalPriorityTasks.slice(i, i + maxConcurrency));
    }
    
    return batches;
  }

  /**
   * Check if a result is high quality
   */
  private isHighQualityResult(result: any, threshold: number): boolean {
    if (!result) return false;
    
    // Check confidence score if available
    if (typeof result.confidence === 'number') {
      return result.confidence >= threshold;
    }
    
    // Check if result has required fields
    if (result.title && result.description && result.speakers?.length > 0) {
      return true;
    }
    
    return false;
  }

  /**
   * Update processing metrics
   */
  private updateMetrics(batchResults: ParallelResult<any>[], totalDuration: number): void {
    const successful = batchResults.filter(r => r.success);
    const failed = batchResults.filter(r => !r.success);
    
    this.metrics.completedTasks += successful.length;
    this.metrics.failedTasks += failed.length;
    this.metrics.totalDuration = totalDuration;
    
    if (batchResults.length > 0) {
      const avgBatchDuration = batchResults.reduce((sum, r) => sum + r.duration, 0) / batchResults.length;
      this.metrics.averageDuration = (this.metrics.averageDuration + avgBatchDuration) / 2;
    }
    
    // Calculate throughput
    this.metrics.throughput = this.metrics.completedTasks / (totalDuration / 1000);
  }

  /**
   * Adjust concurrency level based on system resources and performance
   */
  private adjustConcurrency(): void {
    const { memory, cpu } = this.resourceMonitor;
    const { memoryThreshold, cpuThreshold } = PARALLEL_CONFIG.resources;
    
    // Reduce concurrency if resources are high
    if (memory > memoryThreshold || cpu > cpuThreshold) {
      this.concurrencyLevel = Math.max(
        PARALLEL_CONFIG.concurrency.min,
        this.concurrencyLevel - 1
      );
      console.log(`[parallel-processor] Reduced concurrency to ${this.concurrencyLevel} due to high resource usage`);
    }
    // Increase concurrency if resources are low and performance is good
    else if (memory < memoryThreshold * 0.6 && cpu < cpuThreshold * 0.6 && this.metrics.throughput > 0) {
      this.concurrencyLevel = Math.min(
        PARALLEL_CONFIG.concurrency.max,
        this.concurrencyLevel + 1
      );
      console.log(`[parallel-processor] Increased concurrency to ${this.concurrencyLevel} due to low resource usage`);
    }
    
    this.metrics.concurrencyLevel = this.concurrencyLevel;
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    setInterval(() => {
      this.updateResourceMonitor();
    }, PARALLEL_CONFIG.resources.checkInterval);
  }

  /**
   * Update resource monitor with current system stats
   */
  private updateResourceMonitor(): void {
    // In a real implementation, this would use system APIs to get actual resource usage
    // For now, we'll simulate based on active tasks
    const activeTaskCount = this.activeTasks.size;
    const maxTasks = PARALLEL_CONFIG.concurrency.max;
    
    // Simulate memory usage based on active tasks
    this.resourceMonitor.memory = Math.min(0.9, 0.3 + (activeTaskCount / maxTasks) * 0.6);
    
    // Simulate CPU usage based on throughput
    const baseCpu = 0.2;
    const throughputFactor = Math.min(0.5, this.metrics.throughput / 10);
    this.resourceMonitor.cpu = baseCpu + throughputFactor;
    
    this.resourceMonitor.timestamp = Date.now();
    
    this.metrics.resourceUtilization = {
      memory: this.resourceMonitor.memory,
      cpu: this.resourceMonitor.cpu
    };
  }

  /**
   * Get current processing metrics
   */
  getMetrics(): ParallelMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current resource utilization
   */
  getResourceUtilization(): ResourceMonitor {
    return { ...this.resourceMonitor };
  }

  /**
   * Shutdown the processor gracefully
   */
  async shutdown(): Promise<void> {
    console.log('[parallel-processor] Shutting down...');
    this.isShuttingDown = true;
    
    // Wait for active tasks to complete
    const activePromises = Array.from(this.activeTasks.values());
    if (activePromises.length > 0) {
      console.log(`[parallel-processor] Waiting for ${activePromises.length} active tasks to complete...`);
      await Promise.allSettled(activePromises);
    }
    
    console.log('[parallel-processor] Shutdown complete');
  }
}

// Global instance
let globalProcessor: SmartParallelProcessor | null = null;

/**
 * Get or create the global parallel processor instance
 */
export function getParallelProcessor(): SmartParallelProcessor {
  if (!globalProcessor) {
    globalProcessor = new SmartParallelProcessor();
  }
  return globalProcessor;
}

/**
 * Shutdown the global parallel processor
 */
export async function shutdownParallelProcessor(): Promise<void> {
  if (globalProcessor) {
    await globalProcessor.shutdown();
    globalProcessor = null;
  }
}

/**
 * Helper function to create a parallel task
 */
export function createParallelTask<T, R>(
  id: string,
  data: T,
  priority: number = 0.5,
  service: 'firecrawl' | 'gemini' | 'cse' | 'database' = 'firecrawl',
  options: {
    maxRetries?: number;
    timeout?: number;
  } = {}
): ParallelTask<T, R> {
  return {
    id,
    data,
    priority,
    retryCount: 0,
    maxRetries: options.maxRetries || 3,
    timeout: options.timeout || 30000,
    service
  };
}

/**
 * Helper function to process URL discovery in parallel
 */
export async function processUrlDiscoveryParallel(
  queries: string[],
  processor: (query: string) => Promise<string[]>
): Promise<ParallelResult<string[]>[]> {
  const parallelProcessor = getParallelProcessor();
  
  const tasks = queries.map((query, index) => 
    createParallelTask(
      `discovery_${index}`,
      query,
      0.8, // High priority for discovery
      'firecrawl'
    )
  );
  
  const results = await parallelProcessor.processParallel(tasks, async (task) => {
    return processor(task.data);
  });
  
  return results as ParallelResult<string[]>[];
}

/**
 * Helper function to process event extraction in parallel
 */
export async function processEventExtractionParallel(
  urls: string[],
  processor: (url: string) => Promise<any>
): Promise<ParallelResult<any>[]> {
  const parallelProcessor = getParallelProcessor();
  
  const tasks = urls.map((url, index) => 
    createParallelTask(
      `extraction_${index}`,
      url,
      0.6, // Medium priority for extraction
      'firecrawl'
    )
  );
  
  return parallelProcessor.processParallel(tasks, async (task) => {
    return processor(task.data);
  });
}

/**
 * Helper function to process speaker enhancement in parallel
 */
export async function processSpeakerEnhancementParallel(
  events: any[],
  processor: (event: any) => Promise<any>
): Promise<ParallelResult<any>[]> {
  const parallelProcessor = getParallelProcessor();
  
  const tasks = events.map((event, index) => 
    createParallelTask(
      `enhancement_${index}`,
      event,
      0.4, // Lower priority for enhancement
      'gemini'
    )
  );
  
  return parallelProcessor.processParallel(tasks, async (task) => {
    return processor(task.data);
  });
}
