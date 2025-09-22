import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer();

    // Test authentication
    const { data: me, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      return NextResponse.json({
        status: "error",
        message: "Authentication failed",
        error: authError.message
      }, { status: 401 });
    }

    if (!me?.user) {
      return NextResponse.json({
        status: "error",
        message: "No user found",
        user: null
      }, { status: 401 });
    }

    // Test database connection
    const { data: configs, error: dbError } = await supabase
      .from("search_configurations")
      .select("id, name, industry, is_active")
      .limit(5);

    if (dbError) {
      return NextResponse.json({
        status: "error",
        message: "Database query failed",
        error: dbError.message,
        code: dbError.code,
        user: {
          id: me.user.id,
          email: me.user.email
        }
      }, { status: 500 });
    }

    return NextResponse.json({
      status: "success",
      message: "Database connection working",
      user: {
        id: me.user.id,
        email: me.user.email
      },
      configs: configs || [],
      configCount: configs?.length || 0
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      status: "error",
      message: "Unexpected error",
      error: errorMessage
    }, { status: 500 });
  }
}
