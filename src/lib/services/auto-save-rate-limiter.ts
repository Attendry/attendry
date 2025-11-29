/**
 * Auto-Save Rate Limiter Service
 * 
 * User-specific rate limiting for contact creation (auto-save operations).
 * Prevents system overload by limiting contact creation to 50 contacts/hour/user.
 * 
 * Features:
 * - Per-user rate limiting (50 contacts/hour)
 * - Queue system for bulk operations
 * - Backpressure mechanism (reject when queue full)
 * - Circuit breaker (stop processing if threshold exceeded)
 * - Redis-based for distributed systems
 * 
 * Builds on existing RateLimitService infrastructure but specialized for user operations.
 */

import { getRedisClient } from '@/lib/cache/redis-client';

export interface AutoSaveRateLimitConfig {
  maxContactsPerHour: number;
  maxContactsPerDay?: number;
  queueMaxSize: number; // Maximum queue size before backpressure
  circuitBreakerThreshold: number; // Queue size that triggers circuit breaker
  circuitBreakerCooldown: number; // Cooldown period in milliseconds
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // timestamp when limit resets
  retryAfter?: number; // seconds to wait before retry
  queueSize?: number;
  queueFull?: boolean;
  circuitBreakerOpen?: boolean;
}

export interface QueueStats {
  queueSize: number;
  processing: number;
  completed: number;
  failed: number;
  circuitBreakerOpen: boolean;
}

// Default configuration
const DEFAULT_CONFIG: AutoSaveRateLimitConfig = {
  maxContactsPerHour: 50,
  maxContactsPerDay: 200, // Optional daily limit
  queueMaxSize: 100, // Reject new items when queue has 100+ pending
  circuitBreakerThreshold: 200, // Open circuit breaker at 200+ items
  circuitBreakerCooldown: 300000, // 5 minutes cooldown
};

/**
 * Auto-Save Rate Limiter Service
 */
export class AutoSaveRateLimiter {
  private static instance: AutoSaveRateLimiter;
  private config: AutoSaveRateLimitConfig;
  private redis = getRedisClient();

  private constructor(config?: Partial<AutoSaveRateLimitConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<AutoSaveRateLimitConfig>): AutoSaveRateLimiter {
    if (!AutoSaveRateLimiter.instance) {
      AutoSaveRateLimiter.instance = new AutoSaveRateLimiter(config);
    }
    return AutoSaveRateLimiter.instance;
  }

  /**
   * Check if user can create more contacts (rate limit check)
   */
  async checkRateLimit(userId: string): Promise<RateLimitCheckResult> {
    try {
      const now = Date.now();
      const hour = Math.floor(now / 3600000); // Hour timestamp
      const day = Math.floor(now / 86400000); // Day timestamp

      // Redis keys
      const hourKey = `auto_save:rate_limit:${userId}:hour:${hour}`;
      const dayKey = `auto_save:rate_limit:${userId}:day:${day}`;
      const queueKey = `auto_save:queue:${userId}`;
      const circuitBreakerKey = `auto_save:circuit_breaker:${userId}`;

      // Check circuit breaker
      const circuitBreakerOpen = await this.isCircuitBreakerOpen(userId);
      if (circuitBreakerOpen) {
        const cooldownEnd = await this.getCircuitBreakerCooldownEnd(userId);
        return {
          allowed: false,
          remaining: 0,
          resetAt: cooldownEnd,
          retryAfter: Math.ceil((cooldownEnd - now) / 1000),
          circuitBreakerOpen: true,
        };
      }

      // Check queue size (backpressure)
      const queueSize = await this.getQueueSize(userId);
      if (queueSize >= this.config.queueMaxSize) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: now + 60000, // Retry in 1 minute
          retryAfter: 60,
          queueSize,
          queueFull: true,
        };
      }

