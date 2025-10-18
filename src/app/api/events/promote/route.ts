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

    // Create a new event extraction record to trigger analysis
    const { data: extractionData, error: extractionError } = await supabase
      .from('event_extractions')
      .insert({
        user_id: userRes.user.id,
        event_id: eventId,
        source_url: eventData.source_url,
        status: 'pending',
        extraction_type: 'promoted_from_calendar',
        metadata: {
          promoted_at: new Date().toISOString(),
          original_event_data: eventData
        }
      })
      .select()
      .single();

    if (extractionError) {
      return NextResponse.json({ 
        success: false,
        error: extractionError.message 
      }, { status: 400 });
    }

    // Update the event to mark it as promoted
    const { error: updateError } = await supabase
      .from('collected_events')
      .update({
        metadata: {
          ...eventData.metadata,
          promoted_to_analysis: true,
          promoted_at: new Date().toISOString(),
          promoted_by: userRes.user.id
        }
      })
      .eq('id', eventId);

    if (updateError) {
      console.error('Failed to update event metadata:', updateError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({ 
      success: true, 
      message: "Event promoted to analysis pipeline",
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
