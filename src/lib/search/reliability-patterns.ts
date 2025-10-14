/**
 * Reliability Patterns - Resilience Implementation
 * 
 * Implements timeouts, retries, circuit breakers, and rate limiters
 */

export interface TimeoutConfig {
  default: number; // 30 seconds
  search: number; // 10 seconds
  extraction: number; // 30 seconds
  llm: number; // 60 seconds
  cache: number; // 5 seconds
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs: number;
  retryableStatusCodes: number[];
  retryableErrors: string[];
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // 5 failures
  recoveryTimeout: number; // 30 seconds
  monitoringWindow: number; // 60 seconds
  halfOpenMaxCalls: number; // 3 calls
}

export interface RateLimiterConfig {
  requestsPerSecond: number;
  burstSize: number;
  windowSizeMs: number;
}

/**
 * Default configurations
 */
const DEFAULT_TIMEOUTS: TimeoutConfig = {
  default: 30000,
  search: 10000,
  extraction: 30000,
  llm: 60000,
  cache: 5000
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterMs: 500,
  retryableStatusCodes: [429, 500, 502, 503, 504],
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED']
};

const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 30000,
  monitoringWindow: 60000,
  halfOpenMaxCalls: 3
};

const DEFAULT_RATE_LIMITER: RateLimiterConfig = {
  requestsPerSecond: 10,
  burstSize: 20,
  windowSizeMs: 1000
};

/**
 * Timeout Manager
 */
export class TimeoutManager {
  private config: TimeoutConfig;

  constructor(config: TimeoutConfig = DEFAULT_TIMEOUTS) {
    this.config = config;
  }

  /**
   * Execute function with timeout
   */
  async withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number = this.config.default,
    operation: string = 'operation'
  ): Promise<T> {
    return Promise.race([
      fn(),
      this.createTimeoutPromise(timeoutMs, operation)
    ]);
  }

  /**
   * Execute search with timeout
   */
  async withSearchTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return this.withTimeout(fn, this.config.search, 'search');
  }

  /**
   * Execute extraction with timeout
   */
  async withExtractionTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return this.withTimeout(fn, this.config.extraction, 'extraction');
  }

  /**
   * Execute LLM operation with timeout
   */
  async withLLMTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return this.withTimeout(fn, this.config.llm, 'llm');
  }

  /**
   * Execute cache operation with timeout
   */
  async withCacheTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return this.withTimeout(fn, this.config.cache, 'cache');
  }

  private createTimeoutPromise<T>(timeoutMs: number, operation: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout: ${operation} exceeded ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }
}

/**
 * Retry Manager with Exponential Backoff
 */
export class RetryManager {
  private config: RetryConfig;

  constructor(config: RetryConfig = DEFAULT_RETRY_CONFIG) {
    this.config = config;
  }

  /**
   * Execute function with retry logic
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    operation: string = 'operation'
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if this is the last attempt
        if (attempt === this.config.maxRetries) {
          throw lastError;
        }

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          throw lastError;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);
        
        console.log(`Retry attempt ${attempt + 1}/${this.config.maxRetries} for ${operation} in ${delay}ms`);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    // Check for retryable error messages
    for (const retryableError of this.config.retryableErrors) {
      if (error.message.includes(retryableError)) {
        return true;
      }
    }

    // Check for retryable status codes
    const statusMatch = error.message.match(/HTTP (\d{3})/);
    if (statusMatch) {
      const statusCode = parseInt(statusMatch[1]);
      return this.config.retryableStatusCodes.includes(statusCode);
    }

    return false;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);
    const jitter = Math.random() * this.config.jitterMs;
    
    return Math.floor(cappedDelay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;

  constructor(config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER) {
    this.config = config;
  }

  /**
   * Execute function with circuit breaker
   */
  async execute<T>(fn: () => Promise<T>, operation: string = 'operation'): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.halfOpenCalls = 0;
      } else {
        throw new Error(`Circuit breaker OPEN for ${operation}`);
      }
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      throw new Error(`Circuit breaker HALF_OPEN limit reached for ${operation}`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get circuit breaker state
   */
  getState(): { state: string; failureCount: number; lastFailureTime: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenCalls = 0;
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
      this.state = 'OPEN';
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.recoveryTimeout;
  }
}

/**
 * Rate Limiter Implementation
 */
export class RateLimiter {
  private config: RateLimiterConfig;
  private requests: number[] = [];
  private tokens: number;

  constructor(config: RateLimiterConfig = DEFAULT_RATE_LIMITER) {
    this.config = config;
    this.tokens = config.burstSize;
  }

  /**
   * Check if request is allowed
   */
  async isAllowed(): Promise<boolean> {
    const now = Date.now();
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.config.windowSizeMs);
    
    // Check if we're within the rate limit
    if (this.requests.length >= this.config.requestsPerSecond) {
      return false;
    }

    // Check token bucket
    if (this.tokens <= 0) {
      return false;
    }

    // Allow request
    this.requests.push(now);
    this.tokens--;
    
    // Refill tokens
    this.refillTokens(now);
    
