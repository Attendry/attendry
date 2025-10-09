import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/ssr";

export async function POST(req: NextRequest) {
  const res = NextResponse.next();

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({
        status: "error",
        message: "Email and password are required"
      }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ request: req, response: res });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

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

    const success = NextResponse.json({
      status: "success",
      message: "Session created",
      user: {
        id: data.user?.id,
        email: data.user?.email
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });

    res.cookies.getAll().forEach((cookie) => {
      success.cookies.set(cookie);
    });

    return success;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      status: "error",
      message: "Sign in failed",
      error: errorMessage
    }, { status: 500 });
  }
}
