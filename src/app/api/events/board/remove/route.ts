export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function DELETE(req: NextRequest): Promise<NextResponse> {
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        success: false,
        error: "id is required" 
      }, { status: 400 });
    }

    // Verify user owns this board item
    const { data: existing } = await supabase
      .from('user_event_board')
      .select('id')
      .eq('id', id)
      .eq('user_id', userRes.user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ 
        success: false,
        error: "Board item not found or access denied" 
      }, { status: 404 });
    }

    // Delete the board item
    const { error } = await supabase
      .from('user_event_board')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ 
        success: false,
        error: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to remove board item" 
    }, { status: 500 });
  }
}

