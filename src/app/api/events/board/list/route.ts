export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { UserEventBoardItem } from "@/lib/types/database";

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

    // Build query - get both collected_events and event_data
    let query = supabase
      .from('user_event_board')
      .select(`
        *,
        collected_events (
          id,
          title,
          starts_at,
          ends_at,
          city,
          country,
          venue,
          organizer,
          description,
          topics,
          speakers,
          sponsors,
          participating_organizations,
          partners,
          competitors,
          source_url,
          confidence
        )
      `)
      .eq('user_id', userRes.user.id)
      .order('position', { ascending: true })
      .order('added_at', { ascending: false });

    // Filter by status if provided
    if (status) {
      query = query.eq('column_status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ 
        success: false,
        error: error.message 
      }, { status: 400 });
    }

    // Transform data to ensure event information is available
    const transformedItems = (data || []).map((item: any) => {
      // If we have collected_events, use that; otherwise use event_data
      const eventInfo = item.collected_events || item.event_data || null;
      
      return {
        ...item,
        // Ensure event data is available for frontend
        event: eventInfo,
      };
    });

    return NextResponse.json({ 
      success: true,
      items: transformedItems 
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to list board items" 
    }, { status: 500 });
  }
}

