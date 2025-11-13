export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { UpdateBoardItemRequest } from "@/lib/types/event-board";

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    const requestData: UpdateBoardItemRequest = await req.json();
    const { id, columnStatus, position, notes, tags } = requestData;
    
    if (!id) {
      return NextResponse.json({ 
        success: false,
        error: "id is required" 
      }, { status: 400 });
    }

    // Build update object
    const updateData: any = {};
    if (columnStatus !== undefined) updateData.column_status = columnStatus;
    if (position !== undefined) updateData.position = position;
    if (notes !== undefined) updateData.notes = notes;
    if (tags !== undefined) updateData.tags = tags;

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

    // Update the board item
    const { data, error } = await supabase
      .from('user_event_board')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ 
        success: false,
        error: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      boardItem: data 
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to update board item" 
    }, { status: 500 });
  }
}

