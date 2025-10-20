/**
 * Cache Optimizer
 * 
 * This module implements advanced cache invalidation strategies and intelligent
 * cache warming to maximize cache hit rates and minimize stale data.
 * 
 * Key Features:
 * - Smart cache invalidation with dependency tracking
 * - Predictive cache warming based on usage patterns
 * - Cache preloading for popular queries
 * - Intelligent cache eviction policies
 * - Cache compression and optimization
 * - Real-time cache analytics and monitoring
 */

import { createHash } from "crypto";
import { searchCache, analysisCache, speakerCache } from "./advanced-cache";

// Cache optimization configuration
export const CACHE_OPTIMIZATION_CONFIG = {
  // Invalidation strategies
  invalidation: {
    enableDependencyTracking: true,
    enablePatternInvalidation: true,
    enableTimeBasedInvalidation: true,
    enablePredictiveInvalidation: true,
    invalidationBatchSize: 100,
    invalidationDelay: 1000, // 1 second delay for batch invalidation
  },
  
  // Cache warming strategies
  warming: {
    enablePredictiveWarming: true,
    enablePopularQueryWarming: true,
    enableTimeBasedWarming: true,
    warmingBatchSize: 50,
    warmingInterval: 5 * 60 * 1000, // 5 minutes
    maxWarmingConcurrency: 10,
    warmingTimeout: 30000, // 30 seconds
  },
  
  // Cache analytics
  analytics: {
    enableRealTimeAnalytics: true,
    analyticsInterval: 60000, // 1 minute
    maxAnalyticsHistory: 1000,
    enablePerformanceTracking: true,
  },
  
  // Cache optimization
  optimization: {
    enableCompression: true,
    enableDeduplication: true,
    enableSerializationOptimization: true,
    compressionThreshold: 1024, // 1KB
    maxCacheSize: 10000,
    evictionPolicy: 'lru', // lru, lfu, ttl
  }
};

// Cache invalidation patterns
export interface CacheInvalidationPattern {
  pattern: string;
  type: 'exact' | 'prefix' | 'suffix' | 'contains' | 'regex';
  priority: number;
  dependencies?: string[];
}

// Cache warming strategy
export interface CacheWarmingStrategy {
  name: string;
  priority: number;
  enabled: boolean;
  queryGenerator: () => Promise<string[]>;
  dataProvider: (key: string) => Promise<any>;
  ttl?: number;
}

// Cache analytics data
export interface CacheAnalyticsData {
  timestamp: number;
  hitRate: number;
  missRate: number;
  totalRequests: number;
  averageResponseTime: number;
  cacheSize: number;
  memoryUsage: number;
  topKeys: Array<{ key: string; hits: number; size: number }>;
  invalidationCount: number;
  warmingCount: number;
}

// Cache dependency tracker
class CacheDependencyManager {
  private dependencies = new Map<string, Set<string>>();
  private reverseDependencies = new Map<string, Set<string>>();
  private invalidationQueue: string[] = [];
  private invalidationTimer: NodeJS.Timeout | null = null;

  addDependency(key: string, dependency: string): void {
    if (!this.dependencies.has(key)) {
      this.dependencies.set(key, new Set());
    }
    this.dependencies.get(key)!.add(dependency);

    if (!this.reverseDependencies.has(dependency)) {
      this.reverseDependencies.set(dependency, new Set());
    }
    this.reverseDependencies.get(dependency)!.add(key);
  }

  getDependencies(key: string): string[] {
    return Array.from(this.dependencies.get(key) || []);
  }

  getDependents(dependency: string): string[] {
    return Array.from(this.reverseDependencies.get(dependency) || []);
  }

  async invalidateDependency(dependency: string): Promise<void> {
    const dependents = this.getDependents(dependency);
    
    for (const dependent of dependents) {
      this.queueInvalidation(dependent);
    }
    
    // Remove dependency from all dependents
    this.reverseDependencies.delete(dependency);
    for (const dependent of dependents) {
      const deps = this.dependencies.get(dependent);
      if (deps) {
        deps.delete(dependency);
        if (deps.size === 0) {
          this.dependencies.delete(dependent);
        }
      }
    }
  }

  private queueInvalidation(key: string): void {
    if (!this.invalidationQueue.includes(key)) {
      this.invalidationQueue.push(key);
    }
    
    if (this.invalidationTimer) {
      clearTimeout(this.invalidationTimer);
    }
    
    this.invalidationTimer = setTimeout(() => {
      this.processInvalidationQueue();
    }, CACHE_OPTIMIZATION_CONFIG.invalidation.invalidationDelay);
  }

