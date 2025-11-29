/**
 * Competitive Intelligence History API
 * 
 * Enhancement 3: Historical Competitor Tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { supabaseServer } from '@/lib/supabase-server';
import { getCompetitorHistory, analyzeTrends } from '@/lib/services/competitor-history-service';

/**
 * GET /api/competitive-intelligence/history/[competitor]
 * 
 * Get historical snapshots for a competitor
 * 
 * Query params:
 * - periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly'
 * - startDate: ISO date string
 * - endDate: ISO date string
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { competitor: string } }
): Promise<NextResponse> {
  try {
    const supabaseClient = await supabaseServer();
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const periodType = (searchParams.get('periodType') || 'monthly') as 'daily' | 'weekly' | 'monthly' | 'quarterly';
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Default: 90 days ago
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date();

    const competitorName = decodeURIComponent(params.competitor);

    // Get historical snapshots
    const snapshots = await getCompetitorHistory(
      user.id,
      competitorName,
      periodType,
      startDate,
      endDate
    );

    // Analyze trends
    const trends = await analyzeTrends(user.id, competitorName, snapshots);

    return NextResponse.json({
      competitor: competitorName,
      periodType,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      snapshots,
      trends,
      count: snapshots.length
    });
  } catch (error: any) {
    console.error('[CompetitorHistory] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

