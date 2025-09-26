import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchWithRetry } from "@/lib/http";
import { RetryService } from "./retry-service";
import { FirecrawlSearchService } from "./firecrawl-search-service";
import { GeminiService } from "./gemini-service";
import { BatchGeminiService } from "./batch-gemini-service";
import { TokenBudgetService } from "./token-budget-service";

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
  speakerPrompts: {
    extraction: string;
    normalization: string;
  };
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
  speakers?: { name: string; org?: string; title?: string }[] | null;
  sponsors?: string[] | null;
  confidence?: number | null;
}

// Cache management
const searchCache = new Map<string, { data: unknown; timestamp: number }>();
(global as any).searchCache = searchCache;
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
const DB_CACHE_TTL_HOURS = 6;

function getCacheKey(q: string, country: string, from?: string, to?: string): string {
  return `${q}|${country}|${from || ''}|${to || ''}`;
}

function getCachedResult(key: string) {
  const cached = searchCache.get(key);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_DURATION) {
      console.log(JSON.stringify({ at: "search_service_cache", hit: true, key, age: Math.round(age / 1000) + 's' }));
      return cached.data;
    } else {
      searchCache.delete(key);
      console.log(JSON.stringify({ at: "search_service_cache", expired: true, key, age: Math.round(age / 1000) + 's' }));
    }
  }
  return null;
}

