import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const timeline: any[] = [];
    
    // Step 1: Check environment
    timeline.push({
      step: 1,
      action: "Environment Check",
      timestamp: new Date().toISOString(),
      details: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        nodeEnv: process.env.NODE_ENV,
        isProduction: process.env.NODE_ENV === 'production'
      }
    });

    // Step 2: Check cookies in request
    const cookieHeader = req.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        acc[name] = decodeURIComponent(value);
      }
      return acc;
    }, {} as Record<string, string>);

    const supabaseCookies = Object.keys(cookies).filter(key => key.startsWith('sb-'));
    
    timeline.push({
      step: 2,
      action: "Request Cookies Analysis",
      timestamp: new Date().toISOString(),
      details: {
        totalCookies: Object.keys(cookies).length,
        supabaseCookies: supabaseCookies,
        allCookies: Object.keys(cookies),
        cookieHeader: cookieHeader
      }
    });

    // Step 3: Create Supabase client
    let supabase;
    try {
      supabase = await supabaseServer();
      timeline.push({
        step: 3,
        action: "Supabase Client Creation",
        timestamp: new Date().toISOString(),
        status: "success",
        details: "Client created successfully"
      });
    } catch (error: any) {
      timeline.push({
        step: 3,
        action: "Supabase Client Creation",
        timestamp: new Date().toISOString(),
        status: "error",
        details: error.message
      });
      return NextResponse.json({ timeline, error: "Failed to create Supabase client" });
    }

    // Step 4: Check session
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      timeline.push({
        step: 4,
        action: "Session Check",
        timestamp: new Date().toISOString(),
        status: sessionError ? "error" : "success",
        details: {
          sessionExists: !!session,
          accessToken: session?.access_token ? 'present' : 'missing',
          refreshToken: session?.refresh_token ? 'present' : 'missing',
          expiresAt: session?.expires_at,
          error: sessionError?.message
        }
      });
    } catch (error: any) {
      timeline.push({
        step: 4,
        action: "Session Check",
        timestamp: new Date().toISOString(),
        status: "error",
        details: error.message
      });
    }

    // Step 5: Check user
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      timeline.push({
        step: 5,
        action: "User Check",
        timestamp: new Date().toISOString(),
        status: userError ? "error" : "success",
        details: {
          userExists: !!user,
          userId: user?.id,
          userEmail: user?.email,
          error: userError?.message
        }
      });
    } catch (error: any) {
      timeline.push({
        step: 5,
        action: "User Check",
        timestamp: new Date().toISOString(),
        status: "error",
        details: error.message
      });
    }

    // Step 6: Test database access
    try {
      const { data, error: dbError } = await supabase
        .from("search_configurations")
        .select("count", { count: "exact", head: true });
      
      timeline.push({
        step: 6,
        action: "Database Access Test",
        timestamp: new Date().toISOString(),
        status: dbError ? "error" : "success",
        details: {
          canAccessDB: !dbError,
          error: dbError?.message
        }
      });
    } catch (error: any) {
      timeline.push({
        step: 6,
        action: "Database Access Test",
        timestamp: new Date().toISOString(),
        status: "error",
        details: error.message
      });
    }

    return NextResponse.json({
      status: "success",
      message: "Session timeline analysis completed",
      timeline,
      summary: {
        totalSteps: timeline.length,
        successfulSteps: timeline.filter(t => t.status === 'success').length,
        failedSteps: timeline.filter(t => t.status === 'error').length,
        hasSession: timeline.find(t => t.action === "Session Check")?.details?.sessionExists || false,
        hasUser: timeline.find(t => t.action === "User Check")?.details?.userExists || false,
        hasCookies: supabaseCookies.length > 0
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      message: "Session timeline analysis failed",
      error: error.message
    }, { status: 500 });
  }
}
