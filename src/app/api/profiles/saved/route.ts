import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { SavedSpeakerProfile } from "@/lib/types/database";

export const runtime = "nodejs";

interface SaveProfileRequest {
  speaker_data: any;
  enhanced_data: any;
  notes?: string;
  tags?: string[];
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
