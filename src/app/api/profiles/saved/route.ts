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
    // Check rate limit before processing
    const { checkAutoSaveRateLimitOrThrow, getAutoSaveRateLimiter } = await import('@/lib/services/auto-save-rate-limiter');
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Unauthorized" 
      }, { status: 401 });
    }

    const userId = userRes.user.id;
    
    try {
      await checkAutoSaveRateLimitOrThrow(userId);
    } catch (rateLimitError: any) {
      return NextResponse.json({
        success: false,
        error: rateLimitError.message,
        rateLimitExceeded: true,
        retryAfter: rateLimitError.retryAfter,
        circuitBreakerOpen: rateLimitError.circuitBreakerOpen,
        queueFull: rateLimitError.queueFull,
      }, { 
        status: 429,
        headers: {
          'Retry-After': rateLimitError.retryAfter?.toString() || '60',
        }
      });
    }

    const requestData: SaveProfileRequest = await req.json();
    const { speaker_data, enhanced_data, notes, tags } = requestData;
    
    if (!speaker_data || !enhanced_data) {
      return NextResponse.json({ 
        success: false,
        error: "speaker_data and enhanced_data are required" 
      }, { status: 400 });
    }

    // Determine data source (manual save vs auto-save)
    const dataSource = requestData.metadata?.auto_save ? 'auto_save' : 'manual';
    
    // Check if consent is required for auto-save
    if (dataSource === 'auto_save') {
      const { getConsentStatus } = await import('@/lib/services/gdpr-service');
      const consentStatus = await getConsentStatus(userId);
      
      if (!consentStatus?.autoSaveConsent) {
        return NextResponse.json({
          success: false,
          error: "Auto-save requires consent. Please enable auto-save consent in privacy settings.",
          requiresConsent: true,
        }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from('saved_speaker_profiles')
      .insert({
        user_id: userRes.user.id,
        speaker_data,
        enhanced_data,
        notes: notes || null,
        tags: tags || [],
        outreach_status: 'not_started',
        data_source: dataSource,
        consent_given: dataSource === 'auto_save', // Auto-saved contacts require consent
        consent_date: dataSource === 'auto_save' ? new Date().toISOString() : null,
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

    // Record contact creation for rate limiting
    if (data?.id) {
      try {
        const { getAutoSaveRateLimiter } = await import('@/lib/services/auto-save-rate-limiter');
        const rateLimiter = getAutoSaveRateLimiter();
        await rateLimiter.recordContactCreation(userId);
      } catch (rateLimitError) {
        console.warn('[auto-save] Failed to record contact creation for rate limiting:', rateLimitError);
        // Don't fail the request if rate limit recording fails
      }
    }

    // Auto-research: Trigger research in background when contact is added
    if (data?.id && speaker_data?.name) {
      const name = speaker_data.name || 'Unknown';
      const company = speaker_data.org || speaker_data.organization || 'Unknown';
      
      // Use setImmediate or setTimeout to ensure it runs after response is sent
      // In serverless, we need to ensure the function doesn't terminate before research starts
      if (typeof setImmediate !== 'undefined') {
        setImmediate(async () => {
          try {
            console.log(`[auto-research] Starting research for contact ${data.id}: ${name} at ${company}`);
            const researchResult = await researchContact(name, company);
            await saveContactResearch(userRes.user.id, data.id, researchResult);
            console.log(`[auto-research] Research completed for contact: ${data.id}`);
          } catch (error: any) {
            console.error(`[auto-research] Failed to research contact ${data.id}:`, error?.message || error);
          }
        });
      } else {
        // Fallback for environments without setImmediate
        setTimeout(async () => {
          try {
            console.log(`[auto-research] Starting research for contact ${data.id}: ${name} at ${company}`);
            const researchResult = await researchContact(name, company);
            await saveContactResearch(userRes.user.id, data.id, researchResult);
            console.log(`[auto-research] Research completed for contact: ${data.id}`);
          } catch (error: any) {
            console.error(`[auto-research] Failed to research contact ${data.id}:`, error?.message || error);
          }
        }, 100);
      }
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