function setCachedResult(key: string, data: unknown) {
  if (searchCache.size > 100) {
    const now = Date.now();
    let cleaned = 0;
    for (const [k, v] of searchCache.entries()) {
      if (now - v.timestamp > CACHE_DURATION) {
        searchCache.delete(k);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(JSON.stringify({ at: "search_service_cache", cleanup: true, cleaned, remaining: searchCache.size }));
    }
  }
  
  const timestamp = Date.now();
  searchCache.set(key, { data, timestamp });
  console.log(JSON.stringify({ at: "search_service_cache", stored: true, key, size: searchCache.size }));
}

async function readSearchCacheDB(cacheKey: string) {
  try {
    const supabase = supabaseAdmin(); // Use admin client to bypass RLS
    const { data, error } = await supabase
      .from("search_cache")
      .select("payload, ttl_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    
    if (error) {
      console.log(JSON.stringify({ at: "search_service_cache_db", error: error.message, key: cacheKey }));
      return null;
    }
    
    if (!data) {
      return null;
    }
    
    const now = Date.now();
    const ttlTime = new Date(data.ttl_at).getTime();
    
    if (ttlTime > now) {
      const age = Math.round((now - (ttlTime - DB_CACHE_TTL_HOURS * 3600 * 1000)) / 1000);
      console.log(JSON.stringify({ at: "search_service_cache_db", hit: true, key: cacheKey, age: age + 's' }));
      return data.payload;
    } else {
      console.log(JSON.stringify({ at: "search_service_cache_db", expired: true, key: cacheKey }));
      return null;
    }
  } catch (error) {
    console.log(JSON.stringify({ at: "search_service_cache_db", exception: error instanceof Error ? error.message : 'unknown', key: cacheKey }));
    return null;
  }
}

async function writeSearchCacheDB(cacheKey: string, provider: string, payload: any) {
  try {
    const supabase = supabaseAdmin(); // Use admin client to bypass RLS
    const ttlAt = new Date(Date.now() + DB_CACHE_TTL_HOURS * 3600 * 1000).toISOString();
    const { error } = await supabase
      .from("search_cache")
      .upsert({ cache_key: cacheKey, provider, payload, schema_version: 1, ttl_at: ttlAt }, { onConflict: "cache_key" });
    
    if (error) {
      console.log(JSON.stringify({ at: "search_service_cache_db", write_error: error.message, key: cacheKey }));
    } else {
      console.log(JSON.stringify({ at: "search_service_cache_db", stored: true, key: cacheKey, ttl: DB_CACHE_TTL_HOURS + 'h' }));
    }
  } catch (error) {
    console.log(JSON.stringify({ at: "search_service_cache_db", write_exception: error instanceof Error ? error.message : 'unknown', key: cacheKey }));
  }
}

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
          speakerPrompts: data.speaker_prompts || {
            extraction: "",
            normalization: ""
          },
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
      speakerPrompts: {
        extraction: "Extract ALL speakers on the page(s). For each, return name, organization (org), title/role if present, and profile_url if linked. Look for sections labelled Speakers, Referenten, Referent:innen, Sprecher, Vortragende, Mitwirkende, Panel, Agenda/Programm/Fachprogramm. Do not invent names; only list people visible on the pages.",
        normalization: "You are a data normalizer. Merge duplicate speakers across pages. Return clean JSON with fields: name, org, title, profile_url, source_url (one of the pages), confidence (0-1). Do not invent people. Keep only real names (≥2 tokens)."
      },
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
    let query = baseQuery.trim();
    
    // If no base query, use a simple default
    if (!query) {
      query = "conference";
    }
    
    // Build comprehensive query using all available terms
    const queryParts: string[] = [];
    
    // Start with base query
    queryParts.push(query);
    
    // Add industry terms from search config
    if (searchConfig?.industryTerms && searchConfig.industryTerms.length > 0) {
      const industryTerms = searchConfig.industryTerms
        .filter((term: string) => !query.toLowerCase().includes(term.toLowerCase()))
        .slice(0, 5); // Limit to 5 industry terms
      
      if (industryTerms.length > 0) {
        queryParts.push(`(${industryTerms.join(' OR ')})`);
      }
    }
    
    // Add user profile terms if available and enabled
    if (userProfile?.use_in_basic_search !== false) {
      // Add user's industry terms
      if (userProfile.industry_terms && userProfile.industry_terms.length > 0) {
        const userIndustryTerms = userProfile.industry_terms
          .filter((term: string) => !query.toLowerCase().includes(term.toLowerCase()))
          .slice(0, 3); // Limit to 3 user industry terms
        
        if (userIndustryTerms.length > 0) {
          queryParts.push(`(${userIndustryTerms.join(' OR ')})`);
        }
      }
      
      // Add user's ICP terms
      if (userProfile.icp_terms && userProfile.icp_terms.length > 0) {
        const icpTerms = userProfile.icp_terms
          .filter((term: string) => !query.toLowerCase().includes(term.toLowerCase()))
          .slice(0, 3); // Limit to 3 ICP terms
        
        if (icpTerms.length > 0) {
          queryParts.push(`(${icpTerms.join(' OR ')})`);
        }
      }
      
      // Add competitors (as positive terms to find related events)
      if (userProfile.competitors && userProfile.competitors.length > 0) {
        const competitors = userProfile.competitors
          .filter((term: string) => !query.toLowerCase().includes(term.toLowerCase()))
          .slice(0, 2); // Limit to 2 competitors
        
        if (competitors.length > 0) {
          queryParts.push(`(${competitors.join(' OR ')})`);
        }
      }
    }
    
    // Combine all parts
    query = queryParts.join(' ');
    
    // Add German event keywords for German searches
    if (country === 'de') {
      const germanEventKeywords = ['veranstaltung', 'kongress', 'konferenz'];
      const hasGermanKeywords = germanEventKeywords.some(keyword => 
        query.toLowerCase().includes(keyword)
      );
      
      if (!hasGermanKeywords) {
        query = `${query} veranstaltung`;
      }
    } else {
      // Add English event keyword if not present
      if (!query.toLowerCase().includes('conference') && !query.toLowerCase().includes('event')) {
        query = `${query} conference`;
      }
    }
    
    // Clean up the query and limit length
    query = query
      .replace(/\s+/g, ' ') // Clean up multiple spaces
      .trim();
    
    // Limit query length to prevent API errors but allow comprehensive queries
    if (query.length > 1000) {
      console.warn('Query too long, truncating:', query.length);
      // Try to truncate at word boundaries to avoid cutting off words
      const truncated = query.substring(0, 1000);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 800) { // Only use word boundary if it's not too far back
        query = truncated.substring(0, lastSpace).trim();
      } else {
        query = truncated.trim();
      }
    }
    
    return query;
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
    let query = baseQuery.trim();
    
    // If no base query, use a simple default
    if (!query) {
      query = "conference";
    }
    
    // Simplify query building to avoid Google CSE 400 errors
    // Use space-separated terms instead of complex OR clauses
    
    // Add key industry terms (max 3 to avoid complexity)
    if (searchConfig?.industryTerms && searchConfig.industryTerms.length > 0) {
      const keyTerms = searchConfig.industryTerms
        .filter((term: string) => !query.toLowerCase().includes(term.toLowerCase()))
        .slice(0, 3); // Limit to 3 key terms
      
      if (keyTerms.length > 0) {
        query = `${query} ${keyTerms.join(' ')}`;
      }
    }
    
    // Add user profile terms (max 2 to avoid complexity)
    if (userProfile?.use_in_basic_search !== false) {
      if (userProfile.industry_terms && userProfile.industry_terms.length > 0) {
        const userTerms = userProfile.industry_terms
          .filter((term: string) => !query.toLowerCase().includes(term.toLowerCase()))
          .slice(0, 2); // Limit to 2 user terms
        
        if (userTerms.length > 0) {
          query = `${query} ${userTerms.join(' ')}`;
        }
      }
    }
    
    // Add country-specific event keywords
    if (country === 'de') {
      if (!query.toLowerCase().includes('veranstaltung')) {
        query = `${query} veranstaltung`;
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
    
    // Add current year
    const currentYear = new Date().getFullYear();
    if (!query.includes(currentYear.toString())) {
      query = `${query} ${currentYear}`;
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
    }

    // Step 2: Try Firecrawl Search with user configuration
    try {
      console.log(JSON.stringify({ at: "search_service", provider: "firecrawl", attempt: "primary" }));
      
      // Load user configuration to enhance search
      const searchConfig = await this.loadSearchConfig();
      const userProfile = await this.loadUserProfile().catch(error => {
        console.warn('Failed to load user profile, continuing without user-specific enhancements:', error.message);
        return null;
      });
      
      // Build enhanced query using user configuration
      const enhancedQuery = this.buildEnhancedQuery(params.q, searchConfig, userProfile, params.country);
      
      const firecrawlResult = await FirecrawlSearchService.searchEvents({
        query: enhancedQuery,
        country: params.country,
        from: params.from,
        to: params.to,
        industry: searchConfig?.industry || "legal-compliance",
        maxResults: params.num || 20
      });
      
      if (firecrawlResult.items.length > 0) {
        console.log(JSON.stringify({ at: "search_service", provider: "firecrawl", success: true, items: firecrawlResult.items.length }));
        
        // NEW: Add Gemini prioritization before returning results
        try {
          console.log(JSON.stringify({ at: "search_service", step: "gemini_prioritization", items: firecrawlResult.items.length }));
          const prioritization = await this.prioritizeUrlsWithGemini(firecrawlResult.items, searchConfig, params.country);
          
          // Return only prioritized URLs as search items
          const prioritizedItems = firecrawlResult.items.filter(item => 
            prioritization.prioritizedUrls.includes(item.link)
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
          console.warn('Gemini prioritization failed, returning all results:', error.message);
          return firecrawlResult;
        }
      }
    } catch (error) {
      console.warn('Firecrawl Search failed, falling back to Google CSE:', error);
    }

    // Step 3: Fallback to Google CSE
    console.log(JSON.stringify({ at: "search_service", provider: "google_cse", attempt: "fallback" }));
    return await this.executeGoogleCSESearch(params);
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
    const cacheKey = getCacheKey(q, country, from, to);
    const cachedResult = getCachedResult(cacheKey) || await readSearchCacheDB(cacheKey);
    if (cachedResult) {
      console.log(JSON.stringify({ at: "search_service", cache: "hit", key: cacheKey }));
      return { ...cachedResult, cached: true };
    }
    console.log(JSON.stringify({ at: "search_service", cache: "miss", key: cacheKey }));

    // Load search configuration
    const searchConfig = await this.loadSearchConfig();

    // Get API credentials
    const key = process.env.GOOGLE_CSE_KEY;
    const cx = process.env.GOOGLE_CSE_CX;

    if (!key || !cx) {
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
      
      setCachedResult(cacheKey, result);
      await writeSearchCacheDB(cacheKey, "demo", result);
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
      cx,
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
    
    const res = await RetryService.fetchWithRetry(
      "google_cse",
      "search",
      url,
      { cache: "no-store" }
    );
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

    // Apply Gemini prioritization to Google CSE results as well
    let finalItems = filteredItems;
    try {
      console.log(JSON.stringify({ at: "search_service", step: "gemini_prioritization_cse", items: filteredItems.length }));
      const prioritization = await this.prioritizeUrlsWithGemini(filteredItems, searchConfig, country);
      
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

    const result = {
      provider: "cse",
      items: finalItems,
      cached: false
    };

    // Cache the result
    setCachedResult(cacheKey, result);
    await writeSearchCacheDB(cacheKey, "cse", result);

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
        speakers: event.speakers // Include existing speakers
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
        
        if (batchResultItem && batchResultItem.success && batchResultItem.speakers.length > 0) {
          event.speakers = batchResultItem.speakers;
          stats.speakersFound += batchResultItem.speakers.length;
          stats.enhanced++;
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
        const prompt = `Extract speaker information from this event description. Look for:
        - Speaker names
        - Their organizations/companies
        - Job titles/roles
        - Session titles or topics they're speaking about
        
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
        events: urls.slice(0, 10).map(url => ({
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
              onlyMainContent: true,
              waitFor: 500, // Further reduced from 1000ms
              blockAds: true,
              removeBase64Images: true,
              timeout: 10000 // Further reduced from 15000ms
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
    const maxAttempts = 10; // 10 seconds max (further reduced from 20)
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
          starts_at: event.eventDate || null,
          ends_at: null, // Would need more sophisticated parsing for end dates
          city: event.location || null,
          country: null, // Would need more sophisticated parsing
          organizer: event.organizer || null,
          venue: event.venue || null,
          speakers: event.speakers || null,
          confidence: 0.8
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

    // If still no events extracted, create minimal events with better titles
    if (events.length === 0) {
      console.log('No events extracted from any method, creating minimal events from URLs');
      events.push(...urls.slice(0, 10).map(url => ({
        source_url: url,
        title: this.extractTitleFromUrl(url),
        starts_at: null,
        ends_at: null,
        city: null,
        country: null,
        organizer: null,
      })));
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
        .slice(0, 5) // Limit to 5 URLs for fallback (reduced from 8)
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
    const prioritization = await this.prioritizeUrlsWithGemini(
      search.items,
      searchConfig,
      country
    );

    // Step 6: Extract events from prioritized URLs only
    const extract = await this.extractEvents(prioritization.prioritizedUrls);

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
      
      // Basic country filtering
      if (country && event.country && event.country.toLowerCase() !== country.toLowerCase()) {
        return false;
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
        total: prioritization.prioritizationStats.total,
        selected: prioritization.prioritizationStats.prioritized,
        reasons: prioritization.prioritizationStats.reasons.slice(0, 5) // Show top 5 reasons
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
}
