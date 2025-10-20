import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchWithRetry } from "@/lib/http";
import { RetryService } from "./retry-service";
import { FirecrawlSearchService } from "./firecrawl-search-service";
import { GeminiService } from "./gemini-service";
import { BatchGeminiService } from "./batch-gemini-service";
import { TokenBudgetService } from "./token-budget-service";
import { getCacheService, CACHE_CONFIGS } from "@/lib/cache";
import { deduplicateRequest, createHttpRequestFingerprint } from "@/lib/services/request-deduplicator";
import { getServiceQueue, RATE_LIMIT_CONFIGS } from "@/lib/services/request-queue";
import { executeWithCircuitBreaker, CIRCUIT_BREAKER_CONFIGS } from "@/lib/services/circuit-breaker";
import { executeWithFallback } from "@/lib/services/fallback-strategies";
import { OptimizedAIService } from "@/lib/services/optimized-ai-service";
import { buildSearchQuery } from "@/search/query";
import { buildUnifiedQuery } from "@/lib/unified-query-builder";
import { cseSearch } from "@/search/providers/cse";
import { searchCacheKey } from "@/search/cache";
import { FLAGS } from "@/config/flags";

/**
 * Shared Search Service
 * 
 * This service provides direct function calls instead of HTTP requests
 * for internal API communication, reducing overhead and improving performance.
 */

// Types
export interface SearchItem {
  title: string;
  link: string;
  snippet: string;
}

export interface SearchConfig {
  id?: string;
  name: string;
  industry: string;
  baseQuery: string;
  excludeTerms: string;
  industryTerms: string[];
  icpTerms: string[];
  is_active?: boolean;
}

export interface EventRec {
  source_url: string;
  title?: string;
  description?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  city?: string | null;
  country?: string | null;
  location?: string | null;
  venue?: string | null;
  organizer?: string | null;
  topics?: string[] | null;
  speakers?: { name: string; org?: string; title?: string; session_title?: string; confidence?: number }[] | null;
  sponsors?: string[] | null;
  participating_organizations?: string[] | null;
  partners?: string[] | null;
  competitors?: string[] | null;
  confidence?: number | null;
  confidence_reason?: string | null;
  pipeline_metadata?: any;
}

// Unified cache service
const cacheService = getCacheService();

  function getCacheKey(provider: string, q: string, country: string, from?: string, to?: string, timeframe?: string | null): string {
    const cleanedQuery = q.trim().replace(/\s+/g, ' ');
    return searchCacheKey({
      provider: provider as 'firecrawl'|'cse',
      query: cleanedQuery,
      country,
      from,
      to,
    });
  }

async function getCachedResult<T>(key: string): Promise<T | null> {
  return await cacheService.get<T>(key, CACHE_CONFIGS.SEARCH_RESULTS);
}

async function setCachedResult<T>(key: string, data: T): Promise<boolean> {
  return await cacheService.set(key, data, CACHE_CONFIGS.SEARCH_RESULTS);
}

// Database cache functions are now handled by the unified cache service

// Database cache write operations are now handled by the unified cache service

/**
 * Search Service Class
 */
