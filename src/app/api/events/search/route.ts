/**
 * Event Search API Route
 * 
 * This endpoint handles event discovery through Google Custom Search Engine (CSE)
 * with intelligent filtering using Google's Gemini AI. It provides a robust search
 * system that can identify real events from general web content.
 * 
 * Key Features:
 * - Google CSE integration for web search
 * - AI-powered event filtering using Gemini
 * - Fallback to regex-based filtering when AI is unavailable
 * - Caching system for performance optimization
 * - Database persistence for search analytics
 * 
 * @author Attendry Team
 * @version 2.0
 */

export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchWithRetry } from "@/lib/http";
import { createHash } from "crypto";
import { GeminiService } from "@/lib/services/gemini-service";
import { 
  EventSearchRequest, 
  EventSearchResponse, 
  ErrorResponse
} from "@/lib/types/api";
import { withCorrelation, ensureCorrelation } from '@/lib/obs/corr';
import { stageCounter, logSuppressedSamples, type Reason } from '@/lib/obs/triage-metrics';
import { EventData, SearchConfig, SearchResultItem } from "@/lib/types/core";

// ============================================================================
// ENHANCED QUERY BUILDING
// ============================================================================

/**
 * Build enhanced search query with multiple strategies for better event discovery
 * 
 * @param userText - User's search query
 * @param searchConfig - Search configuration with industry terms
 * @param country - Country code for geographic context
 * @param from - Start date for temporal context
 * @param to - End date for temporal context
 * @returns Enhanced search query string
 */
function buildEnhancedQuery(userText: string, searchConfig: any, country: string, from: string, to: string): string {
  const industryTerms = searchConfig.industryTerms || [];
  const currentYear = new Date().getFullYear();
  
  // Use user query if provided, otherwise use base query from config
  let query = userText.trim() || searchConfig.baseQuery || 'conference';
  
  // Build comprehensive query using all available terms
  const queryParts: string[] = [];
  queryParts.push(query);
  
  // Add industry terms from search config
  if (industryTerms.length > 0) {
    const filteredTerms = industryTerms
      .filter((term: string) => !query.toLowerCase().includes(term.toLowerCase()))
      .slice(0, 5); // Limit to 5 industry terms
    
    if (filteredTerms.length > 0) {
      queryParts.push(`(${filteredTerms.join(' OR ')})`);
    }
  }
  
  // Add country-specific event terms using localized phrases
  const localizedTerms = buildLocalizedEventLexicon(country);
  if (localizedTerms) {
    queryParts.push(localizedTerms);
  }
  
  // Add year
  queryParts.push(currentYear.toString());
  
  // Combine all parts
  const finalQuery = queryParts.join(' ');
  
  // Limit query length to prevent API errors
  if (finalQuery.length > 200) {
    console.warn('Query too long, truncating:', finalQuery.length);
    return finalQuery.substring(0, 200).trim();
  }
  
  return finalQuery.trim();
}

/**
 * Build date context for search query
 */
function buildDateContext(from: string, to: string, currentYear: number): string {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const now = new Date();
  
  // Determine if this is a future or past search
  const isFuture = fromDate > now;
  const isPast = toDate < now;
  
  if (isFuture) {
    // Future events - emphasize upcoming, registration, early bird
    return '(upcoming OR registration OR "early bird" OR "save the date" OR "call for papers")';
  } else if (isPast) {
    // Past events - emphasize completed, archived, recap
    return '(completed OR archived OR recap OR "event summary" OR "post-event")';
  } else {
    // Current/ongoing events
    return '(ongoing OR "happening now" OR live OR current)';
  }
}

/**
 * Build geographic context for search query
 */
function buildGeographicContext(country: string): string {
  if (!country) return '';
  
  const countryContexts: Record<string, string> = {
    'de': '(Germany OR Deutschland OR Berlin OR München OR Hamburg OR Frankfurt OR Köln OR Düsseldorf)',
    'fr': '(France OR Français OR Paris OR Lyon OR Marseille OR Toulouse OR Bordeaux OR Lille)',
    'nl': '(Netherlands OR Nederland OR Amsterdam OR Rotterdam OR Utrecht OR Eindhoven OR Den Haag)',
    'gb': '(UK OR "United Kingdom" OR Britain OR London OR Manchester OR Birmingham OR Edinburgh)',
    'es': '(Spain OR España OR Madrid OR Barcelona OR Valencia OR Sevilla OR Bilbao)',
    'it': '(Italy OR Italia OR Rome OR Roma OR Milan OR Milano OR Turin OR Napoli)',
    'se': '(Sweden OR Sverige OR Stockholm OR Göteborg OR Malmø OR Uppsala)',
    'pl': '(Poland OR Polska OR Warszawa OR Warsaw OR Kraków OR Wrocław)',
    'be': '(Belgium OR Belgique OR België OR Brussels OR Bruxelles OR Antwerpen)',
    'ch': '(Switzerland OR Schweiz OR Suisse OR Zurich OR Genève OR Basel OR Bern)'
  };
  
  return countryContexts[country] || '';
}

