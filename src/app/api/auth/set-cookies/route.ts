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

    // Manually set Supabase cookies (HttpOnly for security)
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    } as const;

    // Set access token cookie
    if (data.session.access_token) {
      response.cookies.set('sb-access-token', data.session.access_token, cookieOptions);
    }

    // Set refresh token cookie
    if (data.session.refresh_token) {
      response.cookies.set('sb-refresh-token', data.session.refresh_token, cookieOptions);
    }

    // Avoid storing session JSON in a cookie; rely on Supabase cookies

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
