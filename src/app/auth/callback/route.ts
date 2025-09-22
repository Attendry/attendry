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
      
      // Force session refresh to ensure cookies are set
      if (data.session) {
        try {
          const { error: refreshError } = await supabase.auth.refreshSession({
            refresh_token: data.session.refresh_token
          });
          if (refreshError) {
            console.error('Session refresh error in callback:', refreshError);
          } else {
            console.log('Session refreshed successfully in callback');
          }
        } catch (refreshErr) {
          console.error('Session refresh exception in callback:', refreshErr);
        }
      }
    }

    // After this, cookies are set on the response and the server will see your session.
    // Use the request origin, but fallback to environment variable if needed
    const baseUrl = req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || 'https://attendry-6o26.vercel.app';
    const redirectUrl = new URL(next, baseUrl);
    
    console.log('Auth callback - redirecting to:', redirectUrl.toString());
    
    // Create response with explicit cookie headers
    const response = NextResponse.redirect(redirectUrl);
    
    // Add explicit cookie headers to ensure they're set
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error: any) {
    console.error('Auth callback unexpected error:', error);
    const baseUrl = req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || 'https://attendry-6o26.vercel.app';
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, baseUrl));
  }
}
