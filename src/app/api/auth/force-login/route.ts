import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    
    // Force a fresh session check
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      return NextResponse.json({
        status: "error",
        message: "Session error",
        error: sessionError.message
      }, { status: 401 });
    }

    if (!session?.session) {
      return NextResponse.json({
        status: "error",
        message: "No active session",
        action: "Please sign in first"
      }, { status: 401 });
    }

    // Try to refresh the session
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: session.session.refresh_token
    });

    if (refreshError) {
      return NextResponse.json({
        status: "error",
        message: "Failed to refresh session",
        error: refreshError.message
      }, { status: 401 });
    }

    return NextResponse.json({
      status: "success",
      message: "Session refreshed",
      user: {
        id: refreshData.user?.id,
        email: refreshData.user?.email
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      status: "error",
      message: "Force login failed",
      error: errorMessage
    }, { status: 500 });
  }
}
