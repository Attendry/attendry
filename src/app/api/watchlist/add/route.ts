export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { 
  WatchlistAddRequest, 
  WatchlistAddResponse, 
  ErrorResponse 
} from "@/lib/types/api";

export async function POST(req: NextRequest): Promise<NextResponse<WatchlistAddResponse | ErrorResponse>> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) return NextResponse.json({ 
      success: false,
      error: "Not authenticated" 
    }, { status: 401 });

    const requestData: WatchlistAddRequest = await req.json();
    const { kind, label, ref_id } = requestData;
    
    const { data, error } = await supabase.rpc("add_watchlist_item", {
      p_kind: String(kind || "event"),
      p_label: String(label || "Untitled"),
      p_ref_id: String(ref_id || ""),
    });
    if (error) return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 400 });

    return NextResponse.json({ success: true, id: data ?? undefined });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "save failed" 
    }, { status: 500 });
  }
}
