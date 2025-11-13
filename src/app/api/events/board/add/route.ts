export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { AddEventToBoardRequest } from "@/lib/types/event-board";

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

    const requestData: AddEventToBoardRequest = await req.json();
    const { eventId, eventUrl, eventData, columnStatus = 'interested' } = requestData;
    
    if (!eventUrl) {
      return NextResponse.json({ 
        success: false,
        error: "eventUrl is required" 
      }, { status: 400 });
    }

    // Validate UUID format - eventId might be a generated ID like "optimized_xxx"
    const isValidUUID = (str: string | undefined): boolean => {
      if (!str) return false;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    // Try to find the event in collected_events by URL to get the real UUID
    let actualEventId: string | null = null;
    if (eventUrl) {
      const { data: existingEvent } = await supabase
        .from('collected_events')
        .select('id')
        .eq('source_url', eventUrl)
        .single();
      
      if (existingEvent) {
        actualEventId = existingEvent.id;
      } else if (eventId && isValidUUID(eventId)) {
        // Only use eventId if it's a valid UUID
        actualEventId = eventId;
      }
    }

    // Check if event already exists in board
    const { data: existing } = await supabase
      .from('user_event_board')
      .select('id')
      .eq('user_id', userRes.user.id)
      .eq('event_url', eventUrl)
      .single();

    if (existing) {
      // Update existing board item
      const { data, error } = await supabase
        .from('user_event_board')
        .update({
          event_id: actualEventId,
          column_status: columnStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ 
          success: false,
          error: error.message 
        }, { status: 400 });
      }

      return NextResponse.json({ success: true, boardItem: data });
    }

    // Insert new board item
    const { data, error } = await supabase
      .from('user_event_board')
      .insert({
        user_id: userRes.user.id,
        event_id: actualEventId,
        event_url: eventUrl,
        column_status: columnStatus,
        position: 0
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ 
        success: false,
        error: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({ success: true, boardItem: data });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to add event to board" 
    }, { status: 500 });
  }
}