    return true;
  }

  /**
   * Wait for rate limit
   */
  async waitForRateLimit(): Promise<void> {
    while (!(await this.isAllowed())) {
      await this.sleep(100); // Wait 100ms before checking again
    }
  }

  /**
   * Get rate limit status
   */
  getStatus(): {
    requestsInWindow: number;
    tokensAvailable: number;
    requestsPerSecond: number;
    burstSize: number;
  } {
    return {
      requestsInWindow: this.requests.length,
      tokensAvailable: this.tokens,
      requestsPerSecond: this.config.requestsPerSecond,
      burstSize: this.config.burstSize
    };
  }

  private refillTokens(now: number): void {
    const timeSinceLastRefill = now - (this.requests[0] || now);
    const tokensToAdd = Math.floor(timeSinceLastRefill / this.config.windowSizeMs);
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.config.burstSize, this.tokens + tokensToAdd);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Resilience Manager - Orchestrates all resilience patterns
 */
export class ResilienceManager {
  private timeoutManager: TimeoutManager;
  private retryManager: RetryManager;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();

  constructor(
    timeoutConfig?: TimeoutConfig,
    retryConfig?: RetryConfig
  ) {
    this.timeoutManager = new TimeoutManager(timeoutConfig);
    this.retryManager = new RetryManager(retryConfig);
  }

  /**
   * Get or create circuit breaker for service
   */
  getCircuitBreaker(service: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.circuitBreakers.has(service)) {
      this.circuitBreakers.set(service, new CircuitBreaker(config));
    }
    return this.circuitBreakers.get(service)!;
  }

  /**
   * Get or create rate limiter for service
   */
  getRateLimiter(service: string, config?: RateLimiterConfig): RateLimiter {
    if (!this.rateLimiters.has(service)) {
      this.rateLimiters.set(service, new RateLimiter(config));
    }
    return this.rateLimiters.get(service)!;
  }

  /**
   * Execute with full resilience patterns
   */
  async executeWithResilience<T>(
    service: string,
    operation: string,
    fn: () => Promise<T>,
    options: {
      timeout?: number;
      retry?: boolean;
      circuitBreaker?: boolean;
      rateLimit?: boolean;
    } = {}
  ): Promise<T> {
    const {
      timeout = this.timeoutManager['config'].default,
      retry = true,
      circuitBreaker = true,
      rateLimit = true
    } = options;

    // Apply rate limiting
    if (rateLimit) {
      const rateLimiter = this.getRateLimiter(service);
      await rateLimiter.waitForRateLimit();
    }

    // Apply circuit breaker
    if (circuitBreaker) {
      const breaker = this.getCircuitBreaker(service);
      return breaker.execute(async () => {
        // Apply retry logic
        if (retry) {
          return this.retryManager.withRetry(async () => {
            // Apply timeout
            return this.timeoutManager.withTimeout(fn, timeout, operation);
          }, operation);
        } else {
          // Apply timeout only
          return this.timeoutManager.withTimeout(fn, timeout, operation);
        }
      }, operation);
    } else {
      // Apply retry and timeout without circuit breaker
      if (retry) {
        return this.retryManager.withRetry(async () => {
          return this.timeoutManager.withTimeout(fn, timeout, operation);
        }, operation);
      } else {
        return this.timeoutManager.withTimeout(fn, timeout, operation);
      }
    }
  }

  /**
   * Execute search with resilience
   */
  async executeSearch<T>(service: string, fn: () => Promise<T>): Promise<T> {
    return this.executeWithResilience(service, 'search', fn, {
      timeout: this.timeoutManager['config'].search,
      retry: true,
      circuitBreaker: true,
      rateLimit: true
    });
  }

  /**
   * Execute extraction with resilience
   */
  async executeExtraction<T>(service: string, fn: () => Promise<T>): Promise<T> {
    return this.executeWithResilience(service, 'extraction', fn, {
      timeout: this.timeoutManager['config'].extraction,
      retry: true,
      circuitBreaker: true,
      rateLimit: true
    });
  }

  /**
   * Execute LLM operation with resilience
   */
  async executeLLM<T>(service: string, fn: () => Promise<T>): Promise<T> {
    return this.executeWithResilience(service, 'llm', fn, {
      timeout: this.timeoutManager['config'].llm,
      retry: true,
      circuitBreaker: true,
      rateLimit: true
    });
  }

  /**
   * Get resilience status for all services
   */
  getResilienceStatus(): {
    circuitBreakers: Record<string, any>;
    rateLimiters: Record<string, any>;
  } {
    const circuitBreakers: Record<string, any> = {};
    const rateLimiters: Record<string, any> = {};

    for (const [service, breaker] of this.circuitBreakers) {
      circuitBreakers[service] = breaker.getState();
    }

    for (const [service, limiter] of this.rateLimiters) {
      rateLimiters[service] = limiter.getStatus();
    }

    return { circuitBreakers, rateLimiters };
  }
}

/**
 * Global resilience manager
 */
export const resilienceManager = new ResilienceManager();
