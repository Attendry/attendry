/**
 * Event Run API Route
 * 
 * This endpoint orchestrates the complete event discovery and extraction pipeline.
 * It coordinates between search, extraction, and filtering to provide comprehensive
 * event data to the frontend.
 * 
 * Pipeline Flow:
 * 1. Load search configuration based on user profile
 * 2. Execute search using the search endpoint
 * 3. Extract detailed event information from URLs
 * 4. Filter events by country and date
 * 5. Return processed events with metadata
 * 
 * Key Features:
 * - User profile-based search configuration
 * - Multi-step event processing pipeline
 * - Comprehensive filtering and validation
 * - Debug information for troubleshooting
 * 
 * @author Attendry Team
 * @version 2.0
 */

export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

type EventRec = {
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
};

const DROP_TITLE = /\b(404|page not found|nicht gefunden|fehler\s*404)\b/i;

const DE_CITIES = new Set([
  "Berlin","München","Munich","Hamburg","Köln","Cologne","Frankfurt","Stuttgart","Düsseldorf",
  "Leipzig","Bremen","Dresden","Hannover","Nürnberg","Nuremberg","Heidelberg","Freiburg",
  "Aachen","Bonn","Münster","Mainz","Wiesbaden"
]);

function tldCountry(u: string): string | null {
  try {
    const tld = new URL(u).hostname.split(".").pop()!.toLowerCase();
    const m: Record<string,string> = {
      de:"Germany", fr:"France", nl:"Netherlands", it:"Italy", es:"Spain", be:"Belgium",
      ch:"Switzerland", at:"Austria", uk:"United Kingdom", gb:"United Kingdom",
      se:"Sweden", pl:"Poland", pt:"Portugal", cz:"Czechia", dk:"Denmark", fi:"Finland", ie:"Ireland"
    };
    return m[tld] || null;
  } catch { return null; }
}

// Keep items that match the selected country, with sensible fallbacks.
function postExtractFilter(events: any[], country: string) {
  if (!country) return { kept: events, reasons: { kept: events.length } };

  const want = country.toLowerCase(); // e.g. "de"
  const wantName = { de: "Germany", fr:"France", nl:"Netherlands", it:"Italy", es:"Spain",
                     be:"Belgium", ch:"Switzerland", at:"Austria", uk:"United Kingdom",
                     gb:"United Kingdom", se:"Sweden", pl:"Poland", pt:"Portugal",
                     cz:"Czechia", dk:"Denmark", fi:"Finland", ie:"Ireland" }[want];

  const reasons: Record<string, number> = { kept:0, wrongCountry:0, ambiguous:0 };

  const kept = events.filter((e) => {
    // explicit country match
    if (e.country && wantName && e.country === wantName) { reasons.kept++; return true; }

    // city-based acceptance (Germany selection only here)
    if (want === "de" && e.city && DE_CITIES.has(e.city)) { reasons.kept++; return true; }

    // TLD-based fallback
    const tld = tldCountry(e.source_url);
    if (tld && wantName && tld === wantName) { reasons.kept++; return true; }

    // otherwise drop
    if (e.country || e.city || tld) reasons.wrongCountry = (reasons.wrongCountry||0) + 1;
    else reasons.ambiguous = (reasons.ambiguous||0) + 1;
    return false;
  });

  return { kept, reasons };
}

function sanitizeEvents(arr: any[]) {
  const out: any[] = [];
  for (const e of arr) {
    // drop obvious 404s
    if (e.title && DROP_TITLE.test(e.title)) continue;

    // backfill country from TLD if missing
    if (!e.country) {
      const c = tldCountry(e.source_url);
      if (c) e.country = c;
    }

    // trim datetimes to date if needed
    if (e.starts_at && typeof e.starts_at === "string") e.starts_at = e.starts_at.slice(0,10);
    if (e.ends_at && typeof e.ends_at === "string") e.ends_at = e.ends_at.slice(0,10);

    out.push(e);
  }
  return out;
}

