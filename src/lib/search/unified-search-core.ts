/**
 * Unified Search Core
 * 
 * Consolidates all Firecrawl, CSE, and database search implementations
 * into a single, efficient, and maintainable service.
 * 
 * This eliminates code duplication and provides:
 * - Unified rate limiting
 * - Unified caching
 * - Consistent error handling
 * - Better performance through shared resources
 */

import { createHash } from "crypto";
import { supabaseServer } from "@/lib/supabase-server";
import { executeWithRetry, executeWithGracefulDegradation, executeWithCircuitBreaker } from "@/lib/error-recovery";
import { OPTIMIZED_RATE_LIMITS, OPTIMIZED_CACHE } from "@/lib/resource-optimizer";

// Environment variables
const firecrawlKey = process.env.FIRECRAWL_KEY;
const googleCseKey = process.env.GOOGLE_CSE_KEY;
const googleCseCx = process.env.GOOGLE_CSE_CX;

// Use optimized rate limiting configuration
const UNIFIED_RATE_LIMITS = OPTIMIZED_RATE_LIMITS;

// Use optimized cache configuration
const CACHE_DURATION = OPTIMIZED_CACHE.duration;

// Memory-safe storage with automatic cleanup
class MemorySafeStore<T> {
  private store = new Map<string, { data: T; timestamp: number; ttl: number }>();
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxSize: number = OPTIMIZED_CACHE.maxSize, cleanupIntervalMs: number = OPTIMIZED_CACHE.cleanupInterval) {
    this.maxSize = maxSize;
    // Cleanup expired entries with optimized interval
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  set(key: string, data: T, ttl: number = CACHE_DURATION): void {
    // Remove oldest entries if we're at capacity
    if (this.store.size >= this.maxSize) {
      this.evictOldest();
    }
    
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  entries(): IterableIterator<[string, T]> {
    const result: [string, T][] = [];
    for (const [key, entry] of this.store.entries()) {
      if (Date.now() - entry.timestamp <= entry.ttl) {
        result.push([key, entry.data]);
      }
    }
    return result[Symbol.iterator]();
  }

  keys(): IterableIterator<string> {
    const result: string[] = [];
    for (const [key, entry] of this.store.entries()) {
      if (Date.now() - entry.timestamp <= entry.ttl) {
        result.push(key);
      }
    }
    return result[Symbol.iterator]();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.store.delete(key);
      }
    }
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.store.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Memory-safe storage instances
const rateLimitStore = new MemorySafeStore<{ count: number; resetTime: number }>(500, 60000);
const cacheStore = new MemorySafeStore<any>(1000, 60000);

export interface UnifiedSearchParams {
  q: string;
  dateFrom?: string;
  dateTo?: string;
  country?: string;
  limit?: number;
  scrapeContent?: boolean;
  useCache?: boolean;
}

export interface UnifiedSearchResult {
  items: string[];
  provider: 'firecrawl' | 'cse' | 'database';
  debug: {
    rawCount: number;
    error?: string;
    responseKeys?: string[];
    cached?: boolean;
    rateLimited?: boolean;
  };
  metrics: {
    responseTime: number;
    cacheHit: boolean;
    rateLimitHit: boolean;
  };
}

export interface UnifiedSearchResponse {
  items: string[];
  providers: string[];
  totalItems: number;
  debug: {
    firecrawl?: any;
    cse?: any;
    database?: any;
  };
  metrics: {
    totalResponseTime: number;
    cacheHits: number;
    rateLimitHits: number;
  };
}

/**
 * Check if rate limit is exceeded for a provider
 */
function checkRateLimit(provider: 'firecrawl' | 'cse'): boolean {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const key = `unified_${provider}_${minute}`;
  
  const limits = UNIFIED_RATE_LIMITS[provider];
  const current = rateLimitStore.get(key) || { count: 0, resetTime: now + 60000 };
  
  if (current.resetTime < now) {
    rateLimitStore.set(key, { count: 1, resetTime: now + 60000 }, 60000); // 1 minute TTL
    return true;
  }
  
  if (current.count >= limits.maxRequestsPerMinute) {
    return false;
  }
  
  current.count++;
  rateLimitStore.set(key, current, 60000); // 1 minute TTL
  return true;
}

/**
 * Get cached search result
 */
function getCachedResult(cacheKey: string): any | null {
  return cacheStore.get(cacheKey);
}

/**
 * Set cached search result
 */
function setCachedResult(cacheKey: string, data: any): void {
  cacheStore.set(cacheKey, data, CACHE_DURATION);
}

/**
 * Generate cache key for search parameters
 */
function generateCacheKey(params: UnifiedSearchParams, provider: string): string {
  const keyData = {
    q: params.q,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    country: params.country,
    limit: params.limit,
    scrapeContent: params.scrapeContent,
    provider
  };
  return createHash('sha256').update(JSON.stringify(keyData)).digest('hex');
}

/**
 * Unified Firecrawl search implementation
 */
async function unifiedFirecrawlSearch(params: UnifiedSearchParams): Promise<UnifiedSearchResult> {
  const startTime = Date.now();
  
  if (!firecrawlKey) {
    return {
      items: [],
      provider: 'firecrawl',
      debug: { rawCount: 0, error: 'Missing API key: FIRECRAWL_KEY not set' },
      metrics: { responseTime: Date.now() - startTime, cacheHit: false, rateLimitHit: false }
    };
  }

  // Check cache first
  const cacheKey = generateCacheKey(params, 'firecrawl');
  if (params.useCache !== false) {
    const cached = getCachedResult(cacheKey);
    if (cached) {
      return {
        ...cached,
        metrics: { ...cached.metrics, cacheHit: true }
      };
    }
  }

  // Check rate limit
  if (!checkRateLimit('firecrawl')) {
    return {
      items: [],
      provider: 'firecrawl',
      debug: { rawCount: 0, error: 'Rate limit exceeded', rateLimited: true },
      metrics: { responseTime: Date.now() - startTime, cacheHit: false, rateLimitHit: true }
    };
  }

  try {
    // Build optimized search body based on Firecrawl v2 API
    const body: any = {
      query: params.q,
      limit: params.limit || 20,
      sources: ['web'],
      timeout: 60000
    };

    // Add content scraping if requested
    if (params.scrapeContent) {
      body.scrapeOptions = {
        formats: ['markdown'],
        onlyMainContent: true
      };
    }

    // Add location-based search for better regional results
    if (params.country) {
      const countryMap: Record<string, string> = {
        'DE': 'Germany',
        'FR': 'France', 
        'IT': 'Italy',
        'ES': 'Spain',
        'NL': 'Netherlands',
        'GB': 'United Kingdom',
        'US': 'United States'
      };
      
      const location = countryMap[params.country] || params.country;
      // Firecrawl v2 API expects location as a string, not an object
      body.location = location;
    }

    console.log('[unified-firecrawl] Making request with body:', JSON.stringify(body, null, 2));

    // Use error recovery for Firecrawl API calls
    const data = await executeWithRetry(async () => {
      const response = await fetch('https://api.firecrawl.dev/v2/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    }, 'firecrawl');

    console.log('[unified-firecrawl] Response received, items:', data?.data?.length || 0);

    const items: string[] = Array.isArray(data?.data) 
      ? data.data
          .map((item: any) => item?.url)
          .filter((url: string) => typeof url === 'string' && url.startsWith('http'))
      : [];

    const result: UnifiedSearchResult = {
      items,
      provider: 'firecrawl',
      debug: { rawCount: items.length, responseKeys: Object.keys(data) },
      metrics: { responseTime: Date.now() - startTime, cacheHit: false, rateLimitHit: false }
    };

    // Cache the result
    if (params.useCache !== false) {
      setCachedResult(cacheKey, result);
    }

    return result;

  } catch (error) {
    console.error('[unified-firecrawl] Request failed:', error);
    return {
      items: [],
      provider: 'firecrawl',
      debug: { rawCount: 0, error: error instanceof Error ? error.message : 'Unknown error' },
      metrics: { responseTime: Date.now() - startTime, cacheHit: false, rateLimitHit: false }
    };
  }
}

/**
 * Unified CSE search implementation
 */
async function unifiedCseSearch(params: UnifiedSearchParams): Promise<UnifiedSearchResult> {
  const startTime = Date.now();
  
  if (!googleCseKey || !googleCseCx) {
    return {
      items: [],
      provider: 'cse',
      debug: { rawCount: 0, error: 'Missing API keys: GOOGLE_CSE_KEY or GOOGLE_CSE_CX not set' },
      metrics: { responseTime: Date.now() - startTime, cacheHit: false, rateLimitHit: false }
    };
  }

  // Check cache first
  const cacheKey = generateCacheKey(params, 'cse');
  if (params.useCache !== false) {
    const cached = getCachedResult(cacheKey);
    if (cached) {
      return {
        ...cached,
        metrics: { ...cached.metrics, cacheHit: true }
      };
    }
  }

  // Check rate limit
  if (!checkRateLimit('cse')) {
    return {
      items: [],
      provider: 'cse',
      debug: { rawCount: 0, error: 'Rate limit exceeded', rateLimited: true },
      metrics: { responseTime: Date.now() - startTime, cacheHit: false, rateLimitHit: true }
    };
  }

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('q', params.q);
    url.searchParams.set('key', googleCseKey);
    url.searchParams.set('cx', googleCseCx);
    url.searchParams.set('num', '10');
    url.searchParams.set('safe', 'off');

    console.log('[unified-cse] Making request to:', url.toString().replace(/key=[^&]+/, 'key=***'));

    // Use error recovery for CSE API calls
    const data = await executeWithRetry(async () => {
      const response = await fetch(url.toString());
      console.log('[unified-cse] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    }, 'cse');

    console.log('[unified-cse] Response data keys:', Object.keys(data));

    const items: string[] = (data?.items ?? [])
      .map((x: any) => x?.link)
      .filter((u: string) => typeof u === 'string' && u.startsWith('http'));

    console.log('[unified-cse] Extracted URLs:', items.length, items.slice(0, 3));

    const result: UnifiedSearchResult = {
      items,
      provider: 'cse',
      debug: { rawCount: items.length, responseKeys: Object.keys(data) },
      metrics: { responseTime: Date.now() - startTime, cacheHit: false, rateLimitHit: false }
    };

    // Cache the result
    if (params.useCache !== false) {
      setCachedResult(cacheKey, result);
    }

    return result;

  } catch (error) {
    console.error('[unified-cse] Request failed:', error);
    return {
      items: [],
      provider: 'cse',
      debug: { rawCount: 0, error: error instanceof Error ? error.message : 'Unknown error' },
      metrics: { responseTime: Date.now() - startTime, cacheHit: false, rateLimitHit: false }
    };
  }
}

/**
 * Unified database search implementation
 */
async function unifiedDatabaseSearch(params: UnifiedSearchParams): Promise<UnifiedSearchResult> {
  const startTime = Date.now();
  
  try {
    console.log('[unified-database] Fallback search with query:', params.q);
    
    // Use error recovery for any database operations
    return await executeWithRetry(async () => {
      // This is a placeholder for database-based search
      // In a real implementation, you would search your own database of events
      // For now, return some sample legal event URLs that are known to be relevant
    
    const sampleUrls = [
      'https://www.juve.de/termine/',
      'https://www.anwaltverein.de/veranstaltungen/',
      'https://www.dav.de/veranstaltungen/',
      'https://www.forum-institut.de/veranstaltungen/',
      'https://www.euroforum.de/veranstaltungen/',
      'https://www.beck-akademie.de/veranstaltungen/',
      'https://www.bitkom.org/veranstaltungen/',
      'https://www.handelsblatt.com/veranstaltungen/',
      'https://www.compliance-netzwerk.de/veranstaltungen/',
      'https://www.legal-operations.de/events/'
    ];
    
    // Filter based on query terms
    const queryLower = params.q.toLowerCase();
    const filteredUrls = sampleUrls.filter(url => {
      const urlLower = url.toLowerCase();
      return queryLower.includes('legal') || 
             queryLower.includes('compliance') || 
             queryLower.includes('conference') ||
             queryLower.includes('veranstaltung') ||
             queryLower.includes('konferenz') ||
             urlLower.includes('veranstaltung') ||
             urlLower.includes('termine') ||
             urlLower.includes('event');
    });
    
      console.log('[unified-database] Returning', filteredUrls.length, 'fallback URLs');
      
      return {
        items: filteredUrls,
        provider: 'database',
        debug: { rawCount: filteredUrls.length, responseKeys: ['sample_urls'] },
        metrics: { responseTime: Date.now() - startTime, cacheHit: false, rateLimitHit: false }
      };
    }, 'database');

  } catch (error) {
    console.error('[unified-database] Database search failed:', error);
    return {
      items: [],
      provider: 'database',
      debug: { rawCount: 0, error: error instanceof Error ? error.message : 'Unknown error' },
      metrics: { responseTime: Date.now() - startTime, cacheHit: false, rateLimitHit: false }
    };
  }
}

/**
 * Main unified search function
 * 
 * Tries providers in order: Firecrawl -> CSE -> Database
 * Returns results from the first successful provider
 */
export async function unifiedSearch(params: UnifiedSearchParams): Promise<UnifiedSearchResponse> {
  const startTime = Date.now();
  const providers: string[] = [];
  const debug: any = {};
  let totalItems = 0;
  let cacheHits = 0;
  let rateLimitHits = 0;

  // Try Firecrawl first
  console.log('[unified-search] Trying Firecrawl first...');
  const firecrawlResult = await unifiedFirecrawlSearch(params);
  providers.push('firecrawl');
  debug.firecrawl = firecrawlResult.debug;
  
  if (firecrawlResult.metrics.cacheHit) cacheHits++;
  if (firecrawlResult.metrics.rateLimitHit) rateLimitHits++;

  if (firecrawlResult.items.length > 0) {
    totalItems = firecrawlResult.items.length;
    console.log('[unified-search] Firecrawl returned', totalItems, 'items');
    return {
      items: firecrawlResult.items,
      providers,
      totalItems,
      debug,
      metrics: {
        totalResponseTime: Date.now() - startTime,
        cacheHits,
        rateLimitHits
      }
    };
  }

  // Try CSE if Firecrawl failed
  console.log('[unified-search] Firecrawl returned 0 results, trying CSE...');
  const cseResult = await unifiedCseSearch(params);
  providers.push('cse');
  debug.cse = cseResult.debug;
  
  if (cseResult.metrics.cacheHit) cacheHits++;
  if (cseResult.metrics.rateLimitHit) rateLimitHits++;

  if (cseResult.items.length > 0) {
    totalItems = cseResult.items.length;
    console.log('[unified-search] CSE returned', totalItems, 'items');
    return {
      items: cseResult.items,
      providers,
      totalItems,
      debug,
      metrics: {
        totalResponseTime: Date.now() - startTime,
        cacheHits,
        rateLimitHits
      }
    };
  }

  // Try database fallback if both failed
  console.log('[unified-search] CSE also returned 0 results, using database fallback...');
  const databaseResult = await unifiedDatabaseSearch(params);
  providers.push('database');
  debug.database = databaseResult.debug;
  
  if (databaseResult.metrics.cacheHit) cacheHits++;
  if (databaseResult.metrics.rateLimitHit) rateLimitHits++;

  totalItems = databaseResult.items.length;
  console.log('[unified-search] Database fallback returned', totalItems, 'items');

  return {
    items: databaseResult.items,
    providers,
    totalItems,
    debug,
    metrics: {
      totalResponseTime: Date.now() - startTime,
      cacheHits,
      rateLimitHits
    }
  };
}

/**
 * Get unified search statistics
 */
export function getUnifiedSearchStats(): {
  rateLimits: Record<string, { count: number; resetTime: number }>;
  cacheSize: number;
  cacheKeys: string[];
} {
  return {
    rateLimits: Object.fromEntries(rateLimitStore.entries()),
    cacheSize: cacheStore.size(),
    cacheKeys: Array.from(cacheStore.keys())
  };
}

/**
 * Clear unified search cache
 */
export function clearUnifiedSearchCache(): void {
  cacheStore.clear();
  console.log('[unified-search] Cache cleared');
}

/**
 * Clear unified search rate limits
 */
export function clearUnifiedSearchRateLimits(): void {
  rateLimitStore.clear();
  console.log('[unified-search] Rate limits cleared');
}
