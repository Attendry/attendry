import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

// GET /api/events/promoted - Get recently promoted events
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

    const url = new URL(req.url);
    const extractionId = url.searchParams.get('extractionId');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    let query = supabase
      .from('event_extractions')
      .select('*')
      .eq('payload->>ready_for_analysis', 'true')
      .order('created_at', { ascending: false })
      .limit(limit);

    // If specific extraction ID is requested
    if (extractionId) {
      query = query.eq('id', extractionId);
    }

    const { data: extractions, error: extractionError } = await query;

    if (extractionError) {
      return NextResponse.json({ 
        success: false,
        error: extractionError.message 
      }, { status: 400 });
    }

    // Transform the data to match the expected format with rich analysis data
    const promotedEvents = extractions?.map(extraction => {
      const baseEvent = {
        id: extraction.id,
        title: extraction.payload?.original_event_data?.title || 'Promoted Event',
        source_url: extraction.url,
        starts_at: extraction.payload?.original_event_data?.starts_at,
        ends_at: extraction.payload?.original_event_data?.ends_at,
        city: extraction.locality,
        country: extraction.country,
        venue: extraction.payload?.original_event_data?.venue,
        organizer: extraction.payload?.original_event_data?.organizer,
        description: extraction.payload?.original_event_data?.description,
        confidence: extraction.payload?.original_event_data?.confidence,
        promoted_at: extraction.payload?.promoted_at,
        extraction_id: extraction.id,
        status: 'promoted'
      };

      // Include rich analysis data if available
      if (extraction.payload?.analysis_results) {
        const analysis = extraction.payload.analysis_results;
        return {
          ...baseEvent,
          // Enhanced event metadata from analysis
          title: analysis.event?.title || baseEvent.title,
          description: analysis.event?.description || baseEvent.description,
          venue: analysis.event?.location || baseEvent.venue,
          organizer: analysis.event?.organizer || baseEvent.organizer,
          // Rich speaker data from analysis
          speakers: analysis.speakers || [],
          // Analysis metadata
          analysis_completed: extraction.payload?.analysis_completed || false,
          speakers_found: analysis.speakers?.length || 0,
          crawl_stats: analysis.crawl_stats || null,
          // Enhanced confidence based on analysis
          confidence: analysis.speakers?.length > 0 ? Math.min(0.9, (baseEvent.confidence || 0.5) + 0.3) : baseEvent.confidence
        };
      }

      return baseEvent;
    }) || [];

    // Log speaker counts for debugging
    const totalSpeakers = promotedEvents.reduce((sum, event) => sum + (event.speakers?.length || 0), 0);
    console.log('Promoted events API response:', {
      totalEvents: promotedEvents.length,
      totalSpeakers: totalSpeakers,
      eventsWithSpeakers: promotedEvents.filter(e => e.speakers?.length > 0).length,
      analysisCompleted: promotedEvents.filter(e => e.analysis_completed).length
    });

    return NextResponse.json({ 
      success: true,
      events: promotedEvents,
      count: promotedEvents.length,
      totalSpeakers: totalSpeakers
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to fetch promoted events" 
    }, { status: 500 });
  }
}
