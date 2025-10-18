import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

// GET /api/profiles/me - Get current user's profile
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

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userRes.user.id)
      .single();

    if (error) {
      // If profile doesn't exist, return empty profile
      if (error.code === 'PGRST116') {
        return NextResponse.json({ 
          success: true, 
          profile: {
            id: userRes.user.id,
            full_name: userRes.user.user_metadata?.full_name || null,
            company: null,
            competitors: [],
            icp_terms: [],
            industry_terms: [],
            use_in_basic_search: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        });
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
      error: e?.message || "Failed to fetch profile" 
    }, { status: 500 });
  }
}
