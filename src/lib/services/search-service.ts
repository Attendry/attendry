import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchWithRetry } from "@/lib/http";
import { RetryService } from "./retry-service";
import { FirecrawlSearchService } from "./firecrawl-search-service";

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
  starts_at?: string | null;
  ends_at?: string | null;
  city?: string | null;
  country?: string | null;
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
    if (query.length > 500) {
      console.warn('Query too long, truncating:', query.length);
      query = query.substring(0, 500).trim();
    }
    
    return query;
  }

  /**
   * Execute search with Firecrawl primary and Google CSE fallback
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
    // Try Firecrawl Search first with user configuration
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
        return firecrawlResult;
      }
    } catch (error) {
      console.warn('Firecrawl Search failed, falling back to Google CSE:', error);
    }

    // Fallback to Google CSE
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

    // Build enhanced query - ultra simplified to avoid Google CSE 400 errors
    let enhancedQuery = q;
    
    // Use localized base query based on country
    let simpleBaseQuery = "conference 2025";
    if (country === "de") {
      simpleBaseQuery = "(veranstaltung OR konferenz OR kongress OR workshop OR panel) deutschland 2025";
    } else if (country === "fr") {
      simpleBaseQuery = "(conférence OR congrès OR atelier OR panel) france 2025";
    } else if (country === "nl") {
      simpleBaseQuery = "(conferentie OR congres OR workshop OR panel) nederland 2025";
    }
    
    if (!q.trim()) {
      enhancedQuery = simpleBaseQuery;
    } else if (q.trim()) {
      // Use simple space separation instead of AND to avoid issues
      enhancedQuery = `${q} ${simpleBaseQuery}`;
    }

    // Limit query length to prevent 400 errors
    if (enhancedQuery.length > 200) {
      console.warn('Query too long, truncating to prevent 400 error:', enhancedQuery.length);
      enhancedQuery = enhancedQuery.substring(0, 200);
    }

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

    const result = {
      provider: "cse",
      items: filteredItems,
      cached: false
    };

    // Cache the result
    setCachedResult(cacheKey, result);
    await writeSearchCacheDB(cacheKey, "cse", result);

    return result;
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
              waitFor: 2000,
              blockAds: true,
              removeBase64Images: true,
              timeout: 30000
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
    const maxAttempts = 60; // 60 seconds max
    const pollInterval = 2000; // 2 second intervals
    
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
    const enhancedEvents = await this.enhanceEventsWithGemini(events, extractData);

    return {
      events: enhancedEvents,
      version: "firecrawl_v2_polled_gemini",
      trace: []
    };
  }

  /**
   * Enhance events with Gemini API for speaker extraction
   */
  private static async enhanceEventsWithGemini(events: EventRec[], extractData: any): Promise<EventRec[]> {
    const geminiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiKey || events.length === 0) {
      return events;
    }

    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genai = new GoogleGenerativeAI(geminiKey);
      const model = genai.getGenerativeModel({ model: "gemini-1.5-pro" });

      // Collect all markdown content for processing
      const markdownContent: string[] = [];
      if (extractData.data) {
        const rawData = Array.isArray(extractData.data) ? extractData.data : [extractData.data];
        for (const data of rawData) {
          if (data?.markdown) {
            markdownContent.push(data.markdown);
          }
        }
      }

      if (markdownContent.length === 0) {
        return events;
      }

      const prompt = `You are an expert at extracting speaker information from event content. Analyze the following event content and extract all speakers, presenters, panelists, and keynotes.

For each speaker found, return:
- name: Full name (first and last name)
- org: Organization/company they work for
- title: Job title or role (if mentioned)
- speech_title: Title of their presentation/speech (if mentioned)
- session: Session name or track (if mentioned)

Look for sections with these labels in multiple languages:
English: Speakers, Presenters, Panelists, Keynotes, Moderators, Hosts, Faculty, Instructors
German: Referenten, Referent:innen, Sprecher, Vortragende, Mitwirkende, Moderatoren, Gastgeber
French: Conférenciers, Présentateurs, Panélistes, Intervenants, Modérateurs
Spanish: Ponentes, Presentadores, Panelistas, Oradores, Moderadores
Italian: Relatori, Presentatori, Panelisti, Ospiti, Moderatori
Dutch: Sprekers, Presentatoren, Panelleden, Gasten, Moderators

Also check: Agenda, Program, Schedule, Programme, Fachprogramm, Programme détaillé

IMPORTANT: 
- Only extract people who are clearly identified as speakers/presenters
- Do not invent names or information
- Skip generic entries like "TBA", "To be announced", "Speaker TBD"
- Focus on real people with actual names and organizations
- If a person appears multiple times, include them only once with the most complete information

Return a JSON array of speaker objects. If no speakers are found, return an empty array.`;

      const response = await model.generateContent(`${prompt}\n\nContent to analyze:\n${markdownContent.join('\n\n---\n\n')}`);
      const text = response.response.text();
      
      if (!text) return events;

      // Clean and parse the response
      let cleanText = text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const jsonStart = cleanText.indexOf('[');
      const jsonEnd = cleanText.lastIndexOf(']') + 1;
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        cleanText = cleanText.substring(jsonStart, jsonEnd);
      }
      
      const speakers = JSON.parse(cleanText);
      if (!Array.isArray(speakers)) return events;

      // Add speakers to the first event (or distribute among events if multiple)
      const enhancedEvents = [...events];
      if (enhancedEvents.length > 0 && speakers.length > 0) {
        enhancedEvents[0].speakers = speakers;
        enhancedEvents[0].confidence = Math.min((enhancedEvents[0].confidence || 0.5) + 0.2, 1.0);
      }

      return enhancedEvents;
    } catch (error) {
      console.warn('Gemini speaker enhancement failed:', error);
      return events;
    }
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
   * Run the complete event discovery pipeline
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
    extract: any;
    deduped: any;
  }> {
    const { q = "", country = "", from, to, provider = "cse" } = params;

    // Step 1: Load search configuration
    const searchConfig = await this.loadSearchConfig();

    // Step 2: Build effective query - ultra simplified to avoid Google CSE 400 errors
    let effectiveQ = q;
    
    // Use ultra simple base query to avoid 400 errors
    const simpleBaseQuery = "conference 2025";
    
    if (!q.trim()) {
      effectiveQ = simpleBaseQuery;
    } else if (q.trim()) {
      // Use simple space separation instead of AND to avoid issues
      effectiveQ = `${q} ${simpleBaseQuery}`;
    }

    // Limit query length to prevent 400 errors
    if (effectiveQ.length > 200) {
      console.warn('Query too long, truncating to prevent 400 error:', effectiveQ.length);
      effectiveQ = effectiveQ.substring(0, 200);
    }

    // Step 3: Execute search
    const search = await this.executeSearch({
      q: effectiveQ,
      country,
      from,
      to,
      num: 50,
      rerank: true,
      topK: 50
    });

    // Step 4: Extract events from URLs
    const urls = search.items.map(item => item.link);
    const extract = await this.extractEvents(urls);

    // Step 5: Process and deduplicate events
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

    // Step 6: Filter by country and date (simplified)
    const filteredEvents = events.filter(event => {
      // Basic country filtering
      if (country && event.country && event.country.toLowerCase() !== country.toLowerCase()) {
        return false;
      }
      return true;
    });

    return {
      events: filteredEvents,
      search: {
        status: 200,
        provider: search.provider,
        items: search.items
      },
      extract: {
        status: 200,
        version: extract.version,
        eventsBeforeFilter: extract.events.length,
        sampleTrace: extract.trace.slice(0, 3)
      },
      deduped: {
        count: filteredEvents.length
      }
    };
  }
}
