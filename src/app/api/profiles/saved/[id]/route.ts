import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

interface UpdateProfileRequest {
  notes?: string;
  tags?: string[];
  outreach_status?: 'not_started' | 'contacted' | 'responded' | 'meeting_scheduled';
  enhanced_data?: any;
  speaker_data?: any;
  last_enhanced_at?: string | null;
}

// PATCH /api/profiles/saved/[id] - Update a profile
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    const requestData: UpdateProfileRequest = await req.json();
    const { notes, tags, outreach_status } = requestData;

    const updatePayload: Record<string, unknown> = {
      ...(notes !== undefined && { notes }),
      ...(tags !== undefined && { tags }),
      ...(outreach_status !== undefined && { outreach_status }),
      ...(enhanced_data !== undefined && { enhanced_data }),
      ...(speaker_data !== undefined && { speaker_data }),
      ...(last_enhanced_at !== undefined && { last_enhanced_at }),
    };

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({
        success: false,
        error: "No fields provided for update"
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('saved_speaker_profiles')
      .update(updatePayload)
      .eq('id', params.id)
      .eq('user_id', userRes.user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ 
        success: false,
        error: error.message 
      }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ 
        success: false,
        error: "Profile not found" 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      profile: data 
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Update failed" 
    }, { status: 500 });
  }
}

// DELETE /api/profiles/saved/[id] - Remove a profile
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    const { error } = await supabase
      .from('saved_speaker_profiles')
      .delete()
      .eq('id', params.id)
      .eq('user_id', userRes.user.id);

    if (error) {
      return NextResponse.json({ 
        success: false,
        error: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true 
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Delete failed" 
    }, { status: 500 });
  }
}