export class SearchService {
  /**
   * Load search configuration from database or return default
   */
  static async loadSearchConfig(): Promise<SearchConfig> {
    try {
      const admin = supabaseAdmin();
      const { data, error } = await admin
        .from("search_configurations")
        .select("*")
        .eq("is_active", true)
        .single();
      
      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          industry: data.industry,
          baseQuery: data.base_query,
          excludeTerms: data.exclude_terms,
          industryTerms: data.industry_terms || [],
          icpTerms: data.icp_terms || [],
          is_active: data.is_active
        };
      }
    } catch (dbError) {
      console.warn('Database not available for search config, using default:', dbError);
    }

    // Return default configuration with localized base queries  
    
    return {
      id: "default",
      name: "Default Configuration",
      industry: "legal-compliance",
      baseQuery: "compliance veranstaltung OR compliance konferenz OR compliance kongress OR compliance panel OR compliance workshop OR datenschutz veranstaltung OR dsgvo konferenz OR compliance summit deutschland",
      excludeTerms: "reddit forum personal blog international global usa america instagram facebook twitter linkedin social media reel post",
      industryTerms: ["compliance", "legal", "investigation", "datenschutz", "dsgvo", "recht", "regulierung", "audit", "risk management", "governance"],
      icpTerms: ["legal counsel", "compliance officer", "datenschutzbeauftragter", "compliance manager"],
      is_active: true
    };
  }

  /**
   * Load user profile
   */
  static async loadUserProfile(): Promise<any> {
    try {
      const supabase = await supabaseServer();
      
      if (!supabase) {
        console.warn('Supabase client not available, skipping user profile');
        return null;
      }

      // Check if auth object exists and has getUser method
      if (!supabase.auth || typeof supabase.auth.getUser !== 'function') {
        console.warn('Supabase auth not available, skipping user profile');
        return null;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.warn('Error getting user:', userError.message);
        return null;
      }
      
      if (!user) {
        console.log('No authenticated user, skipping user profile');
        return null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.warn('Error loading user profile:', error.message);
        return null;
      }

      console.log('User profile loaded successfully for user:', user.email);
      return data;
    } catch (error: any) {
      console.warn('Error loading user profile:', error.message);
      return null;
    }
  }

  /**
   * Build enhanced query using user configuration
   */
  /**
   * Build comprehensive query for Firecrawl (can handle complex queries)
   */
  static buildEnhancedQuery(
    baseQuery: string, 
    searchConfig: any, 
    userProfile: any, 
    country: string
  ): string {
    // Use only the base query from search config - no augmentation
    const query = searchConfig?.baseQuery || baseQuery || '(legal)';
    
    console.log('buildEnhancedQuery debug:', {
      searchConfigBaseQuery: searchConfig?.baseQuery,
      passedBaseQuery: baseQuery,
      finalQuery: query
    });
    
    
    return query;
  }


  /**
   * Soft filter URLs to remove only hard noise
   */
  static softFilterUrls(urls: string[]): string[] {
    const ALLOWLIST = new Set([
      'juve.de','anwaltverein.de','dav.de','forum-institut.de','euroforum.de',
      'beck-akademie.de','dai.de','bitkom.org','handelsblatt.com','uni-koeln.de',
      'uni-muenchen.de','uni-frankfurt.de','zfbf.de','compliance-netzwerk.de','legal-operations.de'
    ]);

    function isLikelyEventUrl(u: URL) {
      const p = u.pathname.toLowerCase();
      return /veranstalt|termine|event|konferenz|kongress|tagung|seminar|workshop|symposium|summit/.test(p);
    }

    function isGermanish(u: URL, htmlLang?: string) {
      return u.hostname.endsWith('.de') || ALLOWLIST.has(u.hostname.replace(/^www\./,''))
          || (htmlLang?.startsWith('de'));
    }

    const out: string[] = [];
    for (const s of urls) {
      try {
        const u = new URL(s);
        if (/\/tag\//.test(u.pathname)) continue;         // kill tag indexes
        if (/fintech\.global|nerja|student/i.test(s)) continue; // obvious noise from logs
        if (!isGermanish(u)) { out.push(s); continue; }   // keep for now—later filtering will cull
        out.push(s);
      } catch { /* skip invalid */ }
    }
    return Array.from(new Set(out));
  }

  /**
   * Safe JSON parsing with repair and fallback
   */
  static async safeParse<T=any>(s: string): Promise<T | null> {
    try { return JSON.parse(s) as T; } catch {}
    try { 
      // Try jsonrepair if available
      const { jsonrepair } = await import('jsonrepair');
      return JSON.parse(jsonrepair(s)) as T; 
    } catch {}
    try { 
      // Try json5 if available
      const { parse: parseJson5 } = await import('json5');
      return parseJson5(s) as T; 
    } catch {}
    // last-ditch: extract first {...} block
    const m = s.match(/\{[\s\S]*\}$/m);
    if (m) { 
      try { 
        const { jsonrepair } = await import('jsonrepair');
        return JSON.parse(jsonrepair(m[0])) as T; 
      } catch {} 
    }
    return null;
  }

  /**
   * Calculate heuristic score for prioritization fallback
   */
  static calculateHeuristicScore(item: SearchItem): number {
    const url = item.link?.toLowerCase() || '';
    const title = item.title?.toLowerCase() || '';
    const text = item.snippet?.toLowerCase() || '';
    
    let s = 0;
    
    // Event keywords
    if (/veranstalt|konferenz|kongress|tagung|seminar|workshop|symposium|summit/i.test(title + text)) s += 3;
    
    // Legal keywords
    if (/compliance|datenschutz|dsgvo|gdpr|ediscovery|e-discovery|whistleblow|interne untersuch|wirtschaftsstrafrecht|legal operations/i.test(title + text)) s += 3;
    
    // URL path hints
    if (/\/veranstaltungen?|\/termine|\/event|\/konferenz|\/kongress/i.test(url)) s += 2;
    
    // Domain trust
    if (url.endsWith('.de') || /juve\.de|anwaltverein\.de|forum-institut\.de|euroforum\.de|beck-akademie\.de|dai\.de/i.test(url)) s += 2;
    
    return s;
  }

  /**
   * Convert days to CDR window format
   */
  static toCdr(days: number): { cd_min: string, cd_max: string } {
    const now = new Date();
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    const formatDate = (date: Date) => {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    };
    
    return {
      cd_min: formatDate(from),
      cd_max: formatDate(now)
    };
  }

  /**
   * Infer country from URL and text content
   */
  static inferCountry(url: string, text: string): string {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      
      if (host.endsWith('.de')) return 'DE';
      
      const DE_CITIES = new Set(['berlin', 'münchen', 'frankfurt', 'köln', 'hamburg', 'stuttgart', 'leipzig', 'düsseldorf']);
      
      if (/\b(Deutschland|Germany|Berlin|München|Frankfurt|Köln|Hamburg|Stuttgart|Leipzig|Düsseldorf)\b/i.test(text)) return 'DE';
      if (/\b(Österreich|Austria|Wien)\b/i.test(text)) return 'AT';
      if (/\b(Schweiz|Switzerland|Zürich|Bern|Basel)\b/i.test(text)) return 'CH';
      
      return 'OTHER';
    } catch {
      return 'OTHER';
    }
  }

  /**
   * Infer date from text content
   */
  static inferDate(text: string): string | undefined {
    // ISO format: 2024-01-15
    const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (iso) return iso[1];
    
    // German dots format: dd.mm.yyyy or dd.mm.yy
    const deDots = text.match(/\b(\d{1,2}\.\d{1,2}\.(20)?\d{2,4})\b/);
    if (deDots) {
      const [d, m, y] = deDots[1].split('.');
      const year = (y.length === 2 ? '20' + y : y).padStart(4, '0');
      return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    
    // German month names: d. Monat yyyy
    const months = ['januar','februar','märz','april','mai','juni','juli','august','september','oktober','november','dezember'];
    const m = text.toLowerCase().match(new RegExp(`\\b(\\d{1,2})\\.\\s*(${months.join('|')})\\s*(20\\d{2})\\b`,'i'));
    if (m) {
      const day = m[1].padStart(2, '0');
      const month = String(months.indexOf(m[2].toLowerCase()) + 1).padStart(2, '0');
      return `${m[3]}-${month}-${day}`;
    }
    
    return undefined;
  }

  /**
   * Infer metadata from URL and content
   */
  static inferMeta(url: string, html: string, text: string): { country: string, dateISO?: string } {
    const country = this.inferCountry(url, text);
    const dateISO = this.inferDate(text);
    
    return { country, dateISO };
  }

  /**
   * Build simplified query for Google CSE (avoids 400 errors)
   */
  static buildSimpleQuery(
    baseQuery: string, 
    searchConfig: any, 
    userProfile: any, 
    country: string
  ): string {
    // For Google CSE, use very simple queries to avoid 400 errors
    // Extract just the key terms from the search config
    let query = "";
    
    if (searchConfig?.baseQuery) {
      // Extract key terms from the complex baseQuery for Google CSE
      const keyTerms = searchConfig.baseQuery
        .replace(/\([^)]*\)/g, '') // Remove parentheses
        .replace(/\b(OR|AND)\b/gi, ' ') // Replace OR/AND with spaces
        .replace(/["']/g, '') // Remove quotes
        .split(/\s+/)
        .filter((term: string) => term.length > 2)
        .slice(0, 2); // Take only first 2 terms for Google CSE
      
      query = keyTerms.join(' ');
    }
    
    // If no query extracted, use simple defaults
    if (!query || query.length < 3) {
      if (searchConfig?.industry === 'legal-compliance') {
        query = "compliance conference";
      } else {
        query = "conference";
      }
    }
    
    // Add country-specific event keywords with industry focus
    if (country === 'de') {
      // Add legal/compliance specific German terms
      if (!query.toLowerCase().includes('veranstaltung')) {
        query = `${query} veranstaltung`;
      }
      if (!query.toLowerCase().includes('konferenz')) {
        query = `${query} konferenz`;
      }
      if (!query.toLowerCase().includes('deutschland')) {
        query = `${query} deutschland`;
      }
    } else {
      // Add English event keyword if not present
      if (!query.toLowerCase().includes('conference') && !query.toLowerCase().includes('event')) {
        query = `${query} conference`;
      }
    }
    
    // Ensure we're looking for professional events, not general events
    if (!query.toLowerCase().includes('professional') && !query.toLowerCase().includes('business')) {
      query = `${query} professional`;
    }
    
    // Add current year (2025) unless query already includes a year
    const currentYear = new Date().getFullYear(); // 2025
    
    // Check if query already includes a year
    const hasYear = /\b(202[4-6])\b/.test(query);
    if (!hasYear) {
      // Always use current year (2025) unless it's a past search
      const preferredYear = query.toLowerCase().includes('past') || query.toLowerCase().includes('last') ? currentYear - 1 : currentYear;
      query = `${query} ${preferredYear}`;
    }
    
    // Clean up the query and limit length
    query = query
      .replace(/\s+/g, ' ') // Clean up multiple spaces
      .trim();
    
    // Limit query length to prevent API errors
    if (query.length > 200) {
      console.warn('Query too long, truncating:', query.length);
      // Try to truncate at word boundaries to avoid cutting off words
      const truncated = query.substring(0, 200);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 150) { // Only use word boundary if it's not too far back
        query = truncated.substring(0, lastSpace).trim();
      } else {
        query = truncated.trim();
      }
    }
    
    return query;
  }

  /**
   * Check database for existing events before making API calls
   */
  static async checkDatabaseForEvents(params: {
    q: string;
    country: string;
    from?: string;
    to?: string;
  }): Promise<{
    found: boolean;
    events: EventRec[];
    count: number;
  }> {
    try {
      const supabase = await supabaseAdmin();
      if (!supabase) {
        return { found: false, events: [], count: 0 };
      }

      // Build date range query
      const dateFilter: any = {};
      if (params.from) {
        dateFilter.gte = params.from;
      }
      if (params.to) {
        dateFilter.lte = params.to;
      }

      // Query collected events table
      let query = supabase
        .from('collected_events')
        .select('*')
        .eq('country', params.country)
        .limit(50);

      // Add date filtering if provided
      if (params.from || params.to) {
        query = query.gte('starts_at', params.from || '1900-01-01')
                     .lte('starts_at', params.to || '2100-12-31');
      }

      // Add text search if query provided
      if (params.q && params.q.trim()) {
        query = query.or(`title.ilike.%${params.q}%,description.ilike.%${params.q}%,organizer.ilike.%${params.q}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Database query error:', error.message);
        return { found: false, events: [], count: 0 };
      }

      const events = data || [];
      console.log(`Database check: Found ${events.length} events for ${params.country} ${params.from}-${params.to}`);

      return {
        found: events.length > 0,
        events: events,
        count: events.length
      };
    } catch (error: any) {
      console.warn('Error checking database for events:', error.message);
      return { found: false, events: [], count: 0 };
    }
  }

  /**
   * Execute search with database-first approach, then Firecrawl primary and Google CSE fallback
   */
  static async executeSearch(params: {
    q: string;
    country: string;
    from?: string;
    to?: string;
    num?: number;
    rerank?: boolean;
    topK?: number;
  }): Promise<{
    provider: string;
    items: SearchItem[];
    cached: boolean;
  }> {
    // Step 1: Check database first to avoid duplicate API calls
    const dbResult = await this.checkDatabaseForEvents({
      q: params.q,
      country: params.country,
      from: params.from,
      to: params.to
    });

    if (dbResult.found && dbResult.events.length > 0) {
      console.log(JSON.stringify({ at: "search_service", provider: "database", found: dbResult.count, cached: true }));
      
      // Convert database events to SearchItem format
      const items: SearchItem[] = dbResult.events.map(event => ({
        title: event.title || "Event",
        link: event.source_url || "",
        snippet: event.description || event.title || "Event details"
      }));

      return {
        provider: "database",
        items: items.slice(0, params.num || 20),
        cached: true
      };
    } else {
      console.log(JSON.stringify({ at: "search_service", provider: "database", found: false, count: dbResult.count, proceeding_to_search: true }));
    }

    // Step 2: Try Firecrawl Search with tier-based approach
    try {
      console.log(JSON.stringify({ at: "search_service", provider: "firecrawl", attempt: "tier_based" }));
      
      // Load user configuration to enhance search
      const searchConfig = await this.loadSearchConfig();
      const userProfile = await this.loadUserProfile().catch(error => {
        console.warn('Failed to load user profile, continuing without user-specific enhancements:', error.message);
        return null;
      });
      
      // Build enhanced query using user configuration
      const enhancedQuery = this.buildEnhancedQuery(params.q, searchConfig, userProfile, params.country);
      
      // Normalize effectiveQ using unified query builder
      let effectiveQ: string;
      try {
        const result = await buildUnifiedQuery({
          userText: params.q,
          country: params.country,
          dateFrom: params.from,
          dateTo: params.to,
          language: 'en'
        });
        effectiveQ = result.query;
      } catch (error) {
        console.warn('[search-service] Failed to use unified query builder, using fallback:', error);
        effectiveQ = buildSearchQuery({
          baseQuery: searchConfig.baseQuery,
          userText: params.q
        });
      }
      
      // Sanitize to collapse accidental double parens
      const normalizedQ = effectiveQ.replace(/^\(+/, '(').replace(/\)+$/, ')');
      
      console.log(JSON.stringify({ 
        at: "search_service", 
        effectiveQ: normalizedQ, 
        query_length: normalizedQ.length 
      }));
      
      // Declare firecrawlResult outside the if block for proper scope
      let firecrawlResult: any;
      
      // One-shot Firecrawl with clean CSE fallback (no re-entry)
      let providerUsed: 'firecrawl' | 'cse' | null = null;
      let urls: string[] = [];

      try {
        let q: string;
        try {
          const result = await buildUnifiedQuery({
            userText: params.q,
            country: params.country,
            dateFrom: params.from,
            dateTo: params.to,
            language: 'en'
          });
          q = result.query;
        } catch (error) {
          console.warn('[search-service] Failed to use unified query builder for Firecrawl, using fallback:', error);
          q = buildSearchQuery({ baseQuery: searchConfig.baseQuery, userText: params.q });
        }
        
        const fcResult = await FirecrawlSearchService.searchEvents({
          query: q,
          country: params.country,
          from: params.from,
          to: params.to,
          industry: searchConfig?.industry || "legal-compliance",
          maxResults: params.num || 10
        });
        urls = (fcResult?.items ?? []).map((r: any) => r.link).filter(Boolean);
        providerUsed = 'firecrawl';
      } catch (err) {
        console.warn('[firecrawl.build] skip -> using CSE', String(err));
        let q: string;
        try {
          const result = await buildUnifiedQuery({
            userText: params.q,
            country: params.country,
            dateFrom: params.from,
            dateTo: params.to,
            language: 'en'
          });
          q = result.query;
        } catch (error) {
          console.warn('[search-service] Failed to use unified query builder for CSE fallback, using fallback:', error);
          q = buildSearchQuery({ baseQuery: searchConfig.baseQuery, userText: params.q });
        }
        urls = await cseSearch(q);
        providerUsed = 'cse';
      }
      
      // Convert URLs to SearchItem format
      const allResults = urls.map(url => ({
        title: "Event",
        link: url,
        snippet: "Event details"
      }));
      
      firecrawlResult = { items: allResults };
      
      console.log(JSON.stringify({ 
        at: "search_service", 
        providerUsed,
        total_results: urls.length,
        sample_urls: urls.slice(0, 5)
      }));
      
      if (firecrawlResult.items.length > 0) {
        console.log(JSON.stringify({ at: "search_service", provider: "firecrawl", success: true, items: firecrawlResult.items.length }));
        
        // Disable Gemini prioritization for low-signal docs
        if (FLAGS.aiRankingEnabled && urls.length > 0) {
          try {
            console.log(JSON.stringify({ at: "search_service", step: "gemini_prioritization", items: firecrawlResult.items.length }));
          
          // Check if we have enough results for prioritization
          if (firecrawlResult.items.length < 8) {
            console.log(JSON.stringify({ at: "search_service", step: "auto_degrade", reason: "low_results", count: firecrawlResult.items.length }));
            // Auto-degrade: widen window, relax filters
            const degradedParams = {
              ...params,
              from: new Date(Date.now() - (60 * 24 * 60 * 60 * 1000)).toISOString(), // +30 days
              to: params.to
            };
            // TODO: Implement auto-degrade logic here
          }
          
          const prioritization = await OptimizedAIService.processRequest<{ prioritizedUrls: string[] }>(
            'prioritize',
            'Prioritize URLs based on relevance for event discovery',
            { items: firecrawlResult.items, searchConfig, country: params.country },
            { useBatching: true, useCache: true }
          );
          
          // Use safeParse to handle JSON parsing errors (prioritization is already parsed)
          const parsedPrioritization = prioritization as { prioritizedUrls: string[] };
          
          if (!parsedPrioritization) {
            console.warn('Gemini prioritization returned invalid JSON, using heuristic fallback');
            // Use heuristic prioritization based on title/URL scoring
            const scoredItems = firecrawlResult.items
              .map((item: any) => ({
                ...item,
                score: this.calculateHeuristicScore(item)
              }))
              .sort((a: any, b: any) => b.score - a.score);
            
            // Keep items with score >= 4, or top-scoring if fewer than 8
            const highScoreItems = scoredItems.filter((item: any) => item.score >= 4);
            const prioritizedItems = highScoreItems.length >= 8 
              ? highScoreItems 
              : scoredItems.slice(0, Math.max(8, scoredItems.length));
            
            console.log(`Heuristic scoring: ${scoredItems.length} total, ${highScoreItems.length} with score >= 4, keeping ${prioritizedItems.length}`);
            
            return {
              provider: firecrawlResult.provider,
              items: prioritizedItems.map((item: any) => ({ title: item.title, link: item.link, snippet: item.snippet })),
              cached: false
            };
          }
          
          // Return only prioritized URLs as search items
          const prioritizedItems = firecrawlResult.items.filter((item: any) => 
            parsedPrioritization.prioritizedUrls.includes(item.link)
          );
          
          console.log(JSON.stringify({ 
            at: "search_service", 
            step: "prioritization_complete", 
            original: firecrawlResult.items.length, 
            prioritized: prioritizedItems.length 
          }));
          
          return {
            provider: firecrawlResult.provider,
            items: prioritizedItems,
            cached: false
          };
        } catch (error: any) {
          console.warn('Gemini prioritization failed, using heuristic fallback:', error.message);
          // Use heuristic prioritization as fallback
          const scoredItems = firecrawlResult.items
            .map((item: any) => ({
              ...item,
              score: this.calculateHeuristicScore(item)
            }))
            .sort((a: any, b: any) => b.score - a.score);
          
          // Keep items with score >= 4, or top-scoring if fewer than 8
          const highScoreItems = scoredItems.filter((item: any) => item.score >= 4);
          const prioritizedItems = highScoreItems.length >= 8 
            ? highScoreItems 
            : scoredItems.slice(0, Math.max(8, scoredItems.length));
          
          console.log(`Heuristic fallback: ${scoredItems.length} total, ${highScoreItems.length} with score >= 4, keeping ${prioritizedItems.length}`);
          
          return {
            provider: firecrawlResult.provider,
            items: prioritizedItems.map((item: any) => ({ title: item.title, link: item.link, snippet: item.snippet })),
            cached: false
          };
        }
        } else {
          // skip; use heuristic or identity ordering
          console.log(JSON.stringify({ at: "search_service", step: "gemini_prioritization_skipped", reason: "flag_disabled" }));
        }
      }
    } catch (error) {
      console.warn('Firecrawl Search failed, falling back to Google CSE:', error);
    }

    // Step 3: Fallback to Google CSE
    console.log(JSON.stringify({ at: "search_service", provider: "google_cse", attempt: "fallback" }));
    const cseResult = await this.executeGoogleCSESearch(params);
    console.log(JSON.stringify({ at: "search_service", google_cse_result: { provider: cseResult.provider, items_count: cseResult.items.length } }));
    
    // Log search summary
    console.info(JSON.stringify({
      at: 'search_summary',
      preFilterCount: 0, // TODO: track this
      keptAfterHeuristics: 0, // TODO: track this
      keptAfterModel: 0, // TODO: track this
      keptAfterCountryDate: 0, // TODO: track this
      degradedRun: false, // TODO: track this
      sample: cseResult.items.slice(0,5).map(x => x.link)
    }, null, 2));
    
    return cseResult;
  }

  /**
   * Execute search using Google Custom Search Engine (fallback method)
   */
  static async executeGoogleCSESearch(params: {
    q: string;
    country: string;
    from?: string;
    to?: string;
    num?: number;
    rerank?: boolean;
    topK?: number;
  }): Promise<{
    provider: string;
    items: SearchItem[];
    cached: boolean;
  }> {
    const { q = "", country = "", from, to, num = 10, rerank = false, topK = 50 } = params;

    // Check cache first
    const cacheKey = getCacheKey('firecrawl', q, country, from, to);
    const cachedResult = await getCachedResult<{ provider: string; items: SearchItem[]; cached: boolean }>(cacheKey);
    if (cachedResult) {
      console.log(JSON.stringify({ at: "search_service", cache: "hit", key: cacheKey }));
      return { ...cachedResult, cached: true };
    }
    console.log(JSON.stringify({ at: "search_service", cache: "miss", key: cacheKey }));

    // Load search configuration
    const searchConfig = await this.loadSearchConfig();

    // Get API credentials
    const key = process.env.GOOGLE_CSE_KEY;

    if (!key) {
      // Return demo data if API keys are not configured
      const demoItems: SearchItem[] = [
        {
          title: "Legal Tech Conference 2025 - Munich",
          link: "https://example.com/legal-tech-2025",
          snippet: "Join us for the premier legal technology conference in Munich, featuring compliance, e-discovery, and regulatory technology sessions."
        }
      ];
      
      const result = {
        provider: "demo",
        items: demoItems,
        cached: false
      };
      
      await setCachedResult(cacheKey, result);
      return result;
    }

    // Load user profile for query building
    const userProfile = await this.loadUserProfile().catch(error => {
      console.warn('Failed to load user profile for Google CSE, continuing without user-specific enhancements:', error.message);
      return null;
    });
    
    // Build simplified query for Google CSE to avoid 400 errors
    const enhancedQuery = this.buildSimpleQuery(q, searchConfig, userProfile, country);

    // Build search parameters
    const searchParams = new URLSearchParams({
      q: enhancedQuery,
      key,
      num: num.toString(),
      safe: "off",
      hl: "en"
    });

    // Add country restriction
    if (country === "de") {
      searchParams.set("cr", "countryDE");
      searchParams.set("gl", "de");
      searchParams.set("lr", "lang_de|lang_en");
    } else if (country === "fr") {
      searchParams.set("cr", "countryFR");
      searchParams.set("gl", "fr");
      searchParams.set("lr", "lang_fr|lang_en");
    } else if (country === "uk") {
      searchParams.set("cr", "countryGB");
      searchParams.set("gl", "gb");
      searchParams.set("lr", "lang_en");
    }

    // Make the search request with retry logic
    const url = `https://www.googleapis.com/customsearch/v1?${searchParams}`;
    console.log(JSON.stringify({ at: "search_service", real: "calling_cse", query: enhancedQuery, url: url }));
    
    // Use request deduplication for Google CSE calls
    const fingerprint = createHttpRequestFingerprint(
      "google_cse",
      url,
      "GET",
      { q: enhancedQuery, country, num: num.toString() }
    );

    const res = await executeWithFallback("google_cse", async () => {
      return await deduplicateRequest(fingerprint, () =>
        executeWithCircuitBreaker("google_cse", () =>
          RetryService.fetchWithRetry(
            "google_cse",
            "search",
            url,
            { cache: "no-store" }
          ),
          CIRCUIT_BREAKER_CONFIGS.GOOGLE_CSE
        )
      );
    });
    const data = await res.json();
    console.log(JSON.stringify({ at: "search_service", real: "cse_result", status: res.status, items: data.items?.length || 0 }));

    // Transform results
    const items: SearchItem[] = (data.items || []).map((it: any) => ({
      title: it.title || "",
      link: it.link || "",
      snippet: it.snippet || ""
    }));

    // Apply basic filtering
    const filteredItems = items.filter(item => {
      // Filter out 404 pages
      if (/\b(404|page not found|fehler 404|not found)\b/i.test(item.title)) {
        return false;
      }
      
      // Filter out banned hosts (social media, forums, etc.)
      const bannedHosts = [
        "reddit.com", "www.reddit.com", 
        "mumsnet.com", "www.mumsnet.com",
        "instagram.com", "www.instagram.com",
        "facebook.com", "www.facebook.com",
        "twitter.com", "www.twitter.com", "x.com", "www.x.com",
        "linkedin.com", "www.linkedin.com",
        "youtube.com", "www.youtube.com",
        "tiktok.com", "www.tiktok.com"
      ];
      const hostname = new URL(item.link).hostname.toLowerCase();
      if (bannedHosts.includes(hostname)) {
        return false;
      }
      
      return true;
    });

    // Disable Gemini prioritization for CSE results
    let finalItems = filteredItems;
    if (FLAGS.aiRankingEnabled && filteredItems.length > 0) {
      try {
        console.log(JSON.stringify({ at: "search_service", step: "gemini_prioritization_cse", items: filteredItems.length }));
        const prioritization = await OptimizedAIService.processRequest<{ prioritizedUrls: string[] }>(
          'prioritize',
          'Prioritize URLs based on relevance for event discovery',
          { items: filteredItems, searchConfig, country },
          { useBatching: true, useCache: true }
        );
        
        // Return only prioritized URLs
        finalItems = filteredItems.filter(item => 
          prioritization.prioritizedUrls.includes(item.link)
        );
        
        console.log(JSON.stringify({ 
          at: "search_service", 
          step: "prioritization_complete_cse", 
          original: filteredItems.length, 
          prioritized: finalItems.length 
        }));
      } catch (error: any) {
        console.warn('Gemini prioritization failed for CSE results, returning all filtered results:', error.message);
      }
    } else {
      console.log(JSON.stringify({ at: "search_service", step: "gemini_prioritization_cse_skipped", reason: "flag_disabled" }));
    }

    const result = {
      provider: "cse",
      items: finalItems,
      cached: false
    };

    // Cache the result
    await setCachedResult(cacheKey, result);

    return result;
  }

  /**
   * Enhance events with Gemini AI for speaker extraction and additional information
   * Now uses batch processing for improved efficiency and token usage
   */
  static async enhanceEventsWithGemini(events: EventRec[]): Promise<{
    enhancedEvents: EventRec[];
    enhancementStats: {
      processed: number;
      enhanced: number;
      speakersFound: number;
    };
  }> {
    const stats = {
      processed: 0,
      enhanced: 0,
      speakersFound: 0
    };

    // Check token budget before processing
    const estimatedTokens = TokenBudgetService.estimateTokenUsage(
      `Extract speakers from ${events.length} events. Return JSON array with speaker information.`
    );
    
    const budgetStatus = TokenBudgetService.getBudgetStatus();
    const fallbackRecommendation = TokenBudgetService.getFallbackRecommendation(estimatedTokens);
    
    if (fallbackRecommendation.useFallback) {
      console.warn(`Token budget constraint: ${fallbackRecommendation.reason}. ${fallbackRecommendation.alternative}`);
      
      // Return events without enhancement if budget is exceeded
      return {
        enhancedEvents: events,
        enhancementStats: {
          processed: events.length,
          enhanced: 0,
          speakersFound: 0
        }
      };
    }

    try {
      // Prepare events for batch processing
      const eventsForProcessing = events.map((event, index) => ({
        id: event.source_url || `event_${index}`,
        title: event.title || '',
        description: event.description || '',
        starts_at: event.starts_at || undefined,
        location: event.location || event.city || undefined,
        city: event.city || undefined,
        speakers: event.speakers ? event.speakers.map(speaker => ({
          name: speaker.name || '',
          org: speaker.org || '',
          title: speaker.title || '',
          session_title: '',
          confidence: 0.5
        })) : undefined
      }));

      // Record estimated token usage
      TokenBudgetService.recordEstimate(estimatedTokens, 'speaker_extraction_batch', 'gemini');

      // Use batch processing for speaker extraction
      const batchResult = await BatchGeminiService.processSpeakerExtractionBatch(
        eventsForProcessing,
        {
          batchSize: 5, // Process 5 events at once
          maxRetries: 2,
          delayBetweenBatches: 1000
        }
      );

      // Record actual token usage (estimate based on batch size)
      const actualTokens = Math.ceil(estimatedTokens * 0.8); // Assume 20% efficiency gain
      TokenBudgetService.recordUsage(actualTokens, 'speaker_extraction_batch', 'gemini');

      // Apply results to events
      const enhancedEvents: EventRec[] = [];
      
      for (const event of events) {
        const eventId = event.source_url || `event_${events.indexOf(event)}`;
        const batchResultItem = batchResult.results.find(r => r.eventId === eventId);
        
        if (batchResultItem && batchResultItem.success) {
          let hasEnhancement = false;
          
          // Apply speaker data
          if (batchResultItem.speakers.length > 0) {
            console.log(`Enhancing event ${eventId} with ${batchResultItem.speakers.length} speakers:`, JSON.stringify(batchResultItem.speakers, null, 2));
            event.speakers = batchResultItem.speakers;
            stats.speakersFound += batchResultItem.speakers.length;
            hasEnhancement = true;
          }
          
          // Apply sponsor data
          if (batchResultItem.sponsors.length > 0) {
            console.log(`Enhancing event ${eventId} with ${batchResultItem.sponsors.length} sponsors:`, JSON.stringify(batchResultItem.sponsors, null, 2));
            event.sponsors = batchResultItem.sponsors;
            hasEnhancement = true;
          }
          
          // Apply participating organizations data
          if (batchResultItem.participating_organizations.length > 0) {
            console.log(`Enhancing event ${eventId} with ${batchResultItem.participating_organizations.length} participating organizations:`, JSON.stringify(batchResultItem.participating_organizations, null, 2));
            event.participating_organizations = batchResultItem.participating_organizations;
            hasEnhancement = true;
          }
          
          // Apply partners data
          if (batchResultItem.partners.length > 0) {
            console.log(`Enhancing event ${eventId} with ${batchResultItem.partners.length} partners:`, JSON.stringify(batchResultItem.partners, null, 2));
            event.partners = batchResultItem.partners;
            hasEnhancement = true;
          }
          
          if (hasEnhancement) {
            stats.enhanced++;
          }
        } else {
          console.log(`No enhancement for event ${eventId}`);
        }
        
        enhancedEvents.push(event);
        stats.processed++;
      }

      console.log(`Batch Gemini enhancement complete: ${stats.enhanced}/${stats.processed} events enhanced, ${stats.speakersFound} speakers found`);
      console.log(`Batch processing stats: ${batchResult.stats.successfulBatches}/${batchResult.stats.totalProcessed} successful, ${batchResult.stats.processingTime}ms`);

      return {
        enhancedEvents,
        enhancementStats: stats
      };

    } catch (error: any) {
      console.error('Batch speaker extraction failed, falling back to individual processing:', error.message);
      
      // Fallback to individual processing if batch fails
      return await this.enhanceEventsWithGeminiFallback(events);
    }
  }

  /**
   * Fallback method for individual event enhancement (used when batch processing fails)
   */
  private static async enhanceEventsWithGeminiFallback(events: EventRec[]): Promise<{
    enhancedEvents: EventRec[];
    enhancementStats: {
      processed: number;
      enhanced: number;
      speakersFound: number;
    };
  }> {
    const stats = {
      processed: 0,
      enhanced: 0,
      speakersFound: 0
    };

    const enhancedEvents: EventRec[] = [];

    for (const event of events) {
      stats.processed++;
      
      try {
        // Skip if event already has speakers
        if (event.speakers && event.speakers.length > 0) {
          enhancedEvents.push(event);
          continue;
        }

        // Check token budget for individual processing
        const estimatedTokens = TokenBudgetService.estimateTokenUsage(
          `Extract speakers from event: ${event.title || ''}. Return JSON with speaker information.`
        );

        if (!TokenBudgetService.canSpend(estimatedTokens)) {
          console.warn(`Token budget exceeded for individual processing of event: ${event.title}`);
          enhancedEvents.push(event);
          continue;
        }

        // Use simple prompt
        const prompt = `Extract speaker information from this event page content. Look for:
        - Speaker names (people presenting, moderating, or speaking)
        - Their organizations/companies
        - Job titles/roles
        - Session titles or topics they're speaking about
        - Panelists, moderators, keynote speakers, workshop leaders
        
        Event: ${event.title || 'Unknown Event'}
        Content: ${event.description || 'No description available'}
        
        Return a JSON array of speakers with fields: name, org, title, session_title, confidence (0-1)`;

        // Use Gemini to extract speakers and enhance event information
        const enhancementResult = await GeminiService.extractWithGemini({
          content: event.description || event.title || "",
          prompt: prompt,
          context: {
            eventTitle: event.title,
            eventDate: event.starts_at,
            eventLocation: event.location || event.city
          }
        });

        // Record token usage
        TokenBudgetService.recordUsage(estimatedTokens, 'speaker_extraction_single', 'gemini');

        if (enhancementResult.result?.speakers) {
          const speakers = enhancementResult.result.speakers;
          if (speakers.length > 0) {
            event.speakers = speakers;
            stats.speakersFound += speakers.length;
            stats.enhanced++;
          }
        }

        enhancedEvents.push(event);
      } catch (error: any) {
        console.warn(`Failed to enhance event "${event.title}" with Gemini:`, error.message);
        enhancedEvents.push(event); // Add original event even if enhancement fails
      }
    }

    console.log(`Fallback Gemini enhancement complete: ${stats.enhanced}/${stats.processed} events enhanced, ${stats.speakersFound} speakers found`);

    return {
      enhancedEvents,
      enhancementStats: stats
    };
  }

  /**
   * Extract event details from URLs using Firecrawl
   */
  static async extractEvents(urls: string[]): Promise<{
    events: EventRec[];
    version: string;
    trace: any[];
  }> {
    const firecrawlKey = process.env.FIRECRAWL_KEY;
    
    if (!firecrawlKey) {
      console.log(JSON.stringify({ at: "search_service_extract", note: "no FIRECRAWL_KEY, returning minimal events" }));
      return {
        events: (urls || []).slice(0, 10).map(url => ({
          source_url: url,
          title: url,
          starts_at: null,
          ends_at: null,
          city: null,
          country: null,
          organizer: null,
        })),
        version: "minimal",
        trace: []
      };
    }

    try {
      // Use Firecrawl v2 extract with schema for better event extraction
      const extractResponse = await RetryService.fetchWithRetry(
        "firecrawl",
        "extract",
        "https://api.firecrawl.dev/v2/extract",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            urls: urls.slice(0, 10), // Limit to 10 URLs for performance
            schema: {
              type: "object",
              properties: {
                events: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      eventDate: { type: "string" },
                      location: { type: "string" },
                      organizer: { type: "string" },
                      venue: { type: "string" },
                      speakers: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            org: { type: "string" },
                            title: { type: "string" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            prompt: "Extract event information including title, date, location, organizer, venue, and speakers. For speakers, include their name, organization, and job title if available.",
            showSources: true,
            scrapeOptions: {
              formats: ["markdown"],
              onlyMainContent: false, // Get more content for better event extraction
              waitFor: 2000, // More time for dynamic content
              blockAds: false, // Don't block ads to avoid missing content
              removeBase64Images: false, // Keep images for better context
              timeout: 15000 // More time for complex pages
            },
            ignoreInvalidURLs: true
          })
        }
      );

      const extractData = await extractResponse.json();
      
      // Check if we got a job ID for polling
      if (extractData.success && extractData.id) {
        // Poll for results
        const polledData = await this.pollExtractResults(extractData.id, firecrawlKey);
        if (polledData) {
          return await this.processExtractResults(polledData, urls);
        }
      }
      
      // Fallback: process immediate results if no polling needed
      return await this.processExtractResults(extractData, urls);
    } catch (error) {
      console.error('Firecrawl extraction failed:', error);
      return {
        events: urls.slice(0, 10).map(url => ({
          source_url: url,
          title: url,
          description: `Event page: ${url}`, // Basic description for speaker extraction
          starts_at: null,
          ends_at: null,
          city: null,
          country: null,
          organizer: null,
        })),
        version: "fallback",
        trace: []
      };
    }
  }

  /**
   * Poll for extract results using the job ID
   */
  private static async pollExtractResults(jobId: string, firecrawlKey: string): Promise<any> {
    const maxAttempts = 20; // 20 seconds max for better extraction success
    const pollInterval = 1000; // 1 second intervals
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        console.log(`Polling extract job ${jobId}, attempt ${attempt + 1}/${maxAttempts}`);
        
        const response = await RetryService.fetchWithRetry(
          "firecrawl",
          "extract_status",
          `https://api.firecrawl.dev/v2/extract/${jobId}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${firecrawlKey}`,
              "Content-Type": "application/json"
            }
          }
        );
        
        const data = await response.json();
        console.log(`Extract job ${jobId} status: ${data.status} (attempt ${attempt + 1})`);
        
        if (data.status === "completed") {
          console.log(`Extract job ${jobId} completed successfully`);
          return data;
        } else if (data.status === "failed" || data.status === "cancelled") {
          console.warn(`Extract job ${jobId} failed with status: ${data.status}`);
          return null;
        }
        
        // Still processing, wait and try again
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.warn(`Error polling extract job ${jobId} (attempt ${attempt + 1}):`, error);
        // Don't return null immediately, try a few more times
        if (attempt >= 5) {
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    console.warn(`Extract job ${jobId} timed out after ${maxAttempts} attempts`);
    return null;
  }

  /**
   * Process extract results into EventRec format
   */
  private static async processExtractResults(extractData: any, urls: string[]): Promise<{
    events: EventRec[];
    version: string;
    trace: any[];
  }> {
    const events: EventRec[] = [];
    
    // Debug: Log the structure of extractData
    console.log('Extract data structure:', JSON.stringify({
      hasData: !!extractData.data,
      dataType: typeof extractData.data,
      isArray: Array.isArray(extractData.data),
      hasEvents: !!extractData.data?.events,
      eventsLength: extractData.data?.events?.length || 0,
      dataKeys: extractData.data ? Object.keys(extractData.data) : []
    }, null, 2));
    
    if (extractData.data?.events) {
      for (const event of extractData.data.events) {
        events.push({
          source_url: urls[0] || "", // Use first URL as source
          title: event.title || "Event",
          description: event.description || null,
          starts_at: event.eventDate || null,
          ends_at: event.endDate || null,
          city: event.location || event.city || null,
          country: event.country || null,
          location: event.location || null,
          venue: event.venue || null,
          organizer: event.organizer || null,
          topics: event.topics || null,
          speakers: event.speakers || null,
          sponsors: event.sponsors || null,
          participating_organizations: event.participating_organizations || event.organizations || null,
          partners: event.partners || null,
          competitors: event.competitors || null,
          confidence: event.confidence || 0.8,
          confidence_reason: event.confidence_reason || null,
          pipeline_metadata: event.pipeline_metadata || null
        });
      }
    }

    // If no events extracted, try to extract basic info from the raw data
    if (events.length === 0 && extractData.data) {
      console.log('No events found in structured data, trying fallback extraction from markdown');
      // Try to extract from raw markdown content
      for (let i = 0; i < urls.length && i < 10; i++) {
        const url = urls[i];
        const rawData = Array.isArray(extractData.data) ? extractData.data[i] : extractData.data;
        
        console.log(`Processing URL ${i + 1}/${Math.min(urls.length, 10)}: ${url}`);
        console.log(`Raw data has markdown: ${!!rawData?.markdown}`);
        
        if (rawData && rawData.markdown) {
          const markdown = rawData.markdown;
          const title = this.extractTitleFromMarkdown(markdown) || this.extractTitleFromUrl(url);
          const date = this.extractDateFromMarkdown(markdown);
          const location = this.extractLocationFromMarkdown(markdown);
          const organizer = this.extractOrganizerFromMarkdown(markdown);
          
          events.push({
            source_url: url,
            title: title,
            description: markdown.substring(0, 2000), // Include markdown content for speaker extraction
            starts_at: date,
            ends_at: null,
            city: location,
            country: null,
            organizer: organizer,
            speakers: null, // Will be enhanced with Gemini
            confidence: 0.6
          });
        }
      }
    }

    // If still no events extracted, try direct content fetching as fallback
    if (events.length === 0) {
      console.log('No events extracted from any method, trying direct content fetching');
      
      for (let i = 0; i < Math.min(urls.length, 5); i++) {
        const url = urls[i];
        try {
          console.log(`Fetching content directly from: ${url}`);
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });
          
          if (response.ok) {
            const html = await response.text();
            const title = this.extractTitleFromUrl(url);
            const description = this.extractTextFromHTML(html).substring(0, 2000);
            
            // Filter out generic event calendars and tourism sites
            if (this.isGenericEventPage(url, title, description)) {
              console.log(`Skipping generic event page: ${url}`);
              continue;
            }
            
            const country = this.extractCountryFromUrl(url) || this.extractCountryFromContent(description);
            const city = this.extractCityFromContent(description) || this.extractCityFromUrl(url);
            const dateInfo = this.extractDateFromContent(description);
            
            events.push({
              source_url: url,
              title: title,
              description: description,
              starts_at: dateInfo?.starts_at || null,
              ends_at: dateInfo?.ends_at || null,
              city: city,
              country: country,
              organizer: null,
              confidence: 0.5
            });
            
            console.log(`Successfully fetched content from: ${url}`);
          } else {
            console.log(`Failed to fetch content from: ${url} (status: ${response.status})`);
          }
        } catch (error: any) {
          console.log(`Error fetching content from: ${url}`, error.message);
        }
      }
      
      // If still no events, create minimal events
      if (events.length === 0) {
        console.log('Direct content fetching failed, creating minimal events from URLs');
        events.push(...urls.slice(0, 10).map(url => ({
          source_url: url,
          title: this.extractTitleFromUrl(url),
          description: `Event page: ${url}`, // Basic description for speaker extraction
          starts_at: null,
          ends_at: null,
          city: null,
          country: null,
          organizer: null,
        })));
      }
    }
    
    console.log(`Final events count: ${events.length}`);

    // Enhance events with Gemini API for speaker extraction
    const { enhancedEvents } = await this.enhanceEventsWithGemini(events);

    return {
      events: enhancedEvents,
      version: "firecrawl_v2_polled_gemini",
      trace: []
    };
  }


  /**
   * Extract title from markdown content
   */
  private static extractTitleFromMarkdown(markdown: string): string | null {
    if (!markdown) return null;
    
    // Look for the first heading (# or ##)
    const headingMatch = markdown.match(/^#+\s*(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }
    
    // Look for title in the first few lines
    const lines = markdown.split('\n').slice(0, 5);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 10 && trimmed.length < 200) {
        return trimmed;
      }
    }
    
    return null;
  }

  /**
   * Extract country from URL
   */
  private static extractCountryFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // Check for German domains
      if (hostname.includes('.de') || hostname.includes('germany') || hostname.includes('deutschland')) {
        return 'Germany';
      }
      
      // Check for other country indicators
      if (hostname.includes('.uk') || hostname.includes('britain')) {
        return 'United Kingdom';
      }
      if (hostname.includes('.fr') || hostname.includes('france')) {
        return 'France';
      }
      if (hostname.includes('.it') || hostname.includes('italy')) {
        return 'Italy';
      }
      if (hostname.includes('.es') || hostname.includes('spain')) {
        return 'Spain';
      }
      if (hostname.includes('.nl') || hostname.includes('netherlands')) {
        return 'Netherlands';
      }
      if (hostname.includes('.at') || hostname.includes('austria')) {
        return 'Austria';
      }
      if (hostname.includes('.ch') || hostname.includes('switzerland')) {
        return 'Switzerland';
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extract country from venue/location information
   */
  private static extractCountryFromVenue(venue: string): string | null {
    if (!venue) return null;
    
    const lowerVenue = venue.toLowerCase();
    
    // German cities and regions
    if (lowerVenue.includes('berlin') || lowerVenue.includes('munich') || 
        lowerVenue.includes('hamburg') || lowerVenue.includes('frankfurt') ||
        lowerVenue.includes('cologne') || lowerVenue.includes('stuttgart') ||
        lowerVenue.includes('düsseldorf') || lowerVenue.includes('dortmund') ||
        lowerVenue.includes('leipzig') || lowerVenue.includes('dresden') ||
        lowerVenue.includes('bremen') || lowerVenue.includes('hannover') ||
        lowerVenue.includes('nürnberg') || lowerVenue.includes('duisburg') ||
        lowerVenue.includes('bochum') || lowerVenue.includes('wuppertal') ||
        lowerVenue.includes('bielefeld') || lowerVenue.includes('bonn') ||
        lowerVenue.includes('münster') || lowerVenue.includes('karlsruhe') ||
        lowerVenue.includes('mannheim') || lowerVenue.includes('augsburg') ||
        lowerVenue.includes('wiesbaden') || lowerVenue.includes('gelsenkirchen') ||
        lowerVenue.includes('mönchengladbach') || lowerVenue.includes('braunschweig') ||
        lowerVenue.includes('chemnitz') || lowerVenue.includes('kiel') ||
        lowerVenue.includes('aachen') || lowerVenue.includes('halle') ||
        lowerVenue.includes('magdeburg') || lowerVenue.includes('freiburg') ||
        lowerVenue.includes('krefeld') || lowerVenue.includes('lübeck') ||
        lowerVenue.includes('oberhausen') || lowerVenue.includes('erfurt') ||
        lowerVenue.includes('mainz') || lowerVenue.includes('rostock') ||
        lowerVenue.includes('kassel') || lowerVenue.includes('hagen') ||
        lowerVenue.includes('hamm') || lowerVenue.includes('saarbrücken') ||
        lowerVenue.includes('mülheim') || lowerVenue.includes('potsdam') ||
        lowerVenue.includes('ludwigshafen') || lowerVenue.includes('oldenburg') ||
        lowerVenue.includes('leverkusen') || lowerVenue.includes('osnabrück') ||
        lowerVenue.includes('solingen') || lowerVenue.includes('heidelberg') ||
        lowerVenue.includes('herne') || lowerVenue.includes('neuss') ||
        lowerVenue.includes('darmstadt') || lowerVenue.includes('paderborn') ||
        lowerVenue.includes('regensburg') || lowerVenue.includes('ingolstadt') ||
        lowerVenue.includes('würzburg') || lowerVenue.includes('fürth') ||
        lowerVenue.includes('wolfsburg') || lowerVenue.includes('offenbach') ||
        lowerVenue.includes('ulm') || lowerVenue.includes('heilbronn') ||
        lowerVenue.includes('pforzheim') || lowerVenue.includes('göttingen') ||
        lowerVenue.includes('bottrop') || lowerVenue.includes('trier') ||
        lowerVenue.includes('recklinghausen') || lowerVenue.includes('reutlingen') ||
        lowerVenue.includes('bremerhaven') || lowerVenue.includes('koblenz') ||
        lowerVenue.includes('bergisch gladbach') || lowerVenue.includes('jena') ||
        lowerVenue.includes('remscheid') || lowerVenue.includes('erlangen') ||
        lowerVenue.includes('moers') || lowerVenue.includes('siegen') ||
        lowerVenue.includes('hildesheim') || lowerVenue.includes('salzgitter')) {
      return 'Germany';
    }
    
    // Other European cities
    if (lowerVenue.includes('london') || lowerVenue.includes('manchester') || 
        lowerVenue.includes('birmingham') || lowerVenue.includes('glasgow') ||
        lowerVenue.includes('liverpool') || lowerVenue.includes('leeds') ||
        lowerVenue.includes('sheffield') || lowerVenue.includes('edinburgh') ||
        lowerVenue.includes('bristol') || lowerVenue.includes('cardiff')) {
      return 'United Kingdom';
    }
    
    if (lowerVenue.includes('paris') || lowerVenue.includes('lyon') || 
        lowerVenue.includes('marseille') || lowerVenue.includes('toulouse') ||
        lowerVenue.includes('nice') || lowerVenue.includes('nantes') ||
        lowerVenue.includes('strasbourg') || lowerVenue.includes('montpellier') ||
        lowerVenue.includes('bordeaux') || lowerVenue.includes('lille')) {
      return 'France';
    }
    
    if (lowerVenue.includes('rome') || lowerVenue.includes('milan') || 
        lowerVenue.includes('naples') || lowerVenue.includes('turin') ||
        lowerVenue.includes('palermo') || lowerVenue.includes('genoa') ||
        lowerVenue.includes('bologna') || lowerVenue.includes('florence') ||
        lowerVenue.includes('bari') || lowerVenue.includes('catania')) {
      return 'Italy';
    }
    
    if (lowerVenue.includes('madrid') || lowerVenue.includes('barcelona') || 
        lowerVenue.includes('valencia') || lowerVenue.includes('seville') ||
        lowerVenue.includes('zaragoza') || lowerVenue.includes('málaga') ||
        lowerVenue.includes('murcia') || lowerVenue.includes('palma') ||
        lowerVenue.includes('las palmas') || lowerVenue.includes('bilbao')) {
      return 'Spain';
    }
    
    if (lowerVenue.includes('amsterdam') || lowerVenue.includes('rotterdam') || 
        lowerVenue.includes('the hague') || lowerVenue.includes('utrecht') ||
        lowerVenue.includes('eindhoven') || lowerVenue.includes('tilburg') ||
        lowerVenue.includes('groningen') || lowerVenue.includes('almere') ||
        lowerVenue.includes('breda') || lowerVenue.includes('nijmegen')) {
      return 'Netherlands';
    }
    
    if (lowerVenue.includes('vienna') || lowerVenue.includes('graz') || 
        lowerVenue.includes('linz') || lowerVenue.includes('salzburg') ||
        lowerVenue.includes('innsbruck') || lowerVenue.includes('klagenfurt') ||
        lowerVenue.includes('villach') || lowerVenue.includes('wels') ||
        lowerVenue.includes('sankt pölten') || lowerVenue.includes('dornbirn')) {
      return 'Austria';
    }
    
    if (lowerVenue.includes('zurich') || lowerVenue.includes('geneva') || 
        lowerVenue.includes('basel') || lowerVenue.includes('bern') ||
        lowerVenue.includes('lausanne') || lowerVenue.includes('winterthur') ||
        lowerVenue.includes('lucerne') || lowerVenue.includes('st. gallen') ||
        lowerVenue.includes('lugano') || lowerVenue.includes('biel')) {
      return 'Switzerland';
    }
    
    return null;
  }

  /**
   * Check if a country is European
   */
  private static isEuropeanCountry(country: string): boolean {
    const europeanCountries = [
      'germany', 'france', 'italy', 'spain', 'poland', 'romania', 'netherlands',
      'belgium', 'greece', 'czech republic', 'portugal', 'sweden', 'hungary',
      'austria', 'belarus', 'switzerland', 'bulgaria', 'serbia', 'denmark',
      'finland', 'slovakia', 'norway', 'ireland', 'croatia', 'bosnia and herzegovina',
      'albania', 'lithuania', 'slovenia', 'latvia', 'estonia', 'north macedonia',
      'moldova', 'luxembourg', 'malta', 'iceland', 'montenegro', 'cyprus',
      'united kingdom', 'ukraine', 'russia'
    ];
    
    return europeanCountries.includes(country.toLowerCase());
  }

  /**
   * Extract country from content
   */
  private static extractCountryFromContent(content: string): string | null {
    const lowerContent = content.toLowerCase();
    
    // German indicators
    if (lowerContent.includes('germany') || lowerContent.includes('deutschland') || 
        lowerContent.includes('berlin') || lowerContent.includes('munich') || 
        lowerContent.includes('hamburg') || lowerContent.includes('frankfurt') ||
        lowerContent.includes('cologne') || lowerContent.includes('stuttgart') ||
        lowerContent.includes('düsseldorf') || lowerContent.includes('dortmund')) {
      return 'Germany';
    }
    
    // Other country indicators
    if (lowerContent.includes('united kingdom') || lowerContent.includes('london') || lowerContent.includes('britain')) {
      return 'United Kingdom';
    }
    if (lowerContent.includes('france') || lowerContent.includes('paris')) {
      return 'France';
    }
    if (lowerContent.includes('italy') || lowerContent.includes('rome') || lowerContent.includes('milan')) {
      return 'Italy';
    }
    if (lowerContent.includes('spain') || lowerContent.includes('madrid') || lowerContent.includes('barcelona')) {
      return 'Spain';
    }
    if (lowerContent.includes('netherlands') || lowerContent.includes('amsterdam')) {
      return 'Netherlands';
    }
    if (lowerContent.includes('austria') || lowerContent.includes('vienna')) {
      return 'Austria';
    }
    if (lowerContent.includes('switzerland') || lowerContent.includes('zurich') || lowerContent.includes('geneva')) {
      return 'Switzerland';
    }
    
    return null;
  }

  /**
   * Extract text content from HTML
   */
  private static extractTextFromHTML(html: string): string {
    try {
      // Simple HTML tag removal and text extraction
      let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
        .replace(/<[^>]+>/g, ' ') // Remove HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // Extract meaningful content (first 3000 characters)
      return text.substring(0, 3000);
    } catch (error) {
      console.error('Error extracting text from HTML:', error);
      return '';
    }
  }

  /**
   * Extract title from URL
   */
  private static extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Extract meaningful parts from the URL path
      const segments = pathname.split('/').filter(segment => 
        segment && 
        segment.length > 2 && 
        !segment.match(/^\d+$/) && // Not just numbers
        !segment.match(/^(page|event|conference|summit)$/i) // Skip generic words
      );
      
      if (segments.length > 0) {
        // Take the last meaningful segment and format it
        const lastSegment = segments[segments.length - 1];
        return lastSegment
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())
          .trim();
      }
      
      // Fallback to hostname
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  /**
   * Extract date from markdown content
   */
  private static extractDateFromMarkdown(markdown: string): string | null {
    if (!markdown) return null;
    
    // Look for various date patterns
    const datePatterns = [
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g,
      /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/g,
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/gi,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}/gi
    ];
    
    for (const pattern of datePatterns) {
      const match = markdown.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    return null;
  }

  /**
   * Extract location from markdown content
   */
  private static extractLocationFromMarkdown(markdown: string): string | null {
    if (!markdown) return null;
    
    // Look for location patterns
    const locationPatterns = [
      /(?:location|venue|where|ort|veranstaltungsort):\s*([^\n]+)/gi,
      /(?:in|at|@)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g
    ];
    
    for (const pattern of locationPatterns) {
      const match = markdown.match(pattern);
      if (match) {
        return match[1]?.trim() || null;
      }
    }
    
    return null;
  }

  /**
   * Extract organizer from markdown content
   */
  private static extractOrganizerFromMarkdown(markdown: string): string | null {
    if (!markdown) return null;
    
    // Look for organizer patterns
    const organizerPatterns = [
      /(?:organizer|organised by|hosted by|veranstalter):\s*([^\n]+)/gi,
      /(?:by|von)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g
    ];
    
    for (const pattern of organizerPatterns) {
      const match = markdown.match(pattern);
      if (match) {
        return match[1]?.trim() || null;
      }
    }
    
    return null;
  }

  /**
   * Prioritize URLs using Gemini AI before expensive extraction
   * Now uses batch processing and token budgeting for improved efficiency
   */
  static async prioritizeUrlsWithGemini(searchResults: Array<{
    title: string;
    link: string;
    snippet: string;
  }>, searchConfig: any, country: string): Promise<{
    prioritizedUrls: string[];
    prioritizationStats: {
      total: number;
      prioritized: number;
      reasons: Array<{ url: string; score: number; reason: string }>;
    };
  }> {
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        console.warn('No Gemini API key, returning all URLs without prioritization');
        return {
          prioritizedUrls: searchResults.map(item => item.link),
          prioritizationStats: {
            total: searchResults.length,
            prioritized: searchResults.length,
            reasons: []
          }
        };
      }

      // Check token budget before processing
      const estimatedTokens = TokenBudgetService.estimateTokenUsage(
        `Prioritize ${searchResults.length} URLs for events in ${country}. Return top 15 URLs with scores.`
      );
      
      const fallbackRecommendation = TokenBudgetService.getFallbackRecommendation(estimatedTokens);
      
      if (fallbackRecommendation.useFallback) {
        console.warn(`Token budget constraint for URL prioritization: ${fallbackRecommendation.reason}. ${fallbackRecommendation.alternative}`);
        
        // Return top 15 URLs based on simple heuristics
        const fallbackUrls = searchResults
          .slice(0, 15)
          .map(item => item.link);
        
        return {
          prioritizedUrls: fallbackUrls,
          prioritizationStats: {
            total: searchResults.length,
            prioritized: fallbackUrls.length,
            reasons: []
          }
        };
      }

      // Record estimated token usage
      TokenBudgetService.recordEstimate(estimatedTokens, 'url_prioritization_batch', 'gemini');

      // Use batch processing for URL prioritization
      const batchResult = await BatchGeminiService.processUrlPrioritizationBatch(
        searchResults,
        searchConfig,
        country,
        {
          batchSize: 10, // Process 10 URLs at once
          maxRetries: 2,
          delayBetweenBatches: 500
        }
      );

      // Record actual token usage
      const actualTokens = Math.ceil(estimatedTokens * 0.8); // Assume 20% efficiency gain
      TokenBudgetService.recordUsage(actualTokens, 'url_prioritization_batch', 'gemini');

      // Combine results from all batches
      const allPrioritizedUrls: string[] = [];
      const allReasons: Array<{ url: string; score: number; reason: string }> = [];
      
      for (const result of batchResult.results) {
        if (result.success) {
          allPrioritizedUrls.push(...result.prioritizedUrls);
          allReasons.push(...result.reasons);
        }
      }

      // Remove duplicates and limit to top 15
      const uniqueUrls = Array.from(new Set(allPrioritizedUrls)).slice(0, 15);
      
      console.log(`Batch Gemini URL prioritization: ${uniqueUrls.length}/${searchResults.length} URLs selected for extraction`);
      console.log(`Batch processing stats: ${batchResult.stats.successfulBatches}/${batchResult.stats.totalProcessed} successful, ${batchResult.stats.processingTime}ms`);
      
      return {
        prioritizedUrls: uniqueUrls,
        prioritizationStats: {
          total: searchResults.length,
          prioritized: uniqueUrls.length,
          reasons: allReasons.slice(0, 10) // Show top 10 reasons
        }
      };

    } catch (error: any) {
      console.warn('Batch Gemini URL prioritization failed, falling back to simple heuristics:', error.message);
      
      // Fallback: return top 15 URLs based on simple heuristics
      const fallbackUrls = searchResults
        .filter(item => {
          const title = item.title.toLowerCase();
          const link = item.link.toLowerCase();
          const snippet = (item.snippet || '').toLowerCase();
          
          // Filter out obvious non-events
          if (title.includes('job') || title.includes('career') || title.includes('hiring')) {
            return false;
          }
          if (link.includes('indeed.com') || link.includes('linkedin.com') || link.includes('x.com')) {
            return false;
          }
          if (title.includes('news') || title.includes('article') || title.includes('blog')) {
            return false;
          }
          
          // Prefer URLs that look like events
          const hasEventKeywords = title.includes('event') || title.includes('conference') || 
                                 title.includes('summit') || title.includes('webinar') ||
                                 title.includes('workshop') || title.includes('seminar') ||
                                 title.includes('veranstaltung') || title.includes('kongress');
          
          return hasEventKeywords;
        })
        .slice(0, 15)
        .map(item => item.link);
      
      return {
        prioritizedUrls: fallbackUrls,
        prioritizationStats: {
          total: searchResults.length,
          prioritized: fallbackUrls.length,
          reasons: []
        }
      };
    }
  }

  /**
   * Build URL prioritization prompt for Gemini
   */
  private static buildUrlPrioritizationPrompt(
    searchResults: Array<{ title: string; link: string; snippet: string }>,
    searchConfig: any,
    country: string
  ): string {
    const resultsJson = JSON.stringify(searchResults, null, 2);
    const industry = searchConfig?.industry || 'business';
    const countryName = country === 'de' ? 'Germany' : country === 'us' ? 'United States' : country;
    
    return `You are an expert event discovery assistant. Your task is to prioritize URLs for event extraction based on their likelihood of containing actual business events.

SEARCH CONTEXT:
- Industry: ${industry}
- Country: ${countryName}
- Looking for: Conferences, summits, workshops, seminars, webinars, trade shows, professional events

PRIORITIZATION CRITERIA (in order of importance):
1. **Event Pages**: Direct event pages with specific dates, venues, and agendas
2. **Event Aggregators**: Sites that list multiple events (Eventbrite, Meetup, etc.)
3. **Conference Websites**: Dedicated conference or summit websites
4. **Company Event Pages**: Corporate event calendars with specific events
5. **Industry Associations**: Professional organization event pages
6. **Venue Websites**: Conference centers, hotels with event listings
7. **Academic Events**: University conferences, research symposiums

SCORING GUIDELINES:
- Score 0.9-1.0: Direct event pages with clear dates, venues, speakers
- Score 0.7-0.8: Event aggregators or conference websites
- Score 0.5-0.6: Company event calendars or industry association pages
- Score 0.0-0.4: News articles, job postings, general company pages

EXCLUDE (HIGH PRIORITY):
- News articles about events (not the events themselves)
- Job postings, career pages, or hiring information
- General company pages without events
- Blog posts or articles
- Social media content
- Generic directory pages
- Pages with no clear event information
- Law firm general pages (unless they have specific events)
- Thought leadership content
- Press releases
- Any content from indeed.com, linkedin.com, or job sites
- Generic directory pages without event information

SEARCH RESULTS TO PRIORITIZE:
${resultsJson}

Please analyze each URL and return a JSON response with this exact structure:
{
  "prioritizedUrls": [
    "https://example.com/event1",
    "https://example.com/event2"
  ],
  "reasons": [
    {
      "url": "https://example.com/event1",
      "score": 0.9,
      "reason": "Direct conference page with agenda and speakers"
    }
  ]
}

Return only the top 15 most promising URLs for event extraction. Focus on quality over quantity.`;
  }

  /**
   * Parse Gemini URL prioritization response
   */
  private static parseUrlPrioritizationResponse(
    response: any,
    originalResults: Array<{ title: string; link: string; snippet: string }>
  ): {
    prioritizedUrls: string[];
    prioritizationStats: {
      total: number;
      prioritized: number;
      reasons: Array<{ url: string; score: number; reason: string }>;
    };
  } {
    try {
      // Debug: Log the response structure
      console.log("Gemini response structure:", JSON.stringify({
        hasCandidates: !!response.candidates,
        candidatesLength: response.candidates?.length || 0,
        hasContent: !!response.candidates?.[0]?.content,
        hasParts: !!response.candidates?.[0]?.content?.parts,
        partsLength: response.candidates?.[0]?.content?.parts?.length || 0,
        hasText: !!response.candidates?.[0]?.content?.parts?.[0]?.text
      }, null, 2));

      // Safely extract text from response
      let text = "";
      if (response.candidates && response.candidates[0] && 
          response.candidates[0].content && response.candidates[0].content.parts && 
          response.candidates[0].content.parts[0] && 
          response.candidates[0].content.parts[0].text) {
        text = response.candidates[0].content.parts[0].text;
      } else {
        throw new Error("Invalid Gemini response structure");
      }

      console.log("Gemini response text (first 500 chars):", text.substring(0, 500));
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error("No JSON found in Gemini response");
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      console.log("Parsed Gemini response:", JSON.stringify(parsed, null, 2));
      
      return {
        prioritizedUrls: parsed.prioritizedUrls || [],
        prioritizationStats: {
          total: originalResults.length,
          prioritized: parsed.prioritizedUrls?.length || 0,
          reasons: parsed.reasons || []
        }
      };
    } catch (error) {
      console.error("Error parsing Gemini prioritization response:", error);
      console.error("Full response:", JSON.stringify(response, null, 2));
      
      // Fallback: return URLs based on enhanced heuristics, filtering out obvious non-events
      const fallbackUrls = originalResults
        .filter(item => {
          const title = item.title.toLowerCase();
          const link = item.link.toLowerCase();
          const snippet = (item.snippet || '').toLowerCase();
          
          // Filter out obvious non-events
          if (title.includes('job') || title.includes('career') || title.includes('hiring')) {
            return false;
          }
          if (link.includes('indeed.com') || link.includes('linkedin.com') || link.includes('x.com')) {
            return false;
          }
          if (title.includes('news') || title.includes('article') || title.includes('blog')) {
            return false;
          }
          if (link.includes('law.com') && !title.includes('event') && !title.includes('conference')) {
            return false;
          }
          
          // Don't filter out attendee/participant lists - they provide valuable intelligence
          // and may contain speaker information in various formats
          
          // Filter out marketing pages and company websites
          if (title.includes('company') || title.includes('about us') || 
              title.includes('services') || title.includes('solutions') ||
              title.includes('products') || title.includes('contact us')) {
            return false;
          }
          
          // Filter out generic directories and finder pages (but allow event directories)
          if ((title.includes('finder') || title.includes('directory') || 
              title.includes('search') || title.includes('browse')) &&
              !title.includes('event') && !title.includes('conference')) {
            return false;
          }
          
          // Enhanced filtering for better quality
          if (title.includes('season') && title.includes('episode')) {
            return false; // Podcast episodes, not events
          }
          if (title.includes('how to') || title.includes('guide') || title.includes('tutorial')) {
            return false; // How-to articles, not events
          }
          if (link.includes('thought-leadership') || link.includes('insights')) {
            return false; // Thought leadership content
          }
          if (title.includes('outcome tree') || title.includes('product decisions')) {
            return false; // Product management content
          }
          
          // Prefer URLs that look like events
          const hasEventKeywords = title.includes('event') || title.includes('conference') || 
                                 title.includes('summit') || title.includes('webinar') ||
                                 title.includes('workshop') || title.includes('seminar') ||
                                 title.includes('veranstaltung') || title.includes('kongress');
          
          // Prefer URLs with specific event indicators
          const hasEventIndicators = snippet.includes('register') || snippet.includes('ticket') ||
                                   snippet.includes('agenda') || snippet.includes('speaker') ||
                                   snippet.includes('venue') || snippet.includes('date');
          
          // Score based on event likelihood
          let score = 0;
          if (hasEventKeywords) score += 2;
          if (hasEventIndicators) score += 1;
          if (link.includes('event') || link.includes('conference')) score += 1;
          if (title.length > 10 && title.length < 100) score += 1; // Reasonable title length
          
          return score >= 1; // Only keep URLs with some event indicators
        })
        .slice(0, 10) // Limit to 10 URLs for fallback
        .map(item => item.link);
      
      return {
        prioritizedUrls: fallbackUrls,
        prioritizationStats: {
          total: originalResults.length,
          prioritized: fallbackUrls.length,
          reasons: []
        }
      };
    }
  }

  /**
   * Run the complete event discovery pipeline with optimized workflow
   */
  static async runEventDiscovery(params: {
    q: string;
    country: string;
    from: string;
    to: string;
    provider?: string;
  }): Promise<{
    events: EventRec[];
    search: any;
    prioritization?: any;
    extract: any;
    deduped: any;
    enhancement?: any;
  }> {
    const { q = "", country = "", from, to, provider = "cse" } = params;

    // Step 1: Load search configuration
    const searchConfig = await this.loadSearchConfig();

    // Step 2: Load user profile for comprehensive query building
    const userProfile = await this.loadUserProfile();

    // Step 3: Build comprehensive query using all available data
    const effectiveQ = this.buildEnhancedQuery(
      q,
      searchConfig,
      userProfile,
      country
    );

    // Step 4: Execute search (Firecrawl primary, CSE fallback)
    const search = await this.executeSearch({
      q: effectiveQ,
      country,
      from,
      to,
      num: 50,
      rerank: true,
      topK: 50
    });

    // Step 5: NEW - Prioritize URLs with Gemini AI before expensive extraction
    const prioritization = await OptimizedAIService.processRequest<{ 
      prioritizedUrls: string[];
      prioritizationStats: {
        total: number;
        prioritized: number;
        reasons: string[];
      };
    }>(
      'prioritize',
      'Prioritize URLs based on relevance for event discovery',
      { items: search.items, searchConfig, country },
      { useBatching: true, useCache: true }
    );

    // Step 6: Extract events from prioritized URLs only
    const extract = await this.extractEvents(prioritization.prioritizedUrls || []);

    // Step 7: Process and deduplicate events
    let events = extract.events;
    
    // Basic deduplication by URL
    const seenUrls = new Set<string>();
    events = events.filter(event => {
      if (seenUrls.has(event.source_url)) {
        return false;
      }
      seenUrls.add(event.source_url);
      return true;
    });

    // Step 8: Filter by country and date with improved logic
    const filteredEvents = events.filter(event => {
      // Skip events with poor quality indicators
      if (!event.title || event.title.length < 3) {
        return false;
      }
      
      // Skip events that are just URLs or generic titles
      if (event.title === event.source_url || 
          event.title.toLowerCase().includes('.html') ||
          event.title.toLowerCase().includes('.aspx') ||
          event.title.toLowerCase().includes('.php')) {
        return false;
      }
      
      // Country filtering based on physical venue location
      if (country) {
        let eventCountry = event.country;
        
        // If no country is set, try to infer from URL, content, or venue location
        if (!eventCountry) {
          eventCountry = this.extractCountryFromUrl(event.source_url) || 
                        this.extractCountryFromContent(event.description || '') ||
                        this.extractCountryFromVenue(event.venue || event.location || '');
        }
        
        // Handle "All Europe" vs specific country filtering
        if (country.toLowerCase() === 'all europe' || country.toLowerCase() === 'europe') {
          // Keep events from any European country
          if (eventCountry && !this.isEuropeanCountry(eventCountry)) {
            return false;
          }
        } else {
          // Keep events only from the specific country (physical venue location)
          if (!eventCountry || eventCountry.toLowerCase() !== country.toLowerCase()) {
            return false;
          }
        }
      }
      
      // Date filtering for "next 7 days" type searches
      if (from && to) {
        if (!event.starts_at) {
          // If no date, only keep if we're being lenient (allowUndated)
          // For strict searches like "next 7 days", we should filter out undated events
          return false;
        }
        
        const eventDate = new Date(event.starts_at);
        const fromDate = new Date(from);
        const toDate = new Date(to);
        
        if (eventDate < fromDate || eventDate > toDate) {
          return false;
        }
      }
      
      return true;
    });

    // Step 9: Enhance events with Gemini AI for speaker extraction
    const { enhancedEvents, enhancementStats } = await this.enhanceEventsWithGemini(filteredEvents);

    return {
      events: enhancedEvents,
      search: {
        status: 200,
        provider: search.provider,
        items: search.items
      },
      prioritization: {
        total: prioritization?.prioritizationStats?.total || 0,
        selected: prioritization?.prioritizationStats?.prioritized || 0,
        reasons: prioritization?.prioritizationStats?.reasons?.slice(0, 5) || [] // Show top 5 reasons
      },
      extract: {
        status: 200,
        version: extract.version,
        eventsBeforeFilter: extract.events.length,
        sampleTrace: extract.trace.slice(0, 3)
      },
      deduped: {
        count: filteredEvents.length
      },
      enhancement: {
        processed: enhancementStats.processed,
        enhanced: enhancementStats.enhanced,
        speakersFound: enhancementStats.speakersFound
      }
    };
  }

  private static extractCityFromContent(content: string): string | null {
    if (!content) return null;
    
    const contentLower = content.toLowerCase();
    
    // German cities
    const germanCities = [
      'berlin', 'münchen', 'hamburg', 'köln', 'frankfurt', 'stuttgart', 'düsseldorf', 'dortmund', 'essen',
      'leipzig', 'bremen', 'dresden', 'hannover', 'nürnberg', 'duisburg', 'bochum', 'wuppertal', 'bielefeld',
      'bonn', 'münster', 'karlsruhe', 'mannheim', 'augsburg', 'wiesbaden', 'gelsenkirchen', 'mönchengladbach',
      'braunschweig', 'chemnitz', 'kiel', 'aachen', 'halle', 'magdeburg', 'freiburg', 'krefeld', 'lübeck',
      'oberhausen', 'erfurt', 'mainz', 'rostock', 'kassel', 'hagen', 'hamm', 'saarbrücken', 'mülheim', 'potsdam'
    ];
    
    for (const city of germanCities) {
      if (contentLower.includes(city)) {
        return city.charAt(0).toUpperCase() + city.slice(1);
      }
    }
    
    return null;
  }

  private static extractCityFromUrl(url: string): string | null {
    if (!url) return null;
    
    const urlLower = url.toLowerCase();
    
    // Extract city from URL patterns
    if (urlLower.includes('berlin')) return 'Berlin';
    if (urlLower.includes('münchen') || urlLower.includes('munich')) return 'München';
    if (urlLower.includes('hamburg')) return 'Hamburg';
    if (urlLower.includes('köln') || urlLower.includes('cologne')) return 'Köln';
    if (urlLower.includes('frankfurt')) return 'Frankfurt';
    if (urlLower.includes('stuttgart')) return 'Stuttgart';
    if (urlLower.includes('düsseldorf')) return 'Düsseldorf';
    if (urlLower.includes('dortmund')) return 'Dortmund';
    if (urlLower.includes('essen')) return 'Essen';
    if (urlLower.includes('leipzig')) return 'Leipzig';
    if (urlLower.includes('bremen')) return 'Bremen';
    if (urlLower.includes('dresden')) return 'Dresden';
    if (urlLower.includes('hannover')) return 'Hannover';
    if (urlLower.includes('nürnberg') || urlLower.includes('nuremberg')) return 'Nürnberg';
    
    return null;
  }

  private static extractDateFromContent(content: string): { starts_at: string | null; ends_at: string | null } {
    if (!content) return { starts_at: null, ends_at: null };
    
    const contentLower = content.toLowerCase();
    
    // Look for date patterns
    const datePatterns = [
      // German date formats
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/g, // DD.MM.YYYY
      /(\d{1,2})\s+(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s+(\d{4})/gi, // DD Month YYYY
      // English date formats
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/g, // MM/DD/YYYY
      /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/gi, // DD Month YYYY
      // ISO format
      /(\d{4})-(\d{1,2})-(\d{1,2})/g // YYYY-MM-DD
    ];
    
    const months: { [key: string]: string } = {
      'januar': '01', 'january': '01', 'februar': '02', 'february': '02', 'märz': '03', 'march': '03',
      'april': '04', 'mai': '05', 'may': '05', 'juni': '06', 'june': '06', 'juli': '07', 'july': '07',
      'august': '08', 'september': '09', 'oktober': '10', 'october': '10', 'november': '11', 'dezember': '12', 'december': '12'
    };
    
    for (const pattern of datePatterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        const firstMatch = matches[0];
        let dateStr = null;
        
        if (pattern.source.includes('\\d{4}-\\d{1,2}-\\d{1,2}')) {
          // ISO format
          dateStr = firstMatch;
        } else if (pattern.source.includes('\\d{1,2}\\.\\d{1,2}\\.\\d{4}')) {
          // DD.MM.YYYY format
          const parts = firstMatch.split('.');
          if (parts.length === 3) {
            dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        } else if (pattern.source.includes('\\d{1,2}\\/\\d{1,2}\\/\\d{4}')) {
          // MM/DD/YYYY format
          const parts = firstMatch.split('/');
          if (parts.length === 3) {
            dateStr = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
          }
        } else if (pattern.source.includes('januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|january|february|march|april|may|june|july|august|september|october|november|december')) {
          // DD Month YYYY format
          const parts = firstMatch.split(' ');
          if (parts.length === 3) {
            const month = months[parts[1].toLowerCase()];
            if (month) {
              dateStr = `${parts[2]}-${month}-${parts[0].padStart(2, '0')}`;
            }
          }
        }
        
        if (dateStr) {
          return { starts_at: dateStr, ends_at: null };
        }
      }
    }
    
    return { starts_at: null, ends_at: null };
  }

  private static isGenericEventPage(url: string, title: string, description: string): boolean {
    const urlLower = url.toLowerCase();
    const titleLower = title.toLowerCase();
    const descLower = description.toLowerCase();
    
    // Generic event calendar patterns (universal exclusions)
    const genericPatterns = [
      'visitberlin', 'songkick', 'eventbrite.de', 'berliner-philharmoniker',
      'event calendar', 'event-calendar', 'concerts', 'festivals',
      'tourism', 'travel', 'sightseeing', 'entertainment',
      'music', 'cultural', 'art', 'museum', 'theater'
    ];
    
    // Check URL patterns
    for (const pattern of genericPatterns) {
      if (urlLower.includes(pattern)) {
        return true;
      }
    }
    
    // Check title patterns
    const genericTitlePatterns = [
      'event calendar', 'concerts', 'festivals', 'tourism',
      'sightseeing', 'entertainment', 'music events',
      'cultural events', 'art events', 'museum events'
    ];
    
    for (const pattern of genericTitlePatterns) {
      if (titleLower.includes(pattern)) {
        return true;
      }
    }
    
    // Check description patterns
    const genericDescPatterns = [
      'concerts in', 'festivals in', 'tourism', 'sightseeing',
      'entertainment', 'cultural events', 'music events',
      'art events', 'museum events', 'theater events',
      'visit berlin', 'berlin events', 'city events'
    ];
    
    for (const pattern of genericDescPatterns) {
      if (descLower.includes(pattern)) {
        return true;
      }
    }
    
    return false;
  }
}

// Export static methods for external use
export const executeSearch = SearchService.executeSearch.bind(SearchService);
export const runEventDiscovery = SearchService.runEventDiscovery.bind(SearchService);
