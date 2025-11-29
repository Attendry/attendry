/**
 * User Cost Summary API
 * 
 * Returns cost summary for the current user
 */

import { NextRequest, NextResponse } from "next/server";
import { getCostTracker } from "@/lib/services/cost-tracker";
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

    const userId = userRes.user.id;
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')!) 
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;

    const costTracker = getCostTracker();
    const summary = await costTracker.getUserCostSummary(userId, startDate, endDate);
    const monthlyCost = await costTracker.getMonthlyCost(userId);
    
    return NextResponse.json({
      success: true,
      summary,
      monthlyCost,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[costs-summary] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

