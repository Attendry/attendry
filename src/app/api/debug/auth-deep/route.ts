import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    
    // Get all cookies from the request
    const cookies = req.cookies.getAll();
    const cookieInfo = cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value ? `${cookie.value.substring(0, 20)}...` : 'empty',
      hasValue: !!cookie.value
    }));

    // Check session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    // Check user
    const { data: userData, error: userError } = await supabase.auth.getUser();

    // Check environment
    const envInfo = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'missing',
      nodeEnv: process.env.NODE_ENV,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'not set'
    };

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      cookies: cookieInfo,
      session: {
        exists: !!sessionData.session,
        user: sessionData.session?.user ? {
          id: sessionData.session.user.id,
          email: sessionData.session.user.email
        } : null,
        error: sessionError?.message || null
      },
      user: {
        exists: !!userData.user,
        user: userData.user ? {
          id: userData.user.id,
          email: userData.user.email
        } : null,
        error: userError?.message || null
      },
      environment: envInfo,
      request: {
        origin: req.nextUrl.origin,
        host: req.headers.get('host'),
        userAgent: req.headers.get('user-agent')?.substring(0, 100) || 'unknown'
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
