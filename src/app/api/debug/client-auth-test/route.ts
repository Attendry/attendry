import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // This endpoint will be called from the client side
    // to test if the client can access Supabase properly
    
    return NextResponse.json({
      status: "success",
      message: "Client auth test endpoint ready",
      instructions: [
        "1. Open browser console",
        "2. Run: fetch('/api/debug/client-auth-test').then(r => r.json()).then(console.log)",
        "3. Check if client-side Supabase is working"
      ],
      clientTest: `
        // Run this in browser console:
        import { createBrowserClient } from '@supabase/ssr';
        
        const supabase = createBrowserClient(
          '${process.env.NEXT_PUBLIC_SUPABASE_URL}',
          '${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}'
        );
        
        supabase.auth.getSession().then(({data, error}) => {
          console.log('Client session:', data);
          console.log('Client error:', error);
        });
      `
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      status: "error",
      message: "Client auth test failed",
      error: errorMessage
    }, { status: 500 });
  }
}