function buildLocalizedEventLexicon(country: string): string {
  const lexicon: Record<string, string> = {
    'de': '(veranstaltung OR konferenz OR kongress OR fachkongress OR workshop OR symposium)',
    'fr': '(événement OR "événement professionnel" OR conférence OR congrès OR salon OR colloque OR atelier OR séminaire OR sommet OR rencontre OR forum)',
    'es': '(evento OR conferencia OR congreso OR "feria" OR seminario OR taller OR encuentro OR foro)',
    'it': '(evento OR conferenza OR congresso OR fiera OR seminario OR workshop OR incontro OR forum)',
    'nl': '(evenement OR conferentie OR congres OR beurs OR seminar OR workshop OR bijeenkomst OR forum)',
    'se': '(evenemang OR konferens OR kongress OR seminarium OR mässa OR workshop OR möte)',
    'pl': '(wydarzenie OR konferencja OR kongres OR targi OR seminarium OR warsztaty OR spotkanie OR forum)',
    'pt': '(evento OR conferência OR congresso OR feira OR seminário OR workshop OR encontro OR fórum)',
    'da': '(begivenhed OR konference OR kongres OR messe OR seminar OR workshop OR møde)',
    'fi': '(tapahtuma OR konferenssi OR kongressi OR messut OR seminaari OR työpaja OR tapaaminen OR foorumi)',
    'no': '(arrangement OR konferanse OR kongress OR messe OR seminar OR workshop OR møte OR forum)'
  };

  return lexicon[country] || '';
}

// ============================================================================
// CACHING SYSTEM
// ============================================================================

/**
 * In-memory cache for search results to improve performance and reduce API calls.
 * 
 * Note: In production, this should be replaced with Redis or a database-backed
 * cache for better scalability and persistence across server restarts.
 */
const searchCache = new Map<string, { data: unknown; timestamp: number }>();
// Expose cache globally for debug endpoints
(global as any).searchCache = searchCache;
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
const DB_CACHE_TTL_HOURS = 6;

/**
 * Generates a unique cache key based on search parameters.
 * This ensures that different search queries are cached separately.
 * 
 * @param q - Search query string
 * @param country - Country filter (e.g., "de", "fr")
 * @param from - Start date for filtering (optional)
 * @param to - End date for filtering (optional)
 * @returns Unique cache key string
 */
function getCacheKey(q: string, country: string, from?: string, to?: string): string {
  // Generate consistent cache key without timestamp to enable proper caching
  return `${q}|${country}|${from || ''}|${to || ''}`;
}

/**
 * Retrieves cached search results if they exist and are still valid.
 * 
 * @param key - Cache key to look up
 * @returns Cached data if valid, null otherwise
 */
function getCachedResult(key: string) {
  const cached = searchCache.get(key);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_DURATION) {
      console.log(JSON.stringify({ at: "cache", hit: true, key, age: Math.round(age / 1000) + 's' }));
      return cached.data;
    } else {
      // Remove expired entry
      searchCache.delete(key);
      console.log(JSON.stringify({ at: "cache", expired: true, key, age: Math.round(age / 1000) + 's' }));
    }
  }
  return null;
}

/**
 * Stores search results in cache with automatic cleanup to prevent memory leaks.
 * 
 * This function implements a simple LRU-style cleanup that removes expired
 * entries when the cache grows beyond 100 items.
 * 
 * @param key - Cache key to store under
 * @param data - Search results data to cache
 */
function setCachedResult(key: string, data: unknown) {
  // Clean up old entries to prevent memory leaks
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
      console.log(JSON.stringify({ at: "cache", cleanup: true, cleaned, remaining: searchCache.size }));
    }
  }
  
  const timestamp = Date.now();
  searchCache.set(key, { data, timestamp });
  console.log(JSON.stringify({ at: "cache", stored: true, key, size: searchCache.size }));
}