const EU: Record<string, string> = {
  "": "", de: "Germany", fr: "France", nl: "Netherlands", gb: "United Kingdom",
  es: "Spain", it: "Italy", se: "Sweden", pl: "Poland", be: "Belgium", ch: "Switzerland",
};

function inRange(iso: string | null | undefined, from: string, to: string) {
  if (!iso) return true; // keep if no date - let other filters handle quality
  const x = new Date(iso).getTime();
  const a = new Date(from + "T00:00:00Z").getTime();
  const b = new Date(to + "T23:59:59Z").getTime();
  return x >= a && x <= b;
}

// Load search configuration
async function loadSearchConfig(origin: string, headers: HeadersInit) {
  const defaults = {
    baseQuery: '(conference OR summit OR forum OR congress OR symposium OR "industry event" OR "annual meeting") (legal OR compliance OR investigation OR "e-discovery" OR ediscovery)',
    excludeTerms: 'reddit Mumsnet "legal advice" forum',
    industryTerms: ['compliance', 'investigations', 'regtech', 'ESG', 'sanctions'],
    icpTerms: ['general counsel', 'chief compliance officer', 'investigations lead']
  };
  try {
    const abs = new URL('/api/config/search', origin).toString();
    const res = await fetch(abs, { cache: 'no-store', headers });
    const data = await res.json().catch(() => ({}));
    const c = data?.config || {};
    return {
      baseQuery: c.baseQuery || c.base_query || defaults.baseQuery,
      excludeTerms: c.excludeTerms || c.exclude_terms || defaults.excludeTerms,
      industryTerms: c.industryTerms || c.industry_terms || defaults.industryTerms,
      icpTerms: c.icpTerms || c.icp_terms || defaults.icpTerms,
      industry: c.industry || 'general'
    };
  } catch (error) {
    console.warn('Failed to load search config, using defaults:', error);
    return defaults as any;
  }
}

