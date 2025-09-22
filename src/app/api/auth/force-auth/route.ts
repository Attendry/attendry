import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      return NextResponse.json({
        status: "error",
        message: "Session error",
        error: sessionError.message
      }, { status: 401 });
    }

    if (!session) {
      return NextResponse.json({
        status: "error",
        message: "No active session",
        action: "Please sign in first"
      }, { status: 401 });
    }

    // Force refresh the session to ensure cookies are set
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: session.refresh_token
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
      message: "Session refreshed and cookies set",
      user: {
        id: refreshData.user?.id,
        email: refreshData.user?.email
      },
      session: {
        accessToken: refreshData.session?.access_token ? 'present' : 'missing',
        refreshToken: refreshData.session?.refresh_token ? 'present' : 'missing'
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      status: "error",
      message: "Force auth failed",
      error: errorMessage
    }, { status: 500 });
  }
}
