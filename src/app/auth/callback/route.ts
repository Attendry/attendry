import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const next = url.searchParams.get("next") || "/";

    console.log('Auth callback - code:', code ? 'present' : 'missing');
    console.log('Auth callback - next:', next);

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('Auth callback error:', error);
        // Redirect to login with error
        const baseUrl = req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || 'https://attendry-6o26.vercel.app';
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, baseUrl));
      }
      
      console.log('Auth callback - session exchanged successfully:', data.session ? 'yes' : 'no');
      console.log('Auth callback - user:', data.user?.email || 'no email');
    }

    // After this, cookies are set on the response and the server will see your session.
    // Use the request origin, but fallback to environment variable if needed
    const baseUrl = req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || 'https://attendry-6o26.vercel.app';
    const redirectUrl = new URL(next, baseUrl);
    
    console.log('Auth callback - redirecting to:', redirectUrl.toString());
    
    return NextResponse.redirect(redirectUrl);
  } catch (error: any) {
    console.error('Auth callback unexpected error:', error);
    const baseUrl = req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || 'https://attendry-6o26.vercel.app';
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, baseUrl));
  }
}
