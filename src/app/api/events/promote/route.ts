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

    // Start the analysis pipeline asynchronously
    let analysisJobId: string | null = null;
    try {
      console.log('Starting async analysis pipeline for promoted event:', eventId);
      
      // Import and start async analysis
      const { startAsyncCalendarAnalysis } = await import('@/lib/async-calendar-analysis');
      
      analysisJobId = await startAsyncCalendarAnalysis(
        eventData.source_url,
        eventData.title,
        eventData.starts_at,
        eventData.country
      );
      
      console.log('Async analysis started for promoted event:', eventId, 'job ID:', analysisJobId);
      
      // Update the extraction record with job ID for tracking
      const { error: updateError } = await supabase
        .from('event_extractions')
        .update({
          payload: {
            ...extractionData.payload,
            async_analysis_job_id: analysisJobId,
            analysis_status: 'processing',
            analysis_started_at: new Date().toISOString()
          }
        })
        .eq('id', extractionData.id);
      
      if (updateError) {
        console.error('Failed to update extraction record with job ID:', updateError);
      } else {
        console.log('Updated extraction record with async job ID:', analysisJobId);
      }
    } catch (analysisError) {
      console.error('Failed to start async analysis for promoted event:', eventId, analysisError);
      
      // Update the extraction record to indicate analysis failed to start
      const { error: updateError } = await supabase
        .from('event_extractions')
        .update({
          payload: {
            ...extractionData.payload,
            analysis_error: analysisError instanceof Error ? analysisError.message : 'Failed to start async analysis',
            analysis_status: 'failed',
            analysis_started_at: new Date().toISOString()
          }
        })
        .eq('id', extractionData.id);
      
      if (updateError) {
        console.error('Failed to update extraction record with analysis error:', updateError);
      }
      // Don't fail the promotion if analysis fails
    }

    return NextResponse.json({ 
      success: true, 
      message: "Event promoted to analysis pipeline and processing started",
      extractionId: extractionData.id,
      eventId: eventId,
      analysisJobId: analysisJobId, // Include the async job ID for tracking
      analysisStatus: 'processing' // Indicate that analysis is running in background
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to promote event" 
    }, { status: 500 });
  }
}
