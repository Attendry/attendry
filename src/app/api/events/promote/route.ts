import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

interface PromoteEventRequest {
  eventId: string;
}

// POST /api/events/promote - Promote a calendar event to the main analysis pipeline
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

    const requestData: PromoteEventRequest = await req.json();
    const { eventId } = requestData;
    
    if (!eventId) {
      return NextResponse.json({ 
        success: false,
        error: "eventId is required" 
      }, { status: 400 });
    }

    // First, get the event from collected_events
    const { data: eventData, error: eventError } = await supabase
      .from('collected_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      return NextResponse.json({ 
        success: false,
        error: "Event not found" 
      }, { status: 404 });
    }

    // Convert the collected event to the format expected by the analysis pipeline
    const eventForAnalysis = {
      source_url: eventData.source_url,
      title: eventData.title,
      description: eventData.description,
      starts_at: eventData.starts_at,
      ends_at: eventData.ends_at,
      city: eventData.city,
      country: eventData.country,
      venue: eventData.venue,
      organizer: eventData.organizer,
      speakers: eventData.speakers || [],
      sponsors: eventData.sponsors || [],
      participating_organizations: eventData.participating_organizations || [],
      confidence: eventData.confidence,
      data_completeness: eventData.data_completeness,
      pipeline_metadata: {
        ...eventData.pipeline_metadata,
        promoted_from_calendar: true,
        promoted_at: new Date().toISOString(),
        promoted_by: userRes.user.id
      }
    };

    // For now, we'll mark the event as promoted and let the user know
    // The analysis pipeline can be triggered manually or through a separate process
    console.log('Event promoted from calendar:', eventId, 'by user:', userRes.user.id);

    // Create or update an event extraction record to track the promotion
    const eventDate = eventData.starts_at ? new Date(eventData.starts_at).toISOString().split('T')[0] : null;
    
    const { data: extractionData, error: extractionError } = await supabase
      .from('event_extractions')
      .upsert({
        url: eventData.source_url,
        normalized_url: eventData.source_url,
        event_date: eventDate,
        country: eventData.country,
        locality: eventData.city,
        payload: {
          promoted_from_calendar: true,
          promoted_at: new Date().toISOString(),
          promoted_by: userRes.user.id,
          original_event_data: eventData,
          status: 'promoted',
          ready_for_analysis: true
        }
      }, {
        onConflict: 'normalized_url,event_date',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (extractionError) {
      return NextResponse.json({ 
        success: false,
        error: extractionError.message 
      }, { status: 400 });
    }

    // Now trigger the actual analysis pipeline for the promoted event
    try {
      console.log('Triggering analysis pipeline for promoted event:', eventId);
      
      // Call the event analysis logic directly instead of making HTTP request
      console.log('Starting direct event analysis for:', eventData.source_url);
      
      // Import the analysis functions directly
      const { analyzeEvent } = await import('@/lib/event-analysis');
      
      const analysisResult = await analyzeEvent({
        eventUrl: eventData.source_url,
        eventTitle: eventData.title,
        eventDate: eventData.starts_at,
        country: eventData.country
      });
      
      console.log('Event analysis completed for promoted event:', eventId);
      console.log('Analysis result success:', analysisResult.success);
      console.log('Analysis result cached:', analysisResult.cached);
      console.log('Event metadata:', analysisResult.event);
      console.log('Speakers found:', analysisResult.speakers?.length || 0);
      console.log('Crawl stats:', analysisResult.crawl_stats);
      
      if (analysisResult.speakers && analysisResult.speakers.length > 0) {
        console.log('First speaker:', {
          name: analysisResult.speakers[0].name,
          title: analysisResult.speakers[0].title,
          company: analysisResult.speakers[0].company
        });
      }
      
      if (analysisResult.success) {
        // Update the extraction record with analysis results
        await supabase
          .from('event_extractions')
          .update({
            payload: {
              ...extractionData.payload,
              analysis_completed: true,
              analysis_results: analysisResult,
              analyzed_at: new Date().toISOString(),
              event_metadata: analysisResult.event,
              speakers_found: analysisResult.speakers?.length || 0,
              crawl_stats: analysisResult.crawl_stats
            }
          })
          .eq('id', extractionData.id);
          
        console.log('Updated extraction record with analysis results');
      } else {
        console.warn('Event analysis failed for promoted event:', eventId, 'Error:', analysisResult.error);
      }
    } catch (analysisError) {
      console.error('Failed to trigger analysis pipeline:', analysisError);
      // Don't fail the promotion if analysis fails
    }

    return NextResponse.json({ 
      success: true, 
      message: "Event promoted to analysis pipeline and processing started",
      extractionId: extractionData.id,
      eventId: eventId
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to promote event" 
    }, { status: 500 });
  }
}
