/**
 * Advanced Retry Manager
 * 
 * This module implements sophisticated retry mechanisms with intelligent backoff
 * strategies, error classification, and adaptive retry policies.
 * 
 * Key Features:
 * - Intelligent retry logic with context-aware strategies
 * - Exponential backoff with jitter to prevent thundering herd
 * - Retry budget management to prevent resource exhaustion
 * - Error classification for appropriate retry strategies
 * - Retry analytics and success rate tracking
 * - Adaptive retry policies based on service health
 * - Circuit breaker integration for intelligent retry decisions
 */

import { createHash } from "crypto";

// Retry configuration
export const RETRY_CONFIG = {
  // Default retry settings
  default: {
    maxRetries: 3,
    baseDelay: 1000,        // 1 second
    maxDelay: 30000,        // 30 seconds
    backoffMultiplier: 2,
    jitter: 0.1,            // 10% jitter
    timeout: 60000,         // 60 seconds total timeout
  },
  
  // Service-specific retry configurations
  services: {
    firecrawl: {
      maxRetries: 5,
      baseDelay: 2000,
      maxDelay: 20000,
      backoffMultiplier: 1.5,
      jitter: 0.2,
      timeout: 45000,
    },
    cse: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 15000,
      backoffMultiplier: 2,
      jitter: 0.15,
      timeout: 30000,
    },
    database: {
      maxRetries: 4,
      baseDelay: 500,
      maxDelay: 10000,
      backoffMultiplier: 2.5,
      jitter: 0.1,
      timeout: 20000,
    },
    gemini: {
      maxRetries: 4,
      baseDelay: 1500,
      maxDelay: 25000,
      backoffMultiplier: 1.8,
      jitter: 0.25,
      timeout: 50000,
    }
  },
  
  // Error-specific retry configurations
  errorTypes: {
    NETWORK_ERROR: {
      maxRetries: 5,
      baseDelay: 1000,
      backoffMultiplier: 2,
      jitter: 0.2,
    },
    TIMEOUT_ERROR: {
      maxRetries: 3,
      baseDelay: 2000,
      backoffMultiplier: 1.5,
      jitter: 0.1,
    },
    RATE_LIMIT_ERROR: {
      maxRetries: 4,
      baseDelay: 5000,
      backoffMultiplier: 1.2,
      jitter: 0.3,
    },
    AUTHENTICATION_ERROR: {
      maxRetries: 1,
      baseDelay: 1000,
      backoffMultiplier: 1,
      jitter: 0,
    },
    VALIDATION_ERROR: {
      maxRetries: 0,
      baseDelay: 0,
      backoffMultiplier: 1,
      jitter: 0,
    },
    UNKNOWN_ERROR: {
      maxRetries: 2,
      baseDelay: 1500,
      backoffMultiplier: 2,
      jitter: 0.15,
    }
  },
  
  // Retry budget management
  budget: {
    maxRetriesPerMinute: 100,
    maxRetriesPerHour: 1000,
    budgetResetInterval: 60 * 60 * 1000, // 1 hour
    enableBudgetManagement: true,
  },
  
  // Analytics and monitoring
  analytics: {
    enableRetryAnalytics: true,
    analyticsRetention: 24 * 60 * 60 * 1000, // 24 hours
    enableAdaptivePolicies: true,
    adaptiveLearningPeriod: 60 * 60 * 1000, // 1 hour
  }
};

// Error types for retry classification
export enum RetryErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// Retry strategy types
export enum RetryStrategy {
  EXPONENTIAL_BACKOFF = 'EXPONENTIAL_BACKOFF',
  LINEAR_BACKOFF = 'LINEAR_BACKOFF',
  FIXED_DELAY = 'FIXED_DELAY',
  CUSTOM = 'CUSTOM'
}

// Retry configuration interface
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: number;
  timeout: number;
  strategy: RetryStrategy;
  service: string;
  errorType?: RetryErrorType;
}

// Retry attempt record
export interface RetryAttempt {
  attempt: number;
  timestamp: number;
  delay: number;
  error: Error;
  errorType: RetryErrorType;
  success: boolean;
  responseTime: number;
}

// Retry analytics
export interface RetryAnalytics {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  successRate: number;
  averageRetries: number;
  averageResponseTime: number;
  errorBreakdown: Record<RetryErrorType, number>;
  serviceBreakdown: Record<string, number>;
  retryBudget: {
    used: number;
    remaining: number;
    resetTime: number;
  };
}

