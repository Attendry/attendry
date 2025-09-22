import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    
    // Get current session to check if we're authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    const debugInfo: any = {
      status: "success",
      message: "User debug completed",
      currentSession: {
        exists: !!session,
        user: session?.user ? {
          id: session.user.id,
          email: session.user.email,
          emailConfirmed: session.user.email_confirmed_at ? true : false
        } : null
      },
      recommendations: []
    };

    // If we have a session, we can check users (this is a debug endpoint)
    if (session?.user) {
      debugInfo.recommendations.push(`✅ Current user: ${session.user.email}`);
      debugInfo.recommendations.push(`✅ Email confirmed: ${session.user.email_confirmed_at ? 'Yes' : 'No'}`);
    } else {
      debugInfo.recommendations.push("❌ No active session - cannot check user details");
    }

    return NextResponse.json(debugInfo);
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      message: "User debug failed",
      error: error.message
    }, { status: 500 });
  }
}
