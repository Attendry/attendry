/**
 * Cache Module Index
 * 
 * This file exports all caching utilities and services
 * for use throughout the Attendry application.
 */

// Export Redis client
export * from './redis-client';

// Export unified cache service
export * from './unified-cache-service';

// Re-export commonly used functions and types
export {
  getRedisClient,
  initializeRedis,
  closeRedis,
} from './redis-client';

export {
  getCacheService,
  CACHE_CONFIGS,
} from './unified-cache-service';

export type {
  CacheConfig,
  CacheEntry,
  CacheStats,
} from './unified-cache-service';
