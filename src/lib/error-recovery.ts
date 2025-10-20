/**
 * Error Recovery System
 * 
 * Provides comprehensive error handling with retry logic, exponential backoff,
 * graceful degradation, and circuit breaker patterns for the search pipeline.
 */

import { 
  circuitBreakerManager, 
  executeWithCircuitBreaker as executeWithAdvancedCircuitBreakerImport, 
  CircuitState 
} from "./circuit-breaker";
import { 
  retryManager, 
  executeWithRetry as executeWithAdvancedRetryImport,
  RetryErrorType,
  RetryStrategy,
  RetryConfig as RetryConfigType
} from "./retry-manager";

// Error types for different failure scenarios
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// Error classification
export interface ClassifiedError {
  type: ErrorType;
  message: string;
  retryable: boolean;
  originalError: any;
  context?: Record<string, any>;
}

// Retry configuration
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

// Default retry configurations for different operations
export const RETRY_CONFIGS: Record<string, RetryConfig> = {
  firecrawl: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true
  },
  gemini: {
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 2,
    jitter: true
  },
  cse: {
    maxAttempts: 2,
    baseDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitter: true
  },
  database: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    jitter: true
  },
  default: {
    maxAttempts: 2,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitter: true
  }
};

/**
 * Classify an error to determine how to handle it
 */
