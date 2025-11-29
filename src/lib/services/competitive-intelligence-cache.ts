/**
 * Competitive Intelligence Cache Service
 * 
 * Enhancement 2: Caching layer for competitor event searches and activity comparisons
 * Reduces database load and improves response times
 */

import { EventData } from '@/lib/types/core';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// In-memory cache (can be replaced with Redis in production)
const cache = new Map<string, CacheEntry<any>>();

// Cache TTLs (in milliseconds)
const CACHE_TTLS = {
  COMPETITOR_EVENTS: 60 * 60 * 1000, // 1 hour
  ACTIVITY_COMPARISON: 6 * 60 * 60 * 1000, // 6 hours
  USER_EVENTS: 30 * 60 * 1000 // 30 minutes
};

/**
 * Generate cache key for competitor events
 */
function getCompetitorEventsKey(
  competitorName: string,
  timeWindow?: { from: Date; to: Date }
): string {
  const windowStr = timeWindow
    ? `${timeWindow.from.toISOString()}-${timeWindow.to.toISOString()}`
    : 'all';
  return `competitor:events:${competitorName}:${windowStr}`;
}

/**
 * Generate cache key for activity comparison
 */
function getActivityComparisonKey(
  userId: string,
  competitors: string[],
  timeWindow?: { from: Date; to: Date }
): string {
  const competitorsStr = competitors.sort().join(',');
  const windowStr = timeWindow
    ? `${timeWindow.from.toISOString()}-${timeWindow.to.toISOString()}`
    : 'all';
  return `activity:comparison:${userId}:${competitorsStr}:${windowStr}`;
}

/**
 * Generate cache key for user events
 */
function getUserEventsKey(
  userId: string,
  timeWindow?: { from: Date; to: Date }
): string {
  const windowStr = timeWindow
    ? `${timeWindow.from.toISOString()}-${timeWindow.to.toISOString()}`
    : 'all';
  return `user:events:${userId}:${windowStr}`;
}

/**
 * Get cached competitor events
 */
export async function getCachedCompetitorEvents(
  competitorName: string,
  timeWindow?: { from: Date; to: Date }
): Promise<EventData[] | null> {
  const key = getCompetitorEventsKey(competitorName, timeWindow);
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Cache competitor events
 */
export async function cacheCompetitorEvents(
  competitorName: string,
  events: EventData[],
  timeWindow?: { from: Date; to: Date }
): Promise<void> {
  const key = getCompetitorEventsKey(competitorName, timeWindow);
  const expiresAt = Date.now() + CACHE_TTLS.COMPETITOR_EVENTS;

  cache.set(key, {
    data: events,
    expiresAt
  });
}

/**
 * Get cached activity comparison
 */
export async function getCachedActivityComparison(
  userId: string,
  competitors: string[],
  timeWindow?: { from: Date; to: Date }
): Promise<any | null> {
  const key = getActivityComparisonKey(userId, competitors, timeWindow);
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Cache activity comparison
 */
export async function cacheActivityComparison(
  userId: string,
  competitors: string[],
  comparison: any,
  timeWindow?: { from: Date; to: Date }
): Promise<void> {
  const key = getActivityComparisonKey(userId, competitors, timeWindow);
  const expiresAt = Date.now() + CACHE_TTLS.ACTIVITY_COMPARISON;

  cache.set(key, {
    data: comparison,
    expiresAt
  });
}

/**
 * Get cached user events
 */
export async function getCachedUserEvents(
  userId: string,
  timeWindow?: { from: Date; to: Date }
): Promise<string[] | null> {
  const key = getUserEventsKey(userId, timeWindow);
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Cache user events
 */
export async function cacheUserEvents(
  userId: string,
  events: string[],
  timeWindow?: { from: Date; to: Date }
): Promise<void> {
  const key = getUserEventsKey(userId, timeWindow);
  const expiresAt = Date.now() + CACHE_TTLS.USER_EVENTS;

  cache.set(key, {
    data: events,
    expiresAt
  });
}

/**
 * Invalidate cache for a competitor
 */
export function invalidateCompetitorCache(competitorName: string): void {
  const keysToDelete: string[] = [];
  
  for (const key of cache.keys()) {
    if (key.includes(`competitor:events:${competitorName}:`)) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => cache.delete(key));
}

/**
 * Invalidate cache for a user
 */
export function invalidateUserCache(userId: string): void {
  const keysToDelete: string[] = [];
  
  for (const key of cache.keys()) {
    if (key.includes(`user:events:${userId}:`) || key.includes(`activity:comparison:${userId}:`)) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => cache.delete(key));
}

/**
 * Clear all cache (for testing/debugging)
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{ key: string; expiresAt: Date; ttl: number }>;
} {
  const entries = Array.from(cache.entries()).map(([key, entry]) => ({
    key,
    expiresAt: new Date(entry.expiresAt),
    ttl: entry.expiresAt - Date.now()
  }));

  return {
    size: cache.size,
    entries
  };
}

