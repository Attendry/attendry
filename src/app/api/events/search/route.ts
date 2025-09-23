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

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Represents a search result item from Google CSE
 */
interface SearchItem {
  title: string;      // Page title
  link: string;       // URL to the page
  snippet: string;    // Search result snippet/description
}

/**
 * Represents a decision from Gemini AI about whether a search result is an event
 */
interface GeminiDecision {
  index: number;      // Index of the item in the original array
  isEvent: boolean;   // Whether this item represents an actual event
  reason: string;     // AI's reasoning for the decision
}

/**
 * Represents an event item with date information for filtering
 */
interface EventItem {
  starts_at?: string | null;  // Event start date (ISO format)
  ends_at?: string | null;    // Event end date (ISO format)
  title?: string;             // Event title
}

// ============================================================================
// ENHANCED QUERY BUILDING
// ============================================================================

/**
 * Build enhanced search query with multiple strategies for better event discovery
 * 
 * @param userQuery - User's search query
 * @param searchConfig - Search configuration with industry terms
 * @param country - Country code for geographic context
 * @param from - Start date for temporal context
 * @param to - End date for temporal context
 * @returns Enhanced search query string
 */
function buildEnhancedQuery(userQuery: string, searchConfig: any, country: string, from: string, to: string): string {
  // If user provided a specific query, use it as base
  if (userQuery.trim()) {
    return userQuery;
  }
  
  // Build context-aware query based on search configuration
  const industryTerms = searchConfig.industryTerms || [];
  const baseQuery = searchConfig.baseQuery || "";
  
  // Get current year for temporal relevance
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  
  // Build date context
  const dateContext = buildDateContext(from, to, currentYear);
  
  // Build geographic context
  const geoContext = buildGeographicContext(country);
  
  // Combine all elements for maximum relevance
  const queryParts = [
    baseQuery,
    dateContext,
    geoContext,
    `(${industryTerms.slice(0, 3).join(' OR ')})`, // Top 3 industry terms
    `(${currentYear} OR ${nextYear} OR upcoming OR "this year" OR "next year")` // Temporal relevance
  ].filter(Boolean);
  
  return queryParts.join(' ');
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
    'de': '(Germany OR Deutschland OR Berlin OR Munich OR Hamburg OR Frankfurt)',
    'fr': '(France OR Paris OR Lyon OR Marseille OR "en français")',
    'nl': '(Netherlands OR Nederland OR Amsterdam OR Rotterdam OR "in Dutch")',
    'gb': '(UK OR "United Kingdom" OR London OR Manchester OR Birmingham)',
    'es': '(Spain OR España OR Madrid OR Barcelona OR "en español")',
    'it': '(Italy OR Italia OR Rome OR Milan OR "in italiano")',
    'se': '(Sweden OR Sverige OR Stockholm OR Gothenburg OR "på svenska")',
    'pl': '(Poland OR Polska OR Warsaw OR Krakow OR "po polsku")',
    'be': '(Belgium OR Belgique OR Brussels OR "en français" OR "in Dutch")',
    'ch': '(Switzerland OR Schweiz OR Zurich OR Geneva OR "en français" OR "auf Deutsch")'
  };
  
  return countryContexts[country] || '';
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
  return `${q}|${country}|${from}|${to}`;
}

/**
 * Retrieves cached search results if they exist and are still valid.
 * 
 * @param key - Cache key to look up
 * @returns Cached data if valid, null otherwise
 */
function getCachedResult(key: string) {
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
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
    for (const [k, v] of searchCache.entries()) {
      if (now - v.timestamp > CACHE_DURATION) {
        searchCache.delete(k);
      }
    }
  }
  searchCache.set(key, { data, timestamp: Date.now() });
}

