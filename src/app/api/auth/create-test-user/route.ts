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
    
    // Create user with email and password
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${req.nextUrl.origin}/auth/callback?next=/events`
      }
    });

    if (error) {
      return NextResponse.json({
        status: "error",
        message: error.message
      }, { status: 400 });
    }

    return NextResponse.json({
      status: "success",
      message: "User created successfully",
      user: {
        id: data.user?.id,
        email: data.user?.email,
        needsConfirmation: !data.session
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      status: "error",
      message: "Failed to create user",
      error: errorMessage
    }, { status: 500 });
  }
}
