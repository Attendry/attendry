/**
 * PERF-1.4.1: Centralized Rate Limit Service
 * PERF-1.4.3: Adaptive Rate Limiting
 * 
 * Provides centralized rate limiting for all external APIs using Redis
 * Tracks limits for Firecrawl, Google CSE, and Gemini services
 * Uses 1-minute sliding windows for accurate rate limiting
 * Adapts rate limits based on API response time performance
 */

import { getRedisClient } from '@/lib/cache/redis-client';

export type ServiceType = 'firecrawl' | 'cse' | 'gemini';

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour?: number;
  burstLimit?: number;
  burstWindow?: number; // in milliseconds
  // PERF-1.4.3: Adaptive rate limiting thresholds
  fastThreshold?: number; // ms - response time considered "fast"
  slowThreshold?: number; // ms - response time considered "slow"
  minRateLimit?: number; // minimum requests per minute (safety floor)
  maxRateLimit?: number; // maximum requests per minute (safety ceiling)
  adjustmentFactor?: number; // percentage to adjust by (0.1 = 10%)
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  requestCount: number;
  lastUpdated: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // timestamp when limit resets
  retryAfter?: number; // seconds to wait before retry
}

export interface RateLimitStats {
  service: ServiceType;
  requestsInWindow: number;
  limit: number;
  remaining: number;
  resetAt: number;
  // PERF-1.4.3: Performance metrics
  averageResponseTime?: number;
  adaptiveLimit?: number; // current adaptive limit
  baseLimit?: number; // original base limit
}

// Default rate limit configurations
const DEFAULT_RATE_LIMITS: Record<ServiceType, RateLimitConfig> = {
  firecrawl: {
    maxRequestsPerMinute: 15,
    maxRequestsPerHour: 150,
    burstLimit: 5,
    burstWindow: 10000, // 10 seconds
    // PERF-1.4.3: Adaptive thresholds
    fastThreshold: 2000, // 2s - fast response
    slowThreshold: 8000, // 8s - slow response
    minRateLimit: 5, // minimum 5 req/min
    maxRateLimit: 30, // maximum 30 req/min
    adjustmentFactor: 0.15, // 15% adjustment
  },
  cse: {
    maxRequestsPerMinute: 150,
    maxRequestsPerHour: 1500,
    burstLimit: 10,
    burstWindow: 5000, // 5 seconds
    // PERF-1.4.3: Adaptive thresholds
    fastThreshold: 500, // 0.5s - fast response
    slowThreshold: 3000, // 3s - slow response
    minRateLimit: 50, // minimum 50 req/min
    maxRateLimit: 300, // maximum 300 req/min
    adjustmentFactor: 0.2, // 20% adjustment
  },
  gemini: {
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 600,
    burstLimit: 3,
    burstWindow: 10000, // 10 seconds
    // PERF-1.4.3: Adaptive thresholds
    fastThreshold: 1000, // 1s - fast response
    slowThreshold: 5000, // 5s - slow response
    minRateLimit: 20, // minimum 20 req/min
    maxRateLimit: 120, // maximum 120 req/min
    adjustmentFactor: 0.15, // 15% adjustment
  },
};

/**
 * Centralized Rate Limit Service
 */
export class RateLimitService {
  private static instance: RateLimitService;
  private configs: Map<ServiceType, RateLimitConfig> = new Map();
  private redis = getRedisClient();