      // Check hourly limit
      const hourCount = await this.getRequestCount(hourKey);
      if (hourCount >= this.config.maxContactsPerHour) {
        const resetAt = (hour + 1) * 3600000;
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter: Math.ceil((resetAt - now) / 1000),
          queueSize,
        };
      }

      // Check daily limit if configured
      if (this.config.maxContactsPerDay) {
        const dayCount = await this.getRequestCount(dayKey);
        if (dayCount >= this.config.maxContactsPerDay) {
          const resetAt = (day + 1) * 86400000;
          return {
            allowed: false,
            remaining: 0,
            resetAt,
            retryAfter: Math.ceil((resetAt - now) / 1000),
            queueSize,
          };
        }
      }

      // All checks passed
      const remaining = this.config.maxContactsPerHour - hourCount;
      return {
        allowed: true,
        remaining,
        resetAt: (hour + 1) * 3600000,
        queueSize,
      };
    } catch (error) {
      console.error('[auto-save-rate-limiter] Error checking rate limit:', error);
      // Fail open - allow request if rate limiter fails
      return {
        allowed: true,
        remaining: this.config.maxContactsPerHour,
        resetAt: Date.now() + 3600000,
      };
    }
  }

  /**
   * Record a contact creation (increment counters)
   */
  async recordContactCreation(userId: string): Promise<void> {
    try {
      const now = Date.now();
      const hour = Math.floor(now / 3600000);
      const day = Math.floor(now / 86400000);

      const hourKey = `auto_save:rate_limit:${userId}:hour:${hour}`;
      const dayKey = `auto_save:rate_limit:${userId}:day:${day}`;

      // Increment counters
      await this.incrementRequestCount(hourKey, 3600); // 1 hour TTL
      if (this.config.maxContactsPerDay) {
        await this.incrementRequestCount(dayKey, 86400); // 1 day TTL
      }

      // Check if we need to open circuit breaker (queue too large)
      const queueSize = await this.getQueueSize(userId);
      if (queueSize >= this.config.circuitBreakerThreshold) {
        await this.openCircuitBreaker(userId);
        console.warn(`[auto-save-rate-limiter] Circuit breaker opened for user ${userId}: queue size ${queueSize} >= threshold ${this.config.circuitBreakerThreshold}`);
      }
    } catch (error) {
      console.error('[auto-save-rate-limiter] Error recording contact creation:', error);
    }
  }

  /**
   * Add contact creation to queue (for bulk operations)
   */
  async enqueueContactCreation(
    userId: string,
    contactData: {
      speakerName: string;
      speakerOrg?: string;
      eventId?: string;
      metadata?: any;
    }
  ): Promise<{ queued: boolean; queueSize: number; reason?: string }> {
    try {
      // Check rate limit first
      const rateLimitCheck = await this.checkRateLimit(userId);
      if (!rateLimitCheck.allowed) {
        return {
          queued: false,
          queueSize: rateLimitCheck.queueSize || 0,
          reason: rateLimitCheck.circuitBreakerOpen
            ? 'Circuit breaker open'
            : rateLimitCheck.queueFull
            ? 'Queue full'
            : 'Rate limit exceeded',
        };
      }

      // Add to queue
      const queueKey = `auto_save:queue:${userId}`;
      const queueItem = {
        id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        userId,
        contactData,
        createdAt: Date.now(),
        status: 'pending' as const,
      };

      const redis = await this.redis;
      if (redis) {
        await redis.lpush(queueKey, JSON.stringify(queueItem));
        await redis.expire(queueKey, 86400); // 24 hour TTL for queue items

        const queueSize = await this.getQueueSize(userId);
        return { queued: true, queueSize };
      } else {
        // Fallback: in-memory queue (not recommended for production)
        console.warn('[auto-save-rate-limiter] Redis not available, using fallback');
        return { queued: false, queueSize: 0, reason: 'Redis not available' };
      }
    } catch (error) {
      console.error('[auto-save-rate-limiter] Error enqueuing contact creation:', error);
      return { queued: false, queueSize: 0, reason: 'Error enqueuing' };
    }
  }

  /**
   * Get queue size for user
   */
  async getQueueSize(userId: string): Promise<number> {
    try {
      const queueKey = `auto_save:queue:${userId}`;
      const redis = await this.redis;
      if (redis) {
        return await redis.llen(queueKey);
      }
      return 0;
    } catch (error) {
      console.error('[auto-save-rate-limiter] Error getting queue size:', error);
      return 0;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(userId: string): Promise<QueueStats> {
    try {
      const queueSize = await this.getQueueSize(userId);
      const circuitBreakerOpen = await this.isCircuitBreakerOpen(userId);

      // TODO: Track processing/completed/failed in Redis
      return {
        queueSize,
        processing: 0,
        completed: 0,
        failed: 0,
        circuitBreakerOpen,
      };
    } catch (error) {
      console.error('[auto-save-rate-limiter] Error getting queue stats:', error);
      return {
        queueSize: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        circuitBreakerOpen: false,
      };
    }
  }

  /**
   * Check if circuit breaker is open
   */
  private async isCircuitBreakerOpen(userId: string): Promise<boolean> {
    try {
      const circuitBreakerKey = `auto_save:circuit_breaker:${userId}`;
      const redis = await this.redis;
      if (redis) {
        const ttl = await redis.ttl(circuitBreakerKey);
        return ttl > 0; // Circuit breaker is open if key exists
      }
      return false;
    } catch (error) {
      console.error('[auto-save-rate-limiter] Error checking circuit breaker:', error);
      return false;
    }
  }

  /**
   * Get circuit breaker cooldown end time
   */
  private async getCircuitBreakerCooldownEnd(userId: string): Promise<number> {
    try {
      const circuitBreakerKey = `auto_save:circuit_breaker:${userId}`;
      const redis = await this.redis;
      if (redis) {
        const ttl = await redis.ttl(circuitBreakerKey);
        if (ttl > 0) {
          return Date.now() + ttl * 1000;
        }
      }
      return Date.now();
    } catch (error) {
      console.error('[auto-save-rate-limiter] Error getting circuit breaker cooldown:', error);
      return Date.now();
    }
  }

  /**
   * Open circuit breaker (stop processing)
   */
  private async openCircuitBreaker(userId: string): Promise<void> {
    try {
      const circuitBreakerKey = `auto_save:circuit_breaker:${userId}`;
      const redis = await this.redis;
      if (redis) {
        const cooldownSeconds = Math.ceil(this.config.circuitBreakerCooldown / 1000);
        await redis.setex(circuitBreakerKey, cooldownSeconds, '1');
      }
    } catch (error) {
      console.error('[auto-save-rate-limiter] Error opening circuit breaker:', error);
    }
  }

  /**
   * Close circuit breaker (resume processing)
   */
  async closeCircuitBreaker(userId: string): Promise<void> {
    try {
      const circuitBreakerKey = `auto_save:circuit_breaker:${userId}`;
      const redis = await this.redis;
      if (redis) {
        await redis.del(circuitBreakerKey);
      }
    } catch (error) {
      console.error('[auto-save-rate-limiter] Error closing circuit breaker:', error);
    }
  }

  /**
   * Get request count from Redis
   */
  private async getRequestCount(key: string): Promise<number> {
    try {
      const redis = await this.redis;
      if (redis) {
        const count = await redis.get(key);
        return count ? parseInt(count, 10) : 0;
      }
      return 0;
    } catch (error) {
      console.warn(`[auto-save-rate-limiter] Redis not available for ${key}`);
      return 0;
    }
  }

  /**
   * Increment request count in Redis
   */
  private async incrementRequestCount(key: string, ttl: number): Promise<void> {
    try {
      const redis = await this.redis;
      if (redis) {
        await redis.incr(key);
        await redis.expire(key, ttl);
      }
    } catch (error) {
      console.warn(`[auto-save-rate-limiter] Redis not available for incrementing ${key}`);
    }
  }

  /**
   * Reset rate limit for user (admin/testing)
   */
  async resetRateLimit(userId: string): Promise<void> {
    try {
      const redis = await this.redis;
      if (redis) {
        const pattern = `auto_save:rate_limit:${userId}:*`;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }
    } catch (error) {
      console.error('[auto-save-rate-limiter] Error resetting rate limit:', error);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutoSaveRateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Get rate limiter instance
 */
export function getAutoSaveRateLimiter(): AutoSaveRateLimiter {
  return AutoSaveRateLimiter.getInstance();
}

/**
 * Check rate limit and throw if exceeded
 */
export async function checkAutoSaveRateLimitOrThrow(userId: string): Promise<void> {
  const rateLimiter = getAutoSaveRateLimiter();
  const result = await rateLimiter.checkRateLimit(userId);
  
  if (!result.allowed) {
    const error = new Error(
      `Auto-save rate limit exceeded for user ${userId}. ${result.circuitBreakerOpen ? 'Circuit breaker open.' : result.queueFull ? 'Queue full.' : `Retry after ${result.retryAfter}s`}`
    );
    (error as any).retryAfter = result.retryAfter;
    (error as any).circuitBreakerOpen = result.circuitBreakerOpen;
    (error as any).queueFull = result.queueFull;
    throw error;
  }
}

