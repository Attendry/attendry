/**
 * Company Intelligence Cache Service
 * 
 * Provides intelligent caching for company intelligence data using
 * the existing unified cache service infrastructure.
 */

import { getCacheService, CACHE_CONFIGS } from '@/lib/cache';

export interface CompanyCacheKey {
  companyName: string;
  dataType: 'annual_reports' | 'intent_signals' | 'competitor_analysis' | 'event_participation' | 'speaker_activity';
  timeRange?: string;
  country?: string;
}

export interface CompanyCacheEntry<T = any> {
  data: T;
  metadata: {
    cachedAt: string;
    expiresAt: string;
    sourceCount: number;
    confidence: number;
    version: string;
  };
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

/**
 * Company Intelligence Cache Service
 */
export class CompanyIntelligenceCache {
  private static cacheService = getCacheService();
  private static stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };

  private static readonly CACHE_VERSION = '1.0.0';
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly LONG_TTL = 86400; // 24 hours for stable data

  /**
   * Get company data from cache
   */
  static async getCompanyData<T = any>(
    key: CompanyCacheKey
  ): Promise<CompanyCacheEntry<T> | null> {
    try {
      const cacheKey = this.buildCacheKey(key);
      const cached = await this.cacheService.get<CompanyCacheEntry<T>>(
        cacheKey, 
        CACHE_CONFIGS.COMPANY_INTELLIGENCE
      );

      if (cached) {
        // Check if cache entry is still valid
        if (new Date(cached.metadata.expiresAt) > new Date()) {
          this.stats.hits++;
          console.log(`[CompanyIntelligenceCache] Cache hit for ${cacheKey}`);
          return cached;
        } else {
          // Cache expired, remove it
          await this.deleteCompanyData(key);
          this.stats.misses++;
          console.log(`[CompanyIntelligenceCache] Cache expired for ${cacheKey}`);
          return null;
        }
      }

      this.stats.misses++;
      console.log(`[CompanyIntelligenceCache] Cache miss for ${cacheKey}`);
      return null;
    } catch (error) {
      this.stats.errors++;
      console.error(`[CompanyIntelligenceCache] Error getting data for ${key.companyName}:`, error);
      return null;
    }
  }

  /**
   * Set company data in cache
   */
  static async setCompanyData<T = any>(
    key: CompanyCacheKey,
    data: T,
    options: {
      ttl?: number;
      sourceCount?: number;
      confidence?: number;
    } = {}
  ): Promise<boolean> {
    try {
      const cacheKey = this.buildCacheKey(key);
      const ttl = options.ttl || this.getDefaultTTL(key.dataType);
      
      const cacheEntry: CompanyCacheEntry<T> = {
        data,
        metadata: {
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
          sourceCount: options.sourceCount || 0,
          confidence: options.confidence || 0,
          version: this.CACHE_VERSION
        }
      };

      const success = await this.cacheService.set(
        cacheKey,
        cacheEntry,
        CACHE_CONFIGS.COMPANY_INTELLIGENCE
      );

      if (success) {
        this.stats.sets++;
        console.log(`[CompanyIntelligenceCache] Cached data for ${cacheKey}`);
      }

      return success;
    } catch (error) {
      this.stats.errors++;
      console.error(`[CompanyIntelligenceCache] Error setting data for ${key.companyName}:`, error);
      return false;
    }
  }

  /**
   * Delete company data from cache
   */
  static async deleteCompanyData(key: CompanyCacheKey): Promise<boolean> {
    try {
      const cacheKey = this.buildCacheKey(key);
      const success = await this.cacheService.delete(cacheKey, 'ci');
      
      if (success) {
        this.stats.deletes++;
        console.log(`[CompanyIntelligenceCache] Deleted cache for ${cacheKey}`);
      }

      return success;
    } catch (error) {
      this.stats.errors++;
      console.error(`[CompanyIntelligenceCache] Error deleting data for ${key.companyName}:`, error);
      return false;
    }
  }

