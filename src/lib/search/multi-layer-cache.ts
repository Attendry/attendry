/**
 * Multi-Layer Cache Design
 * 
 * Implements QCache, SnippetCache, and EnrichmentCache with TTLs and invalidation
 */

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  etag?: string;
  version: string;
  metadata: {
    source: string;
    country: string;
    queryHash: string;
    size: number;
  };
}

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum entries
  prefix: string; // Key prefix
  invalidateOnETagChange: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  errors: number;
  totalSize: number;
  hitRate: number;
}

/**
 * Cache layer configurations
 */
const CACHE_CONFIGS = {
  QCache: {
    ttl: 12 * 60 * 60, // 12 hours
    maxSize: 10000,
    prefix: 'qcache',
    invalidateOnETagChange: false
  },
  SnippetCache: {
    ttl: 7 * 24 * 60 * 60, // 7 days
    maxSize: 50000,
    prefix: 'snippet',
    invalidateOnETagChange: true
  },
  EnrichmentCache: {
    ttl: 14 * 24 * 60 * 60, // 14 days
    maxSize: 20000,
    prefix: 'enrichment',
    invalidateOnETagChange: false
  }
} as const;

/**
 * Base Cache Interface
 */
interface CacheLayer<T = any> {
  get(key: string): Promise<CacheEntry<T> | null>;
  set(key: string, entry: CacheEntry<T>): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getStats(): Promise<CacheStats>;
  invalidate(pattern: string): Promise<number>;
}

/**
 * QCache - Query → Candidate URLs
 */
