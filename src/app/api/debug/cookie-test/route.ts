import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const debugInfo: any = {
      status: "success",
      message: "Cookie test completed",
      environment: {
        nodeEnv: process.env.NODE_ENV,
        isProduction: process.env.NODE_ENV === 'production',
        domain: process.env.NODE_ENV === 'production' ? '.vercel.app' : 'localhost'
      },
      cookies: {
        total: 0,
        allCookies: [],
        supabaseCookies: [],
        cookieHeader: req.headers.get('cookie') || 'No cookies sent'
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
      const cookies = cookieHeader.split(';').map(c => c.trim());
      debugInfo.cookies.total = cookies.length;
      debugInfo.cookies.allCookies = cookies;
      
      // Find Supabase cookies
      const supabaseCookies = cookies.filter(c => 
        c.startsWith('sb-') || 
        c.includes('supabase') || 
        c.includes('access_token') || 
        c.includes('refresh_token')
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

    return NextResponse.json(debugInfo);
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      message: "Cookie test failed",
      error: error.message
    }, { status: 500 });
  }
}