// Durable cache helpers (Supabase)
async function readSearchCacheDB(cacheKey: string) {
  const correlationId = ensureCorrelation();
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("search_cache")
      .select("payload, ttl_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    
    if (error) {
      console.log(JSON.stringify({ at: "cache_db", error: error.message, key: cacheKey }));
      return null;
    }
    
    if (!data) {
      return null;
    }
    
    const now = Date.now();
    const ttlTime = new Date(data.ttl_at).getTime();
    
    if (ttlTime > now) {
      const age = Math.round((now - (ttlTime - DB_CACHE_TTL_HOURS * 3600 * 1000)) / 1000);
      console.log(JSON.stringify({ at: "cache_db", hit: true, key: cacheKey, age: age + 's' }));
      return data.payload;
    } else {
      console.log(JSON.stringify({ at: "cache_db", expired: true, key: cacheKey }));
      return null;
    }
  } catch (error) {
    console.log(JSON.stringify({ at: "cache_db", exception: error instanceof Error ? error.message : 'unknown', key: cacheKey }));
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
      console.log(JSON.stringify({ at: "cache_db", write_error: error.message, key: cacheKey }));
    } else {
      console.log(JSON.stringify({ at: "cache_db", stored: true, key: cacheKey, ttl: DB_CACHE_TTL_HOURS + 'h' }));
    }
  } catch (error) {
    console.log(JSON.stringify({ at: "cache_db", write_exception: error instanceof Error ? error.message : 'unknown', key: cacheKey }));
  }
}

function hashItem(title: string, link: string) {
  return createHash("sha256").update(`${(title||"").trim()}|${(link||"").trim()}`).digest("hex");
}

// ============================================================================
// AI-POWERED EVENT FILTERING
// ============================================================================

/**
 * Intelligent event filtering using Google's Gemini AI.
 * 
 * This function uses AI to distinguish between actual events and general content
 * by analyzing search result titles, snippets, and URLs. It provides much more
 * accurate filtering than regex-based approaches.
 * 
 * Process:
 * 1. Check if Gemini API key is available
 * 2. If not, fall back to regex-based filtering
 * 3. If available, send search results to Gemini in batches
 * 4. Parse AI responses and filter results accordingly
 * 5. Apply basic safety filters (404 pages, banned hosts)
 * 
 * @param items - Array of search results to filter
 * @param dropTitleRegex - Regex to identify 404/error pages
 * @param banHosts - Set of banned hostnames (e.g., reddit, forums)
 * @returns Filtered array of search results that are likely events
 */
