export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: me } = await supabase.auth.getUser();
  if (!me?.user) return NextResponse.json({ items: [] }, { status: 200 });

  const { data, error } = await supabase
    .from("watchlists")
    .select("ref_id")
    .eq("owner", me.user.id)
    .eq("kind", "event");

  if (error) return NextResponse.json({ items: [], error: error.message }, { status: 200 });
  return NextResponse.json({ items: (data ?? []).map(r => r.ref_id) });
}
