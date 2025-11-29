/**
 * Search Rate Limiter
 * Simple rate limiting for speaker search API
 */

import { getRedisClient } from '@/lib/cache/redis-client';

export interface SearchRateLimitConfig {
  maxSearchesPerHour: number;
  maxSearchesPerMinute: number;
}

const DEFAULT_CONFIG: SearchRateLimitConfig = {
  maxSearchesPerHour: 100,
  maxSearchesPerMinute: 20,
};

/**
 * Check if user can perform a search
 */
export async function checkSearchRateLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}> {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      // If Redis unavailable, allow (graceful degradation)
      return {
        allowed: true,
        remaining: DEFAULT_CONFIG.maxSearchesPerHour,
        resetAt: Date.now() + 3600000,
      };
    }

    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const hour = Math.floor(now / 3600000);

    const minuteKey = `search_rate_limit:${userId}:minute:${minute}`;
    const hourKey = `search_rate_limit:${userId}:hour:${hour}`;

    // Check minute limit
    const minuteCount = await redis.incr(minuteKey);
    await redis.expire(minuteKey, 60); // Expire after 1 minute

    if (minuteCount > DEFAULT_CONFIG.maxSearchesPerMinute) {
      const retryAfter = 60 - (now % 60000) / 1000;
      return {
        allowed: false,
        remaining: 0,
        resetAt: (minute + 1) * 60000,
        retryAfter: Math.ceil(retryAfter),
      };
    }

    // Check hour limit
    const hourCount = await redis.incr(hourKey);
    await redis.expire(hourKey, 3600); // Expire after 1 hour

    if (hourCount > DEFAULT_CONFIG.maxSearchesPerHour) {
      const retryAfter = 3600 - (now % 3600000) / 1000;
      return {
        allowed: false,
        remaining: 0,
        resetAt: (hour + 1) * 3600000,
        retryAfter: Math.ceil(retryAfter),
      };
    }

    return {
      allowed: true,
      remaining: DEFAULT_CONFIG.maxSearchesPerHour - hourCount,
      resetAt: (hour + 1) * 3600000,
    };
  } catch (error) {
    console.error('[search-rate-limiter] Error checking rate limit:', error);
    // Graceful degradation: allow if rate limit check fails
    return {
      allowed: true,
      remaining: DEFAULT_CONFIG.maxSearchesPerHour,
      resetAt: Date.now() + 3600000,
    };
  }
}

