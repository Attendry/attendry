export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { kind, label, ref_id } = await req.json();
    const { data, error } = await supabase.rpc("add_watchlist_item", {
      p_kind: String(kind || "event"),
      p_label: String(label || "Untitled"),
      p_ref_id: String(ref_id || ""),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, id: data ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "save failed" }, { status: 500 });
  }
}