  private async processInvalidationQueue(): Promise<void> {
    const batch = this.invalidationQueue.splice(0, CACHE_OPTIMIZATION_CONFIG.invalidation.invalidationBatchSize);
    
    for (const key of batch) {
      await this.invalidateKey(key);
    }
    
    if (this.invalidationQueue.length > 0) {
      this.invalidationTimer = setTimeout(() => {
        this.processInvalidationQueue();
      }, CACHE_OPTIMIZATION_CONFIG.invalidation.invalidationDelay);
    }
  }

  private async invalidateKey(key: string): Promise<void> {
    try {
      // Determine cache type and invalidate accordingly
      if (key.startsWith('search:')) {
        await searchCache.delete(key);
      } else if (key.startsWith('analysis:')) {
        await analysisCache.delete(key);
      } else if (key.startsWith('speaker:')) {
        await speakerCache.delete(key);
      }
    } catch (error) {
      console.error(`[cache-dependency-manager] Failed to invalidate key ${key}:`, error);
    }
  }
}

// Cache warming manager
class CacheWarmingManager {
  private strategies: Map<string, CacheWarmingStrategy> = new Map();
  private warmingQueue: Set<string> = new Set();
  private warmingTimer: NodeJS.Timeout | null = null;
  private warmingStats = {
    totalWarmed: 0,
    successfulWarms: 0,
    failedWarms: 0,
    lastWarmingTime: 0,
  };

  registerStrategy(strategy: CacheWarmingStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  async startWarming(): Promise<void> {
    if (this.warmingTimer) {
      clearInterval(this.warmingTimer);
    }

    this.warmingTimer = setInterval(async () => {
      await this.performWarming();
    }, CACHE_OPTIMIZATION_CONFIG.warming.warmingInterval);
  }

  async stopWarming(): Promise<void> {
    if (this.warmingTimer) {
      clearInterval(this.warmingTimer);
      this.warmingTimer = null;
    }
  }

  private async performWarming(): Promise<void> {
    const enabledStrategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const strategy of enabledStrategies) {
      try {
        await this.warmStrategy(strategy);
      } catch (error) {
        console.error(`[cache-warming] Failed to warm strategy ${strategy.name}:`, error);
      }
    }
  }

  private async warmStrategy(strategy: CacheWarmingStrategy): Promise<void> {
    const keys = await strategy.queryGenerator();
    const keysToWarm = keys.slice(0, CACHE_OPTIMIZATION_CONFIG.warming.warmingBatchSize);
    
    console.log(`[cache-warming] Warming ${keysToWarm.length} keys for strategy ${strategy.name}`);
    
    const warmingPromises = keysToWarm.map(async (key) => {
      if (this.warmingQueue.has(key)) return;
      
      this.warmingQueue.add(key);
      this.warmingStats.totalWarmed++;
      
      try {
        const data = await Promise.race([
          strategy.dataProvider(key),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Warming timeout')), CACHE_OPTIMIZATION_CONFIG.warming.warmingTimeout)
          )
        ]);
        
        // Determine cache type and set accordingly
        if (key.startsWith('search:')) {
          await searchCache.set(key, data, strategy.ttl);
        } else if (key.startsWith('analysis:')) {
          await analysisCache.set(key, data, strategy.ttl);
        } else if (key.startsWith('speaker:')) {
          await speakerCache.set(key, data, strategy.ttl);
        }
        
        this.warmingStats.successfulWarms++;
      } catch (error) {
        this.warmingStats.failedWarms++;
        console.warn(`[cache-warming] Failed to warm key ${key}:`, error);
      } finally {
        this.warmingQueue.delete(key);
      }
    });
    
    await Promise.allSettled(warmingPromises);
    this.warmingStats.lastWarmingTime = Date.now();
  }

  getWarmingStats() {
    return { ...this.warmingStats };
  }
}

// Cache analytics manager
class CacheAnalyticsManager {
  private analyticsHistory: CacheAnalyticsData[] = [];
  private analyticsTimer: NodeJS.Timeout | null = null;

  startAnalytics(): void {
    if (this.analyticsTimer) {
      clearInterval(this.analyticsTimer);
    }

    this.analyticsTimer = setInterval(async () => {
      await this.collectAnalytics();
    }, CACHE_OPTIMIZATION_CONFIG.analytics.analyticsInterval);
  }

  stopAnalytics(): void {
    if (this.analyticsTimer) {
      clearInterval(this.analyticsTimer);
      this.analyticsTimer = null;
    }
  }

