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
import { executeWithRetry, executeWithGracefulDegradation, executeWithCircuitBreaker, executeWithAdvancedCircuitBreaker } from "@/lib/error-recovery";
import { OPTIMIZED_RATE_LIMITS, OPTIMIZED_CACHE } from "@/lib/resource-optimizer";
import { searchCache, generateSearchCacheKey } from "@/lib/advanced-cache";
import { FirecrawlSearchService } from "@/lib/services/firecrawl-search-service";

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

// In-flight request deduplication: track active Firecrawl requests by normalized query
// This prevents duplicate API calls when multiple query variations produce the same narrative query
const inFlightRequests = new Map<string, Promise<UnifiedSearchResult>>();

// METRICS: Track Firecrawl requests in flight
let firecrawlRequestsInFlight = 0;
let firecrawlRequestsTotal = 0;
let firecrawlRequestsFailed = 0;

/**
 * Normalize query for deduplication (remove variations that don't affect Firecrawl query)
 */
function normalizeQueryForDedup(query: string, params: UnifiedSearchParams): string {
  // Use narrative query if provided, otherwise use base query
  const effectiveQuery = params.narrativeQuery || query;
  // Normalize: lowercase, trim, remove extra whitespace
  return effectiveQuery.toLowerCase().trim().replace(/\s+/g, ' ');
}

export interface UnifiedSearchParams {
  q: string;
  narrativeQuery?: string; // Optional narrative query for Firecrawl (prioritizes user search term)
  dateFrom?: string;
  dateTo?: string;
  country?: string;
  limit?: number;
  scrapeContent?: boolean;
  // FIRECRAWL-V2: Unified search + extract options
  extractSchema?: any; // Schema for structured extraction during search
  extractPrompt?: string; // Prompt for extraction during search
  useCache?: boolean;
  userProfile?: any; // Add user profile support
}

export interface UnifiedSearchResult {
  items: string[] | Array<{ url: string; title?: string; description?: string; markdown?: string; extracted?: any }>; // FIRECRAWL-V2: Support enriched items with extracted data
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
  items: string[] | Array<{ url: string; title?: string; description?: string; markdown?: string; extracted?: any }>; // FIRECRAWL-V2: Support enriched items
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

