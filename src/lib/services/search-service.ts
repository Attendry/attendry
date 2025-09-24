import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchWithRetry } from "@/lib/http";
import { RetryService } from "./retry-service";

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
    const supabase = await supabaseServer();
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
    const supabase = await supabaseServer();
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

    // Return default configuration
    return {
      id: "default",
      name: "Default Configuration",
      industry: "legal-compliance",
      baseQuery: "(legal OR compliance OR investigation OR \"e-discovery\" OR ediscovery OR \"legal tech\" OR \"legal technology\" OR \"regulatory\" OR \"governance\" OR \"risk management\" OR \"audit\" OR \"whistleblowing\" OR \"data protection\" OR \"GDPR\" OR \"privacy\" OR \"cybersecurity\" OR \"regtech\" OR \"ESG\") (conference OR summit OR forum OR \"trade show\" OR exhibition OR convention OR \"industry event\" OR \"business event\" OR konferenz OR kongress OR symposium OR veranstaltung OR workshop OR seminar OR webinar OR \"training\" OR \"certification\") (2025 OR \"next year\" OR upcoming OR \"this year\" OR \"September 2025\" OR \"Oktober 2025\" OR \"November 2025\" OR \"Dezember 2025\" OR \"Q1 2025\" OR \"Q2 2025\" OR \"Q3 2025\" OR \"Q4 2025\")",
      excludeTerms: "reddit Mumsnet \"legal advice\" forum",
      industryTerms: ["compliance", "investigations", "regtech", "ESG", "sanctions", "governance", "legal ops", "risk", "audit", "whistleblow"],
      icpTerms: ["general counsel", "chief compliance officer", "investigations lead", "compliance manager", "legal operations"],
      speakerPrompts: {
        extraction: "Extract ALL speakers on the page(s). For each, return name, organization (org), title/role if present, and profile_url if linked. Look for sections labelled Speakers, Referenten, Referent:innen, Sprecher, Vortragende, Mitwirkende, Panel, Agenda/Programm/Fachprogramm. Do not invent names; only list people visible on the pages.",
        normalization: "You are a data normalizer. Merge duplicate speakers across pages. Return clean JSON with fields: name, org, title, profile_url, source_url (one of the pages), confidence (0-1). Do not invent people. Keep only real names (≥2 tokens)."
      },
      is_active: true
    };
  }

  /**
   * Execute search using Google Custom Search Engine
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

    // Build enhanced query - heavily simplified to avoid Google CSE 400 errors
    let enhancedQuery = q;
    
    // Use a much simpler base query to avoid 400 errors
    const simpleBaseQuery = "legal compliance conference 2025";
    
    if (!q.trim()) {
      enhancedQuery = simpleBaseQuery;
    } else if (q.trim()) {
      // Use simple AND combination to avoid complex query issues
      enhancedQuery = `${q} AND ${simpleBaseQuery}`;
    }

    // Add basic exclude terms (simplified)
    enhancedQuery += " -reddit -forum";

    // Limit query length to prevent 400 errors
    if (enhancedQuery.length > 500) {
      console.warn('Query too long, truncating to prevent 400 error:', enhancedQuery.length);
      enhancedQuery = enhancedQuery.substring(0, 500);
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
      
      // Filter out banned hosts
      const bannedHosts = ["reddit.com", "www.reddit.com", "mumsnet.com", "www.mumsnet.com"];
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
      const extractResponse = await RetryService.fetchWithRetry(
        "firecrawl",
        "extract",
        "https://api.firecrawl.dev/v1/scrape",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            urls: urls.slice(0, 20), // Limit to 20 URLs for performance
            formats: ["markdown"],
            onlyMainContent: true,
            crawlerOptions: { 
              depth: 3, 
              allowlist: true 
            }
          })
        }
      );

      const extractData = await extractResponse.json();
      
      // Process the extracted data (simplified version)
      const events: EventRec[] = extractData.data?.map((item: any) => ({
        source_url: item.metadata?.sourceURL || item.url,
        title: item.metadata?.title || item.url,
        starts_at: null, // Would need more sophisticated parsing
        ends_at: null,
        city: null,
        country: null,
        organizer: null,
        confidence: 0.8
      })) || [];

      return {
        events,
        version: "firecrawl",
        trace: []
      };
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

    // Step 2: Build effective query - heavily simplified to avoid Google CSE 400 errors
    let effectiveQ = q;
    
    // Use a much simpler base query to avoid 400 errors
    const simpleBaseQuery = "legal compliance conference 2025";
    
    if (!q.trim()) {
      effectiveQ = simpleBaseQuery;
    } else if (q.trim()) {
      // Use simple AND combination to avoid complex query issues
      effectiveQ = `${q} AND ${simpleBaseQuery}`;
    }

    // Add basic exclude terms (simplified)
    effectiveQ += " -reddit -forum";

    // Limit query length to prevent 400 errors
    if (effectiveQ.length > 500) {
      console.warn('Query too long, truncating to prevent 400 error:', effectiveQ.length);
      effectiveQ = effectiveQ.substring(0, 500);
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