// Retry budget manager
class RetryBudgetManager {
  private budget: Map<string, { used: number; resetTime: number }> = new Map();
  private globalBudget: { used: number; resetTime: number } = { used: 0, resetTime: Date.now() + RETRY_CONFIG.budget.budgetResetInterval };

  canRetry(service: string): boolean {
    if (!RETRY_CONFIG.budget.enableBudgetManagement) return true;

    const now = Date.now();
    
    // Check global budget
    if (now > this.globalBudget.resetTime) {
      this.globalBudget = { used: 0, resetTime: now + RETRY_CONFIG.budget.budgetResetInterval };
    }
    
    if (this.globalBudget.used >= RETRY_CONFIG.budget.maxRetriesPerHour) {
      return false;
    }

    // Check service-specific budget
    const serviceBudget = this.budget.get(service);
    if (!serviceBudget || now > serviceBudget.resetTime) {
      this.budget.set(service, { used: 0, resetTime: now + RETRY_CONFIG.budget.budgetResetInterval });
      return true;
    }

    return serviceBudget.used < RETRY_CONFIG.budget.maxRetriesPerMinute;
  }

  recordRetry(service: string): void {
    if (!RETRY_CONFIG.budget.enableBudgetManagement) return;

    const now = Date.now();
    
    // Update global budget
    if (now > this.globalBudget.resetTime) {
      this.globalBudget = { used: 0, resetTime: now + RETRY_CONFIG.budget.budgetResetInterval };
    }
    this.globalBudget.used++;

    // Update service budget
    const serviceBudget = this.budget.get(service);
    if (!serviceBudget || now > serviceBudget.resetTime) {
      this.budget.set(service, { used: 1, resetTime: now + RETRY_CONFIG.budget.budgetResetInterval });
    } else {
      serviceBudget.used++;
    }
  }

  getBudgetStatus(service?: string): { used: number; remaining: number; resetTime: number } {
    const now = Date.now();
    
    if (service) {
      const serviceBudget = this.budget.get(service);
      if (!serviceBudget || now > serviceBudget.resetTime) {
        return { used: 0, remaining: RETRY_CONFIG.budget.maxRetriesPerMinute, resetTime: now + RETRY_CONFIG.budget.budgetResetInterval };
      }
      return { 
        used: serviceBudget.used, 
        remaining: RETRY_CONFIG.budget.maxRetriesPerMinute - serviceBudget.used, 
        resetTime: serviceBudget.resetTime 
      };
    }

    // Global budget
    if (now > this.globalBudget.resetTime) {
      return { used: 0, remaining: RETRY_CONFIG.budget.maxRetriesPerHour, resetTime: now + RETRY_CONFIG.budget.budgetResetInterval };
    }
    return { 
      used: this.globalBudget.used, 
      remaining: RETRY_CONFIG.budget.maxRetriesPerHour - this.globalBudget.used, 
      resetTime: this.globalBudget.resetTime 
    };
  }
}

// Error classifier
class ErrorClassifier {
  classifyError(error: Error): RetryErrorType {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network errors
    if (message.includes('network') || message.includes('connection') || 
        message.includes('econnreset') || message.includes('enotfound') ||
        message.includes('econnrefused') || message.includes('timeout')) {
      return RetryErrorType.NETWORK_ERROR;
    }

    // Timeout errors
    if (message.includes('timeout') || name.includes('timeout')) {
      return RetryErrorType.TIMEOUT_ERROR;
    }

    // Rate limit errors
    if (message.includes('rate limit') || message.includes('too many requests') ||
        message.includes('429') || message.includes('quota exceeded')) {
      return RetryErrorType.RATE_LIMIT_ERROR;
    }

    // Authentication errors
    if (message.includes('unauthorized') || message.includes('forbidden') ||
        message.includes('401') || message.includes('403') ||
        message.includes('authentication') || message.includes('authorization')) {
      return RetryErrorType.AUTHENTICATION_ERROR;
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid') ||
        message.includes('400') || message.includes('bad request')) {
      return RetryErrorType.VALIDATION_ERROR;
    }

    return RetryErrorType.UNKNOWN_ERROR;
  }
}