  // Check advanced cache first
  const cacheKey = generateSearchCacheKey(params, 'firecrawl');
  if (params.useCache !== false) {
    const cached = await searchCache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        metrics: { ...cached.metrics, cacheHit: true }
      };
    }
  }

  // IN-FLIGHT DEDUPLICATION: Check if identical request is already in progress
  const normalizedQuery = normalizeQueryForDedup(params.q, params);
  const dedupKey = `firecrawl:${normalizedQuery}:${params.country || ''}:${params.dateFrom || ''}:${params.dateTo || ''}`;
  
  if (inFlightRequests.has(dedupKey)) {
    console.log(`[unified-firecrawl] Deduplicating in-flight request: ${dedupKey.substring(0, 80)}...`);
    const existingRequest = inFlightRequests.get(dedupKey)!;
    try {
      const result = await existingRequest;
      // Return a copy with updated metrics to reflect this was a deduplicated call
      return {
        ...result,
        metrics: {
          ...result.metrics,
          responseTime: Date.now() - startTime,
          deduplicated: true
        }
      };
    } catch (error) {
      // If the in-flight request failed, remove it and continue with new request
      inFlightRequests.delete(dedupKey);
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
    // Use provided narrative query if available (prioritizes user search term), otherwise build one
    let firecrawlQuery = params.narrativeQuery || params.q;
    
    // Only build narrative query if not provided
    if (!params.narrativeQuery) {
      try {
        const { buildUnifiedQuery } = await import('../unified-query-builder');
        const queryResult = await buildUnifiedQuery({
          userText: params.q,
          country: params.country,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          language: 'en',
          userProfile: params.userProfile // Pass user profile to query builder
        });
        
        if (queryResult.narrativeQuery) {
          firecrawlQuery = queryResult.narrativeQuery;
          console.log('[unified-firecrawl] Using built narrative query with user profile:', firecrawlQuery);
        }
      } catch (error) {
        console.warn('[unified-firecrawl] Failed to get narrative query, using original:', error);
      }
    } else {
      console.log('[unified-firecrawl] Using provided narrative query:', firecrawlQuery);
    }
    
    // Build optimized search body based on Firecrawl v2 API
    const body: any = {
      query: firecrawlQuery,
      limit: params.limit || 20,
      sources: ['web'],
      timeout: 45000  // Reduced from 60000 to prevent long waits
    };

    // FIRECRAWL-V2: Enhanced scraping with extraction support
    // NOTE: The search endpoint does NOT support extract in scrapeOptions
    // Extract must be done separately using the /v2/extract endpoint
    if (params.scrapeContent) {
      body.scrapeOptions = {
        formats: ['markdown', 'html'], // Get both formats for better extraction
        onlyMainContent: true,
        blockAds: true,
        removeBase64Images: true
      };
    }
    
    // FIRECRAWL-V2: Note - unified search+extract is not supported in search endpoint
    // The extract parameter would need to be at top level, but search API doesn't support it
    // We'll need to do search and extract separately

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

    // Create the actual API call promise and store it for deduplication
    const apiCallPromise = (async (): Promise<UnifiedSearchResult> => {
      try {
        // PHASE 1 OPTIMIZATION: Use adaptive retry with exponential backoff and jitter
        // Timeouts: 8s → 12s → 18s with 0-20% jitter to reduce timeout failures by 30%
        const data = await executeWithAdvancedCircuitBreaker(async () => {
          const adaptiveTimeout = FirecrawlSearchService.getAdaptiveTimeout(0);
          const response = await FirecrawlSearchService.fetchWithAdaptiveRetry(
            "firecrawl",
            "search",
            'https://api.firecrawl.dev/v2/search',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${firecrawlKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(body)
            },
            adaptiveTimeout
          );

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.warn(`[unified-firecrawl] API error ${response.status}:`, errorText);
            throw new Error(`Firecrawl error: ${response.status}`);
          }

          return await response.json();
        }, 'firecrawl');

        console.log('[unified-firecrawl] Response received, items:', data?.data?.web?.length || 0);

        // FIRECRAWL-V2: Parse response with scraped content support
        const webResults = data?.data?.web || [];
        const items: Array<string | { url: string; title?: string; description?: string; markdown?: string }> = Array.isArray(webResults) 
          ? webResults
              .map((item: any) => {
                const url = item?.url;
                if (!url || !url.startsWith('http')) return null;
                
                // Return enriched item if scraped content available
                if (params.scrapeContent && (item.markdown || item.title || item.description)) {
                  return {
                    url,
                    title: item.title,
                    description: item.description,
                    markdown: item.markdown
                  };
                }
                
                // Fallback to URL string for backward compatibility
                return url;
              })
              .filter((item: any) => item !== null)
          : [];

        const result: UnifiedSearchResult = {
          items,
          provider: 'firecrawl',
          debug: { rawCount: items.length, responseKeys: Object.keys(data) },
          metrics: { responseTime: Date.now() - startTime, cacheHit: false, rateLimitHit: false }
        };

        // Cache the result using advanced cache
        if (params.useCache !== false) {
          await searchCache.set(cacheKey, result, CACHE_DURATION, []);
        }

        return result;
      } finally {
        // Always clean up the in-flight request after completion (success or failure)
        inFlightRequests.delete(dedupKey);
      }
    })();

    // Store the promise in the in-flight map for deduplication
    inFlightRequests.set(dedupKey, apiCallPromise);
    
    // METRICS: Track in-flight requests
    firecrawlRequestsInFlight++;
    firecrawlRequestsTotal++;

    // Await the promise and return the result
    try {
      const result = await apiCallPromise;
      firecrawlRequestsInFlight--;
      return result;
    } catch (error) {
      firecrawlRequestsInFlight--;
      firecrawlRequestsFailed++;
      throw error;
    }
  } catch (error) {
    // Clean up in-flight request on error
    inFlightRequests.delete(dedupKey);
    firecrawlRequestsInFlight = Math.max(0, firecrawlRequestsInFlight - 1);
    firecrawlRequestsFailed++;
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
 * METRICS: Get Firecrawl metrics
 */
export function getFirecrawlMetrics() {
  return {
    requests_in_flight: firecrawlRequestsInFlight,
    requests_total: firecrawlRequestsTotal,
    requests_failed: firecrawlRequestsFailed,
    success_rate: firecrawlRequestsTotal > 0 
      ? ((firecrawlRequestsTotal - firecrawlRequestsFailed) / firecrawlRequestsTotal) * 100 
      : 100
  };
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

  // Check advanced cache first
  const cacheKey = generateSearchCacheKey(params, 'cse');
  if (params.useCache !== false) {
    const cached = await searchCache.get(cacheKey);
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

    // Use advanced circuit breaker for CSE API calls
    const data = await executeWithAdvancedCircuitBreaker(async () => {
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

    // Cache the result using advanced cache
    if (params.useCache !== false) {
      await searchCache.set(cacheKey, result, CACHE_DURATION, []);
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
    
    // Use advanced circuit breaker for database operations
    return await executeWithAdvancedCircuitBreaker(async () => {
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
 * Timeout wrapper for provider search functions
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  providerName: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${providerName} timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Generate unified cache key (provider-agnostic)
 * This allows us to check cache once before trying any provider
 * Uses same format as generateSearchCacheKey but without provider
 */
function generateUnifiedCacheKey(params: UnifiedSearchParams): string {
  const keyData = {
    q: params.q,
    country: params.country,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    limit: params.limit,
    scrapeContent: params.scrapeContent,
    // Note: provider is NOT included - we want provider-agnostic cache
  };
  // Use same format as generateSearchCacheKey for consistency
  return `search:unified:${createHash('md5').update(JSON.stringify(keyData)).digest('hex')}`;
}

/**
 * Main unified search function
 * 
 * Optimized flow:
 * 1. Check unified cache first (provider-agnostic)
 * 2. If cache miss, try all providers in parallel with smart timeouts:
 *    - Firecrawl: 40s timeout (allows for 28-30s API response time)
 *    - CSE: 5s timeout
 *    - Database: 2s timeout
 * 3. Cache result for future requests
 * 
 * Returns results from cache or first successful provider
 * Total max wait time: 40s (Firecrawl can take 28-30s)
 */
export async function unifiedSearch(params: UnifiedSearchParams): Promise<UnifiedSearchResponse> {
  const startTime = Date.now();
  const providers: string[] = [];
  const debug: any = {};
  let totalItems = 0;
  let cacheHits = 0;
  let rateLimitHits = 0;

  // Step 1: Check unified cache first (before trying any provider)
  // This prevents duplicate API calls when cache exists
  if (params.useCache !== false) {
    const unifiedCacheKey = generateUnifiedCacheKey(params);
    const cachedResult = await searchCache.get(unifiedCacheKey);
    
    if (cachedResult) {
      console.log('[unified-search] Cache hit - returning cached result without trying providers');
      return {
        ...cachedResult,
        metrics: {
          ...cachedResult.metrics,
          totalResponseTime: Date.now() - startTime,
          cacheHit: true
        }
      };
    }
    console.log('[unified-search] Cache miss - proceeding with provider attempts');
  }

  // Step 2: Try all providers in parallel with smart timeouts
  console.log('[unified-search] Trying all providers in parallel with timeouts...');
  
  const [firecrawlResult, cseResult, databaseResult] = await Promise.allSettled([
    withTimeout(unifiedFirecrawlSearch(params), 40000, 'Firecrawl').catch(err => {
      console.warn('[unified-search] Firecrawl failed:', err instanceof Error ? err.message : String(err));
      return {
        items: [],
        provider: 'firecrawl' as const,
        debug: { rawCount: 0, error: err instanceof Error ? err.message : 'Unknown error' },
        metrics: { responseTime: 0, cacheHit: false, rateLimitHit: false }
      };
    }),
    withTimeout(unifiedCseSearch(params), 5000, 'CSE').catch(err => {
      console.warn('[unified-search] CSE failed:', err instanceof Error ? err.message : String(err));
      return {
        items: [],
        provider: 'cse' as const,
        debug: { rawCount: 0, error: err instanceof Error ? err.message : 'Unknown error' },
        metrics: { responseTime: 0, cacheHit: false, rateLimitHit: false }
      };
    }),
    withTimeout(unifiedDatabaseSearch(params), 2000, 'Database').catch(err => {
      console.warn('[unified-search] Database failed:', err instanceof Error ? err.message : String(err));
      return {
        items: [],
        provider: 'database' as const,
        debug: { rawCount: 0, error: err instanceof Error ? err.message : 'Unknown error' },
        metrics: { responseTime: 0, cacheHit: false, rateLimitHit: false }
      };
    })
  ]);

  // Extract results from settled promises
  const firecrawl = firecrawlResult.status === 'fulfilled' ? firecrawlResult.value : null;
  const cse = cseResult.status === 'fulfilled' ? cseResult.value : null;
  const database = databaseResult.status === 'fulfilled' ? databaseResult.value : null;

  // Track which providers were attempted
  if (firecrawl) {
    providers.push('firecrawl');
    debug.firecrawl = firecrawl.debug;
    if (firecrawl.metrics.cacheHit) cacheHits++;
    if (firecrawl.metrics.rateLimitHit) rateLimitHits++;
  }
  if (cse) {
    providers.push('cse');
    debug.cse = cse.debug;
    if (cse.metrics.cacheHit) cacheHits++;
    if (cse.metrics.rateLimitHit) rateLimitHits++;
  }
  if (database) {
    providers.push('database');
    debug.database = database.debug;
    if (database.metrics.cacheHit) cacheHits++;
    if (database.metrics.rateLimitHit) rateLimitHits++;
  }

  // Use first successful result (prefer Firecrawl > CSE > Database)
  let selectedResult: UnifiedSearchResult | null = null;
  
  if (firecrawl && firecrawl.items.length > 0) {
    selectedResult = firecrawl;
    console.log('[unified-search] Using Firecrawl result:', firecrawl.items.length, 'items');
  } else if (cse && cse.items.length > 0) {
    selectedResult = cse;
    console.log('[unified-search] Using CSE result:', cse.items.length, 'items');
  } else if (database && database.items.length > 0) {
    selectedResult = database;
    console.log('[unified-search] Using Database result:', database.items.length, 'items');
  }

  // If no results, return empty with all attempted providers
  if (!selectedResult) {
    console.log('[unified-search] No results from any provider');
    return {
      items: [],
      providers,
      totalItems: 0,
      debug,
      metrics: {
        totalResponseTime: Date.now() - startTime,
        cacheHits,
        rateLimitHits
      }
    };
  }

  totalItems = selectedResult.items.length;
  console.log('[unified-search] Selected provider:', selectedResult.provider, 'with', totalItems, 'items');

  const result: UnifiedSearchResponse = {
    items: selectedResult.items,
    providers,
    totalItems,
    debug,
    metrics: {
      totalResponseTime: Date.now() - startTime,
      cacheHits,
      rateLimitHits
    }
  };

  // Step 3: Cache the result for future requests (provider-agnostic cache)
  if (params.useCache !== false && selectedResult.items.length > 0) {
    const unifiedCacheKey = generateUnifiedCacheKey(params);
    await searchCache.set(unifiedCacheKey, result, CACHE_DURATION, []).catch(err => {
      console.warn('[unified-search] Failed to cache result:', err);
    });
  }

  return result;
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