  private constructor() {
    // Initialize with default configs
    Object.entries(DEFAULT_RATE_LIMITS).forEach(([service, config]) => {
      this.configs.set(service as ServiceType, config);
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  /**
   * Update rate limit configuration for a service
   */
  updateConfig(service: ServiceType, config: Partial<RateLimitConfig>): void {
    const current = this.configs.get(service) || DEFAULT_RATE_LIMITS[service];
    this.configs.set(service, { ...current, ...config });
  }

  /**
   * PERF-1.4.3: Record API response time for adaptive rate limiting
   */
  async recordResponseTime(service: ServiceType, responseTimeMs: number): Promise<void> {
    try {
      if (!this.redis.isAvailable()) {
        return;
      }

      const now = Date.now();
      const minute = Math.floor(now / 60000);
      const metricsKey = `rate_limit:${service}:metrics:${minute}`;
      
      // Get current metrics
      const metricsJson = await this.redis.get(metricsKey);
      let metrics: PerformanceMetrics = metricsJson 
        ? JSON.parse(metricsJson)
        : { averageResponseTime: 0, requestCount: 0, lastUpdated: now };

      // Update rolling average
      const totalTime = metrics.averageResponseTime * metrics.requestCount + responseTimeMs;
      metrics.requestCount += 1;
      metrics.averageResponseTime = totalTime / metrics.requestCount;
      metrics.lastUpdated = now;

      // Store updated metrics (1 minute TTL)
      await this.redis.set(metricsKey, JSON.stringify(metrics), 60);

      // PERF-1.4.3: Adjust rate limit based on performance
      await this.adjustRateLimit(service, metrics.averageResponseTime);
    } catch (error) {
      console.warn(`[rate-limit] Failed to record response time for ${service}:`, error);
    }
  }

  /**
   * PERF-1.4.3: Adjust rate limit based on average response time
   */
  private async adjustRateLimit(service: ServiceType, averageResponseTime: number): Promise<void> {
    try {
      const config = this.configs.get(service) || DEFAULT_RATE_LIMITS[service];
      const baseLimit = DEFAULT_RATE_LIMITS[service].maxRequestsPerMinute;
      
      // Skip adjustment if thresholds not configured
      if (!config.fastThreshold || !config.slowThreshold) {
        return;
      }

      const fastThreshold = config.fastThreshold;
      const slowThreshold = config.slowThreshold;
      const minLimit = config.minRateLimit || baseLimit * 0.5;
      const maxLimit = config.maxRateLimit || baseLimit * 2;
      const adjustmentFactor = config.adjustmentFactor || 0.15;

      // Get current adaptive limit (stored in Redis)
      const adaptiveKey = `rate_limit:${service}:adaptive`;
      const currentAdaptiveJson = await this.redis.get(adaptiveKey);
      let currentAdaptive = currentAdaptiveJson 
        ? parseInt(currentAdaptiveJson, 10)
        : baseLimit;

      let newLimit = currentAdaptive;

      // Adjust based on performance
      if (averageResponseTime < fastThreshold) {
        // Fast response - increase rate limit
        newLimit = Math.min(
          maxLimit,
          Math.ceil(currentAdaptive * (1 + adjustmentFactor))
        );
        console.log(`[rate-limit] ${service}: Fast response (${averageResponseTime.toFixed(0)}ms < ${fastThreshold}ms), increasing limit: ${currentAdaptive} → ${newLimit}`);
      } else if (averageResponseTime > slowThreshold) {
        // Slow response - decrease rate limit
        newLimit = Math.max(
          minLimit,
          Math.floor(currentAdaptive * (1 - adjustmentFactor))
        );
        console.log(`[rate-limit] ${service}: Slow response (${averageResponseTime.toFixed(0)}ms > ${slowThreshold}ms), decreasing limit: ${currentAdaptive} → ${newLimit}`);
      }
      // If between thresholds, keep current limit

      // Only update if changed
      if (newLimit !== currentAdaptive) {
        await this.redis.set(adaptiveKey, newLimit.toString(), 300); // 5 minute TTL
        this.updateConfig(service, { maxRequestsPerMinute: newLimit });
      }
    } catch (error) {
      console.warn(`[rate-limit] Failed to adjust rate limit for ${service}:`, error);
    }
  }

  /**
   * PERF-1.4.3: Get current adaptive rate limit
   */
  private async getAdaptiveLimit(service: ServiceType): Promise<number> {
    try {
      if (!this.redis.isAvailable()) {
        const config = this.configs.get(service) || DEFAULT_RATE_LIMITS[service];
        return config.maxRequestsPerMinute;
      }

      const adaptiveKey = `rate_limit:${service}:adaptive`;
      const adaptiveJson = await this.redis.get(adaptiveKey);
      if (adaptiveJson) {
        return parseInt(adaptiveJson, 10);
      }

      // Return base limit if no adaptive limit set
      return DEFAULT_RATE_LIMITS[service].maxRequestsPerMinute;
    } catch (error) {
      console.warn(`[rate-limit] Failed to get adaptive limit for ${service}:`, error);
      const config = this.configs.get(service) || DEFAULT_RATE_LIMITS[service];
      return config.maxRequestsPerMinute;
    }
  }

  /**
   * PERF-1.4.3: Get performance metrics for a service
   */
  async getPerformanceMetrics(service: ServiceType): Promise<PerformanceMetrics | null> {
    try {
      if (!this.redis.isAvailable()) {
        return null;
      }

      const now = Date.now();
      const minute = Math.floor(now / 60000);
      const metricsKey = `rate_limit:${service}:metrics:${minute}`;
      
      const metricsJson = await this.redis.get(metricsKey);
      if (metricsJson) {
        return JSON.parse(metricsJson);
      }

      return null;
    } catch (error) {
      console.warn(`[rate-limit] Failed to get performance metrics for ${service}:`, error);
      return null;
    }
  }

  /**
   * Check if a request is allowed under rate limits
   * PERF-1.4.1: Uses Redis for distributed rate limiting with 1-minute sliding windows
   * PERF-1.4.3: Uses adaptive rate limits based on performance
   */
  async checkRateLimit(service: ServiceType): Promise<RateLimitResult> {
    // PERF-1.4.3: Get adaptive limit (may differ from base config)
    const adaptiveLimit = await this.getAdaptiveLimit(service);
    const baseConfig = DEFAULT_RATE_LIMITS[service];
    const config = {
      ...(this.configs.get(service) || baseConfig),
      maxRequestsPerMinute: adaptiveLimit, // Use adaptive limit
    };
    
    const now = Date.now();
    
    // Use Redis for distributed rate limiting
    // Key format: rate_limit:{service}:{minute}
    const minute = Math.floor(now / 60000);
    const minuteKey = `rate_limit:${service}:minute:${minute}`;
    const hour = Math.floor(now / 3600000);
    const hourKey = `rate_limit:${service}:hour:${hour}`;
    
    try {
      // Check minute limit
      const minuteCount = await this.getRequestCount(minuteKey);
      const minuteLimit = config.maxRequestsPerMinute;
      
      if (minuteCount >= minuteLimit) {
        const resetAt = (minute + 1) * 60000;
        const retryAfter = Math.ceil((resetAt - now) / 1000);
        
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter
        };
      }
      
      // Check hour limit if configured
      if (config.maxRequestsPerHour) {
        const hourCount = await this.getRequestCount(hourKey);
        if (hourCount >= config.maxRequestsPerHour) {
          const resetAt = (hour + 1) * 3600000;
          const retryAfter = Math.ceil((resetAt - now) / 1000);
          
          return {
            allowed: false,
            remaining: 0,
            resetAt,
            retryAfter
          };
        }
      }
      
      // Check burst limit if configured
      if (config.burstLimit && config.burstWindow) {
        const burstWindowStart = Math.floor((now - config.burstWindow) / 1000);
        const burstKey = `rate_limit:${service}:burst:${burstWindowStart}`;
        const burstCount = await this.getRequestCount(burstKey);
        
        if (burstCount >= config.burstLimit) {
          const resetAt = now + config.burstWindow;
          const retryAfter = Math.ceil(config.burstWindow / 1000);
          
          return {
            allowed: false,
            remaining: 0,
            resetAt,
            retryAfter
          };
        }
        
        // Increment burst counter
        await this.incrementRequestCount(burstKey, Math.ceil(config.burstWindow / 1000));
      }
      
      // Increment counters
      await this.incrementRequestCount(minuteKey, 60); // 1 minute TTL
      if (config.maxRequestsPerHour) {
        await this.incrementRequestCount(hourKey, 3600); // 1 hour TTL
      }
      
      const remaining = minuteLimit - minuteCount - 1;
      const resetAt = (minute + 1) * 60000;
      
      return {
        allowed: true,
        remaining: Math.max(0, remaining),
        resetAt
      };
    } catch (error) {
      // On error, allow the request but log the error
      console.error(`[rate-limit] Error checking rate limit for ${service}:`, error);
      return {
        allowed: true, // Fail open to avoid blocking requests
        remaining: config.maxRequestsPerMinute,
        resetAt: now + 60000
      };
    }
  }

  /**
   * Get current request count from Redis
   */
  private async getRequestCount(key: string): Promise<number> {
    try {
      if (!this.redis.isAvailable()) {
        console.warn(`[rate-limit] Redis not available for ${key}`);
        return 0;
      }
      
      const value = await this.redis.get(key);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      console.warn(`[rate-limit] Failed to get request count for ${key}:`, error);
      return 0;
    }
  }

  /**
   * Increment request count in Redis
   */
  private async incrementRequestCount(key: string, ttl: number): Promise<void> {
    try {
      if (!this.redis.isAvailable()) {
        console.warn(`[rate-limit] Redis not available for incrementing ${key}`);
        return;
      }
      
      // Use INCR and set TTL
      const count = await this.redis.incr(key);
      if (count === 1) {
        // First time setting this key, set TTL
        await this.redis.expire(key, ttl);
      }
    } catch (error) {
      console.warn(`[rate-limit] Failed to increment request count for ${key}:`, error);
    }
  }

  /**
   * Get rate limit statistics for a service
   * PERF-1.4.3: Includes performance metrics and adaptive limits
   */
  async getStats(service: ServiceType): Promise<RateLimitStats> {
    const baseConfig = DEFAULT_RATE_LIMITS[service];
    const adaptiveLimit = await this.getAdaptiveLimit(service);
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const minuteKey = `rate_limit:${service}:minute:${minute}`;
    
    const requestsInWindow = await this.getRequestCount(minuteKey);
    const limit = adaptiveLimit; // Use adaptive limit
    const remaining = Math.max(0, limit - requestsInWindow);
    const resetAt = (minute + 1) * 60000;
    
    // PERF-1.4.3: Get performance metrics
    const metrics = await this.getPerformanceMetrics(service);
    
    return {
      service,
      requestsInWindow,
      limit,
      remaining,
      resetAt,
      averageResponseTime: metrics?.averageResponseTime,
      adaptiveLimit,
      baseLimit: baseConfig.maxRequestsPerMinute
    };
  }

  /**
   * Reset rate limit counters for a service (for testing/admin)
   */
  async reset(service: ServiceType): Promise<void> {
    try {
      if (!this.redis.isAvailable()) {
        console.warn(`[rate-limit] Redis not available for resetting ${service}`);
        return;
      }
      
      // Delete all rate limit keys for this service
      // Use KEYS (acceptable for admin operations, but could use SCAN for production)
      const pattern = `rate_limit:${service}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        // Delete in batches to avoid blocking
        const batchSize = 100;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          for (const key of batch) {
            await this.redis.del(key);
          }
        }
        console.log(`[rate-limit] Reset ${keys.length} rate limit keys for ${service}`);
      }
    } catch (error) {
      console.error(`[rate-limit] Failed to reset rate limits for ${service}:`, error);
    }
  }
}

/**
 * Get rate limit service instance
 */
export function getRateLimitService(): RateLimitService {
  return RateLimitService.getInstance();
}

/**
 * Check rate limit and throw if exceeded
 */
export async function checkRateLimitOrThrow(service: ServiceType): Promise<void> {
  const rateLimitService = getRateLimitService();
  const result = await rateLimitService.checkRateLimit(service);
  
  if (!result.allowed) {
    const error = new Error(`Rate limit exceeded for ${service}. Retry after ${result.retryAfter}s`);
    (error as any).retryAfter = result.retryAfter;
    (error as any).resetAt = result.resetAt;
    throw error;
  }
}

/**
 * Check rate limit and wait if needed
 */
export async function checkRateLimitAndWait(service: ServiceType): Promise<void> {
  const rateLimitService = getRateLimitService();
  const result = await rateLimitService.checkRateLimit(service);
  
  if (!result.allowed && result.retryAfter) {
    console.log(`[rate-limit] Rate limit exceeded for ${service}, waiting ${result.retryAfter}s`);
    await new Promise(resolve => setTimeout(resolve, result.retryAfter! * 1000));
    
    // Retry once after waiting
    const retryResult = await rateLimitService.checkRateLimit(service);
    if (!retryResult.allowed) {
      throw new Error(`Rate limit still exceeded for ${service} after waiting`);
    }
  }
}

/**
 * PERF-1.4.3: Record API response time for adaptive rate limiting
 * Call this after making an API call to track performance
 */
export async function recordResponseTime(service: ServiceType, responseTimeMs: number): Promise<void> {
  const rateLimitService = getRateLimitService();
  await rateLimitService.recordResponseTime(service, responseTimeMs);
}

/**
 * PERF-1.4.3: Wrap an API call with rate limiting and response time tracking
 * This helper automatically checks rate limits and records response times
 */
export async function withRateLimit<T>(
  service: ServiceType,
  apiCall: () => Promise<T>
): Promise<T> {
  // Check rate limit before making call
  await checkRateLimitAndWait(service);
  
  // Make API call and measure response time
  const startTime = Date.now();
  try {
    const result = await apiCall();
    const responseTime = Date.now() - startTime;
    
    // Record response time (non-blocking)
    recordResponseTime(service, responseTime).catch(err => {
      console.warn(`[rate-limit] Failed to record response time:`, err);
    });
    
    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // Record response time even for errors (non-blocking)
    recordResponseTime(service, responseTime).catch(err => {
      console.warn(`[rate-limit] Failed to record response time:`, err);
    });
    
    throw error;
  }
}

