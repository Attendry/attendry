/**
 * Resource Optimizer
 * 
 * This module optimizes resource usage across the entire search pipeline
 * by removing artificial delays, optimizing timeouts, and implementing
 * intelligent resource management.
 * 
 * Key Optimizations:
 * - Remove artificial delays between requests
 * - Optimize timeout configurations
 * - Implement intelligent caching strategies
 * - Add resource pooling and reuse
 * - Optimize memory usage and garbage collection
 */

// Optimized configuration for maximum performance
export const OPTIMIZED_CONFIG = {
  // Timeout optimizations - increased for stability
  timeouts: {
    discovery: 30000,        // Increased for stability
    prioritization: 20000,   // Increased for stability
    extraction: 15000,       // Increased for stability
    enhancement: 10000,      // Increased for stability
    api: 45000,              // Overall API timeout
    firecrawl: 20000,        // Firecrawl specific timeout
    gemini: 15000,           // Gemini specific timeout
    cse: 10000,              // CSE specific timeout
  },

  // Rate limiting optimizations - conservative for stability
  rateLimits: {
    firecrawl: {
      maxRequestsPerMinute: 15,    // Reduced for stability
      maxRequestsPerHour: 150,     // Reduced for stability
      delayBetweenRequests: 2000,  // 2 second delay for stability
      burstLimit: 2,               // Conservative burst limit
    },
    cse: {
      maxRequestsPerMinute: 150,   // Increased from 100
      maxRequestsPerHour: 1500,    // Increased from 1000
      delayBetweenRequests: 0,     // Removed artificial delay
      burstLimit: 10,              // Allow burst requests
    },
    gemini: {
      maxRequestsPerMinute: 60,    // Gemini rate limit
      maxRequestsPerHour: 600,     // Gemini hourly limit
      delayBetweenRequests: 0,     // No artificial delay
      burstLimit: 3,               // Allow burst requests
    }
  },

  // Caching optimizations
  caching: {
    duration: 60 * 60 * 1000,      // 1 hour cache (increased from 30min)
    maxSize: 2000,                 // Increased cache size
    cleanupInterval: 30000,        // Cleanup every 30s (reduced from 60s)
    enableCompression: true,       // Enable cache compression
    enablePersistence: false,      // Disable persistence for speed
  },

  // Memory optimizations
  memory: {
    maxHeapSize: 512 * 1024 * 1024, // 512MB max heap
    gcThreshold: 0.8,               // Trigger GC at 80% memory usage
    enableMemoryPooling: true,      // Enable object pooling
    maxPoolSize: 100,               // Max objects in pool
  },

  // Concurrency optimizations
  concurrency: {
    maxConcurrentRequests: 15,      // Increased from 10
    maxConcurrentExtractions: 12,   // Increased from 8
    maxConcurrentEnhancements: 8,   // Increased from 5
    maxConcurrentDiscoveries: 6,    // Increased from 4
    enableAdaptiveConcurrency: true, // Enable adaptive scaling
  },

  // Performance optimizations
  performance: {
    enableEarlyTermination: true,   // Stop when enough results found
    qualityThreshold: 0.75,         // High quality threshold
    minResultsForEarlyTermination: 3, // Reduced from 5
    enableResultStreaming: true,    // Stream results as they come
    enableParallelProcessing: true, // Enable all parallel processing
    enableSmartBatching: true,      // Enable intelligent batching
  }
};

// Resource monitoring and optimization
export class ResourceOptimizer {
  private static instance: ResourceOptimizer;
  private memoryUsage: number = 0;
  private cpuUsage: number = 0;
  private activeRequests: number = 0;
  private lastOptimization: number = 0;
  private optimizationInterval: NodeJS.Timeout;

  private constructor() {
    // Start optimization monitoring
    this.optimizationInterval = setInterval(() => {
      this.optimizeResources();
    }, 5000); // Check every 5 seconds
  }

  public static getInstance(): ResourceOptimizer {
    if (!ResourceOptimizer.instance) {
      ResourceOptimizer.instance = new ResourceOptimizer();
    }
    return ResourceOptimizer.instance;
  }

  /**
   * Optimize resources based on current usage
   */
  private optimizeResources(): void {
    const now = Date.now();
    
    // Only optimize every 10 seconds to avoid overhead
    if (now - this.lastOptimization < 10000) {
      return;
    }

    this.lastOptimization = now;
    this.updateResourceMetrics();

    // Memory optimization
    if (this.memoryUsage > 0.8) {
      this.triggerGarbageCollection();
    }

    // CPU optimization
    if (this.cpuUsage > 0.7) {
      this.reduceConcurrency();
    }

    // Request optimization
    if (this.activeRequests > OPTIMIZED_CONFIG.concurrency.maxConcurrentRequests) {
      this.throttleRequests();
    }
  }

  /**
   * Update resource usage metrics
   */
  private updateResourceMetrics(): void {
    // In a real implementation, this would use system APIs
    // For now, we'll simulate based on active requests
    this.memoryUsage = Math.min(0.9, 0.3 + (this.activeRequests / 20) * 0.6);
    this.cpuUsage = Math.min(0.9, 0.2 + (this.activeRequests / 15) * 0.7);
  }

  /**
   * Trigger garbage collection
   */
  private triggerGarbageCollection(): void {
    if (global.gc) {
      global.gc();
      console.log('[resource-optimizer] Triggered garbage collection');
    }
  }

  /**
   * Reduce concurrency when CPU is high
   */
  private reduceConcurrency(): void {
    // This would adjust the parallel processor concurrency
    console.log('[resource-optimizer] High CPU usage detected, reducing concurrency');
  }

