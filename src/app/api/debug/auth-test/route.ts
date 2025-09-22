import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer();

    // Test 1: Check if we can create a Supabase client
    console.log('Supabase client created successfully');

    // Test 2: Check environment variables
    const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const hasSiteUrl = !!process.env.NEXT_PUBLIC_SITE_URL;

    // Test 3: Try to get current session
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    
    // Test 4: Try to get user
    const { data: user, error: userError } = await supabase.auth.getUser();

    return NextResponse.json({
      status: "success",
      message: "Auth test completed",
      environment: {
        hasSupabaseUrl: hasUrl,
        hasSupabaseKey: hasKey,
        hasSiteUrl: hasSiteUrl,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'not set'
      },
      session: {
        exists: !!session?.session,
        error: sessionError?.message || null
      },
      user: {
        exists: !!user?.user,
        id: user?.user?.id || null,
        email: user?.user?.email || null,
        error: userError?.message || null
      },
      recommendations: [
        hasUrl ? "✅ Supabase URL configured" : "❌ Missing NEXT_PUBLIC_SUPABASE_URL",
        hasKey ? "✅ Supabase Key configured" : "❌ Missing NEXT_PUBLIC_SUPABASE_ANON_KEY",
        hasSiteUrl ? "✅ Site URL configured" : "❌ Missing NEXT_PUBLIC_SITE_URL",
        session?.session ? "✅ Session exists" : "❌ No active session - user needs to sign in",
        user?.user ? "✅ User authenticated" : "❌ User not authenticated"
      ]
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      status: "error",
      message: "Auth test failed",
      error: errorMessage
    }, { status: 500 });
  }
}
