import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer();

    // Get all cookies from the request
    const cookieHeader = req.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        acc[name] = decodeURIComponent(value);
      }
      return acc;
    }, {} as Record<string, string>);

    // Check for Supabase cookies specifically
    const supabaseCookies = Object.keys(cookies).filter(key => key.startsWith('sb-'));
    
    // Try to get session
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    
    // Try to get user
    const { data: user, error: userError } = await supabase.auth.getUser();

    return NextResponse.json({
      status: "success",
      message: "Session check completed",
      cookies: {
        total: Object.keys(cookies).length,
        supabaseCookies: supabaseCookies,
        allCookies: Object.keys(cookies),
        cookieHeader: cookieHeader
      },
      session: {
        exists: !!session?.session,
        accessToken: session?.session?.access_token ? 'present' : 'missing',
        refreshToken: session?.session?.refresh_token ? 'present' : 'missing',
        expiresAt: session?.session?.expires_at,
        error: sessionError?.message || null
      },
      user: {
        exists: !!user?.user,
        id: user?.user?.id || null,
        email: user?.user?.email || null,
        error: userError?.message || null
      },
      recommendations: [
        supabaseCookies.length > 0 ? "✅ Supabase cookies found" : "❌ No Supabase cookies - session not established",
        session?.session ? "✅ Session exists" : "❌ No session - need to sign in",
        user?.user ? "✅ User authenticated" : "❌ User not authenticated"
      ]
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      status: "error",
      message: "Session check failed",
      error: errorMessage
    }, { status: 500 });
  }
}
