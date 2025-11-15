export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * GET /api/events/board/check
 * 
 * Check if an event is already in the user's board
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        inBoard: false,
        boardItemId: null
      });
    }

    const searchParams = req.nextUrl.searchParams;
    const eventUrl = searchParams.get('eventUrl');

    if (!eventUrl) {
      return NextResponse.json({ 
        inBoard: false,
        boardItemId: null
      });
    }

    // Check if event exists in board
    const { data: boardItem } = await supabase
      .from('user_event_board')
      .select('id')
      .eq('user_id', userRes.user.id)
      .eq('event_url', eventUrl)
      .maybeSingle();

    if (boardItem) {
      return NextResponse.json({ 
        inBoard: true,
        boardItemId: boardItem.id
      });
    }

    return NextResponse.json({ 
      inBoard: false,
      boardItemId: null
    });
  } catch (e: any) {
    console.error('[Board Check API] Error:', e);
    return NextResponse.json({ 
      inBoard: false,
      boardItemId: null
    });
  }
}