  /**
   * Invalidate all cache entries for a company
   */
  static async invalidateCompanyCache(companyName: string): Promise<number> {
    try {
      const dataTypes: CompanyCacheKey['dataType'][] = [
        'annual_reports',
        'intent_signals', 
        'competitor_analysis',
        'event_participation',
        'speaker_activity'
      ];

      let deletedCount = 0;
      for (const dataType of dataTypes) {
        const key: CompanyCacheKey = { companyName, dataType };
        const success = await this.deleteCompanyData(key);
        if (success) deletedCount++;
      }

      console.log(`[CompanyIntelligenceCache] Invalidated ${deletedCount} cache entries for ${companyName}`);
      return deletedCount;
    } catch (error) {
      console.error(`[CompanyIntelligenceCache] Error invalidating cache for ${companyName}:`, error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  static resetCacheStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  /**
   * Build cache key from CompanyCacheKey
   */
  private static buildCacheKey(key: CompanyCacheKey): string {
    const parts = [
      'company',
      this.normalizeCompanyName(key.companyName),
      key.dataType
    ];

    if (key.timeRange) {
      parts.push(key.timeRange);
    }

    if (key.country) {
      parts.push(key.country.toLowerCase());
    }

    return parts.join(':');
  }

  /**
   * Normalize company name for cache key
   */
  private static normalizeCompanyName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Get default TTL based on data type
   */
  private static getDefaultTTL(dataType: CompanyCacheKey['dataType']): number {
    switch (dataType) {
      case 'annual_reports':
        return this.LONG_TTL; // Annual reports don't change often
      case 'competitor_analysis':
        return this.LONG_TTL; // Competitor analysis is relatively stable
      case 'event_participation':
        return this.DEFAULT_TTL; // Event data changes more frequently
      case 'intent_signals':
        return this.DEFAULT_TTL; // Intent signals change frequently
      case 'speaker_activity':
        return this.DEFAULT_TTL; // Speaker activity changes frequently
      default:
        return this.DEFAULT_TTL;
    }
  }

  /**
   * Check if cache entry needs refresh
   */
  static shouldRefreshCache(
    cacheEntry: CompanyCacheEntry,
    options: {
      maxAge?: number;
      minConfidence?: number;
      minSourceCount?: number;
    } = {}
  ): boolean {
    const { maxAge = 3600, minConfidence = 0.5, minSourceCount = 5 } = options;

    // Check age
    const age = Date.now() - new Date(cacheEntry.metadata.cachedAt).getTime();
    if (age > maxAge * 1000) {
      return true;
    }

    // Check confidence
    if (cacheEntry.metadata.confidence < minConfidence) {
      return true;
    }

    // Check source count
    if (cacheEntry.metadata.sourceCount < minSourceCount) {
      return true;
    }

    return false;
  }

  /**
   * Get cache health status
   */
  static getCacheHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    hitRate: number;
    errorRate: number;
    totalRequests: number;
  } {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    const errorRate = totalRequests > 0 ? this.stats.errors / totalRequests : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (errorRate > 0.1) {
      status = 'unhealthy';
    } else if (hitRate < 0.3 || errorRate > 0.05) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      hitRate: Math.round(hitRate * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      totalRequests
    };
  }

  /**
   * Warm up cache with common company data
   */
  static async warmupCache(
    companies: string[],
    dataTypes: CompanyCacheKey['dataType'][] = ['event_participation']
  ): Promise<{ warmed: number; failed: number }> {
    let warmed = 0;
    let failed = 0;

    for (const company of companies) {
      for (const dataType of dataTypes) {
        try {
          const key: CompanyCacheKey = { companyName: company, dataType };
          const cached = await this.getCompanyData(key);
          
          if (!cached) {
            // Cache miss - could trigger background refresh here
            console.log(`[CompanyIntelligenceCache] Cache miss during warmup for ${company}:${dataType}`);
          } else {
            warmed++;
          }
        } catch (error) {
          console.error(`[CompanyIntelligenceCache] Warmup failed for ${company}:${dataType}:`, error);
          failed++;
        }
      }
    }

    console.log(`[CompanyIntelligenceCache] Warmup completed: ${warmed} warmed, ${failed} failed`);
    return { warmed, failed };
  }
}
