export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { 
  WatchlistRemoveRequest, 
  WatchlistRemoveResponse, 
  ErrorResponse 
} from "@/lib/types/api";

export async function POST(req: NextRequest): Promise<NextResponse<WatchlistRemoveResponse | ErrorResponse>> {
  try {
    const supabase = await supabaseServer();
    const { data: me } = await supabase.auth.getUser();
    if (!me?.user) return NextResponse.json({ 
      success: false,
      error: "Not authenticated" 
    }, { status: 401 });

    const requestData: WatchlistRemoveRequest = await req.json();
    const { kind = "event", ref_id } = requestData;
    if (!ref_id) return NextResponse.json({ 
      success: false,
      error: "ref_id required" 
    }, { status: 400 });

    // delete only current user's row
    const { error } = await supabase
      .from("watchlists")
      .delete()
      .eq("owner", me.user.id)
      .eq("kind", kind)
      .eq("ref_id", ref_id);

    if (error) return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 400 });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove item'
    }, { status: 500 });
  }
}
