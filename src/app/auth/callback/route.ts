import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }
  // After this, cookies are set on the response and the server will see your session.
  return NextResponse.redirect(new URL(next, process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000"));
}