function normalizeUrl(u: string) {
  try {
    const url = new URL(u);
    url.hash = "";
    url.search = "";
    let path = url.pathname.replace(/\/+$/, "");
    if (!path) path = "/";
    return `${url.hostname.toLowerCase()}${path}`;
  } catch { return u; }
}
function normalizeTitle(t?: string | null) {
  return (t || "").toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, "").trim();
}
function dedupeEvents(arr: any[]) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const e of arr) {
    const key = `${normalizeUrl(e.source_url)}|${normalizeTitle(e.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/**
 * POST /api/events/run
 * 
 * Main endpoint for running the complete event discovery pipeline.
 * 
 * Request Body:
 * - q: Search query string (optional, defaults to "")
 * - country: Country code for filtering (optional, defaults to "")
 * - from: Start date for filtering (required)
 * - to: End date for filtering (required)
 * - provider: Search provider (optional, defaults to "cse")
 * 
 * Response:
 * - events: Array of processed event objects
 * - debug: Debug information for troubleshooting
 * - error: Error message if something went wrong
 * 
 * @param req - Next.js request object
 * @returns JSON response with processed events
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request parameters with validation
    const { q = "", country = "", from, to, provider = "cse" } = await req.json();
    const debugEnabled = req.nextUrl?.searchParams?.get("debug") === "1" || process.env.NODE_ENV !== 'production';
    if (!from || !to) return NextResponse.json({ error: "from/to required", events: [] }, { status: 400 });
    
    // Build absolute URLs for internal API calls
    // This ensures the API calls work correctly regardless of deployment environment
    const origin = req.nextUrl?.origin || process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:4000";
    const url = (p: string) => new URL(p, origin).toString();
    const forwardHeaders: HeadersInit = {
      Cookie: req.headers.get('cookie') || ''
    };
    const authHeader = req.headers.get('authorization');
    if (authHeader) (forwardHeaders as any).Authorization = authHeader;

    // Initialize debug object for troubleshooting and monitoring
    const debug: any = debugEnabled ? { marker: "RUN_V4", country, provider } : {};

    // ============================================================================
    // STEP 1: LOAD SEARCH CONFIGURATION
    // ============================================================================
    
    // Load search configuration based on user profile and industry settings
    const searchConfig = await loadSearchConfig(origin, forwardHeaders);
    if (debugEnabled) debug.searchConfig = { industry: searchConfig.industry, baseQuery: searchConfig.baseQuery };

    // ============================================================================
    // STEP 2: GET USER PROFILE FOR PERSONALIZED SEARCH
    // ============================================================================
    
    // Attempt to get authenticated user for personalized search (tolerate missing Supabase)
    let supabase: any = null;
    try {
      supabase = await supabaseServer();
    } catch {
      supabase = null;
    }
    let uid: string | null = null;
    if (supabase) {
      try {
        const auth: any = (supabase as any)?.auth;
        if (auth && typeof auth.getUser === "function") {
          const { data } = await auth.getUser();
          uid = data?.user?.id ?? null;
        }
      } catch {
        // No session or mismatched versions; proceed without profile bias
        uid = null;
      }
    }

    let profile: any = null;
    if (uid && supabase) {
      const { data } = await supabase
        .from("user_profiles")
        .select("competitors, icp_terms, industry_terms, use_in_basic_search")
        .eq("owner", uid)
        .maybeSingle();
      profile = data;
    }

    const base = (q || "").trim() || searchConfig.baseQuery;
    let effectiveQ = base;

    if (profile?.use_in_basic_search !== false) {
      const comp = (profile?.competitors || []).slice(0, 8).map((s: string) => `"${s}"`).join(" OR ");
      const terms = [...(profile?.icp_terms || []), ...(profile?.industry_terms || [])]
        .slice(0, 12)
        .join(" OR ");
      const blocks = [comp && `(${comp})`, terms && `(${terms})`].filter(Boolean).join(" OR ");
      if (blocks) effectiveQ = `${effectiveQ} (${blocks})`;
    }

    if (debugEnabled) debug.effectiveQ = effectiveQ;

    // ============================================================================
    // STEP 3: EXECUTE SEARCH WITH FALLBACK STRATEGY
    // ============================================================================
    
    // Helper function to call the search endpoint
    async function doSearch(query: string) {
      const res = await fetch(url("/api/events/search"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...forwardHeaders },
        cache: "no-store",
        body: JSON.stringify({ q: query, country, from, to, provider, num: 50, rerank: true, topK: 50 }),
      });
      const json = await res.json().catch(() => ({}));
      const items: { title: string; link: string }[] = json.items || [];
      return { status: res.status, provider: json.provider, items };
    }

    // Execute search with personalized query
    let search = await doSearch(effectiveQ);
    
    // Fallback strategy: if personalized search returns no results,
    // retry with base query to avoid over-narrowing
    if ((search.items?.length || 0) === 0 && effectiveQ !== searchConfig.baseQuery) {
      const retryQ = searchConfig.baseQuery;
      search = await doSearch(retryQ);
      if (debugEnabled) { debug.searchRetriedWithBase = true; debug.effectiveQ = retryQ; }
    }
    
    // Additional fallback: try with broader industry terms if still few results
    if ((search.items?.length || 0) < 5) {
      const industryTerms = searchConfig.industryTerms || [];
      const broaderQuery = `(${industryTerms.slice(0, 5).join(' OR ')}) (conference OR summit OR forum OR event OR veranstaltung) (2025 OR upcoming)`;
      const broaderResult = await doSearch(broaderQuery);
      if (debugEnabled) debug.broader = { query: broaderQuery, status: broaderResult.status, items: broaderResult.items.length };
      if (broaderResult.items.length > 0) {
        // Merge results, avoiding duplicates
        const existingUrls = new Set(search.items.map(item => item.link));
        const newItems = broaderResult.items.filter(item => !existingUrls.has(item.link));
        search.items = [...search.items, ...newItems];
      }
    }
    
    if (debugEnabled) debug.search = { status: search.status, provider: search.provider, items: search.items.length };

    // ============================================================================
    // STEP 4: PREPARE URLS FOR EXTRACTION
    // ============================================================================
    
    // Extract unique URLs from search results
    let urls = Array.from(new Set(search.items.map(i => i.link)));
    
    // If no URLs found, seed with demo URLs to ensure extraction has something to process
    if (urls.length === 0) {
      urls = ["https://example.com/demo1", "https://example.com/demo2"];
      debug.seededDemoUrls = true;
    }
    if (debugEnabled) debug.urls = { unique: urls.length, sample: urls.slice(0, 3) };

    // ============================================================================
    // STEP 5: EXTRACT DETAILED EVENT INFORMATION
    // ============================================================================
    
    // Call the extraction endpoint to get detailed event information from URLs
    const extractRes = await fetch(url("/api/events/extract"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...forwardHeaders },
      cache: "no-store",
      body: JSON.stringify({ urls: urls.slice(0, 20), locale: country || "", crawl: { depth: 3, allowlist: true } }), // Limit to 20 URLs for performance
    });
    const extractJson = await extractRes.json().catch(() => ({}));
    let { events = [], version: extractVersion, trace = [] } = extractJson;
    if (debugEnabled) debug.extract = { status: extractRes.status, version: extractVersion, eventsBeforeFilter: events.length, sampleTrace: trace.slice(0,3) };
    events = events as EventRec[];

    // if extraction failed hard, synthesize minimal events from search items
    if (events.length === 0 && search.items.length > 0) {
      events = search.items.slice(0, 10).map((it) => ({
        source_url: it.link,
        title: it.title || it.link,
        starts_at: null,
        ends_at: null,
        city: null,
        country: null,
        organizer: null,
      }));
      debug.synthesizedFromSearch = true;
    }

    // ============================================================================
    // STEP 6: DATA CLEANUP AND DEDUPLICATION
    // ============================================================================
    
    // Remove duplicate events based on URL and title
    events = dedupeEvents(events);
    
    // Sanitize events (remove 404s, backfill countries, normalize dates)
    events = sanitizeEvents(events);
    if (debugEnabled) debug.deduped = { count: events.length };

    // ============================================================================
    // STEP 7: FILTER BY COUNTRY AND DATE
    // ============================================================================
    
    // Apply country-based filtering
    const { kept, reasons } = postExtractFilter(events, country);
    events = kept;
    const undatedCandidates: EventRec[] = [];
    
    // Determine if we should allow undated items (demo/minimal extraction modes)
    const allowUndated = !!(debug as any)?.synthesizedFromSearch ||
      (typeof (search as any)?.provider === 'string' && (((search as any).provider || '').includes('demo')) ) ||
      (typeof (extractJson as any)?.note === 'string' && (extractJson as any).note.includes('no FIRECRAWL_KEY'));

    // Apply date range filtering
    if (debugEnabled) debug.dateFiltering = { from, to, beforeCount: events.length, allowUndated };
    const toleranceDays = 7;
    const toleranceMs = toleranceDays * 24 * 60 * 60 * 1000;
    const rangeStartMs = new Date(from + "T00:00:00Z").getTime();
    const rangeEndMs = new Date(to + "T23:59:59Z").getTime();
    events = events.filter((e: EventRec) => {
      // If no dates, keep the event when relaxed modes are active
      if (!e.starts_at && !e.ends_at) {
        if (allowUndated) return true;
        undatedCandidates.push(e);
        if (debugEnabled) { debug.filteredOut = debug.filteredOut || []; debug.filteredOut.push({ reason: 'no_dates', title: e.title }); }
        return false;
      }
      
      // If only start date, check if it's in range
      if (e.starts_at && !e.ends_at) {
        const startMs = new Date(e.starts_at).getTime();
        const isInRange = startMs >= (rangeStartMs - toleranceMs) && startMs <= (rangeEndMs + toleranceMs);
        if (!isInRange) {
          if (debugEnabled) { debug.filteredOut = debug.filteredOut || []; debug.filteredOut.push({ reason: 'start_date_out_of_range', title: e.title, starts_at: e.starts_at }); }
        }
        return isInRange;
      }
      
      // If only end date, check if it's in range
      if (!e.starts_at && e.ends_at) {
        const endMs = new Date(e.ends_at).getTime();
        const isInRange = endMs >= (rangeStartMs - toleranceMs) && endMs <= (rangeEndMs + toleranceMs);
        if (!isInRange) {
          if (debugEnabled) { debug.filteredOut = debug.filteredOut || []; debug.filteredOut.push({ reason: 'end_date_out_of_range', title: e.title, ends_at: e.ends_at }); }
        }
        return isInRange;
      }
      
      // If both dates exist, check if the event overlaps with the requested range
      if (e.starts_at && e.ends_at) {
        const eventStart = new Date(e.starts_at).getTime();
        const eventEnd = new Date(e.ends_at).getTime();
        const rangeStart = rangeStartMs - toleranceMs;
        const rangeEnd = rangeEndMs + toleranceMs;
        
        // Event overlaps if: event starts before range ends AND event ends after range starts
        const overlaps = eventStart <= rangeEnd && eventEnd >= rangeStart;
        if (!overlaps) {
          if (debugEnabled) { debug.filteredOut = debug.filteredOut || []; debug.filteredOut.push({ 
            reason: 'event_outside_range', 
            title: e.title, 
            starts_at: e.starts_at, 
            ends_at: e.ends_at,
            eventStart: new Date(eventStart).toISOString(),
            eventEnd: new Date(eventEnd).toISOString(),
            rangeStart: new Date(rangeStart).toISOString(),
            rangeEnd: new Date(rangeEnd).toISOString()
          }); }
        }
        return overlaps;
      }
      
      return false;
    });
    if (debugEnabled) debug.dateFiltering.afterCount = events.length;
    if (events.length === 0 && undatedCandidates.length > 0) {
      events = undatedCandidates.slice(0, 5);
      if (debugEnabled) {
        debug.dateFiltering.fallbackUndatedUsed = true;
        debug.dateFiltering.undatedKept = events.length;
      }
    }
    
    // ============================================================================
    // STEP 8: FINAL DATA SANITIZATION
    // ============================================================================
    
    // Final cleanup before returning to client
    for (const e of events) {
      if (typeof e.starts_at === "string") e.starts_at = e.starts_at.slice(0,10);
      if (typeof e.ends_at === "string") e.ends_at   = e.ends_at.slice(0,10);
      if (e.title) e.title = e.title.replace(/\s+/g, " ").trim();
    }
    
    if (debugEnabled) debug.filter = { kept: events.length, reasons };

    // ============================================================================
    // STEP 9: SAVE TO DATABASE (BEST-EFFORT)
    // ============================================================================
    
    // Check if database is available for saving events
    const canDb =
      !!supabase &&
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const saved: string[] = [];
    if (canDb) {
      // Save each event to the database using upsert to avoid duplicates
      for (const ev of events) {
        const { data, error } = await supabase.rpc("upsert_event", { p: ev as any });
        if (!error && data) saved.push(String(data));
      }
      if (debugEnabled) debug.upsert = { saved: saved.length };
    } else {
      if (debugEnabled) debug.upsert = { skipped: true, reason: "no supabase env" };
    }

    // ============================================================================
    // RETURN FINAL RESPONSE
    // ============================================================================
    
    const payload = { count: events.length, saved, events } as any;
    if (debugEnabled) Object.assign(payload, debug);
    return NextResponse.json(payload);
  } catch (e: any) {
    // Return error response with empty events array
    // We return status 200 to avoid breaking the UI
    return NextResponse.json({ error: e?.message || "run failed", debug: { crashed: true } }, { status: 200 });
  }
}