// Durable cache helpers (Supabase)
async function readSearchCacheDB(cacheKey: string) {
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("search_cache")
      .select("payload, ttl_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    if (data.ttl_at && new Date(data.ttl_at).getTime() > Date.now()) {
      return data.payload;
    }
    return null;
  } catch {
    return null;
  }
}
async function writeSearchCacheDB(cacheKey: string, provider: string, payload: any) {
  try {
    const supabase = await supabaseServer();
    const ttlAt = new Date(Date.now() + DB_CACHE_TTL_HOURS * 3600 * 1000).toISOString();
    await supabase
      .from("search_cache")
      .upsert({ cache_key: cacheKey, provider, payload, schema_version: 1, ttl_at: ttlAt }, { onConflict: "cache_key" });
  } catch {
    // best-effort
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
async function filterWithGemini(items: SearchItem[], dropTitleRegex: RegExp, banHosts: Set<string>, searchConfig: any = {}): Promise<SearchItem[]> {
  const geminiKey = process.env.GEMINI_API_KEY;
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

  const preApproved: SearchItem[] = [];
  const undecided: { item: SearchItem; idx: number; hash: string }[] = [];
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
  if (!geminiKey) {
    const base = items.filter((item: SearchItem) => {
      const text = `${item.title || ""} ${item.snippet || ""}`;
      
      // Filter out obvious non-events (404 pages, error pages)
      if (dropTitleRegex.test(text)) {
        return false;
      }
      
      // Filter out banned hosts (forums, social media, etc.)
      try {
        const h = new URL(item.link).hostname.toLowerCase();
        if (banHosts.has(h)) {
          return false;
        }
      } catch { 
        return false; // Invalid URLs are filtered out
      }
      
      // Use comprehensive regex to identify event-related content
      // This includes event keywords in multiple languages and date indicators
      const EVENT_HINT_FALLBACK = /\b(agenda|programm|program|anmeldung|register|speakers?|konferenz|kongress|symposium|conference|summit|forum|veranstaltung|event|termin|schedule|meeting|workshop|seminar|training|webinar|exhibition|trade show|expo|convention|gathering|networking|roundtable|panel|keynote|presentation|session|breakout|track|day|2024|2025|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
      const hasEventHint = EVENT_HINT_FALLBACK.test(text);
      return hasEventHint;
    });
    return [...preApproved, ...base];
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const filteredItems: SearchItem[] = preApproved.slice();
    
    // Process items in batches to avoid token limits and improve reliability
    // Gemini has token limits, so we process search results in small batches
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      // Skip batch fully decided
      const needLLMIdx: number[] = [];
      const needLLM: SearchItem[] = [];
      batch.forEach((it, j) => {
        const key = hashItem(it.title, it.link);
        if (decided[key] === undefined) {
          needLLM.push(it);
          needLLMIdx.push(i + j);
        }
      });
      if (needLLM.length === 0) continue;
      
      // Create a detailed prompt for Gemini to analyze each search result
      // The prompt is designed to help the AI distinguish between actual events
      // and general content about topics
      const prompt = `You are an expert at identifying high-quality industry event pages. For each search result, determine if it represents a significant industry event (conference, summit, trade show, exhibition, convention) or just general content/webinars.

CONTEXT: We're searching for ${searchConfig.industry || 'legal-compliance'} industry events. Key terms: ${(searchConfig.industryTerms || []).slice(0, 5).join(', ')}.

IMPORTANT: Return ONLY a valid JSON array. Do not include any markdown formatting, code blocks, or explanatory text.

Return a JSON array with objects containing:
- "index": the original index (0-based)
- "isEvent": boolean - true if this is a significant industry event, false if it's just general content
- "reason": brief explanation of your decision
- "confidence": number between 0-1 indicating your confidence in this decision

Search results to analyze:
${needLLM.map((item, idx) => `${needLLMIdx[idx]}: Title: "${item.title}" | Snippet: "${item.snippet}" | URL: "${item.link}"`).join('\n')}

EXAMPLES OF GOOD EVENTS (mark as true):
✅ "Legal Tech Summit 2025 - Berlin, March 15-17" → Conference with dates and location
✅ "Compliance Forum Europe - Early Bird Registration Open" → Professional event with registration
✅ "E-Discovery Conference & Exhibition - London" → Industry conference with exhibition
✅ "Data Privacy Summit 2025 - Call for Papers" → Academic/professional conference
✅ "RegTech Innovation Forum - Munich, Germany" → Industry-specific event

EXAMPLES OF BAD RESULTS (mark as false):
❌ "Free Webinar: Introduction to Compliance" → Single webinar, not a conference
❌ "Company Training: Legal Updates 2025" → Internal company training
❌ "News: New Compliance Regulations Announced" → News article, not an event
❌ "Legal Advice Forum - General Discussion" → Forum discussion, not an event
❌ "Product Launch: New Legal Software" → Product announcement

PRIORITIZE these event types (mark as true):
- Industry conferences and summits with specific dates and venues
- Trade shows and exhibitions with clear event dates
- Professional conventions with registration information
- Business networking events with venue details
- Multi-day industry gatherings with agendas
- Events with multiple speakers/panels and schedules
- Events with registration fees or tickets
- Academic conferences with call for papers
- Industry forums with multiple sessions

DEPRIORITIZE these (mark as false):
- Single webinars or online seminars
- Free online training sessions
- Company-specific internal events
- General articles about topics
- Product launches or announcements
- News articles or blog posts
- Educational courses or tutorials
- Events without clear dates or venue information
- Past events (2024 or earlier) unless specifically relevant
- Forum discussions or Q&A sessions
- Job postings or career events

Event indicators to look for: specific dates, venues, speakers, agendas, registration, tickets, schedules, multiple sessions, call for papers, early bird pricing

Return ONLY the JSON array, nothing else.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        // Clean the response text
        let cleanText = text.trim();
        
        // Remove markdown code blocks if present
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Remove any leading/trailing text that's not JSON
        const jsonStart = cleanText.indexOf('[');
        const jsonEnd = cleanText.lastIndexOf(']') + 1;
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          cleanText = cleanText.substring(jsonStart, jsonEnd);
        }
        
        
        const decisions: GeminiDecision[] = JSON.parse(cleanText);
        
        // Validate the parsed decisions - ensure we got a proper array
        if (!Array.isArray(decisions)) {
          throw new Error("Response is not an array");
        }
        
        // Process each decision from Gemini
        const upserts: any[] = [];
        for (const decision of decisions) {
          // Validate decision object structure
          if (!decision || typeof decision.index !== 'number' || typeof decision.isEvent !== 'boolean') {
            continue; // Skip invalid decisions
          }
          
          const originalItem = items[decision.index];
          const text = `${originalItem.title || ""} ${originalItem.snippet || ""}`;
          
          // Still apply basic safety filters even for AI-approved items
          // This provides an extra layer of protection against edge cases
          if (dropTitleRegex.test(text)) {
            continue; // Filter out 404/error pages
          }
          
          // Check against banned hosts (forums, social media, etc.)
          try {
            const h = new URL(originalItem.link).hostname.toLowerCase();
            if (banHosts.has(h)) {
              continue; // Filter out banned hosts
            }
          } catch { 
            continue; // Filter out invalid URLs
          }
          
          // If Gemini says it's an event and it passes safety filters, include it
          if (decision.isEvent) {
            filteredItems.push(originalItem);
          }

          // persist decision
          try {
            const supabase = await supabaseServer();
            const h = hashItem(originalItem.title, originalItem.link);
            upserts.push({ item_hash: h, url: originalItem.link, title: originalItem.title, is_event: !!decision.isEvent, confidence: (decision as any).confidence ?? null, schema_version: 1 });
            if (upserts.length >= 10) {
              await supabase.from("ai_decisions").upsert(upserts, { onConflict: "item_hash" });
              upserts.length = 0;
            }
          } catch {}
        }
        if (upserts.length) {
          try { const supabase = await supabaseServer(); await supabase.from("ai_decisions").upsert(upserts, { onConflict: "item_hash" }); } catch {}
        }
      } catch (parseError) {
        // Fallback to regex for this batch when Gemini response parsing fails
        // This ensures we don't lose all results if there's a parsing issue
        const EVENT_HINT_FALLBACK = /\b(agenda|programm|program|anmeldung|register|speakers?|konferenz|kongress|symposium|conference|summit|forum|veranstaltung|event|termin|schedule|meeting|workshop|seminar|training|webinar|exhibition|trade show|expo|convention|gathering|networking|roundtable|panel|keynote|presentation|session|breakout|track|day|2024|2025|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
        for (const item of batch) {
          const text = `${item.title || ""} ${item.snippet || ""}`;
          // Apply regex filtering as fallback
          if (!dropTitleRegex.test(text) && EVENT_HINT_FALLBACK.test(text)) {
            filteredItems.push(item);
          }
        }
      }
    }
    
    return filteredItems;
    
  } catch (error) {
    // Fallback to regex filtering when Gemini API fails completely
    // This ensures the system continues to work even if AI services are down
    const EVENT_HINT_FALLBACK = /\b(agenda|programm|program|anmeldung|register|speakers?|konferenz|kongress|symposium|conference|summit|forum|veranstaltung|event|termin|schedule|meeting|workshop|seminar|training|webinar|exhibition|trade show|expo|convention|gathering|networking|roundtable|panel|keynote|presentation|session|breakout|track|day|2024|2025|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
    return items.filter((item: SearchItem) => {
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
function filterEventsByDate(events: EventItem[], from?: string, to?: string): EventItem[] {
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
export async function POST(req: NextRequest) {
  try {
    // Parse request parameters with defaults
    const { q = "", country = "", from, to, provider = "cse", num = 10 } = await req.json();

    // Check cache first to avoid unnecessary API calls
    const cacheKey = getCacheKey(q, country, from, to);
    const cachedResult = getCachedResult(cacheKey) || await readSearchCacheDB(cacheKey);
    if (cachedResult) {
      console.log(JSON.stringify({ at: "search", cache: "hit", key: cacheKey }));
      return NextResponse.json({ ...cachedResult, cached: true });
    }
    console.log(JSON.stringify({ at: "search", cache: "miss", key: cacheKey }));

    // Load search configuration for enhanced query building
    let searchConfig = { industryTerms: [], baseQuery: "" };
    try {
      const origin = req.nextUrl?.origin || process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
      const configRes = await fetch(`${origin}/api/config/search`);
      if (configRes.ok) {
        const configData = await configRes.json();
        searchConfig = configData.config || searchConfig;
      }
    } catch (error) {
      console.warn('Failed to load search config:', error);
    }

    // Get Google Custom Search Engine API credentials
    const key = process.env.GOOGLE_CSE_KEY;
    const cx  = process.env.GOOGLE_CSE_CX;

    // Fallback to demo data if API keys are not configured
    // This ensures the UI always renders something, even in development
    if (!key || !cx) {
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
        q: "test", key, cx, num: "1", safe: "off", hl: "en", filter: "1"
      });
      const testUrl = `https://www.googleapis.com/customsearch/v1?${testParams}`;
      const testRes = await fetchWithRetry(testUrl, { cache: "no-store", timeoutMs: 8000, retries: 1 });
      
      
      if (testRes.status === 429) {
        // Quota exceeded, use alternative search
        return await alternativeSearch(q, country, from, to, num);
      } else if (testRes.status !== 200) {
        // API error, use alternative search
        return await alternativeSearch(q, country, from, to, num);
      }
      // API test successful, proceeding with real search
    } catch (e) {
      // API test failed, using alternative search
      return await alternativeSearch(q, country, from, to, num);
    }

    // Build enhanced search query with multiple strategies
    const enhancedQuery = buildEnhancedQuery(q || "", searchConfig, country, from, to);
    
    const params = new URLSearchParams({
      q: enhancedQuery, key, cx, num: String(num), safe: "off",
      // explicitly set interface language to stabilize ranking
      hl: "en",
      filter: "1",
    });

    // GEOGRAPHIC FILTERING: Configure country-specific search parameters
    // This helps Google CSE return more relevant results for specific regions
    if (country && CR[country]) {
      params.set("cr", CR[country]);                   // Hard restrict to specific country
      if (GL[country]) params.set("gl", GL[country]);  // Boost geolocation relevance
      if (LR[country]) params.set("lr", LR[country]);  // Bias toward local language
    } else {
      // All-Europe: Restrict to a set of European countries in one shot
      // This is useful when no specific country is requested
      params.set("cr", EU_CR_OR);
      params.set("lr", "lang_en|lang_de|lang_fr|lang_it|lang_es|lang_nl");
      params.set("gl", "de"); // Neutral EU-ish boost (Germany is a good default)
    }

    // DATE FILTERING: Only restrict for PAST windows
    // Note: Google CSE cannot filter future events by page publish time
    // Future date filtering is handled after extraction in the run endpoint
    const dr = buildDateRestrict(from, to);
    if (dr) params.set("dateRestrict", dr);

    // CONTENT FILTERING: Exclude obvious non-event chatter
    // This helps filter out forums, social media, and general discussion sites
    // This will be configurable in future versions
    params.set("excludeTerms", "reddit Mumsnet \"legal advice\" forum");

    // Make the actual search request to Google Custom Search API
    const url = `https://www.googleapis.com/customsearch/v1?${params}`;
    const res = await fetchWithRetry(url, { cache: "no-store", timeoutMs: 10000, retries: 2 });
    const data = await res.json();

    // Transform Google's response into our standardized format
    let items: SearchItem[] = (data.items || []).map((it: any) => ({
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
    ]);

    // Use Gemini AI for intelligent event filtering
    // This provides much more accurate filtering than regex-based approaches
    const filteredItems = await filterWithGemini(items, DROP_TITLE, BAN_HOSTS, searchConfig);

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
    
    return NextResponse.json(result);
  } catch (e: unknown) {
    // Return error response with empty items array
    // We return status 200 to avoid breaking the UI
    return NextResponse.json({ error: (e as Error)?.message || "search failed", items: [] }, { status: 200 });
  }
}