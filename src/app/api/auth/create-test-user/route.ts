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
        emailRedirectTo: `${req.nextUrl.origin}/auth/callback?next=/events`,
        data: {
          // Add any additional user data here if needed
        }
      }
    });

    if (error) {
      console.error('User creation error:', error);
      return NextResponse.json({
        status: "error",
        message: error.message,
        details: error.message
      }, { status: 400 });
    }

    console.log('User creation result:', {
      user: data.user?.id,
      email: data.user?.email,
      emailConfirmed: data.user?.email_confirmed_at,
      session: data.session ? 'present' : 'missing'
    });

    return NextResponse.json({
      status: "success",
      message: data.session 
        ? "User created and signed in successfully" 
        : "User created successfully. Please check your email to confirm your account.",
      user: {
        id: data.user?.id,
        email: data.user?.email,
        emailConfirmed: !!data.user?.email_confirmed_at,
        needsConfirmation: !data.session,
        hasSession: !!data.session
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