export function classifyError(error: any, context?: Record<string, any>): ClassifiedError {
  const message = error?.message || String(error);
  
  // Network errors
  if (error?.code === 'ECONNREFUSED' || 
      error?.code === 'ENOTFOUND' || 
      error?.code === 'ETIMEDOUT' ||
      message.includes('fetch failed') ||
      message.includes('network error')) {
    return {
      type: ErrorType.NETWORK_ERROR,
      message,
      retryable: true,
      originalError: error,
      context
    };
  }
  
  // Timeout errors
  if (error?.code === 'ETIMEDOUT' || 
      message.includes('timeout') ||
      message.includes('timed out')) {
    return {
      type: ErrorType.TIMEOUT_ERROR,
      message,
      retryable: true,
      originalError: error,
      context
    };
  }
  
  // Rate limit errors
  if (error?.status === 429 || 
      error?.statusCode === 429 ||
      message.includes('rate limit') ||
      message.includes('too many requests')) {
    return {
      type: ErrorType.RATE_LIMIT_ERROR,
      message,
      retryable: true,
      originalError: error,
      context
    };
  }
  
  // Authentication errors
  if (error?.status === 401 || 
      error?.statusCode === 401 ||
      error?.status === 403 ||
      error?.statusCode === 403 ||
      message.includes('unauthorized') ||
      message.includes('forbidden')) {
    return {
      type: ErrorType.AUTHENTICATION_ERROR,
      message,
      retryable: false,
      originalError: error,
      context
    };
  }
  
  // Validation errors
  if (error?.status === 400 || 
      error?.statusCode === 400 ||
      message.includes('validation') ||
      message.includes('invalid')) {
    return {
      type: ErrorType.VALIDATION_ERROR,
      message,
      retryable: false,
      originalError: error,
      context
    };
  }
  
  // Default to unknown error
  return {
    type: ErrorType.UNKNOWN_ERROR,
    message,
    retryable: true,
    originalError: error,
    context
  };
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
  
  if (config.jitter) {
    // Add jitter to prevent thundering herd
    const jitterAmount = cappedDelay * 0.1;
    return cappedDelay + (Math.random() * jitterAmount * 2 - jitterAmount);
  }
  
  return cappedDelay;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute operation with retry logic and exponential backoff
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationType: string = 'default',
  customConfig?: Partial<RetryConfig>
): Promise<T> {
  const config = { ...RETRY_CONFIGS[operationType] || RETRY_CONFIGS.default, ...customConfig };
  let lastError: any;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await operation();
      
      if (attempt > 1) {
        console.log(`[error-recovery] Operation succeeded on attempt ${attempt} for ${operationType}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      const classifiedError = classifyError(error, { operationType, attempt });
      
      console.warn(`[error-recovery] Attempt ${attempt}/${config.maxAttempts} failed for ${operationType}:`, {
        errorType: classifiedError.type,
        message: classifiedError.message,
        retryable: classifiedError.retryable
      });
      
      // Don't retry if error is not retryable
      if (!classifiedError.retryable) {
        console.error(`[error-recovery] Non-retryable error for ${operationType}:`, classifiedError.message);
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === config.maxAttempts) {
        console.error(`[error-recovery] All ${config.maxAttempts} attempts failed for ${operationType}`);
        throw error;
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt, config);
      console.log(`[error-recovery] Waiting ${delay}ms before retry ${attempt + 1} for ${operationType}`);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Execute operation with graceful degradation
 */
export async function executeWithGracefulDegradation<T>(
  primaryOperation: () => Promise<T>,
  fallbackOperation: () => Promise<T>,
  operationType: string = 'default'
): Promise<T> {
  try {
    return await executeWithRetry(primaryOperation, operationType);
  } catch (error) {
    console.warn(`[error-recovery] Primary operation failed for ${operationType}, trying fallback:`, error);
    
    try {
      return await executeWithRetry(fallbackOperation, operationType);
    } catch (fallbackError) {
      console.error(`[error-recovery] Both primary and fallback operations failed for ${operationType}:`, {
        primaryError: error,
        fallbackError
      });
      throw fallbackError;
    }
  }
}

/**
 * Execute multiple operations with fallback chain
 */
export async function executeWithFallbackChain<T>(
  operations: Array<() => Promise<T>>,
  operationType: string = 'default'
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < operations.length; i++) {
    try {
      return await executeWithRetry(operations[i], operationType);
    } catch (error) {
      lastError = error;
      console.warn(`[error-recovery] Operation ${i + 1}/${operations.length} failed for ${operationType}:`, error);
      
      // If this is the last operation, throw the error
      if (i === operations.length - 1) {
        console.error(`[error-recovery] All ${operations.length} operations failed for ${operationType}`);
        throw error;
      }
    }
  }
  
  throw lastError;
}

/**
 * Execute operation with timeout
 */
export async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationType: string = 'default'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation ${operationType} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    return await Promise.race([operation(), timeoutPromise]);
  } catch (error) {
    const classifiedError = classifyError(error, { operationType, timeoutMs });
    console.error(`[error-recovery] Operation ${operationType} failed with timeout:`, classifiedError);
    throw error;
  }
}

/**
 * Execute operation with circuit breaker pattern
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000,
    private operationType: string = 'default'
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        console.log(`[error-recovery] Circuit breaker for ${this.operationType} moved to HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker for ${this.operationType} is OPEN`);
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`[error-recovery] Circuit breaker for ${this.operationType} moved to OPEN after ${this.failureCount} failures`);
    }
  }
  
  getState(): string {
    return this.state;
  }
  
  getFailureCount(): number {
    return this.failureCount;
  }
}

/**
 * Global circuit breakers for different services
 */
export const circuitBreakers = {
  firecrawl: new CircuitBreaker(3, 30000, 'firecrawl'),
  gemini: new CircuitBreaker(5, 60000, 'gemini'),
  cse: new CircuitBreaker(3, 30000, 'cse'),
  database: new CircuitBreaker(10, 30000, 'database')
};

/**
 * Execute operation with circuit breaker
 */
export async function executeWithCircuitBreaker<T>(
  serviceType: keyof typeof circuitBreakers,
  operation: () => Promise<T>
): Promise<T> {
  const circuitBreaker = circuitBreakers[serviceType];
  return circuitBreaker.execute(operation);
}

/**
 * Reset all circuit breakers (useful for testing or manual recovery)
 */
export function resetAllCircuitBreakers(): void {
  Object.values(circuitBreakers).forEach(cb => {
    cb['failureCount'] = 0;
    cb['lastFailureTime'] = 0;
    cb['state'] = 'CLOSED';
  });
  console.log('[error-recovery] All circuit breakers reset');
}

/**
 * Execute operation with advanced circuit breaker protection and retry logic
 */
export async function executeWithAdvancedCircuitBreaker<T>(
  operation: () => Promise<T>,
  service: string,
  fallback?: () => Promise<T>
): Promise<T> {
  try {
    return await executeWithAdvancedCircuitBreakerImport(service, operation, fallback);
  } catch (error) {
    // If circuit breaker fails, try with retry logic as fallback
    if (fallback) {
      console.warn(`[error-recovery] Circuit breaker failed for ${service}, trying retry with fallback`);
      try {
        return await executeWithRetry(fallback, service);
      } catch (retryError) {
        console.error(`[error-recovery] Retry with fallback also failed for ${service}:`, retryError);
        throw retryError;
      }
    }
    throw error;
  }
}

/**
 * Execute operation with circuit breaker, retry, and graceful degradation
 */
export async function executeWithFullRecovery<T>(
  operation: () => Promise<T>,
  service: string,
  fallback: () => Promise<T>,
  finalFallback?: () => Promise<T>
): Promise<T> {
  try {
    return await executeWithAdvancedCircuitBreaker(operation, service, fallback);
  } catch (error) {
    console.warn(`[error-recovery] Full recovery failed for ${service}, trying final fallback`);
    if (finalFallback) {
      try {
        return await finalFallback();
      } catch (finalError) {
        console.error(`[error-recovery] Final fallback also failed for ${service}:`, finalError);
        throw finalError;
      }
    }
    throw error;
  }
}

/**
 * Get circuit breaker state for monitoring
 */
export function getCircuitBreakerState(service: string): CircuitState | undefined {
  const circuitBreaker = circuitBreakerManager.getCircuitBreaker(service);
  return circuitBreaker?.getState();
}

/**
 * Get circuit breaker metrics for analytics
 */
export function getCircuitBreakerMetrics(service?: string): any {
  if (service) {
    const circuitBreaker = circuitBreakerManager.getCircuitBreaker(service);
    return circuitBreaker?.getMetrics();
  }
  return circuitBreakerManager.getCircuitBreakerMetrics();
}

/**
 * Execute operation with advanced retry logic and intelligent backoff
 */
export async function executeWithAdvancedRetry<T>(
  operation: () => Promise<T>,
  service: string,
  customConfig?: Partial<RetryConfigType>
): Promise<T> {
  return retryManager.executeWithRetry(operation, service, customConfig);
}

/**
 * Execute operation with circuit breaker and advanced retry combined
 */
export async function executeWithCircuitBreakerAndAdvancedRetry<T>(
  operation: () => Promise<T>,
  service: string,
  fallback?: () => Promise<T>,
  retryConfig?: Partial<RetryConfigType>
): Promise<T> {
  try {
    // First try with circuit breaker
    return await executeWithAdvancedCircuitBreakerImport(service, operation, fallback);
  } catch (error) {
    // If circuit breaker fails, try with advanced retry
    console.warn(`[error-recovery] Circuit breaker failed for ${service}, trying advanced retry`);
    try {
      return await executeWithAdvancedRetry(operation, service, retryConfig);
    } catch (retryError) {
      // If retry also fails, try fallback with retry
      if (fallback) {
        console.warn(`[error-recovery] Advanced retry failed for ${service}, trying fallback with retry`);
        try {
          return await executeWithAdvancedRetry(fallback, service, retryConfig);
        } catch (fallbackRetryError) {
          console.error(`[error-recovery] Fallback with retry also failed for ${service}:`, fallbackRetryError);
          throw fallbackRetryError;
        }
      }
      throw retryError;
    }
  }
}

/**
 * Execute operation with full recovery: circuit breaker + retry + graceful degradation
 */
export async function executeWithFullAdvancedRecovery<T>(
  operation: () => Promise<T>,
  service: string,
  fallback: () => Promise<T>,
  finalFallback?: () => Promise<T>,
  retryConfig?: Partial<RetryConfigType>
): Promise<T> {
  try {
    return await executeWithCircuitBreakerAndAdvancedRetry(operation, service, fallback, retryConfig);
  } catch (error) {
    console.warn(`[error-recovery] Full advanced recovery failed for ${service}, trying final fallback`);
    if (finalFallback) {
      try {
        return await executeWithAdvancedRetry(finalFallback, service, retryConfig);
      } catch (finalError) {
        console.error(`[error-recovery] Final fallback with retry also failed for ${service}:`, finalError);
        throw finalError;
      }
    }
    throw error;
  }
}

/**
 * Get retry analytics for monitoring
 */
export function getRetryAnalytics(): any {
  return retryManager.getAnalytics();
}

/**
 * Get retry budget status
 */
export function getRetryBudgetStatus(service?: string): { used: number; remaining: number; resetTime: number } {
  return retryManager.getBudgetStatus(service);
}

/**
 * Reset retry analytics
 */
export function resetRetryAnalytics(): void {
  retryManager.resetAnalytics();
}

/**
 * Reset retry budget
 */
export function resetRetryBudget(): void {
  retryManager.resetBudget();
}