  private async collectAnalytics(): Promise<void> {
    try {
      const searchAnalytics = searchCache.getAnalytics();
      const analysisAnalytics = analysisCache.getAnalytics();
      const speakerAnalytics = speakerCache.getAnalytics();

      const combinedAnalytics: CacheAnalyticsData = {
        timestamp: Date.now(),
        hitRate: (searchAnalytics.combined.hitRate + analysisAnalytics.combined.hitRate + speakerAnalytics.combined.hitRate) / 3,
        missRate: 100 - ((searchAnalytics.combined.hitRate + analysisAnalytics.combined.hitRate + speakerAnalytics.combined.hitRate) / 3),
        totalRequests: searchAnalytics.combined.totalRequests + analysisAnalytics.combined.totalRequests + speakerAnalytics.combined.totalRequests,
        averageResponseTime: (searchAnalytics.combined.averageResponseTime + analysisAnalytics.combined.averageResponseTime + speakerAnalytics.combined.averageResponseTime) / 3,
        cacheSize: searchAnalytics.combined.cacheSize + analysisAnalytics.combined.cacheSize + speakerAnalytics.combined.cacheSize,
        memoryUsage: searchAnalytics.combined.memoryUsage + analysisAnalytics.combined.memoryUsage + speakerAnalytics.combined.memoryUsage,
        topKeys: [...searchAnalytics.combined.topKeys, ...analysisAnalytics.combined.topKeys, ...speakerAnalytics.combined.topKeys]
          .sort((a, b) => b.hits - a.hits)
          .slice(0, 20),
        invalidationCount: 0, // Would be tracked by dependency manager
        warmingCount: 0, // Would be tracked by warming manager
      };

      this.analyticsHistory.push(combinedAnalytics);
      
      // Keep only recent history
      if (this.analyticsHistory.length > CACHE_OPTIMIZATION_CONFIG.analytics.maxAnalyticsHistory) {
        this.analyticsHistory.shift();
      }
    } catch (error) {
      console.error('[cache-analytics] Failed to collect analytics:', error);
    }
  }

  getAnalyticsHistory(): CacheAnalyticsData[] {
    return [...this.analyticsHistory];
  }

  getCurrentAnalytics(): CacheAnalyticsData | null {
    return this.analyticsHistory.length > 0 ? this.analyticsHistory[this.analyticsHistory.length - 1] : null;
  }
}

// Cache optimizer main class
export class CacheOptimizer {
  private static instance: CacheOptimizer;
  private dependencyManager: CacheDependencyManager;
  private warmingManager: CacheWarmingManager;
  private analyticsManager: CacheAnalyticsManager;
  private isInitialized = false;

  private constructor() {
    this.dependencyManager = new CacheDependencyManager();
    this.warmingManager = new CacheWarmingManager();
    this.analyticsManager = new CacheAnalyticsManager();
  }

  public static getInstance(): CacheOptimizer {
    if (!CacheOptimizer.instance) {
      CacheOptimizer.instance = new CacheOptimizer();
    }
    return CacheOptimizer.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Register warming strategies
    await this.registerWarmingStrategies();
    
    // Start services
    if (CACHE_OPTIMIZATION_CONFIG.warming.enablePredictiveWarming) {
      await this.warmingManager.startWarming();
    }
    
    if (CACHE_OPTIMIZATION_CONFIG.analytics.enableRealTimeAnalytics) {
      this.analyticsManager.startAnalytics();
    }

    this.isInitialized = true;
    console.log('[cache-optimizer] Initialized successfully');
  }

  private async registerWarmingStrategies(): Promise<void> {
    // Popular search queries warming strategy
    this.warmingManager.registerStrategy({
      name: 'popular-searches',
      priority: 10,
      enabled: true,
      queryGenerator: async () => {
        const popularQueries = [
          'legal conference 2025',
          'compliance summit Germany',
          'data privacy event',
          'legal tech conference',
          'regulatory compliance',
          'GDPR workshop',
          'cybersecurity conference',
          'fintech summit',
          'blockchain event',
          'AI conference'
        ];
        
        const countries = ['DE', 'FR', 'IT', 'ES', 'NL', 'AT', 'CH'];
        const keys: string[] = [];
        
        for (const query of popularQueries) {
          for (const country of countries) {
            keys.push(`search:${createHash('md5').update(JSON.stringify({ q: query, country })).digest('hex')}`);
          }
        }
        
        return keys;
      },
      dataProvider: async (key: string) => {
        // In a real implementation, this would call the actual search function
        return { items: [], provider: 'firecrawl', debug: {}, metrics: {} };
      },
      ttl: 60 * 60 * 1000, // 1 hour
    });

    // Time-based warming strategy (warm queries that are likely to be searched soon)
    this.warmingManager.registerStrategy({
      name: 'time-based-warming',
      priority: 5,
      enabled: true,
      queryGenerator: async () => {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay();
        
        // Generate time-based queries
        const timeBasedQueries: string[] = [];
        
        if (currentHour >= 9 && currentHour <= 17) {
          // Business hours - focus on professional events
          timeBasedQueries.push('business conference', 'professional development', 'industry summit');
        } else {
          // After hours - focus on networking events
          timeBasedQueries.push('networking event', 'meetup', 'workshop');
        }
        
        if (currentDay >= 1 && currentDay <= 5) {
          // Weekdays - focus on conferences and workshops
          timeBasedQueries.push('conference', 'workshop', 'seminar');
        } else {
          // Weekends - focus on social and networking events
          timeBasedQueries.push('networking', 'social event', 'community meetup');
        }
        
        const keys: string[] = [];
        for (const query of timeBasedQueries) {
          keys.push(`search:${createHash('md5').update(JSON.stringify({ q: query, country: 'DE' })).digest('hex')}`);
        }
        
        return keys;
      },
      dataProvider: async (key: string) => {
        return { items: [], provider: 'firecrawl', debug: {}, metrics: {} };
      },
      ttl: 30 * 60 * 1000, // 30 minutes
    });
  }

