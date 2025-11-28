export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * GET /api/events/board/check
 * 
 * Check if an event is already in the user's board (Single event)
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

/**
 * POST /api/events/board/check
 * 
 * Batch check if events are in the user's board
 * Body: { eventUrls: string[] }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ results: {} });
    }

    const body = await req.json();
    const { eventUrls } = body;

    if (!eventUrls || !Array.isArray(eventUrls) || eventUrls.length === 0) {
      return NextResponse.json({ results: {} });
    }

    // Check if events exist in board
    const { data: boardItems } = await supabase
      .from('user_event_board')
      .select('id, event_url')
      .eq('user_id', userRes.user.id)
      .in('event_url', eventUrls);

    const results: Record<string, { inBoard: boolean, boardItemId: string | null }> = {};
    
    // Initialize all as false
    eventUrls.forEach(url => {
      results[url] = { inBoard: false, boardItemId: null };
    });

    // Update found items
    if (boardItems) {
      boardItems.forEach((item: any) => {
        if (item.event_url) {
          results[item.event_url] = {
            inBoard: true,
            boardItemId: item.id
          };
        }
      });
    }

    return NextResponse.json({ results });
  } catch (e: any) {
    console.error('[Board Batch Check API] Error:', e);
    return NextResponse.json({ results: {} }, { status: 500 });
  }
}
