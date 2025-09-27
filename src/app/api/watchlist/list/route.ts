export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { 
  WatchlistListResponse, 
  ErrorResponse 
} from "@/lib/types/api";
import { WatchlistItem } from "@/lib/types/core";

export async function GET(): Promise<NextResponse<WatchlistListResponse | ErrorResponse>> {
  try {
    const supabase = await supabaseServer();
    const { data: me } = await supabase.auth.getUser();
    if (!me?.user) return NextResponse.json({ items: [], total: 0 });

    const { data, error } = await supabase
      .from("watchlists")
      .select("*")
      .eq("owner", me.user.id);

    if (error) return NextResponse.json({ 
      items: [], 
      total: 0,
      error: error.message 
    });

    const items: WatchlistItem[] = (data ?? []).map(r => ({
      id: r.id,
      owner: r.owner,
      kind: r.kind,
      label: r.label,
      ref_id: r.ref_id,
      created_at: r.created_at
    }));

    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    return NextResponse.json({ 
      items: [], 
      total: 0,
      error: error instanceof Error ? error.message : 'Failed to get watchlist'
    }, { status: 500 });
  }
}
