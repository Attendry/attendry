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
  // PHASE 1: Unified search + extract options
  extractSchema?: any; // Schema for structured extraction during search
  extractPrompt?: string; // Prompt for extraction during search
  categories?: string[]; // Search categories (e.g., ["research"]) for better targeting
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

    // PHASE 1: Use FirecrawlSearchService for unified search+extract support
    // This consolidates implementation and enables unified search+extract and search categories
    const apiCallPromise = (async (): Promise<UnifiedSearchResult> => {
      try {
        // Get country context for better location handling
        const { getCountryContext } = await import('@/lib/utils/country');
        const countryContext = params.country ? getCountryContext(params.country) : undefined;

        // PHASE 1: Use FirecrawlSearchService with unified search+extract support
        const firecrawlResult = await FirecrawlSearchService.searchEvents({
          query: firecrawlQuery,
          country: params.country || '',
          from: params.dateFrom,
          to: params.dateTo,
          maxResults: params.limit || 20,
          countryContext,
          locale: countryContext?.locale,
          // PHASE 1: Enable unified search+extract
          extractSchema: params.extractSchema,
          extractPrompt: params.extractPrompt,
          // REMOVED: categories: ['research'] - This was causing Firecrawl to return academic papers
          // Only use categories if explicitly provided (and not 'research' for event searches)
          categories: params.categories && !params.categories.includes('research') ? params.categories : undefined,
          scrapeContent: params.scrapeContent || !!params.extractSchema,
        });

        console.log('[unified-firecrawl] Response received, items:', firecrawlResult.items.length);

        // Convert FirecrawlSearchResult to UnifiedSearchResult format
        const items: Array<string | { url: string; title?: string; description?: string; markdown?: string; extracted?: any }> = 
          firecrawlResult.items
            .filter((item) => {
              // Filter out invalid URLs
              if (!item.link || !item.link.startsWith('http')) {
                console.log('[unified-firecrawl] Filtered out invalid URL:', item.link);
                return false;
              }
              return true;
            })
            .map((item) => {
              // Always return enriched item format for better processing downstream
              // This ensures optimized orchestrator can properly handle the results
              const enrichedItem = {
                url: item.link,
                title: item.title || undefined,
                description: item.snippet || undefined,
                extracted: item.extractedData || undefined
              };
              console.log('[unified-firecrawl] Converted item:', { url: enrichedItem.url, hasTitle: !!enrichedItem.title, hasDescription: !!enrichedItem.description });
              return enrichedItem;
            });
        
        console.log('[unified-firecrawl] Final items count after conversion:', items.length);

        const result: UnifiedSearchResult = {
          items,
          provider: 'firecrawl',
          debug: { rawCount: items.length },
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
 * Simplify query for CSE - extract core terms to improve geographic filtering
 * Complex queries with many OR/AND clauses can confuse CSE's geographic filters
 */
function simplifyQueryForCSE(query: string): string {
  // If query is already short (< 200 chars), use as-is
  if (query.length < 200) {
    return query;
  }
  
  // Extract key terms: remove complex boolean logic, keep main keywords
  // Remove excessive parentheses and boolean operators
  let simplified = query
    .replace(/\s*\(+\s*/g, ' ')  // Remove opening parentheses
    .replace(/\s*\)+\s*/g, ' ')  // Remove closing parentheses
    .replace(/\s+OR\s+/gi, ' ')   // Replace OR with space
    .replace(/\s+AND\s+/gi, ' ')  // Replace AND with space
    .replace(/\s+/g, ' ')         // Normalize whitespace
    .trim();
  
  // Extract quoted phrases and key terms
  const quotedPhrases = simplified.match(/"([^"]+)"/g) || [];
  const words = simplified
    .replace(/"([^"]+)"/g, '')  // Remove quoted phrases temporarily
    .split(/\s+/)
    .filter(w => w.length > 3)  // Keep words longer than 3 chars
    .slice(0, 10);  // Limit to 10 key words
  
  // Reconstruct: quoted phrases first, then key words
  const result = [...quotedPhrases, ...words].join(' ').trim();
  
  // Limit to 256 characters (CSE max)
  return result.slice(0, 256);
}

/**
 * Filter CSE results by country to ensure geographic accuracy
 * Removes URLs that clearly don't match the target country
 */
function filterResultsByCountry(urls: string[], targetCountry: string): string[] {
  const countryUpper = targetCountry.toUpperCase();
  
  // Country domain patterns
  const countryDomains: Record<string, string[]> = {
    'DE': ['.de', '.com/de', 'germany', 'deutschland', 'berlin', 'munich', 'frankfurt', 'hamburg'],
    'FR': ['.fr', '.com/fr', 'france', 'paris', 'lyon', 'marseille'],
    'GB': ['.uk', '.co.uk', 'united kingdom', 'london', 'manchester', 'birmingham'],
    'UK': ['.uk', '.co.uk', 'united kingdom', 'london', 'manchester', 'birmingham'],
    'US': ['.us', '.com', 'united states', 'usa', 'new york', 'california'],
    'AT': ['.at', 'austria', 'vienna', 'wien'],
    'CH': ['.ch', 'switzerland', 'zurich', 'geneva'],
    'IT': ['.it', 'italy', 'rome', 'milan'],
    'ES': ['.es', 'spain', 'madrid', 'barcelona'],
    'NL': ['.nl', 'netherlands', 'amsterdam'],
    'BE': ['.be', 'belgium', 'brussels'],
    'PL': ['.pl', 'poland', 'warsaw'],
    'SE': ['.se', 'sweden', 'stockholm'],
    'NO': ['.no', 'norway', 'oslo'],
    'DK': ['.dk', 'denmark', 'copenhagen']
  };
  
  const patterns = countryDomains[countryUpper] || [];
  if (patterns.length === 0) {
    // If country not in list, return all (can't filter)
    return urls;
  }
  
  // URLs to exclude (non-target country indicators)
  const excludePatterns: Record<string, string[]> = {
    'DE': ['.gov/', '.edu/', 'texas', 'california', 'new york', 'hhs.gov', 'tdi.texas', 'microsoft.com/en-us'],
    'FR': ['.gov/', '.edu/', 'texas', 'california', 'microsoft.com/en-us'],
    'GB': ['.gov/', '.edu/', 'texas', 'california', 'microsoft.com/en-us'],
    'US': []  // US searches can include .gov and .edu
  };
  
  const exclude = excludePatterns[countryUpper] || [];
  
  return urls.filter(url => {
    const urlLower = url.toLowerCase();
    
    // Exclude if matches exclude patterns
    if (exclude.some(pattern => urlLower.includes(pattern))) {
      return false;
    }
    
    // Include if matches country patterns
    if (patterns.some(pattern => urlLower.includes(pattern.toLowerCase()))) {
      return true;
    }
    
    // For DE/FR/GB: exclude obvious US government/education sites
    if (['DE', 'FR', 'GB'].includes(countryUpper)) {
      if (urlLower.includes('.gov/') || urlLower.includes('.edu/')) {
        // Only exclude if it's clearly US (not country-specific)
        if (urlLower.includes('.gov/') && !urlLower.includes('.de') && !urlLower.includes('.fr') && !urlLower.includes('.uk')) {
          return false;
        }
      }
    }
    
    // If no clear match, include it (let other filters handle it)
    return true;
  });
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
    
    // Simplify query for CSE - extract core terms to avoid confusion
    // CSE works better with simpler queries, complex queries can confuse geographic filters
    const simplifiedQuery = simplifyQueryForCSE(params.q);
    url.searchParams.set('q', simplifiedQuery);
    url.searchParams.set('key', googleCseKey);
    url.searchParams.set('cx', googleCseCx);
    url.searchParams.set('num', '10');
    url.searchParams.set('safe', 'off');
    url.searchParams.set('hl', 'en'); // Interface language

    // Add geographic filtering parameters
    if (params.country) {
      const countryUpper = params.country.toUpperCase();
      // Map country codes to Google's gl parameter
      const glMap: Record<string, string> = {
        'DE': 'de',
        'FR': 'fr',
        'GB': 'gb',
        'UK': 'gb',
        'US': 'us',
        'AT': 'at',
        'CH': 'ch',
        'IT': 'it',
        'ES': 'es',
        'NL': 'nl',
        'BE': 'be',
        'PL': 'pl',
        'SE': 'se',
        'NO': 'no',
        'DK': 'dk'
      };
      
      const gl = glMap[countryUpper] || countryUpper.toLowerCase();
      url.searchParams.set('gl', gl);
      
      // Add country restriction (cr parameter)
      // Note: cr parameter can sometimes cause 400 errors, so we'll use it carefully
      // Only add if gl parameter is set successfully
      if (gl) {
        try {
          url.searchParams.set('cr', `country${countryUpper}`);
        } catch (e) {
          // If cr causes issues, skip it - gl should be sufficient
          console.warn('[unified-cse] Could not set cr parameter, using gl only');
        }
      }
    }

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
    
    // Log search information to understand why we might get 0 results
    if (data?.searchInformation) {
      console.log('[unified-cse] Search info:', {
        totalResults: data.searchInformation.totalResults,
        searchTime: data.searchInformation.searchTime,
        formattedTotalResults: data.searchInformation.formattedTotalResults
      });
    }
    
    // Log if no items but search completed - indicates query too restrictive
    if (!data?.items && data?.searchInformation?.totalResults === '0') {
      console.warn('[unified-cse] CSE returned 0 results - query may be too restrictive');
    }

    // Extract full CSE items with title, link, and snippet (not just URLs)
    const rawItems = (data?.items ?? []).filter((x: any) => 
      x?.link && typeof x.link === 'string' && x.link.startsWith('http')
    );

    // Post-filter results by country to ensure geographic accuracy
    let filteredItems = rawItems;
    if (params.country && rawItems.length > 0) {
      const countryFiltered = filterResultsByCountry(
        rawItems.map((x: any) => x.link),
        params.country
      );
      const countryFilteredSet = new Set(countryFiltered);
      filteredItems = rawItems.filter((x: any) => countryFilteredSet.has(x.link));
      if (filteredItems.length < rawItems.length) {
        console.log(`[unified-cse] Filtered ${rawItems.length - filteredItems.length} non-${params.country.toUpperCase()} results`);
      }
    }

    // Return enriched items with title, link, and snippet
    const items = filteredItems.map((x: any) => ({
      url: x.link,
      title: x.title || undefined,
      description: x.snippet || undefined,
    }));

    console.log('[unified-cse] Extracted items:', items.length, items.slice(0, 3).map(i => ({ url: i.url, hasTitle: !!i.title })));

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
 * Normalize query for cache key generation
 * This increases cache hit rate by treating semantically similar queries as the same
 */
function normalizeQueryForCache(query: string): string {
  if (!query) return '';
  
  // Normalize whitespace
  let normalized = query
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  
  // Remove common query variations that don't affect meaning
  // Remove trailing event type terms (they're often added as variations)
  const eventTypeSuffixes = [
    ' conference', ' event', ' summit', ' workshop', ' seminar',
    ' forum', ' symposium', ' trade show', ' expo', ' konferenz',
    ' veranstaltung', ' arbeitskreis'
  ];
  
  for (const suffix of eventTypeSuffixes) {
    if (normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, -suffix.length).trim();
      break; // Only remove one suffix
    }
  }
  
  // Normalize boolean operators (treat OR/AND variations as same)
  normalized = normalized
    .replace(/\s+or\s+/g, ' ')
    .replace(/\s+and\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Extract core terms: keep quoted phrases and important keywords
  // Remove excessive parentheses
  normalized = normalized
    .replace(/\s*\(+\s*/g, ' ')
    .replace(/\s*\)+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return normalized;
}

/**
 * Generate unified cache key (provider-agnostic)
 * This allows us to check cache once before trying any provider
 * Uses normalized queries to increase cache hit rate
 */
function generateUnifiedCacheKey(params: UnifiedSearchParams): string {
  // Normalize query to increase cache hits for similar queries
  const normalizedQuery = normalizeQueryForCache(params.q);
  
  const keyData = {
    q: normalizedQuery,  // Use normalized query instead of raw
    country: params.country?.toUpperCase() || '',  // Normalize country code
    dateFrom: params.dateFrom || '',
    dateTo: params.dateTo || '',
    limit: params.limit || 20,  // Default limit for consistency
    scrapeContent: params.scrapeContent || false,
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
  
  // Log provider results for debugging
  console.log('[unified-search] Provider results summary:', {
    firecrawl: firecrawl ? { items: firecrawl.items.length, provider: firecrawl.provider } : null,
    cse: cse ? { items: cse.items.length, provider: cse.provider } : null,
    database: database ? { items: database.items.length, provider: database.provider } : null
  });
  
  if (firecrawl && firecrawl.items.length > 0) {
    selectedResult = firecrawl;
    console.log('[unified-search] Using Firecrawl result:', firecrawl.items.length, 'items');
  } else if (cse && cse.items.length > 0) {
    selectedResult = cse;
    console.log('[unified-search] Using CSE result (Firecrawl had', firecrawl?.items.length || 0, 'items):', cse.items.length, 'items');
  } else if (database && database.items.length > 0) {
    selectedResult = database;
    console.log('[unified-search] Using Database result (Firecrawl had', firecrawl?.items.length || 0, 'items, CSE had', cse?.items.length || 0, 'items):', database.items.length, 'items');
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
