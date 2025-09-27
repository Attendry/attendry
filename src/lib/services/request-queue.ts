/**
 * Request Queue Service
 * 
 * This service manages request queuing for rate-limited APIs,
 * ensuring requests are processed in order and within rate limits.
 */

/**
 * Queued request
 */
interface QueuedRequest<T = any> {
  id: string;
  requestFn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  timestamp: number;
  priority: number;
  retries: number;
  maxRetries: number;
}

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  requestsPerSecond: number;
  burstLimit: number;
  windowSize: number; // in milliseconds
}

/**
 * Request queue service
 */
export class RequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private rateLimitConfig: RateLimitConfig;
  private requestCount = 0;
  private windowStart = Date.now();
  private burstCount = 0;
  private burstWindowStart = Date.now();

  constructor(rateLimitConfig: RateLimitConfig) {
    this.rateLimitConfig = rateLimitConfig;
  }

  /**
   * Add a request to the queue
   */
  async enqueue<T>(
    requestFn: () => Promise<T>,
    options: {
      priority?: number;
      maxRetries?: number;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const {
      priority = 0,
      maxRetries = 3,
      timeout = 30000, // 30 seconds
    } = options;

    return new Promise<T>((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: this.generateRequestId(),
        requestFn,
        resolve,
        reject,
        timestamp: Date.now(),
        priority,
        retries: 0,
        maxRetries,
      };

      // Add to queue with priority ordering
      this.insertByPriority(request);
      
      console.log(`[QUEUE] Enqueued request ${request.id} with priority ${priority}`);

      // Set timeout
      if (timeout > 0) {
        setTimeout(() => {
          if (this.queue.find(r => r.id === request.id)) {
            this.removeRequest(request.id);
            reject(new Error(`Request ${request.id} timed out after ${timeout}ms`));
          }
        }, timeout);
      }

      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Insert request by priority (higher priority first)
   */
  private insertByPriority(request: QueuedRequest): void {
    let insertIndex = this.queue.length;
    
    for (let i = 0; i < this.queue.length; i++) {
      if (request.priority > this.queue[i].priority) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, request);
  }

  /**
   * Remove request from queue
   */
  private removeRequest(requestId: string): void {
    const index = this.queue.findIndex(r => r.id === requestId);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    console.log(`[QUEUE] Starting queue processing with ${this.queue.length} requests`);

    while (this.queue.length > 0) {
      // Check rate limits
      await this.enforceRateLimit();

      // Get next request
      const request = this.queue.shift();
      if (!request) {
        break;
      }

      try {
        console.log(`[QUEUE] Processing request ${request.id}`);
        const result = await request.requestFn();
        request.resolve(result);
        console.log(`[QUEUE] Request ${request.id} completed successfully`);
      } catch (error) {
        console.error(`[QUEUE] Request ${request.id} failed:`, error);
        
        // Retry logic
        if (request.retries < request.maxRetries) {
          request.retries++;
          console.log(`[QUEUE] Retrying request ${request.id} (attempt ${request.retries + 1}/${request.maxRetries + 1})`);
          
          // Add back to queue with lower priority
          request.priority = Math.max(0, request.priority - 1);
          this.insertByPriority(request);
        } else {
          request.reject(error);
        }
      }
    }

    this.processing = false;
    console.log(`[QUEUE] Queue processing completed`);
  }

  /**
   * Enforce rate limits
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset window if needed
    if (now - this.windowStart >= this.rateLimitConfig.windowSize) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // Reset burst window if needed
    if (now - this.burstWindowStart >= 1000) { // 1 second burst window
      this.burstCount = 0;
      this.burstWindowStart = now;
    }

    // Check burst limit
    if (this.burstCount >= this.rateLimitConfig.burstLimit) {
      const waitTime = 1000 - (now - this.burstWindowStart);
      if (waitTime > 0) {
        console.log(`[QUEUE] Burst limit reached, waiting ${waitTime}ms`);
        await this.sleep(waitTime);
        return this.enforceRateLimit();
      }
    }

    // Check rate limit
    const maxRequestsPerWindow = Math.floor(
      (this.rateLimitConfig.requestsPerSecond * this.rateLimitConfig.windowSize) / 1000
    );

    if (this.requestCount >= maxRequestsPerWindow) {
      const waitTime = this.rateLimitConfig.windowSize - (now - this.windowStart);
      if (waitTime > 0) {
        console.log(`[QUEUE] Rate limit reached, waiting ${waitTime}ms`);
        await this.sleep(waitTime);
        return this.enforceRateLimit();
      }
    }

    // Increment counters
    this.requestCount++;
    this.burstCount++;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueLength: number;
    processing: boolean;
    requestCount: number;
    burstCount: number;
    windowStart: number;
    burstWindowStart: number;
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      requestCount: this.requestCount,
      burstCount: this.burstCount,
      windowStart: this.windowStart,
      burstWindowStart: this.burstWindowStart,
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    // Reject all pending requests
    for (const request of this.queue) {
      request.reject(new Error('Queue cleared'));
    }
    this.queue = [];
    console.log('[QUEUE] Queue cleared');
  }

  /**
   * Update rate limit configuration
   */
  updateRateLimit(config: Partial<RateLimitConfig>): void {
    this.rateLimitConfig = { ...this.rateLimitConfig, ...config };
    console.log('[QUEUE] Rate limit configuration updated:', this.rateLimitConfig);
  }
}

/**
 * Service-specific request queues
 */
class ServiceQueues {
  private queues = new Map<string, RequestQueue>();

  /**
   * Get or create queue for a service
   */
  getQueue(service: string, rateLimitConfig: RateLimitConfig): RequestQueue {
    if (!this.queues.has(service)) {
      this.queues.set(service, new RequestQueue(rateLimitConfig));
    }
    return this.queues.get(service)!;
  }

  /**
   * Get all queue statistics
   */
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [service, queue] of this.queues.entries()) {
      stats[service] = queue.getStats();
    }
    return stats;
  }

  /**
   * Clear all queues
   */
  clearAll(): void {
    for (const queue of this.queues.values()) {
      queue.clear();
    }
  }
}

/**
 * Global service queues instance
 */
const globalServiceQueues = new ServiceQueues();

/**
 * Get queue for a specific service
 */
export function getServiceQueue(service: string, rateLimitConfig: RateLimitConfig): RequestQueue {
  return globalServiceQueues.getQueue(service, rateLimitConfig);
}

/**
 * Get all queue statistics
 */
export function getAllQueueStats(): Record<string, any> {
  return globalServiceQueues.getAllStats();
}

/**
 * Clear all queues
 */
export function clearAllQueues(): void {
  globalServiceQueues.clearAll();
}

/**
 * Predefined rate limit configurations for common services
 */
export const RATE_LIMIT_CONFIGS = {
  GOOGLE_CSE: {
    requestsPerSecond: 10,
    burstLimit: 5,
    windowSize: 1000,
  },
  FIRECRAWL: {
    requestsPerSecond: 2,
    burstLimit: 1,
    windowSize: 1000,
  },
  GEMINI: {
    requestsPerSecond: 15,
    burstLimit: 10,
    windowSize: 1000,
  },
  SUPABASE: {
    requestsPerSecond: 100,
    burstLimit: 50,
    windowSize: 1000,
  },
} as const;
