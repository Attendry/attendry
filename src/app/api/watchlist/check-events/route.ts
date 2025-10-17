import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { WatchlistMatcher, EventData } from "@/lib/utils/watchlist-matcher";

// POST /api/watchlist/check-events - Check events against user's watchlist
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    const requestData = await req.json();
    const { events } = requestData;

    if (!events || !Array.isArray(events)) {
      return NextResponse.json({ 
        success: false,
        error: "events array is required" 
      }, { status: 400 });
    }

    // Validate event data structure
    const validatedEvents: EventData[] = events.map((event: any) => ({
      id: event.id || event.source_url || '',
      title: event.title || '',
      organizer: event.organizer || undefined,
      sponsors: event.sponsors || undefined,
      speakers: event.speakers || undefined,
      participating_organizations: event.participating_organizations || undefined,
      partners: event.partners || undefined,
      competitors: event.competitors || undefined,
      source_url: event.source_url || undefined,
    }));

    // Check events against watchlist
    const matches = await WatchlistMatcher.checkEventsAgainstWatchlist(
      userRes.user.id,
      validatedEvents
    );

    // Get summary statistics
    const summary = await WatchlistMatcher.getWatchlistMatchesSummary(
      userRes.user.id,
      validatedEvents
    );

    return NextResponse.json({
      success: true,
      matches,
      summary,
      totalEvents: validatedEvents.length,
    });
  } catch (e: any) {
    console.error('Watchlist check API error:', e);
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to check events against watchlist" 
    }, { status: 500 });
  }
}

// GET /api/watchlist/check-events - Get watchlist summary for user
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    // Get user's watchlist
    const { data: watchlist, error } = await supabase
      .from('watchlists')
      .select('*')
      .eq('owner', userRes.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ 
        success: false,
        error: error.message 
      }, { status: 400 });
    }

    // Group by kind
    const attendees = (watchlist || []).filter(item => item.kind === 'attendee');
    const companies = (watchlist || []).filter(item => item.kind === 'company');

    return NextResponse.json({
      success: true,
      watchlist: {
        total: watchlist?.length || 0,
        attendees: attendees.length,
        companies: companies.length,
        items: watchlist || [],
      },
    });
  } catch (e: any) {
    console.error('Watchlist summary API error:', e);
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to get watchlist summary" 
    }, { status: 500 });
  }
}
