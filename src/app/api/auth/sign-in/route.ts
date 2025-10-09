import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function required(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({
        status: "error",
        message: "Email and password are required"
      }, { status: 400 });
    }

    const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseAnonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const pendingCookies: Array<{ name: string; value: string; options?: CookieOptions }> = [];

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          pendingCookies.push({ name, value, options });
        },
        remove(name: string, options: CookieOptions) {
          pendingCookies.push({ name, value: "", options: { ...options, maxAge: 0 } });
        }
      }
    });

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

    const response = NextResponse.json({
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

    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set({
        name,
        value,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        ...options
      });
    });

    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      status: "error",
      message: "Sign in failed",
      error: errorMessage
    }, { status: 500 });
  }
}
