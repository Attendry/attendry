import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    
    if (!email || !password) {
      return NextResponse.json({
        status: "error",
        message: "Email and password are required"
      }, { status: 400 });
    }

    const supabase = await supabaseServer();
    
    // Sign in with email and password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({
        status: "error",
        message: error.message
      }, { status: 401 });
    }

    // Force refresh the session to ensure cookies are set
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: data.session.refresh_token
    });

    if (refreshError) {
      return NextResponse.json({
        status: "error",
        message: "Failed to refresh session",
        error: refreshError.message
      }, { status: 401 });
    }

    // Create response with session data
    const response = NextResponse.json({
      status: "success",
      message: "Session fixed and cookies set",
      user: {
        id: refreshData.user?.id,
        email: refreshData.user?.email
      }
    });

    // Add explicit cookie headers
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      status: "error",
      message: "Session fix failed",
      error: errorMessage
    }, { status: 500 });
  }
}
