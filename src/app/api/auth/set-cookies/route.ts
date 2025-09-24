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

    if (!data.session) {
      return NextResponse.json({
        status: "error",
        message: "No session created"
      }, { status: 401 });
    }

    // Create response with session data
    const response = NextResponse.json({
      status: "success",
      message: "Session created and cookies will be set",
      user: {
        id: data.user?.id,
        email: data.user?.email
      },
      session: {
        accessToken: data.session.access_token ? 'present' : 'missing',
        refreshToken: data.session.refresh_token ? 'present' : 'missing'
      }
    });

    // The Supabase server client should have already set the proper cookies
    // through the supabaseServer() call above. No need to manually set cookies.

    return response;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      status: "error",
      message: "Cookie setting failed",
      error: errorMessage
    }, { status: 500 });
  }
}
