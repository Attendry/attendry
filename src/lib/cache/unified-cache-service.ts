/**
 * Unified Cache Service for Attendry Application
 * 
 * This service consolidates all caching logic and provides a unified interface
 * for caching with Redis as primary and Supabase as fallback.
 */

import { getRedisClient } from './redis-client';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Cache configuration
 */
interface CacheConfig {
  ttl: number; // Time to live in seconds
  prefix: string; // Key prefix for namespacing
  fallbackToDb?: boolean; // Whether to fallback to database cache
}

/**
 * Cache entry structure
 */
interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

/**
 * Cache statistics
 */
interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  fallbacks: number;
  totalRequests: number;
}

/**
 * Unified cache service with Redis + Supabase fallback
 */
export class UnifiedCacheService {
  private redis = getRedisClient();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    errors: 0,
    fallbacks: 0,
    totalRequests: 0,
  };

  /**
   * Get cached data
   */
  async get<T>(key: string, config: CacheConfig): Promise<T | null> {
    this.stats.totalRequests++;

    try {
      // Try Redis first
      const redisKey = this.buildKey(key, config.prefix);
      const redisData = await this.redis.get(redisKey);
      
      if (redisData) {
        this.stats.hits++;
        console.log(`[CACHE] Redis hit for key: ${redisKey}`);
        return JSON.parse(redisData);
      }

      // Fallback to database cache if enabled
      if (config.fallbackToDb) {
        const dbData = await this.getFromDatabase(redisKey);
        if (dbData) {
          this.stats.hits++;
          this.stats.fallbacks++;
          console.log(`[CACHE] Database fallback hit for key: ${redisKey}`);
          
          // Try to restore to Redis
          await this.redis.set(redisKey, JSON.stringify(dbData), config.ttl);
          return dbData;
        }
      }

      this.stats.misses++;
      console.log(`[CACHE] Miss for key: ${redisKey}`);
      return null;
    } catch (error) {
      this.stats.errors++;
      console.error(`[CACHE] Error getting key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached data
   */
  async set<T>(key: string, data: T, config: CacheConfig): Promise<boolean> {
    try {
      const redisKey = this.buildKey(key, config.prefix);
      const serializedData = JSON.stringify(data);
      
      // Set in Redis
      const redisSuccess = await this.redis.set(redisKey, serializedData, config.ttl);
      
      // Also set in database cache if enabled
      if (config.fallbackToDb) {
        await this.setInDatabase(redisKey, data, config.ttl);
      }

      if (redisSuccess) {
        console.log(`[CACHE] Set key: ${redisKey} (TTL: ${config.ttl}s)`);
        return true;
      }

      return false;
    } catch (error) {
      this.stats.errors++;
      console.error(`[CACHE] Error setting key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete cached data
   */
  async delete(key: string, prefix: string): Promise<boolean> {
    try {
      const redisKey = this.buildKey(key, prefix);
      
      // Delete from Redis
      const redisSuccess = await this.redis.del(redisKey);
      
      // Delete from database cache
      await this.deleteFromDatabase(redisKey);
      
      if (redisSuccess) {
        console.log(`[CACHE] Deleted key: ${redisKey}`);
        return true;
      }

      return false;
    } catch (error) {
      this.stats.errors++;
      console.error(`[CACHE] Error deleting key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, prefix: string): Promise<boolean> {
    try {
      const redisKey = this.buildKey(key, prefix);
      
      // Check Redis first
      if (await this.redis.exists(redisKey)) {
        return true;
      }

      // Check database cache
      const dbData = await this.getFromDatabase(redisKey);
      return dbData !== null;
    } catch (error) {
      console.error(`[CACHE] Error checking existence of key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[], config: CacheConfig): Promise<Record<string, T | null>> {
    const result: Record<string, T | null> = {};
    
    try {
      const redisKeys = keys.map(key => this.buildKey(key, config.prefix));
      const redisData = await this.redis.mget(redisKeys);
      
      for (let i = 0; i < keys.length; i++) {
        const originalKey = keys[i];
        const redisValue = redisData[i];
        
        if (redisValue) {
          this.stats.hits++;
          result[originalKey] = JSON.parse(redisValue);
        } else if (config.fallbackToDb) {
          const dbData = await this.getFromDatabase(redisKeys[i]);
          if (dbData) {
            this.stats.hits++;
            this.stats.fallbacks++;
            result[originalKey] = dbData;
          } else {
            this.stats.misses++;
            result[originalKey] = null;
          }
        } else {
          this.stats.misses++;
          result[originalKey] = null;
        }
      }
      
      this.stats.totalRequests += keys.length;
      return result;
    } catch (error) {
      this.stats.errors++;
      console.error(`[CACHE] Error in mget for keys ${keys}:`, error);
      return keys.reduce((acc, key) => ({ ...acc, [key]: null }), {});
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset<T>(keyValuePairs: Record<string, T>, config: CacheConfig): Promise<boolean> {
    try {
      const redisKeyValuePairs: Record<string, string> = {};
      
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const redisKey = this.buildKey(key, config.prefix);
        redisKeyValuePairs[redisKey] = JSON.stringify(value);
      }
      
      // Set in Redis
      const redisSuccess = await this.redis.mset(redisKeyValuePairs, config.ttl);
      
      // Set in database cache if enabled
      if (config.fallbackToDb) {
        for (const [key, value] of Object.entries(keyValuePairs)) {
          const redisKey = this.buildKey(key, config.prefix);
          await this.setInDatabase(redisKey, value, config.ttl);
        }
      }
      
      if (redisSuccess) {
        console.log(`[CACHE] Set ${Object.keys(keyValuePairs).length} keys with prefix: ${config.prefix}`);
        return true;
      }
      
      return false;
    } catch (error) {
      this.stats.errors++;
      console.error(`[CACHE] Error in mset:`, error);
      return false;
    }
  }

  /**
   * Clear cache by pattern
   */
  async clear(pattern: string, prefix: string): Promise<number> {
    try {
      const searchPattern = this.buildKey(pattern, prefix);
      const keys = await this.redis.keys(searchPattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      // Delete from Redis
      let deletedCount = 0;
      for (const key of keys) {
        if (await this.redis.del(key)) {
          deletedCount++;
        }
      }
      
      // Delete from database cache
      await this.clearFromDatabase(searchPattern);
      
      console.log(`[CACHE] Cleared ${deletedCount} keys matching pattern: ${searchPattern}`);
      return deletedCount;
    } catch (error) {
      console.error(`[CACHE] Error clearing pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const hitRate = this.stats.totalRequests > 0 
      ? (this.stats.hits / this.stats.totalRequests) * 100 
      : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      fallbacks: 0,
      totalRequests: 0,
    };
  }

  /**
   * Build cache key with prefix
   */
  private buildKey(key: string, prefix: string): string {
    return `${prefix}:${key}`;
  }

  /**
   * Get data from database cache
   */
  private async getFromDatabase<T>(cacheKey: string): Promise<T | null> {
    try {
      const supabase = supabaseAdmin();
      const { data, error } = await supabase
        .from('search_cache')
        .select('payload, ttl_at')
        .eq('cache_key', cacheKey)
        .maybeSingle();
      
      if (error || !data) {
        return null;
      }
      
      const now = Date.now();
      const ttlTime = new Date(data.ttl_at).getTime();
      
      if (ttlTime > now) {
        return data.payload;
      } else {
        // Expired, delete it
        await this.deleteFromDatabase(cacheKey);
        return null;
      }
    } catch (error) {
      console.error(`[CACHE] Database get error for key ${cacheKey}:`, error);
      return null;
    }
  }

  /**
   * Set data in database cache
   */
  private async setInDatabase<T>(cacheKey: string, data: T, ttlSeconds: number): Promise<void> {
    try {
      const supabase = supabaseAdmin();
      const ttlAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      
      await supabase
        .from('search_cache')
        .upsert({
          cache_key: cacheKey,
          payload: data,
          ttl_at: ttlAt,
          provider: 'unified_cache',
          schema_version: 1,
        });
    } catch (error) {
      console.error(`[CACHE] Database set error for key ${cacheKey}:`, error);
    }
  }

  /**
   * Delete data from database cache
   */
  private async deleteFromDatabase(cacheKey: string): Promise<void> {
    try {
      const supabase = supabaseAdmin();
      await supabase
        .from('search_cache')
        .delete()
        .eq('cache_key', cacheKey);
    } catch (error) {
      console.error(`[CACHE] Database delete error for key ${cacheKey}:`, error);
    }
  }

  /**
   * Clear data from database cache by pattern
   */
  private async clearFromDatabase(pattern: string): Promise<void> {
    try {
      const supabase = supabaseAdmin();
      await supabase
        .from('search_cache')
        .delete()
        .like('cache_key', pattern);
    } catch (error) {
      console.error(`[CACHE] Database clear error for pattern ${pattern}:`, error);
    }
  }
}

/**
 * Global cache service instance
 */
let globalCacheService: UnifiedCacheService | null = null;

/**
 * Get or create global cache service
 */
export function getCacheService(): UnifiedCacheService {
  if (!globalCacheService) {
    globalCacheService = new UnifiedCacheService();
  }
  return globalCacheService;
}

/**
 * Cache configuration presets
 */
export const CACHE_CONFIGS = {
  SEARCH_RESULTS: {
    ttl: 6 * 60 * 60, // 6 hours
    prefix: 'search',
    fallbackToDb: true,
  },
  USER_PROFILES: {
    ttl: 30 * 60, // 30 minutes
    prefix: 'profile',
    fallbackToDb: true,
  },
  CONFIGURATIONS: {
    ttl: 60 * 60, // 1 hour
    prefix: 'config',
    fallbackToDb: true,
  },
  WATCHLIST: {
    ttl: 5 * 60, // 5 minutes
    prefix: 'watchlist',
    fallbackToDb: true,
  },
  AI_RESPONSES: {
    ttl: 24 * 60 * 60, // 24 hours
    prefix: 'ai',
    fallbackToDb: false,
  },
  EXTERNAL_APIS: {
    ttl: 15 * 60, // 15 minutes
    prefix: 'external',
    fallbackToDb: false,
  },
} as const;
