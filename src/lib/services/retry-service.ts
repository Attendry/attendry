/**
 * Retry Service
 * 
 * Provides robust retry mechanisms with exponential backoff,
 * jitter, and comprehensive monitoring for external API calls.
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs: number;
  retryableStatusCodes: number[];
  retryableErrors: string[];
}

export interface RetryMetrics {
  attempts: number;
  totalDelayMs: number;
  lastError?: string;
  success: boolean;
  service: string;
  operation: string;
  timestamp: Date;
}

export interface RetryResult<T> {
  data: T;
  metrics: RetryMetrics;
}

// Default retry configurations for different services
const DEFAULT_RETRY_CONFIGS: Record<string, RetryConfig> = {
  google_cse: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterMs: 500,
    retryableStatusCodes: [429, 500, 502, 503, 504],
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED']
  },
  firecrawl: {
    maxRetries: 2,
    baseDelayMs: 2000,
    maxDelayMs: 15000,
    backoffMultiplier: 2.5,
    jitterMs: 1000,
    retryableStatusCodes: [429, 500, 502, 503, 504],
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED']
  },
  gemini: {
    maxRetries: 2,
    baseDelayMs: 1500,
    maxDelayMs: 8000,
    backoffMultiplier: 2,
    jitterMs: 750,
    retryableStatusCodes: [429, 500, 502, 503, 504],
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED']
  },
  supabase: {
    maxRetries: 2,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitterMs: 250,
    retryableStatusCodes: [429, 500, 502, 503, 504],
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED']
  }
};

// Global metrics storage for monitoring
const retryMetrics: RetryMetrics[] = [];
const MAX_METRICS_HISTORY = 1000;

/**
 * Retry Service Class
 */
export class RetryService {
  /**
   * Execute a function with retry logic
   */
  static async executeWithRetry<T>(
    service: string,
    operation: string,
    fn: () => Promise<T>,
    customConfig?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const config = { ...DEFAULT_RETRY_CONFIGS[service] || DEFAULT_RETRY_CONFIGS.google_cse, ...customConfig };
    const startTime = Date.now();
    let lastError: string | undefined;
    let totalDelayMs = 0;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await fn();
        
        const metrics: RetryMetrics = {
          attempts: attempt + 1,
          totalDelayMs,
          success: true,
          service,
          operation,
          timestamp: new Date()
        };

        this.recordMetrics(metrics);
        return { data: result, metrics };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        // Check if this is the last attempt
        if (attempt === config.maxRetries) {
          const metrics: RetryMetrics = {
            attempts: attempt + 1,
            totalDelayMs,
            lastError,
            success: false,
            service,
            operation,
            timestamp: new Date()
          };

          this.recordMetrics(metrics);
          throw error;
        }

        // Check if error is retryable
        if (!this.isRetryableError(error, config)) {
          const metrics: RetryMetrics = {
            attempts: attempt + 1,
            totalDelayMs,
            lastError,
            success: false,
            service,
            operation,
            timestamp: new Date()
          };

          this.recordMetrics(metrics);
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, config);
        totalDelayMs += delay;

        console.log(JSON.stringify({
          at: "retry_service",
          service,
          operation,
          attempt: attempt + 1,
          maxRetries: config.maxRetries,
          delay,
          error: lastError,
          retrying: true
        }));

        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error('Retry logic failed unexpectedly');
  }

  /**
   * Execute HTTP request with retry logic
   */
  static async fetchWithRetry(
    service: string,
    operation: string,
    url: string,
    options: RequestInit = {},
    customConfig?: Partial<RetryConfig>
  ): Promise<Response> {
    return this.executeWithRetry(
      service,
      operation,
      async () => {
        const response = await fetch(url, options);
        
        // Check for retryable status codes
        const config = { ...DEFAULT_RETRY_CONFIGS[service] || DEFAULT_RETRY_CONFIGS.google_cse, ...customConfig };
        if (config.retryableStatusCodes.includes(response.status)) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
      },
      customConfig
    ).then(result => result.data);
  }