export class QCache implements CacheLayer<string[]> {
  private cache = new Map<string, CacheEntry<string[]>>();
  private config = CACHE_CONFIGS.QCache;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    errors: 0,
    totalSize: 0,
    hitRate: 0
  };

  async get(key: string): Promise<CacheEntry<string[]> | null> {
    const fullKey = `${this.config.prefix}:${key}`;
    const entry = this.cache.get(fullKey);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(fullKey);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    this.stats.hits++;
    this.updateHitRate();
    return entry;
  }

  async set(key: string, entry: CacheEntry<string[]>): Promise<boolean> {
    try {
      const fullKey = `${this.config.prefix}:${key}`;
      
      // Check size limit
      if (this.cache.size >= this.config.maxSize) {
        await this.evictOldest();
      }

      this.cache.set(fullKey, entry);
      this.stats.totalSize += entry.metadata.size;
      return true;
    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    const fullKey = `${this.config.prefix}:${key}`;
    return this.cache.delete(fullKey);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      errors: 0,
      totalSize: 0,
      hitRate: 0
    };
  }

  async getStats(): Promise<CacheStats> {
    return { ...this.stats };
  }

  async invalidate(pattern: string): Promise<number> {
    let count = 0;
    const regex = new RegExp(pattern);
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    return count;
  }

  private async evictOldest(): Promise<void> {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * SnippetCache - URL → Text Content
 */
export class SnippetCache implements CacheLayer<string> {
  private cache = new Map<string, CacheEntry<string>>();
  private config = CACHE_CONFIGS.SnippetCache;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    errors: 0,
    totalSize: 0,
    hitRate: 0
  };

  async get(key: string): Promise<CacheEntry<string> | null> {
    const fullKey = `${this.config.prefix}:${key}`;
    const entry = this.cache.get(fullKey);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(fullKey);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    this.stats.hits++;
    this.updateHitRate();
    return entry;
  }

  async set(key: string, entry: CacheEntry<string>): Promise<boolean> {
    try {
      const fullKey = `${this.config.prefix}:${key}`;
      
      // Check size limit
      if (this.cache.size >= this.config.maxSize) {
        await this.evictOldest();
      }

      this.cache.set(fullKey, entry);
      this.stats.totalSize += entry.metadata.size;
      return true;
    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    const fullKey = `${this.config.prefix}:${key}`;
    return this.cache.delete(fullKey);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      errors: 0,
      totalSize: 0,
      hitRate: 0
    };
  }

  async getStats(): Promise<CacheStats> {
    return { ...this.stats };
  }

  async invalidate(pattern: string): Promise<number> {
    let count = 0;
    const regex = new RegExp(pattern);
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    return count;
  }

  /**
   * Check if content needs refresh based on ETag
   */
  async needsRefresh(url: string, currentETag?: string): Promise<boolean> {
    const entry = await this.get(url);
    if (!entry) return true;
    
    if (this.config.invalidateOnETagChange && currentETag && entry.etag !== currentETag) {
      return true;
    }
    
    return false;
  }

  private async evictOldest(): Promise<void> {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * EnrichmentCache - URL → LLM Summary
 */
export class EnrichmentCache implements CacheLayer<any> {
  private cache = new Map<string, CacheEntry<any>>();
  private config = CACHE_CONFIGS.EnrichmentCache;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    errors: 0,
    totalSize: 0,
    hitRate: 0
  };

  async get(key: string): Promise<CacheEntry<any> | null> {
    const fullKey = `${this.config.prefix}:${key}`;
    const entry = this.cache.get(fullKey);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(fullKey);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    this.stats.hits++;
    this.updateHitRate();
    return entry;
  }

  async set(key: string, entry: CacheEntry<any>): Promise<boolean> {
    try {
      const fullKey = `${this.config.prefix}:${key}`;
      
      // Check size limit
      if (this.cache.size >= this.config.maxSize) {
        await this.evictOldest();
      }

      this.cache.set(fullKey, entry);
      this.stats.totalSize += entry.metadata.size;
      return true;
    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    const fullKey = `${this.config.prefix}:${key}`;
    return this.cache.delete(fullKey);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      errors: 0,
      totalSize: 0,
      hitRate: 0
    };
  }

  async getStats(): Promise<CacheStats> {
    return { ...this.stats };
  }

  async invalidate(pattern: string): Promise<number> {
    let count = 0;
    const regex = new RegExp(pattern);
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    return count;
  }

  private async evictOldest(): Promise<void> {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * Multi-Layer Cache Manager
 */
export class MultiLayerCacheManager {
  private qCache: QCache;
  private snippetCache: SnippetCache;
  private enrichmentCache: EnrichmentCache;

  constructor() {
    this.qCache = new QCache();
    this.snippetCache = new SnippetCache();
    this.enrichmentCache = new EnrichmentCache();
  }

  /**
   * Get query cache
   */
  getQCache(): QCache {
    return this.qCache;
  }

  /**
   * Get snippet cache
   */
  getSnippetCache(): SnippetCache {
    return this.snippetCache;
  }

  /**
   * Get enrichment cache
   */
  getEnrichmentCache(): EnrichmentCache {
    return this.enrichmentCache;
  }

  /**
   * Generate cache key for query
   */
  generateQueryKey(query: string, country: string, dateRange?: { from?: string; to?: string }): string {
    const hash = this.hashString(`${query}|${country}|${dateRange?.from || ''}|${dateRange?.to || ''}`);
    return `query:${hash}`;
  }

  /**
   * Generate cache key for URL
   */
  generateUrlKey(url: string): string {
    const hash = this.hashString(url);
    return `url:${hash}`;
  }

  /**
   * Generate cache key for enrichment
   */
  generateEnrichmentKey(url: string, task: string, model: string): string {
    const hash = this.hashString(`${url}|${task}|${model}`);
    return `enrichment:${hash}`;
  }

  /**
   * Invalidate caches based on date thresholds
   */
  async invalidateByDateThreshold(threshold: Date): Promise<{
    qCache: number;
    snippetCache: number;
    enrichmentCache: number;
  }> {
    const thresholdMs = threshold.getTime();
    
    // Invalidate old entries
    const qCacheCount = await this.invalidateOldEntries(this.qCache, thresholdMs);
    const snippetCacheCount = await this.invalidateOldEntries(this.snippetCache, thresholdMs);
    const enrichmentCacheCount = await this.invalidateOldEntries(this.enrichmentCache, thresholdMs);

    return {
      qCache: qCacheCount,
      snippetCache: snippetCacheCount,
      enrichmentCache: enrichmentCacheCount
    };
  }

  /**
   * Invalidate caches for upcoming events (within 60 days)
   */
  async invalidateUpcomingEvents(): Promise<number> {
    const now = new Date();
    const upcomingThreshold = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days
    
    // This would need to be implemented based on your event data structure
    // For now, return 0
    return 0;
  }

  /**
   * Get comprehensive cache statistics
   */
  async getStats(): Promise<{
    qCache: CacheStats;
    snippetCache: CacheStats;
    enrichmentCache: CacheStats;
    total: {
      hits: number;
      misses: number;
      evictions: number;
      errors: number;
      totalSize: number;
      hitRate: number;
    };
  }> {
    const qStats = await this.qCache.getStats();
    const snippetStats = await this.snippetCache.getStats();
    const enrichmentStats = await this.enrichmentCache.getStats();

    return {
      qCache: qStats,
      snippetCache: snippetStats,
      enrichmentCache: enrichmentStats,
      total: {
        hits: qStats.hits + snippetStats.hits + enrichmentStats.hits,
        misses: qStats.misses + snippetStats.misses + enrichmentStats.misses,
        evictions: qStats.evictions + snippetStats.evictions + enrichmentStats.evictions,
        errors: qStats.errors + snippetStats.errors + enrichmentStats.errors,
        totalSize: qStats.totalSize + snippetStats.totalSize + enrichmentStats.totalSize,
        hitRate: (qStats.hitRate + snippetStats.hitRate + enrichmentStats.hitRate) / 3
      }
    };
  }

  private async invalidateOldEntries(cache: CacheLayer<any>, thresholdMs: number): Promise<number> {
    // This would need to be implemented based on the specific cache implementation
    // For now, return 0
    return 0;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Redis/Supabase Cache Schema
 */
export const CACHE_SCHEMA = {
  qcache: {
    table: 'search_query_cache',
    columns: {
      id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid()',
      cache_key: 'varchar(255) UNIQUE NOT NULL',
      query_hash: 'varchar(64) NOT NULL',
      country: 'varchar(2) NOT NULL',
      urls: 'jsonb NOT NULL',
      created_at: 'timestamp DEFAULT now()',
      expires_at: 'timestamp NOT NULL',
      metadata: 'jsonb'
    },
    indexes: [
      'CREATE INDEX idx_qcache_query_hash ON search_query_cache(query_hash)',
      'CREATE INDEX idx_qcache_country ON search_query_cache(country)',
      'CREATE INDEX idx_qcache_expires ON search_query_cache(expires_at)'
    ]
  },
  snippet: {
    table: 'search_snippet_cache',
    columns: {
      id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid()',
      cache_key: 'varchar(255) UNIQUE NOT NULL',
      url: 'varchar(2048) NOT NULL',
      content: 'text NOT NULL',
      etag: 'varchar(255)',
      created_at: 'timestamp DEFAULT now()',
      expires_at: 'timestamp NOT NULL',
      metadata: 'jsonb'
    },
    indexes: [
      'CREATE INDEX idx_snippet_url ON search_snippet_cache(url)',
      'CREATE INDEX idx_snippet_expires ON search_snippet_cache(expires_at)',
      'CREATE INDEX idx_snippet_etag ON search_snippet_cache(etag)'
    ]
  },
  enrichment: {
    table: 'search_enrichment_cache',
    columns: {
      id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid()',
      cache_key: 'varchar(255) UNIQUE NOT NULL',
      url: 'varchar(2048) NOT NULL',
      task: 'varchar(50) NOT NULL',
      model: 'varchar(100) NOT NULL',
      result: 'jsonb NOT NULL',
      created_at: 'timestamp DEFAULT now()',
      expires_at: 'timestamp NOT NULL',
      metadata: 'jsonb'
    },
    indexes: [
      'CREATE INDEX idx_enrichment_url ON search_enrichment_cache(url)',
      'CREATE INDEX idx_enrichment_task ON search_enrichment_cache(task)',
      'CREATE INDEX idx_enrichment_expires ON search_enrichment_cache(expires_at)'
    ]
  }
};
