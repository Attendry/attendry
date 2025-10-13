/**
 * Circuit Breaker Service
 * 
 * This service implements the circuit breaker pattern to prevent
 * cascading failures and provide graceful degradation when external
 * services are unavailable.
 */

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, requests are blocked
  HALF_OPEN = 'HALF_OPEN' // Testing if service is back
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;        // Number of failures before opening
  successThreshold: number;        // Number of successes to close from half-open
  timeout: number;                 // Timeout for individual requests (ms)
  resetTimeout: number;            // Time to wait before trying half-open (ms)
  monitoringPeriod: number;        // Period for monitoring failures (ms)
  maxRequests: number;             // Max requests in half-open state
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  requestCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  nextAttemptTime: number | null;
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private requestCount = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private nextAttemptTime: number | null = null;
  private halfOpenRequestCount = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 10000,
      resetTimeout: 60000,
      monitoringPeriod: 60000,
      maxRequests: 3,
      ...config,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.halfOpenRequestCount = 0;
        console.log(`[CIRCUIT_BREAKER] Circuit moved to HALF_OPEN state`);
      } else {
        throw new Error(`Circuit breaker is OPEN. Next attempt at ${new Date(this.nextAttemptTime!).toISOString()}`);
      }
    }

    // Check half-open request limit
    if (this.state === CircuitBreakerState.HALF_OPEN && this.halfOpenRequestCount >= this.config.maxRequests) {
      throw new Error('Circuit breaker is HALF_OPEN and request limit reached');
    }

    this.requestCount++;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenRequestCount++;
    }

    try {
      // Execute the function with timeout
      const result = await this.executeWithTimeout(fn);
      
      // Handle success
      this.onSuccess();
      return result;
    } catch (error) {
      // Handle failure
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Request timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      fn()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttemptTime = null;
        console.log(`[CIRCUIT_BREAKER] Circuit moved to CLOSED state after ${this.successCount} successes`);
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(error?: any): void {
    // Don't trip circuit breaker on programmer errors
    if (this.isTransientError(error)) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.state === CircuitBreakerState.CLOSED) {
        if (this.failureCount >= this.config.failureThreshold) {
          this.state = CircuitBreakerState.OPEN;
          this.nextAttemptTime = Date.now() + this.config.resetTimeout;
          console.log(`[CIRCUIT_BREAKER] Circuit moved to OPEN state after ${this.failureCount} failures`);
        }
      } else if (this.state === CircuitBreakerState.HALF_OPEN) {
        // Move back to open state on failure in half-open
        this.state = CircuitBreakerState.OPEN;
        this.nextAttemptTime = Date.now() + this.config.resetTimeout;
        this.successCount = 0;
        console.log(`[CIRCUIT_BREAKER] Circuit moved back to OPEN state after failure in HALF_OPEN`);
      }
    } else {
      console.log(`[CIRCUIT_BREAKER] Non-transient error, not tripping circuit:`, error?.name || error?.message);
    }
  }

  /**
   * Check if error is transient (should trip circuit breaker)
   */
  private isTransientError(error: any): boolean {
    if (!error) return true; // Unknown error, treat as transient
    
    // Programmer errors - don't trip circuit
    if (error.name === 'ReferenceError' || 
        error.name === 'TypeError' || 
        error.name === 'SyntaxError') {
      return false;
    }
    
    // HTTP 4xx from our own code - don't trip circuit
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return false;
    }
    
    // Transient errors - should trip circuit
    if (error.code === 23 || // TIMEOUT_ERR
        error.name === 'AbortError' ||
        error.statusCode >= 500) {
      return true;
    }
    
    // Default to transient for unknown errors
    return true;
  }

  /**
   * Check if circuit should attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.nextAttemptTime) {
      return false;
    }
    return Date.now() >= this.nextAttemptTime;
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Check if circuit is available for requests
   */
  isAvailable(): boolean {
    if (this.state === CircuitBreakerState.CLOSED) {
      return true;
    }
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      return this.halfOpenRequestCount < this.config.maxRequests;
    }
    
    return false;
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenRequestCount = 0;
    this.nextAttemptTime = null;
    console.log(`[CIRCUIT_BREAKER] Circuit reset to CLOSED state`);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
    console.log(`[CIRCUIT_BREAKER] Configuration updated:`, this.config);
  }
}

/**
 * Service-specific circuit breakers
 */
class ServiceCircuitBreakers {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create circuit breaker for a service
   */
  getBreaker(service: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(service)) {
      this.breakers.set(service, new CircuitBreaker(config));
    }
    return this.breakers.get(service)!;
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [service, breaker] of this.breakers.entries()) {
      stats[service] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

/**
 * Global service circuit breakers instance
 */
const globalServiceBreakers = new ServiceCircuitBreakers();

/**
 * Get circuit breaker for a specific service
 */
export function getServiceCircuitBreaker(service: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  return globalServiceBreakers.getBreaker(service, config);
}

/**
 * Execute a function with circuit breaker protection for a specific service
 */
export async function executeWithCircuitBreaker<T>(
  service: string,
  fn: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>
): Promise<T> {
  const breaker = getServiceCircuitBreaker(service, config);
  return breaker.execute(fn);
}

/**
 * Get all circuit breaker statistics
 */
export function getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  return globalServiceBreakers.getAllStats();
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers(): void {
  globalServiceBreakers.resetAll();
}

/**
 * Predefined circuit breaker configurations for common services
 */
export const CIRCUIT_BREAKER_CONFIGS = {
  GOOGLE_CSE: {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 10000,
    resetTimeout: 30000,
    monitoringPeriod: 60000,
    maxRequests: 2,
  },
  FIRECRAWL: {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 20000,
    resetTimeout: 30000,
    monitoringPeriod: 60000,
    maxRequests: 2,
  },
  GEMINI: {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 20000,
    resetTimeout: 30000,
    monitoringPeriod: 60000,
    maxRequests: 3,
  },
  SUPABASE: {
    failureThreshold: 10,
    successThreshold: 5,
    timeout: 5000,
    resetTimeout: 15000,
    monitoringPeriod: 60000,
    maxRequests: 5,
  },
} as const;
