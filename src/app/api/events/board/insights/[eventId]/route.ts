export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { EventInsightsService } from "@/lib/services/event-insights-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> | { eventId: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        error: "Not authenticated" 
      }, { status: 401 });
    }

    // Handle both Promise and direct params (Next.js 13 vs 15)
    const resolvedParams = params instanceof Promise ? await params : params;
    const eventId = resolvedParams.eventId;
    
    const insights = await EventInsightsService.getEventInsights(eventId, userRes.user.id);

    return NextResponse.json(insights);
  } catch (e: any) {
    console.error('[Insights API] Error:', e);
    return NextResponse.json({ 
      error: e?.message || "Failed to generate insights" 
    }, { status: 500 });
  }
}