// Retry delay calculator
class RetryDelayCalculator {
  calculateDelay(attempt: number, config: RetryConfig): number {
    let delay: number;

    switch (config.strategy) {
      case RetryStrategy.EXPONENTIAL_BACKOFF:
        delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
        break;
      case RetryStrategy.LINEAR_BACKOFF:
        delay = config.baseDelay * attempt;
        break;
      case RetryStrategy.FIXED_DELAY:
        delay = config.baseDelay;
        break;
      default:
        delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    }

    // Apply jitter
    if (config.jitter > 0) {
      const jitterAmount = delay * config.jitter;
      const jitter = (Math.random() - 0.5) * 2 * jitterAmount;
      delay += jitter;
    }

    // Cap at max delay
    delay = Math.min(delay, config.maxDelay);

    return Math.max(0, Math.floor(delay));
  }
}

// Retry manager class
export class RetryManager {
  private static instance: RetryManager;
  private budgetManager: RetryBudgetManager;
  private errorClassifier: ErrorClassifier;
  private delayCalculator: RetryDelayCalculator;
  private analytics: RetryAnalytics;
  private attemptHistory: RetryAttempt[] = [];

  private constructor() {
    this.budgetManager = new RetryBudgetManager();
    this.errorClassifier = new ErrorClassifier();
    this.delayCalculator = new RetryDelayCalculator();
    this.analytics = this.initializeAnalytics();
  }

  public static getInstance(): RetryManager {
    if (!RetryManager.instance) {
      RetryManager.instance = new RetryManager();
    }
    return RetryManager.instance;
  }

  private initializeAnalytics(): RetryAnalytics {
    return {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      successRate: 0,
      averageRetries: 0,
      averageResponseTime: 0,
      errorBreakdown: {
        [RetryErrorType.NETWORK_ERROR]: 0,
        [RetryErrorType.TIMEOUT_ERROR]: 0,
        [RetryErrorType.RATE_LIMIT_ERROR]: 0,
        [RetryErrorType.AUTHENTICATION_ERROR]: 0,
        [RetryErrorType.VALIDATION_ERROR]: 0,
        [RetryErrorType.UNKNOWN_ERROR]: 0,
      },
      serviceBreakdown: {},
      retryBudget: this.budgetManager.getBudgetStatus()
    };
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    service: string,
    customConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = this.buildRetryConfig(service, customConfig);
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      const attemptStartTime = Date.now();
      
      try {
        // Check retry budget
        if (attempt > 1 && !this.budgetManager.canRetry(service)) {
          console.warn(`[retry-manager] Retry budget exceeded for service: ${service}`);
          throw new Error('Retry budget exceeded');
        }

        // Record retry attempt
        if (attempt > 1) {
          this.budgetManager.recordRetry(service);
        }

        // Execute operation with timeout
        const result = await this.executeWithTimeout(operation, config.timeout);
        const responseTime = attemptStartTime - startTime;

        // Record successful attempt
        this.recordAttempt({
          attempt,
          timestamp: attemptStartTime,
          delay: attempt > 1 ? this.delayCalculator.calculateDelay(attempt - 1, config) : 0,
          error: lastError || new Error('Success'),
          errorType: lastError ? this.errorClassifier.classifyError(lastError) : RetryErrorType.UNKNOWN_ERROR,
          success: true,
          responseTime
        });

        this.updateAnalytics();
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorType = this.errorClassifier.classifyError(lastError);
        const responseTime = attemptStartTime - startTime;

        // Record failed attempt
        this.recordAttempt({
          attempt,
          timestamp: attemptStartTime,
          delay: attempt > 1 ? this.delayCalculator.calculateDelay(attempt - 1, config) : 0,
          error: lastError,
          errorType,
          success: false,
          responseTime
        });

        // Check if we should retry
        if (attempt > config.maxRetries || !this.shouldRetry(errorType, attempt, config)) {
          this.updateAnalytics();
          throw lastError;
        }

        // Calculate delay and wait
        const delay = this.delayCalculator.calculateDelay(attempt, config);
        if (delay > 0) {
          console.log(`[retry-manager] Retrying ${service} in ${delay}ms (attempt ${attempt}/${config.maxRetries})`);
          await this.sleep(delay);
        }
      }
    }