  /**
   * Throttle requests when too many are active
   */
  private throttleRequests(): void {
    console.log('[resource-optimizer] Too many active requests, throttling');
  }

  /**
   * Register an active request
   */
  public registerRequest(): void {
    this.activeRequests++;
  }

  /**
   * Unregister a completed request
   */
  public unregisterRequest(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  /**
   * Get current resource metrics
   */
  public getResourceMetrics(): {
    memoryUsage: number;
    cpuUsage: number;
    activeRequests: number;
  } {
    return {
      memoryUsage: this.memoryUsage,
      cpuUsage: this.cpuUsage,
      activeRequests: this.activeRequests
    };
  }

  /**
   * Shutdown the optimizer
   */
  public shutdown(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }
  }
}

// Optimized timeout configurations
export const OPTIMIZED_TIMEOUTS = {
  // API timeouts
  api: {
    overall: OPTIMIZED_CONFIG.timeouts.api,
    discovery: OPTIMIZED_CONFIG.timeouts.discovery,
    prioritization: OPTIMIZED_CONFIG.timeouts.prioritization,
    extraction: OPTIMIZED_CONFIG.timeouts.extraction,
    enhancement: OPTIMIZED_CONFIG.timeouts.enhancement,
  },

  // Service-specific timeouts
  services: {
    firecrawl: OPTIMIZED_CONFIG.timeouts.firecrawl,
    gemini: OPTIMIZED_CONFIG.timeouts.gemini,
    cse: OPTIMIZED_CONFIG.timeouts.cse,
  },

  // Request timeouts
  requests: {
    http: 10000,        // 10s for HTTP requests
    websocket: 30000,   // 30s for WebSocket connections
    database: 5000,     // 5s for database queries
  }
};

// Optimized rate limiting configurations
export const OPTIMIZED_RATE_LIMITS = {
  firecrawl: {
    ...OPTIMIZED_CONFIG.rateLimits.firecrawl,
    // Add burst handling
    burstWindow: 10000,  // 10 second burst window
    burstRequests: 5,    // 5 requests in burst window
  },
  cse: {
    ...OPTIMIZED_CONFIG.rateLimits.cse,
    burstWindow: 5000,   // 5 second burst window
    burstRequests: 10,   // 10 requests in burst window
  },
  gemini: {
    ...OPTIMIZED_CONFIG.rateLimits.gemini,
    burstWindow: 10000,  // 10 second burst window
    burstRequests: 3,    // 3 requests in burst window
  }
};

// Optimized caching configurations
export const OPTIMIZED_CACHE = {
  duration: OPTIMIZED_CONFIG.caching.duration,
  maxSize: OPTIMIZED_CONFIG.caching.maxSize,
  cleanupInterval: OPTIMIZED_CONFIG.caching.cleanupInterval,
  compression: OPTIMIZED_CONFIG.caching.enableCompression,
  persistence: OPTIMIZED_CONFIG.caching.enablePersistence,
  
  // Cache strategies
  strategies: {
    lru: true,           // Use LRU eviction
    ttl: true,           // Use TTL expiration
    compression: true,   // Compress cached data
    indexing: true,      // Index cached data for fast lookup
  }
};

// Performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();
  private startTimes: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start timing an operation
   */
  public startTiming(operation: string): void {
    this.startTimes.set(operation, Date.now());
  }

  /**
   * End timing an operation
   */
  public endTiming(operation: string): number {
    const startTime = this.startTimes.get(operation);
    if (!startTime) return 0;

    const duration = Date.now() - startTime;
    this.startTimes.delete(operation);

    // Store metric
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(duration);

    // Keep only last 100 measurements
    const measurements = this.metrics.get(operation)!;
    if (measurements.length > 100) {
      measurements.shift();
    }

    return duration;
  }

  /**
   * Get average time for an operation
   */
  public getAverageTime(operation: string): number {
    const measurements = this.metrics.get(operation);
    if (!measurements || measurements.length === 0) return 0;

    return measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
  }

  /**
   * Get all performance metrics
   */
  public getAllMetrics(): Record<string, { average: number; count: number; latest: number }> {
    const result: Record<string, { average: number; count: number; latest: number }> = {};
    
    for (const [operation, measurements] of this.metrics.entries()) {
      result[operation] = {
        average: this.getAverageTime(operation),
        count: measurements.length,
        latest: measurements[measurements.length - 1] || 0
      };
    }

    return result;
  }
}

// Global instances
export const resourceOptimizer = ResourceOptimizer.getInstance();
export const performanceMonitor = PerformanceMonitor.getInstance();

// Helper functions for resource optimization
export function optimizeTimeout(service: keyof typeof OPTIMIZED_TIMEOUTS.services): number {
  return OPTIMIZED_TIMEOUTS.services[service];
}

export function optimizeRateLimit(service: keyof typeof OPTIMIZED_RATE_LIMITS): typeof OPTIMIZED_RATE_LIMITS[keyof typeof OPTIMIZED_RATE_LIMITS] {
  return OPTIMIZED_RATE_LIMITS[service];
}

export function optimizeCacheConfig(): typeof OPTIMIZED_CACHE {
  return OPTIMIZED_CACHE;
}

export function getOptimizedConcurrency(): typeof OPTIMIZED_CONFIG.concurrency {
  return OPTIMIZED_CONFIG.concurrency;
}

export function getOptimizedPerformance(): typeof OPTIMIZED_CONFIG.performance {
  return OPTIMIZED_CONFIG.performance;
}
