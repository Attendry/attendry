import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Auth callback error:', error);
      // Redirect to login with error
      const baseUrl = req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || 'https://attendry-6o26.vercel.app';
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, baseUrl));
    }
  }
  
  // After this, cookies are set on the response and the server will see your session.
  // Use the request origin, but fallback to environment variable if needed
  const baseUrl = req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || 'https://attendry-6o26.vercel.app';
  return NextResponse.redirect(new URL(next, baseUrl));
}
