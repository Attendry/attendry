import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { RelevanceService } from "@/lib/services/relevance-service";

// GET /api/events/relevant-calendar - Get relevant upcoming events for user
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const daysAhead = parseInt(searchParams.get('daysAhead') || '90');
    const minScore = parseFloat(searchParams.get('minScore') || '0.1');

    // Get relevant events using the relevance service
    const { events, scores } = await RelevanceService.getRelevantEvents(
      userRes.user.id,
      limit,
      daysAhead
    );

    // Filter by minimum score
    const filteredEvents = events.filter((_, index) => scores[index]?.score >= minScore);
    const filteredScores = scores.filter(score => score.score >= minScore);

    // Format response
    const formattedEvents = filteredEvents.map((event, index) => ({
      ...event,
      relevance: {
        score: filteredScores[index]?.score || 0,
        reasons: filteredScores[index]?.reasons || [],
        matchedTerms: filteredScores[index]?.matchedTerms || {
          industry: [],
          icp: [],
          competitors: [],
        },
      },
    }));

    return NextResponse.json({
      success: true,
      events: formattedEvents,
      total: formattedEvents.length,
      userProfile: {
        hasProfile: true, // We know they have a profile since we got results
        industryTerms: await getUserIndustryTerms(userRes.user.id),
        icpTerms: await getUserIcpTerms(userRes.user.id),
        competitors: await getUserCompetitors(userRes.user.id),
      },
      filters: {
        limit,
        daysAhead,
        minScore,
      },
    });
  } catch (e: any) {
    console.error('Relevant calendar API error:', e);
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to fetch relevant events" 
    }, { status: 500 });
  }
}

// Helper functions to get user profile data
async function getUserIndustryTerms(userId: string): Promise<string[]> {
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from('profiles')
      .select('industry_terms')
      .eq('id', userId)
      .single();
    
    return data?.industry_terms || [];
  } catch {
    return [];
  }
}

async function getUserIcpTerms(userId: string): Promise<string[]> {
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from('profiles')
      .select('icp_terms')
      .eq('id', userId)
      .single();
    
    return data?.icp_terms || [];
  } catch {
    return [];
  }
}

async function getUserCompetitors(userId: string): Promise<string[]> {
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from('profiles')
      .select('competitors')
      .eq('id', userId)
      .single();
    
    return data?.competitors || [];
  } catch {
    return [];
  }
}
