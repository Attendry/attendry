export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { AddEventToBoardRequest } from "@/lib/types/event-board";
import { linkSpeakerToEvent } from "@/lib/services/speaker-service";

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
      const updateData: any = {
        event_id: actualEventId,
        column_status: columnStatus,
        updated_at: new Date().toISOString()
      };
      // Update event_data if provided
      if (eventData) {
        updateData.event_data = eventData;
      }
      
      const { data, error } = await supabase
        .from('user_event_board')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ 
          success: false,
          error: error.message 
        }, { status: 400 });
      }

      // PHASE 2: Link speakers to event in history (if speakers available)
      if (actualEventId && eventData?.speakers && Array.isArray(eventData.speakers)) {
        let linkedCount = 0;
        for (const speaker of eventData.speakers) {
          if (speaker?.name) {
            try {
              const historyEntry = await linkSpeakerToEvent(
                {
                  name: speaker.name,
                  org: speaker.org,
                  title: speaker.title
                },
                actualEventId,
                {
                  talk_title: speaker.speech_title || speaker.talk_title || null,
                  session_name: speaker.session || null,
                  speech_title: speaker.speech_title || speaker.talk_title || null
                },
                speaker.confidence || null
              );
              
              if (historyEntry) {
                linkedCount++;
              }
            } catch (historyError) {
              // Don't fail board add if history linking fails
              console.error('[phase2-speaker-history] Failed to link speaker to event:', {
                speaker: speaker.name,
                eventId: actualEventId,
                error: historyError
              });
            }
          }
        }
        
        if (linkedCount > 0) {
          console.log('[phase2-speaker-history] Linked speakers to event:', {
            eventId: actualEventId,
            speakersLinked: linkedCount,
            totalSpeakers: eventData.speakers.length
          });
        }
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
        event_data: eventData || null, // Store full event data
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

    // PHASE 2: Link speakers to event in history (if speakers available)
    if (actualEventId && eventData?.speakers && Array.isArray(eventData.speakers)) {
      let linkedCount = 0;
      for (const speaker of eventData.speakers) {
        if (speaker?.name) {
          try {
            const historyEntry = await linkSpeakerToEvent(
              {
                name: speaker.name,
                org: speaker.org,
                title: speaker.title
              },
              actualEventId,
              {
                talk_title: speaker.speech_title || speaker.talk_title || null,
                session_name: speaker.session || null,
                speech_title: speaker.speech_title || speaker.talk_title || null
              },
              speaker.confidence || null
            );
            
            if (historyEntry) {
              linkedCount++;
            }
          } catch (historyError) {
            // Don't fail board add if history linking fails
            console.error('[phase2-speaker-history] Failed to link speaker to event:', {
              speaker: speaker.name,
              eventId: actualEventId,
              error: historyError
            });
          }
        }
      }
      
      if (linkedCount > 0) {
        console.log('[phase2-speaker-history] Linked speakers to event:', {
          eventId: actualEventId,
          speakersLinked: linkedCount,
          totalSpeakers: eventData.speakers.length
        });
      }
    }

    return NextResponse.json({ success: true, boardItem: data });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to add event to board" 
    }, { status: 500 });
  }
}