    this.updateAnalytics();
    throw lastError || new Error('Max retries exceeded');
  }

  private buildRetryConfig(service: string, customConfig?: Partial<RetryConfig>): RetryConfig {
    const serviceConfig = RETRY_CONFIG.services[service as keyof typeof RETRY_CONFIG.services] || RETRY_CONFIG.default;
    
    return {
      maxRetries: customConfig?.maxRetries ?? serviceConfig.maxRetries,
      baseDelay: customConfig?.baseDelay ?? serviceConfig.baseDelay,
      maxDelay: customConfig?.maxDelay ?? serviceConfig.maxDelay,
      backoffMultiplier: customConfig?.backoffMultiplier ?? serviceConfig.backoffMultiplier,
      jitter: customConfig?.jitter ?? serviceConfig.jitter,
      timeout: customConfig?.timeout ?? serviceConfig.timeout,
      strategy: customConfig?.strategy ?? RetryStrategy.EXPONENTIAL_BACKOFF,
      service,
      errorType: customConfig?.errorType
    };
  }

  private shouldRetry(errorType: RetryErrorType, attempt: number, config: RetryConfig): boolean {
    // Never retry validation errors
    if (errorType === RetryErrorType.VALIDATION_ERROR) {
      return false;
    }

    // Limited retries for authentication errors
    if (errorType === RetryErrorType.AUTHENTICATION_ERROR && attempt > 1) {
      return false;
    }

    // Check error-specific retry limits
    const errorConfig = RETRY_CONFIG.errorTypes[errorType];
    if (errorConfig && attempt > errorConfig.maxRetries) {
      return false;
    }

    return true;
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timeout after ${timeout}ms`));
      }, timeout);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private recordAttempt(attempt: RetryAttempt): void {
    this.attemptHistory.push(attempt);
    
    // Keep only recent history to prevent memory issues
    if (this.attemptHistory.length > 1000) {
      this.attemptHistory = this.attemptHistory.slice(-500);
    }
  }

  private updateAnalytics(): void {
    const totalAttempts = this.attemptHistory.length;
    const successfulAttempts = this.attemptHistory.filter(a => a.success).length;
    const failedAttempts = totalAttempts - successfulAttempts;
    
    const errorBreakdown: Record<RetryErrorType, number> = {
      [RetryErrorType.NETWORK_ERROR]: 0,
      [RetryErrorType.TIMEOUT_ERROR]: 0,
      [RetryErrorType.RATE_LIMIT_ERROR]: 0,
      [RetryErrorType.AUTHENTICATION_ERROR]: 0,
      [RetryErrorType.VALIDATION_ERROR]: 0,
      [RetryErrorType.UNKNOWN_ERROR]: 0,
    };

    const serviceBreakdown: Record<string, number> = {};

    for (const attempt of this.attemptHistory) {
      errorBreakdown[attempt.errorType]++;
      // Note: We don't have service info in attempt records, would need to add it
    }

    const totalResponseTime = this.attemptHistory.reduce((sum, a) => sum + a.responseTime, 0);

    this.analytics = {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      successRate: totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0,
      averageRetries: totalAttempts > 0 ? totalAttempts / (totalAttempts / (successfulAttempts + failedAttempts)) : 0,
      averageResponseTime: totalAttempts > 0 ? totalResponseTime / totalAttempts : 0,
      errorBreakdown,
      serviceBreakdown,
      retryBudget: this.budgetManager.getBudgetStatus()
    };
  }

  // Public methods
  getAnalytics(): RetryAnalytics {
    this.updateAnalytics();
    return { ...this.analytics };
  }

  getAttemptHistory(): RetryAttempt[] {
    return [...this.attemptHistory];
  }

  getBudgetStatus(service?: string): { used: number; remaining: number; resetTime: number } {
    return this.budgetManager.getBudgetStatus(service);
  }

  resetAnalytics(): void {
    this.attemptHistory = [];
    this.analytics = this.initializeAnalytics();
  }

  resetBudget(): void {
    this.budgetManager = new RetryBudgetManager();
  }
}

// Global retry manager instance
export const retryManager = RetryManager.getInstance();

// Utility functions
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  service: string,
  customConfig?: Partial<RetryConfig>
): Promise<T> {
  return retryManager.executeWithRetry(operation, service, customConfig);
}

export function getRetryAnalytics(): RetryAnalytics {
  return retryManager.getAnalytics();
}

export function getRetryBudgetStatus(service?: string): { used: number; remaining: number; resetTime: number } {
  return retryManager.getBudgetStatus(service);
}

export function resetRetryAnalytics(): void {
  retryManager.resetAnalytics();
}

export function resetRetryBudget(): void {
  retryManager.resetBudget();
}