async function filterWithGemini(items: SearchResultItem[], dropTitleRegex: RegExp, banHosts: Set<string>, searchConfig: any = {}): Promise<SearchResultItem[]> {
  // Attempt to reuse AI decisions from DB
  let decided: Record<string, { isEvent: boolean; confidence?: number }> = {};
  try {
    const supabase = await supabaseServer();
    const hashes = items.map(it => hashItem(it.title, it.link));
    const { data } = await supabase
      .from("ai_decisions")
      .select("item_hash, is_event, confidence")
      .in("item_hash", hashes);
    for (const row of data || []) decided[row.item_hash] = { isEvent: !!row.is_event, confidence: row.confidence };
  } catch {}

  const preApproved: SearchResultItem[] = [];
  const undecided: { item: SearchResultItem; idx: number; hash: string }[] = [];
  items.forEach((item, idx) => {
    const key = hashItem(item.title, item.link);
    if (decided[key]?.isEvent) {
      const text = `${item.title || ""} ${item.snippet || ""}`;
      try {
        const h = new URL(item.link).hostname.toLowerCase();
        if (!banHosts.has(h) && !dropTitleRegex.test(text)) preApproved.push(item);
      } catch {}
    } else if (decided[key] === undefined) {
      undecided.push({ item, idx, hash: key });
    }
  });

  // Fallback to regex filtering when Gemini API key is not available
  if (!process.env.GEMINI_API_KEY) {
    return items.filter((item: SearchResultItem) => {
      const text = `${item.title || ""} ${item.snippet || ""}`;

      if (dropTitleRegex.test(text)) {
        return false;
      }

      try {
        const h = new URL(item.link).hostname.toLowerCase();
        if (banHosts.has(h)) {
          return false;
        }
      } catch {
        return false;
      }

      // Keep softer criteria: allow if we see any event signal OR a known location token;
      // otherwise allow marketing/landing pages so later stages can judge.
      const EVENT_HINT_FALLBACK = /\b(agenda|programm|program|anmeldung|register|speakers?|konferenz|kongress|symposium|conference|summit|forum|veranstaltung|event|termin|schedule|meeting|workshop|seminar|training|webinar|exhibition|trade show|expo|convention|gathering|networking|roundtable|panel|keynote|presentation|session|breakout|track|day|2024|2025|2026|2027|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
      if (EVENT_HINT_FALLBACK.test(text)) {
        return true;
      }

      const LOCATION_HINT = /\b(germany|deutschland|berlin|münchen|munich|frankfurt|hamburg|köln|cologne|stuttgart|düsseldorf|leipzig|paris|brussels|vienna|zurich|amsterdam|europe)\b/i;
      if (LOCATION_HINT.test(text)) {
        return true;
      }

      // Let remaining pages pass through for downstream filtering
      return true;
    });
  }

  try {
    // Use the new Gemini service with retry logic
    const result = await GeminiService.filterWithGemini({
      items,
      dropTitleRegex,
      banHosts,
      searchConfig
    });

    // Store new decisions in the database for future reuse
    const upserts: any[] = [];
    for (const decision of result.decisions) {
      const originalItem = items[decision.index];
      const itemHash = hashItem(originalItem.title, originalItem.link);
      upserts.push({
        item_hash: itemHash,
        is_event: decision.isEvent,
        confidence: 0.8, // Default confidence for Gemini decisions
        reason: decision.reason || "AI decision",
        created_at: new Date().toISOString()
      });
    }
    
    if (upserts.length) {
      try { 
        const supabase = await supabaseServer(); 
        await supabase.from("ai_decisions").upsert(upserts, { onConflict: "item_hash" }); 
      } catch {}
    }

    return result.filteredItems;
    
  } catch (error) {
    console.error("Gemini filtering failed, falling back to regex:", error);
    
    // Fallback to regex filtering when Gemini API fails completely
    // This ensures the system continues to work even if AI services are down
    const EVENT_HINT_FALLBACK = /\b(agenda|programm|program|anmeldung|register|speakers?|konferenz|kongress|symposium|conference|summit|forum|veranstaltung|event|termin|schedule|meeting|workshop|seminar|training|webinar|exhibition|trade show|expo|convention|gathering|networking|roundtable|panel|keynote|presentation|session|breakout|track|day|2024|2025|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
    return items.filter((item: SearchResultItem) => {
      const text = `${item.title || ""} ${item.snippet || ""}`;
      if (dropTitleRegex.test(text)) return false;
      try {
        const h = new URL(item.link).hostname.toLowerCase();
        if (banHosts.has(h)) return false;
      } catch { return false; }
      return EVENT_HINT_FALLBACK.test(text);
    });
  }
}

// Save search results to database for persistence
// ============================================================================
// DATABASE PERSISTENCE
// ============================================================================

/**
 * Save search results to database for persistence and analytics.
 * 
 * This function stores search sessions and their results in the database
 * for later analysis, caching, and user experience improvements.
 * 
 * @param query - The search query that was executed
 * @param country - Country filter that was applied
 * @param results - Array of search results to store
 * @param provider - Search provider used (e.g., "cse", "demo")
 */
async function saveSearchResults(query: string, country: string, results: unknown[], provider: string) {
  try {
    const supabase = await supabaseServer();
    
    // Create a search session record
    const { data: sessionData, error: sessionError } = await supabase
      .from("search_sessions")
      .insert({
        query,
        country,
        provider,
        result_count: results.length,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (sessionError) {
      console.warn("Failed to save search session:", sessionError);
      return;
    }
    
    // Save individual search results
    if (results.length > 0) {
      const searchResults = results.map((result: any) => ({
        session_id: sessionData.id,
        title: result.title,
        url: result.link,
        snippet: result.snippet,
        created_at: new Date().toISOString()
      }));
      
      const { error: resultsError } = await supabase
        .from("search_results")
        .insert(searchResults);
      
      if (resultsError) {
        console.warn("Failed to save search results:", resultsError);
      }
    }
  } catch (e) {
    console.warn("Failed to save search results to database:", e);
  }
}

// ============================================================================
// FALLBACK SEARCH SYSTEM
// ============================================================================

/**
 * Alternative search using enhanced demo data with realistic events.
 * 
 * This function provides fallback search results when the Google CSE API
 * is unavailable, quota is exceeded, or API keys are not configured.
 * It generates realistic event data based on the search parameters.
 * 
 * @param q - Search query string
 * @param country - Country filter (e.g., "de", "fr")
 * @param from - Start date for filtering (optional)
 * @param to - End date for filtering (optional)
 * @param num - Number of results to return (default: 10)
 * @returns Array of realistic demo events
 */
async function alternativeSearch(q: string, country: string, from?: string, to?: string, num: number = 10) {
  try {
    // Generate realistic event data based on search parameters
    const baseEvents = [
      { title: "Legal Tech Conference 2025", link: "https://legaltechconf.com/2025", snippet: "London • Mar 15-16 • Legal technology and innovation" },
      { title: "Data Privacy Summit Europe", link: "https://dataprivacysummit.eu", snippet: "Amsterdam • Apr 8-9 • GDPR compliance and data protection" },
      { title: "Regulatory Compliance Forum", link: "https://regcompliance.eu", snippet: "Frankfurt • May 12 • Financial services compliance" },
      { title: "Investigations & eDiscovery Summit", link: "https://investigations-summit.com", snippet: "Paris • Jun 18-19 • Digital forensics and investigations" },
      { title: "ESG & Sustainability Conference", link: "https://esg-conference.eu", snippet: "Berlin • Jul 22-23 • Environmental, social, and governance" },
      { title: "Cybersecurity & Risk Management", link: "https://cyber-risk.eu", snippet: "Brussels • Aug 14-15 • Information security and risk" },
      { title: "Anti-Money Laundering Forum", link: "https://aml-forum.eu", snippet: "Vienna • Sep 9-10 • AML compliance and financial crime" },
      { title: "Corporate Governance Summit", link: "https://corpgov-summit.eu", snippet: "Zurich • Oct 7-8 • Board governance and oversight" },
      { title: "RegTech Innovation Conference", link: "https://regtech-innovation.eu", snippet: "Dublin • Nov 12-13 • Regulatory technology solutions" },
      { title: "Compliance & Ethics Forum", link: "https://compliance-ethics.eu", snippet: "Copenhagen • Dec 5-6 • Corporate ethics and compliance" },
    ];
    
    // Filter events based on search query
    let filteredEvents = baseEvents;
    if (q && q.trim()) {
      const queryLower = q.toLowerCase();
      filteredEvents = baseEvents.filter(event => 
        event.title.toLowerCase().includes(queryLower) ||
        event.snippet.toLowerCase().includes(queryLower)
      );
    }
    
    // Filter by country if specified
    if (country && country !== "Europe") {
      const countryMap: Record<string, string[]> = {
        "de": ["Berlin", "Frankfurt", "Munich"],
        "fr": ["Paris"],
        "nl": ["Amsterdam"],
        "gb": ["London"],
        "es": ["Madrid", "Barcelona"],
        "it": ["Milan", "Rome"],
        "ch": ["Zurich", "Geneva"],
        "at": ["Vienna"],
        "ie": ["Dublin"],
        "dk": ["Copenhagen"],
        "be": ["Brussels"],
        "pl": ["Warsaw"],
        "se": ["Stockholm"],
        "no": ["Oslo"],
        "pt": ["Lisbon"],
        "cz": ["Prague"]
      };
      
      const countryCities = countryMap[country.toLowerCase()] || [];
      if (countryCities.length > 0) {
        filteredEvents = filteredEvents.filter(event =>
          countryCities.some(city => event.snippet.includes(city))
        );
      }
    }
    
    // Limit results
    const results = filteredEvents.slice(0, num);
    
    return NextResponse.json({ 
      provider: "enhanced_demo", 
      items: results,
      note: `Using enhanced demo data (${results.length} events found) - Google CSE quota exceeded`
    });
    
  } catch (e) {
    // Final fallback to basic demo data
    return NextResponse.json({
      provider: "demo",
      items: [
        { title: "Demo Compliance Summit", link: "https://example.com/demo1", snippet: "Berlin • Oct 12–13" },
        { title: "Investigations Forum Europe", link: "https://example.com/demo2", snippet: "Paris • Oct 9" },
        { title: "Legal Tech Conference 2025", link: "https://example.com/demo3", snippet: "London • Mar 15-16" },
        { title: "Data Privacy Summit", link: "https://example.com/demo4", snippet: "Amsterdam • Apr 8-9" },
        { title: "Regulatory Compliance Forum", link: "https://example.com/demo5", snippet: "Frankfurt • May 12" },
      ],
      note: "Basic demo data - Google CSE quota exceeded and alternative search failed"
    });
  }
}

// map country code -> names (UI) remains if you need it, but here we care about cr/gl/lr
const CR: Record<string, string> = {
  de: "countryDE",
  fr: "countryFR",
  nl: "countryNL",
  gb: "countryUK", // per Google table, UK uses countryUK
  es: "countryES",
  it: "countryIT",
  se: "countrySE",
  pl: "countryPL",
  be: "countryBE",
  ch: "countryCH",
};

const GL: Record<string, string> = {
  de: "de", fr: "fr", nl: "nl", gb: "uk", es: "es", it: "it", se: "se", pl: "pl", be: "be", ch: "ch",
};

const LR: Record<string, string> = {
  // bias to local language + English (keeps intl pages)
  de: "lang_de|lang_en",
  fr: "lang_fr|lang_en",
  nl: "lang_nl|lang_en",
  gb: "lang_en",
  es: "lang_es|lang_en",
  it: "lang_it|lang_en",
  se: "lang_sv|lang_en",
  pl: "lang_pl|lang_en",
  be: "lang_fr|lang_nl|lang_en",
  ch: "lang_de|lang_fr|lang_it|lang_en",
};

// "All Europe": OR a handful of European countries in one request via cr
const EU_CR_OR =
  [
    "countryDE","countryFR","countryNL","countryUK","countryES","countryIT",
    "countrySE","countryPL","countryBE","countryCH","countryAT","countryIE",
    "countryDK","countryFI","countryNO","countryPT","countryCZ"
  ].join("|");

// keep obvious junk out
const BAN_HOSTS = new Set([
  "reddit.com","www.reddit.com",
  "mumsnet.com","www.mumsnet.com",
]);

/**
 * Check if a date range represents a past window.
 * 
 * @param from - Start date string (ISO format yyyy-mm-dd)
 * @param to - End date string (ISO format yyyy-mm-dd)
 * @returns True if the date range is in the past
 */
function isPastWindow(from?: string, to?: string) {
  if (!from || !to) return false;
  const today = new Date().toISOString().slice(0,10);
  return to < today; // both ISO yyyy-mm-dd
}

/**
 * Build Google CSE date restriction parameter.
 * 
 * Google CSE can only filter by page publish date, not event date.
 * This function creates the appropriate date restriction for past searches.
 * 
 * @param from - Start date string (ISO format yyyy-mm-dd)
 * @param to - End date string (ISO format yyyy-mm-dd)
 * @returns Google CSE date restriction string or null
 */
function buildDateRestrict(from?: string, to?: string) {
  if (!isPastWindow(from, to)) return null; // don't attempt "future" filtering
  // rough sizing: clamp to w1 for past 7 days; loosen if window is larger
  try {
    const dFrom = new Date(from!);
    const dTo   = new Date(to!);
    const days = Math.max(1, Math.round((+dTo - +dFrom) / 86400000) + 1);
    if (days <= 7) return "w1";    // Past week
    if (days <= 31) return "m1";   // Past month
    if (days <= 93) return "m3";   // Past 3 months
    return "y1";                   // Past year
  } catch {
    return "w1"; // Default to past week on error
  }
}

/**
 * Filter events by date range after extraction.
 * 
 * This function is used to filter events by their actual event dates
 * after they have been extracted from web pages. This is necessary
 * because Google CSE cannot filter by event dates, only page publish dates.
 * 
 * @param events - Array of events to filter
 * @param from - Start date for filtering (optional)
 * @param to - End date for filtering (optional)
 * @returns Filtered array of events within the date range
 */
function filterEventsByDate(events: EventData[], from?: string, to?: string): EventData[] {
  if (!from && !to) return events;
  
  const today = new Date();
  const fromDate = from ? new Date(from) : today;
  const toDate = to ? new Date(to) : new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
  
  return events.filter(event => {
    if (!event.starts_at) return true; // Keep events without dates
    
    const eventDate = new Date(event.starts_at);
    return eventDate >= fromDate && eventDate <= toDate;
  });
}

// ============================================================================
// MAIN API ENDPOINT
// ============================================================================

/**
 * POST /api/events/search
 * 
 * Main endpoint for searching events using Google Custom Search Engine.
 * 
 * Request Body:
 * - q: Search query string (optional, defaults to "")
 * - country: Country code for filtering (optional, defaults to "")
 * - from: Start date for filtering (optional)
 * - to: End date for filtering (optional)
 * - provider: Search provider (optional, defaults to "cse")
 * - num: Number of results to return (optional, defaults to 10)
 * 
 * Response:
 * - provider: Search provider used
 * - items: Array of filtered search results
 * - cached: Boolean indicating if result was from cache
 * 
 * @param req - Next.js request object
 * @returns JSON response with search results
 */
export async function POST(req: NextRequest): Promise<NextResponse<EventSearchResponse | ErrorResponse>> {
  return withCorrelation(async () => {
    const correlationId = ensureCorrelation();
    try {
    // Parse request parameters with defaults
    const requestData: EventSearchRequest = await req.json();
    const { 
      q = "", 
      country = "", 
      from, 
      to, 
      provider = "cse", 
      num = 10, 
      rerank = false, 
      topK = 50 
    } = requestData;

    // Check cache first to avoid unnecessary API calls
    const cacheKey = getCacheKey(q, country, from, to);
    const cachedResult = getCachedResult(cacheKey) || await readSearchCacheDB(cacheKey);
    if (cachedResult) {
      console.log(JSON.stringify({ correlationId, at: "search", cache: "hit", key: cacheKey }));
      stageCounter('cache', [], [], [{ key: 'cache_hit', count: 1, samples: [cacheKey] }]);
      return NextResponse.json({ ...cachedResult, cached: true });
    }
    console.log(JSON.stringify({ correlationId, at: "search", cache: "miss", key: cacheKey }));

    // Load search configuration for enhanced query building
    let searchConfig = { industryTerms: [], baseQuery: "", excludeTerms: "" } as any;
    try {
      const origin = req.nextUrl?.origin || process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:4000";
      const configRes = await fetch(new URL('/api/config/search', origin).toString(), { headers: { Cookie: req.headers.get('cookie') || '' } });
      if (configRes.ok) {
        const configData = await configRes.json();
        const c = configData.config || {};
        // prefer camelCase but fall back to snake_case
        searchConfig = {
          baseQuery: c.baseQuery || c.base_query || "",
          industryTerms: c.industryTerms || c.industry_terms || [],
          excludeTerms: c.excludeTerms || c.exclude_terms || "",
          industry: c.industry || c.industry
        };
      }
    } catch (error) {
      console.warn('Failed to load search config:', error);
    }

    // Get Google Custom Search Engine API credentials
    const key = process.env.GOOGLE_CSE_KEY;

    // Fallback to demo data if API keys are not configured
    // This ensures the UI always renders something, even in development
    if (!key) {
      return NextResponse.json({
        provider: "demo",
        items: [
          { title: "Demo Compliance Summit", link: "https://example.com/demo1", snippet: "Berlin • Oct 12–13" },
          { title: "Investigations Forum Europe", link: "https://example.com/demo2", snippet: "Paris • Oct 9" },
        ],
      });
    }

    // Test Google API availability before making the real search
    // This helps us fail fast and use alternative search if needed
    // We make a small test call to check quota and API status
    try {
      const testParams = new URLSearchParams({
        q: "test", key, num: "1", safe: "off", hl: "en", filter: "1"
      });
      const testUrl = `https://www.googleapis.com/customsearch/v1?${testParams}`;
      console.log(JSON.stringify({ at: "search", test: "calling_cse_test", url: testUrl }));
      const testRes = await fetchWithRetry(testUrl, { cache: "no-store", timeoutMs: 8000, retries: 1 });
      console.log(JSON.stringify({ at: "search", test: "cse_test_result", status: testRes.status }));
      
      if (testRes.status === 429) {
        // Quota exceeded, use alternative search
        console.log(JSON.stringify({ at: "search", test: "quota_exceeded", fallback: "alternative" }));
        return await alternativeSearch(q, country, from, to, num);
      } else if (testRes.status !== 200) {
        // API error, use alternative search
        console.log(JSON.stringify({ at: "search", test: "api_error", status: testRes.status, fallback: "alternative" }));
        return await alternativeSearch(q, country, from, to, num);
      }
      // API test successful, proceeding with real search
      console.log(JSON.stringify({ at: "search", test: "success", proceeding: "real_search" }));
    } catch (e) {
      // API test failed, using alternative search
      console.log(JSON.stringify({ at: "search", test: "exception", error: e instanceof Error ? e.message : "unknown", fallback: "alternative" }));
      return await alternativeSearch(q, country, from, to, num);
    }

    // Build enhanced search query with multiple strategies
    const enhancedQuery = buildEnhancedQuery(q || "", searchConfig, country, from, to);
    
    // Clean up the query to avoid 400 errors
    const cleanQuery = enhancedQuery
      .replace(/\\"/g, '"')  // Fix escaped quotes
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();
    
    console.log(JSON.stringify({ at: "search", query_cleanup: { original: enhancedQuery, cleaned: cleanQuery } }));
    
    const params = new URLSearchParams({
      q: cleanQuery, key, num: String(Math.max(num, rerank ? Math.min(50, topK || 50) : num)), safe: "off",
      // explicitly set interface language to stabilize ranking
      hl: "en",
      filter: "1", // Required for this CSE configuration
    });

    const geoContext = buildGeographicContext(country);
    if (geoContext && !cleanQuery.includes(geoContext)) {
      params.append("hq", geoContext);
    }
    if (country) {
      params.append("gl", country.toUpperCase());
      params.append("cr", `country${country.toUpperCase()}`);
    }

    // DATE FILTERING: Only restrict for PAST windows
    // Note: Google CSE cannot filter future events by page publish time
    // Future date filtering is handled after extraction in the run endpoint
    const dr = buildDateRestrict(from, to);
    if (dr) params.set("dateRestrict", dr);

    // CONTENT FILTERING: TEMPORARILY DISABLED
    // excludeTerms might be causing 400 errors
    // params.set("excludeTerms", searchConfig.excludeTerms || "reddit Mumsnet \"legal advice\" forum");

    // Make the actual search request to Google Custom Search API
    const url = `https://www.googleapis.com/customsearch/v1?${params}`;
    console.log(JSON.stringify({ at: "search", real: "calling_cse", query: enhancedQuery, url: url }));
    const res = await fetchWithRetry(url, { cache: "no-store", timeoutMs: 10000, retries: 2, service: 'google_cse', operation: 'events_search' });
    const data = await res.json();
    const rawItems = data.items || [];
    console.log(JSON.stringify({ correlationId, at: "search", real: "cse_result", status: res.status, items: rawItems.length }));
    stageCounter('provider:cse', [], rawItems, [{ key: 'returned', count: rawItems.length, samples: rawItems.slice(0,3) }]);

    // Transform Google's response into our standardized format
    let items: SearchResultItem[] = rawItems.map((it: any) => ({
      title: it.title || "", 
      link: it.link || "", 
      snippet: it.snippet || ""
    }));

    // ============================================================================
    // INTELLIGENT FILTERING SYSTEM
    // ============================================================================

    // Define filtering patterns for event identification
    // This regex identifies pages that are likely to contain event information
    const EVENT_HINT = /\b(agenda|programm|program|anmeldung|register|speakers?|konferenz|kongress|symposium|conference|summit|forum|veranstaltung|event|termin|schedule|meeting|workshop|seminar|training|webinar|exhibition|trade show|expo|convention|gathering|networking|roundtable|panel|keynote|presentation|session|breakout|track|day|2024|2025|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

    // Define patterns to identify and filter out error pages
    const DROP_TITLE = /\b(404|page not found|fehler 404|not found)\b/i;
    
    // Define banned hosts that typically don't contain event information
    // This includes forums, social media, and general discussion sites
    const BAN_HOSTS = new Set([
      "reddit.com","www.reddit.com",
      "mumsnet.com","www.mumsnet.com",
      "instagram.com","www.instagram.com",
      "facebook.com","www.facebook.com",
      "twitter.com","www.twitter.com","x.com","www.x.com",
      "linkedin.com","www.linkedin.com",
      "youtube.com","www.youtube.com",
      "tiktok.com","www.tiktok.com"
    ]);

    const beforeFilterCount = items.length;
    const dropReasons: Reason[] = [];
    const collectDrop = (key: string, sample: SearchResultItem) => {
      let entry = dropReasons.find(r => r.key === key);
      if (!entry) {
        entry = { key, count: 0, samples: [] };
        dropReasons.push(entry);
      }
      entry.count += 1;
      entry.samples.push(sample);
    };

    // Use Gemini AI for intelligent event filtering
    // This provides much more accurate filtering than regex-based approaches
    let filteredItems = await filterWithGemini(items, DROP_TITLE, BAN_HOSTS, searchConfig);
    const droppedCount = beforeFilterCount - filteredItems.length;
    if (droppedCount > 0) {
      collectDrop('gemini_filtered', items.find(item => !filteredItems.includes(item)) || items[0] || { title: '', link: '', snippet: '' });
    }
    stageCounter('filter:gemini', items, filteredItems, dropReasons);
    logSuppressedSamples('filter:gemini', dropReasons);

    // Optional: rerank topK using Gemini context if requested
    if (rerank && filteredItems.length > 0 && process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const rankedPrompt = `Rerank these URLs by likelihood of being high-quality industry event pages (conferences/summits/trade shows) for ${searchConfig.industry || 'legal-compliance'}. Return a JSON array of indices in best-to-worst order.\n\nItems:\n${filteredItems.map((it, i) => `${i}: ${it.title} | ${it.link} | ${it.snippet}`).join('\n')}\n\nReturn ONLY a JSON array of indices.`;
        const result = await model.generateContent(rankedPrompt);
        let text = (await result.response).text().trim();
        if (text.startsWith('```')) text = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/,'');
        const order: number[] = JSON.parse(text);
        const seen = new Set<number>();
        const reranked: SearchResultItem[] = [];
        for (const idx of order) {
          if (typeof idx === 'number' && idx >=0 && idx < filteredItems.length && !seen.has(idx)) {
            seen.add(idx);
            reranked.push(filteredItems[idx]);
          }
        }
        // append any not included
        for (let i = 0; i < filteredItems.length; i++) if (!seen.has(i)) reranked.push(filteredItems[i]);
        filteredItems = reranked.slice(0, Math.min(topK || 50, 50));
      } catch {}
    }

    items = filteredItems;

    // Prepare the final response
    const result = { provider: "cse", items };
    
    // Cache the result for future requests
    setCachedResult(cacheKey, result);
    writeSearchCacheDB(cacheKey, "cse", result).catch(() => {});
    
    // Save to database for persistence and analytics
    // Note: We don't await this to avoid slowing down the response
    // The database save happens asynchronously in the background
    saveSearchResults(q, country, items, "cse").catch(error => {
      // Log error but don't fail the request
      console.error("Failed to save search results:", error);
    });
    
    stageCounter('response', filteredItems, filteredItems, [{ key: 'final', count: filteredItems.length, samples: filteredItems.slice(0,3) }]);
    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error(JSON.stringify({ correlationId, at: 'search_error', error: e instanceof Error ? e.message : String(e) }));
    // Return error response with empty items array
    // We return status 200 to avoid breaking the UI
    return NextResponse.json({ error: (e as Error)?.message || "search failed", items: [] }, { status: 200 });
  }
  });
}