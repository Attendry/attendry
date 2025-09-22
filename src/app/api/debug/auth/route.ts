export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.getUser();
    return NextResponse.json({ ok: !error, user: data?.user ?? null, error: error?.message ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 200 });
  }
}
