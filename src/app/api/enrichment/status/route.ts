/**
 * Enrichment Service Status API
 * 
 * Returns status of enrichment services (circuit breaker states, availability)
 */

import { NextRequest, NextResponse } from "next/server";
import { getEnrichmentCircuitBreaker } from "@/lib/services/enrichment-circuit-breaker";
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

    const breaker = getEnrichmentCircuitBreaker();
    const statuses = breaker.getAllServiceStatuses();
    
    return NextResponse.json({
      success: true,
      services: statuses,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[enrichment-status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