  /**
   * Check if an error is retryable
   */
  private static isRetryableError(error: unknown, config: RetryConfig): boolean {
    if (error instanceof Error) {
      // Check for retryable error messages
      for (const retryableError of config.retryableErrors) {
        if (error.message.includes(retryableError)) {
          return true;
        }
      }

      // Check for HTTP status codes in error messages
      for (const statusCode of config.retryableStatusCodes) {
        if (error.message.includes(`HTTP ${statusCode}`) || error.message.includes(`${statusCode}`)) {
          return true;
        }
      }

      // Check for network-related errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private static calculateDelay(attempt: number, config: RetryConfig): number {
    // Exponential backoff: baseDelay * (multiplier ^ attempt)
    const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
    
    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * config.jitterMs;
    
    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Record retry metrics for monitoring
   */
  private static recordMetrics(metrics: RetryMetrics): void {
    retryMetrics.push(metrics);
    
    // Keep only recent metrics to prevent memory leaks
    if (retryMetrics.length > MAX_METRICS_HISTORY) {
      retryMetrics.splice(0, retryMetrics.length - MAX_METRICS_HISTORY);
    }

    // Log significant retry events
    if (!metrics.success || metrics.attempts > 1) {
      console.log(JSON.stringify({
        at: "retry_metrics",
        service: metrics.service,
        operation: metrics.operation,
        attempts: metrics.attempts,
        success: metrics.success,
        totalDelayMs: metrics.totalDelayMs,
        lastError: metrics.lastError
      }));
    }
  }

  /**
   * Get retry metrics for monitoring
   */
  static getMetrics(timeWindowMs?: number): RetryMetrics[] {
    if (!timeWindowMs) {
      return [...retryMetrics];
    }

    const cutoff = new Date(Date.now() - timeWindowMs);
    return retryMetrics.filter(metric => metric.timestamp >= cutoff);
  }

  /**
   * Get retry statistics
   */
  static getStatistics(timeWindowMs?: number): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageAttempts: number;
    averageDelayMs: number;
    retryRate: number;
    serviceBreakdown: Record<string, {
      requests: number;
      successRate: number;
      averageAttempts: number;
    }>;
  } {
    const metrics = this.getMetrics(timeWindowMs);
    
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageAttempts: 0,
        averageDelayMs: 0,
        retryRate: 0,
        serviceBreakdown: {}
      };
    }

    const successful = metrics.filter(m => m.success);
    const failed = metrics.filter(m => !m.success);
    const totalAttempts = metrics.reduce((sum, m) => sum + m.attempts, 0);
    const totalDelay = metrics.reduce((sum, m) => sum + m.totalDelayMs, 0);
    const retried = metrics.filter(m => m.attempts > 1);

    // Service breakdown
    const serviceBreakdown: Record<string, { requests: number; successRate: number; averageAttempts: number }> = {};
    const services = [...new Set(metrics.map(m => m.service))];
    
    for (const service of services) {
      const serviceMetrics = metrics.filter(m => m.service === service);
      const serviceSuccessful = serviceMetrics.filter(m => m.success);
      const serviceAttempts = serviceMetrics.reduce((sum, m) => sum + m.attempts, 0);
      
      serviceBreakdown[service] = {
        requests: serviceMetrics.length,
        successRate: serviceSuccessful.length / serviceMetrics.length,
        averageAttempts: serviceAttempts / serviceMetrics.length
      };
    }

    return {
      totalRequests: metrics.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      averageAttempts: totalAttempts / metrics.length,
      averageDelayMs: totalDelay / metrics.length,
      retryRate: retried.length / metrics.length,
      serviceBreakdown
    };
  }

  /**
   * Clear metrics history
   */
  static clearMetrics(): void {
    retryMetrics.length = 0;
  }

  /**
   * Get health status based on recent retry metrics
   */
  static getHealthStatus(timeWindowMs: number = 5 * 60 * 1000): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    recommendations: string[];
  } {
    const stats = this.getStatistics(timeWindowMs);
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check overall success rate
    if (stats.totalRequests > 0) {
      const successRate = stats.successfulRequests / stats.totalRequests;
      
      if (successRate < 0.8) {
        issues.push(`Low success rate: ${(successRate * 100).toFixed(1)}%`);
        recommendations.push('Check external service health and network connectivity');
      } else if (successRate < 0.95) {
        issues.push(`Degraded success rate: ${(successRate * 100).toFixed(1)}%`);
        recommendations.push('Monitor external services for intermittent issues');
      }
    }

    // Check retry rate
    if (stats.retryRate > 0.3) {
      issues.push(`High retry rate: ${(stats.retryRate * 100).toFixed(1)}%`);
      recommendations.push('Consider increasing retry delays or checking service load');
    }

    // Check average attempts
    if (stats.averageAttempts > 1.5) {
      issues.push(`High average attempts: ${stats.averageAttempts.toFixed(2)}`);
      recommendations.push('Review retry configuration and service reliability');
    }

    // Check service-specific issues
    for (const [service, breakdown] of Object.entries(stats.serviceBreakdown)) {
      if (breakdown.successRate < 0.9) {
        issues.push(`${service} service degraded: ${(breakdown.successRate * 100).toFixed(1)}% success rate`);
        recommendations.push(`Investigate ${service} service health and configuration`);
      }
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (issues.length === 0) {
      status = 'healthy';
    } else if (issues.some(issue => issue.includes('Low success rate') || issue.includes('unhealthy'))) {
      status = 'unhealthy';
    } else {
      status = 'degraded';
    }

    return { status, issues, recommendations };
  }
}