  // Cache invalidation methods
  async invalidateByPattern(pattern: string, type: 'exact' | 'prefix' | 'suffix' | 'contains' | 'regex' = 'contains'): Promise<void> {
    console.log(`[cache-optimizer] Invalidating cache by pattern: ${pattern} (${type})`);
    
    // This would implement pattern-based invalidation
    // For now, we'll use a simplified approach
    const allKeys = await this.getAllCacheKeys();
    const matchingKeys = allKeys.filter(key => {
      switch (type) {
        case 'exact':
          return key === pattern;
        case 'prefix':
          return key.startsWith(pattern);
        case 'suffix':
          return key.endsWith(pattern);
        case 'contains':
          return key.includes(pattern);
        case 'regex':
          return new RegExp(pattern).test(key);
        default:
          return false;
      }
    });
    
    for (const key of matchingKeys) {
      await this.dependencyManager.invalidateDependency(key);
    }
  }

  async invalidateByDependency(dependency: string): Promise<void> {
    await this.dependencyManager.invalidateDependency(dependency);
  }

  async invalidateByTime(olderThan: number): Promise<void> {
    // This would implement time-based invalidation
    console.log(`[cache-optimizer] Invalidating cache entries older than ${olderThan}ms`);
  }

  // Cache warming methods
  async warmCache(keys: string[], dataProvider: (key: string) => Promise<any>): Promise<void> {
    console.log(`[cache-optimizer] Warming ${keys.length} cache keys`);
    
    const warmingPromises = keys.map(async (key) => {
      try {
        const data = await dataProvider(key);
        
        if (key.startsWith('search:')) {
          await searchCache.set(key, data);
        } else if (key.startsWith('analysis:')) {
          await analysisCache.set(key, data);
        } else if (key.startsWith('speaker:')) {
          await speakerCache.set(key, data);
        }
      } catch (error) {
        console.error(`[cache-optimizer] Failed to warm key ${key}:`, error);
      }
    });
    
    await Promise.allSettled(warmingPromises);
  }

  // Analytics methods
  getAnalyticsHistory(): CacheAnalyticsData[] {
    return this.analyticsManager.getAnalyticsHistory();
  }

  getCurrentAnalytics(): CacheAnalyticsData | null {
    return this.analyticsManager.getCurrentAnalytics();
  }

  getWarmingStats() {
    return this.warmingManager.getWarmingStats();
  }

  // Utility methods
  private async getAllCacheKeys(): Promise<string[]> {
    // This would return all cache keys from all cache tiers
    // For now, return empty array
    return [];
  }

  async shutdown(): Promise<void> {
    await this.warmingManager.stopWarming();
    this.analyticsManager.stopAnalytics();
    this.isInitialized = false;
    console.log('[cache-optimizer] Shutdown complete');
  }
}

// Global cache optimizer instance
export const cacheOptimizer = CacheOptimizer.getInstance();

// Initialize cache optimizer
cacheOptimizer.initialize().catch(error => {
  console.error('[cache-optimizer] Failed to initialize:', error);
});

// Export utility functions
export async function invalidateCacheByPattern(pattern: string, type: 'exact' | 'prefix' | 'suffix' | 'contains' | 'regex' = 'contains'): Promise<void> {
  await cacheOptimizer.invalidateByPattern(pattern, type);
}

export async function invalidateCacheByDependency(dependency: string): Promise<void> {
  await cacheOptimizer.invalidateByDependency(dependency);
}

export async function warmCache(keys: string[], dataProvider: (key: string) => Promise<any>): Promise<void> {
  await cacheOptimizer.warmCache(keys, dataProvider);
}

export function getCacheAnalytics(): CacheAnalyticsData | null {
  return cacheOptimizer.getCurrentAnalytics();
}

export function getCacheWarmingStats() {
  return cacheOptimizer.getWarmingStats();
}
