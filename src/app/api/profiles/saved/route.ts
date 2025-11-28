import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { SavedSpeakerProfile } from "@/lib/types/database";
import { linkSpeakerToEvent } from "@/lib/services/speaker-service";
import { researchContact, saveContactResearch } from "@/lib/services/contact-research-service";

export const runtime = "nodejs";

interface SaveProfileRequest {
  speaker_data: any;
  enhanced_data: any;
  notes?: string;
  tags?: string[];
  metadata?: {
    event_id?: string;
    event_source_url?: string;
    event_title?: string;
    confidence?: number;
  };
}

interface UpdateProfileRequest {
  notes?: string;
  tags?: string[];
  outreach_status?: 'not_started' | 'contacted' | 'responded' | 'meeting_scheduled';
}

// POST /api/profiles/saved - Save a profile
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

    const requestData: SaveProfileRequest = await req.json();
    const { speaker_data, enhanced_data, notes, tags } = requestData;
    
    if (!speaker_data || !enhanced_data) {
      return NextResponse.json({ 
        success: false,
        error: "speaker_data and enhanced_data are required" 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('saved_speaker_profiles')
      .insert({
        user_id: userRes.user.id,
        speaker_data,
        enhanced_data,
        notes: notes || null,
        tags: tags || [],
        outreach_status: 'not_started'
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation (profile already saved)
      if (error.code === '23505') {
        return NextResponse.json({ 
          success: false,
          error: "Profile already saved" 
        }, { status: 409 });
      }
      
      return NextResponse.json({ 
        success: false,
        error: error.message 
      }, { status: 400 });
    }

    // PHASE 2: Link speaker to event in history (if event context available)
    if (speaker_data?.name && (requestData.metadata?.event_id || requestData.metadata?.event_source_url)) {
      try {
        // Try to resolve event_id from URL if not provided directly
        let eventId = requestData.metadata?.event_id;
        
        if (!eventId && requestData.metadata?.event_source_url) {
          const { data: eventData } = await supabase
            .from('collected_events')
            .select('id')
            .eq('source_url', requestData.metadata.event_source_url)
            .single();
          
          if (eventData?.id) {
            eventId = eventData.id;
          }
        }
        
        if (eventId) {
          const historyEntry = await linkSpeakerToEvent(
            {
              name: speaker_data.name,
              org: speaker_data.org,
              title: speaker_data.title
            },
            eventId,
            {
              talk_title: speaker_data.speech_title || speaker_data.talk_title || null,
              session_name: speaker_data.session || null,
              speech_title: speaker_data.speech_title || speaker_data.talk_title || null
            },
            requestData.metadata.confidence || null
          );
          
          if (historyEntry) {
            console.log('[phase2-speaker-history] Linked speaker to event:', {
              speaker: speaker_data.name,
              eventId,
              historyId: historyEntry.id
            });
          }
        }
      } catch (historyError) {
        // Don't fail the save if history linking fails
        console.error('[phase2-speaker-history] Failed to link speaker to event:', historyError);
      }
    }

    // Auto-research: Trigger research in background when contact is added
    if (data?.id && speaker_data?.name) {
      // Don't await - let it run in background
      (async () => {
        try {
          const name = speaker_data.name || 'Unknown';
          const company = speaker_data.org || speaker_data.organization || 'Unknown';
          
          // Research the contact
          const researchResult = await researchContact(name, company);
          
          // Save to database
          await saveContactResearch(userRes.user.id, data.id, researchResult);
          
          console.log('[auto-research] Research completed for contact:', data.id);
        } catch (error) {
          console.error('[auto-research] Failed to research contact:', error);
          // Don't fail the save if research fails
        }
      })();
    }

    return NextResponse.json({ 
      success: true, 
      profile: data 
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Save failed" 
    }, { status: 500 });
  }
}

// GET /api/profiles/saved - List saved profiles
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

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const tag = searchParams.get('tag');
    const search = searchParams.get('search');

    let query = supabase
      .from('saved_speaker_profiles')
      .select('*')
      .eq('user_id', userRes.user.id)
      .order('saved_at', { ascending: false });

    if (status) {
      query = query.eq('outreach_status', status);
    }

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    if (search) {
      query = query.or(`speaker_data->>name.ilike.%${search}%,speaker_data->>org.ilike.%${search}%,enhanced_data->>title.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ 
        success: false,
        error: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      profiles: data || [] 
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to fetch profiles" 
    }, { status: 500 });
  }
}
