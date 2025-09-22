export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/events/search-enhanced
 * 
 * Enhanced search endpoint that combines:
 * 1. Real-time search for immediate results (user's 7-day window)
 * 2. Pre-collected comprehensive data from database
 * 
 * This provides the best of both worlds:
 * - Fast, immediate results for user's specific timeframe
 * - Comprehensive data from broader searches
 */
export async function POST(req: NextRequest) {
  try {
    const { q = "", country = "", from, to, provider = "cse" } = await req.json();
    
    if (!from || !to) {
      return NextResponse.json({ error: "from/to required" }, { status: 400 });
    }

    console.log(`[ENHANCED] Searching for ${q} in ${country} from ${from} to ${to}`);

    // Step 1: Run real-time search for immediate results
    const realtimeResponse = await fetch(`${req.nextUrl.origin}/api/events/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q, country, from, to, provider })
    });

    const realtimeData = await realtimeResponse.json();
    const realtimeEvents = realtimeData.events || [];

    // Step 2: Get pre-collected data from database for broader context
    const preCollectedEvents = await getPreCollectedEvents({
      country,
      from,
      to,
      query: q
    });

    // Step 3: Merge and deduplicate results
    const mergedEvents = mergeAndDeduplicateEvents(realtimeEvents, preCollectedEvents);

    // Step 4: Apply user's specific date filter
    const filteredEvents = filterEventsByDate(mergedEvents, from, to);

    return NextResponse.json({
      success: true,
      searchType: "enhanced",
      realtime: {
        eventsFound: realtimeEvents.length,
        searchData: realtimeData.search,
        extractData: realtimeData.extract
      },
      preCollected: {
        eventsFound: preCollectedEvents.length,
        source: "database"
      },
      merged: {
        totalEvents: mergedEvents.length,
        filteredEvents: filteredEvents.length,
        events: filteredEvents
      },
      debug: {
        realtimeEvents: realtimeEvents.length,
        preCollectedEvents: preCollectedEvents.length,
        mergedEvents: mergedEvents.length,
        finalEvents: filteredEvents.length
      }
    });

  } catch (error: any) {
    console.error('[ENHANCED] Error:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

/**
 * Get pre-collected events from database
 */
async function getPreCollectedEvents(params: {
  country: string;
  from: string;
  to: string;
  query: string;
}) {
  try {
    // Import Supabase client
    const { supabaseServer } = await import('@/lib/supabase-server');
    const supabase = await supabaseServer();
    
    if (!supabase) {
      console.log('[ENHANCED] No Supabase connection, skipping pre-collected data');
      return [];
    }

    // Build query for pre-collected events
    let query = supabase
      .from('collected_events')
      .select('*')
      .gte('starts_at', params.from)
      .lte('starts_at', params.to)
      .gte('collected_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .order('confidence', { ascending: false })
      .limit(50);

    // Add country filter if specified
    if (params.country) {
      query = query.eq('country', params.country);
    }

    // Add text search if query provided
    if (params.query && params.query.trim()) {
      const searchTerms = params.query.toLowerCase().split(' ').filter(term => term.length > 2);
      if (searchTerms.length > 0) {
        // Search in title and topics
        query = query.or(`title.ilike.%${searchTerms[0]}%,topics.cs.{${searchTerms[0]}}`);
      }
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('[ENHANCED] Database query error:', error);
      return [];
    }

    console.log(`[ENHANCED] Found ${events?.length || 0} pre-collected events`);
    return events || [];

  } catch (error) {
    console.error('[ENHANCED] Error getting pre-collected events:', error);
    return [];
  }
}

/**
 * Merge real-time and pre-collected events, removing duplicates
 */
function mergeAndDeduplicateEvents(realtimeEvents: any[], preCollectedEvents: any[]) {
  const merged = [...realtimeEvents];
  const seenUrls = new Set(realtimeEvents.map(e => e.source_url || e.url));

  // Add pre-collected events that aren't duplicates
  for (const event of preCollectedEvents) {
    const eventUrl = event.source_url || event.url;
    if (eventUrl && !seenUrls.has(eventUrl)) {
      merged.push(event);
      seenUrls.add(eventUrl);
    }
  }

  return merged;
}

/**
 * Filter events by date range
 */
function filterEventsByDate(events: any[], from: string, to: string) {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  return events.filter(event => {
    if (!event.starts_at) return false; // Skip events without dates
    
    const eventDate = new Date(event.starts_at);
    return eventDate >= fromDate && eventDate <= toDate;
  });
}

/**
 * GET /api/events/search-enhanced
 * 
 * Get status of enhanced search capabilities
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get('country') || 'de';

    // TODO: Get database statistics
    const stats = {
      preCollectedEvents: 0, // TODO: Get from database
      lastCollectionRun: null, // TODO: Get from database
      coverage: {
        totalDays: 180,
        coveredDays: 0 // TODO: Calculate from database
      }
    };

    return NextResponse.json({
      enhanced: true,
      country,
      stats,
      capabilities: {
        realtimeSearch: true,
        preCollectedData: stats.preCollectedEvents > 0,
        dateRange: {
          from: new Date().toISOString().split('T')[0],
          to: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      }
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

