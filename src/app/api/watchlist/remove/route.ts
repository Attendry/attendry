export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: me } = await supabase.auth.getUser();
  if (!me?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { kind = "event", ref_id } = await req.json();
  if (!ref_id) return NextResponse.json({ error: "ref_id required" }, { status: 400 });

  // delete only current user's row
  const { error } = await supabase
    .from("watchlists")
    .delete()
    .eq("owner", me.user.id)
    .eq("kind", kind)
    .eq("ref_id", ref_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
