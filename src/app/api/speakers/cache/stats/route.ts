/**
 * Speaker Enrichment Cache Statistics API
 * 
 * Returns cache statistics for monitoring and analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { getCacheStats } from "@/lib/services/speaker-enrichment-cache";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const stats = await getCacheStats();
    
    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[cache-stats] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

