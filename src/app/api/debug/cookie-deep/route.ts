import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const debugInfo: any = {
      status: "success",
      message: "Deep cookie analysis completed",
      environment: {
        nodeEnv: process.env.NODE_ENV,
        isProduction: process.env.NODE_ENV === 'production',
        expectedDomain: process.env.NODE_ENV === 'production' ? '.vercel.app' : 'localhost',
        origin: req.nextUrl.origin,
        host: req.headers.get('host')
      },
      cookies: {
        rawHeader: req.headers.get('cookie') || 'No cookies sent',
        parsed: {},
        supabaseCookies: [],
        total: 0
      },
      session: {
        exists: false,
        accessToken: 'missing',
        refreshToken: 'missing',
        error: null
      },
      recommendations: []
    };

    // Parse all cookies from the request
    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          acc[name] = decodeURIComponent(value);
        }
        return acc;
      }, {} as Record<string, string>);
      
      debugInfo.cookies.parsed = cookies;
      debugInfo.cookies.total = Object.keys(cookies).length;
      
      // Find Supabase cookies
      const supabaseCookies = Object.keys(cookies).filter(key => 
        key.startsWith('sb-') || 
        key.includes('supabase') || 
        key.includes('access_token') || 
        key.includes('refresh_token')
      );
      debugInfo.cookies.supabaseCookies = supabaseCookies;
    }

    // Test Supabase session
    try {
      const supabase = await supabaseServer();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        debugInfo.session.error = sessionError.message;
        debugInfo.recommendations.push(`❌ Session error: ${sessionError.message}`);
      } else if (session?.session) {
        debugInfo.session.exists = true;
        debugInfo.session.accessToken = session.session.access_token ? 'present' : 'missing';
        debugInfo.session.refreshToken = session.session.refresh_token ? 'present' : 'missing';
        debugInfo.recommendations.push('✅ Session found with tokens');
      } else {
        debugInfo.recommendations.push('❌ No session found');
      }
    } catch (error: any) {
      debugInfo.session.error = error.message;
      debugInfo.recommendations.push(`❌ Supabase error: ${error.message}`);
    }

    // Add recommendations based on findings
    if (debugInfo.cookies.total === 0) {
      debugInfo.recommendations.push('❌ No cookies received - authentication not working');
    } else if (debugInfo.cookies.supabaseCookies.length === 0) {
      debugInfo.recommendations.push('❌ No Supabase cookies found - session not established');
    } else {
      debugInfo.recommendations.push(`✅ Found ${debugInfo.cookies.supabaseCookies.length} Supabase cookies`);
    }

    // Check for domain issues
    if (debugInfo.environment.isProduction && !debugInfo.environment.host?.includes('vercel.app')) {
      debugInfo.recommendations.push('⚠️ Production mode but not on vercel.app domain');
    }

    return NextResponse.json(debugInfo);
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      message: "Deep cookie analysis failed",
      error: error.message
    }, { status: 500 });
  }
}
