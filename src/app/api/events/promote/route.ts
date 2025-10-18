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
      
      // Call the events/run API to process the promoted event (this will extract speakers and enhance them)
      const analysisResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/events/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userText: eventData.title || 'Event Analysis',
          country: eventData.country || 'EU',
          dateFrom: eventData.starts_at ? new Date(eventData.starts_at).toISOString().split('T')[0] : null,
          dateTo: eventData.ends_at ? new Date(eventData.ends_at).toISOString().split('T')[0] : null,
          locale: 'en',
          // Add the specific event URL to focus the analysis
          specificEventUrl: eventData.source_url
        })
      });
      
      if (analysisResponse.ok) {
        const analysisResult = await analysisResponse.json();
        console.log('Analysis pipeline completed for promoted event:', eventId);
        console.log('Analysis result events count:', analysisResult.events?.length || 0);
        
        // Update the extraction record with analysis results
        await supabase
          .from('event_extractions')
          .update({
            payload: {
              ...extractionData.payload,
              analysis_completed: true,
              analysis_results: analysisResult,
              analyzed_at: new Date().toISOString(),
              events_found: analysisResult.events?.length || 0
            }
          })
          .eq('id', extractionData.id);
      } else {
        const errorText = await analysisResponse.text();
        console.warn('Analysis pipeline failed for promoted event:', eventId, 'Status:', analysisResponse.status, 'Error:', errorText);
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
