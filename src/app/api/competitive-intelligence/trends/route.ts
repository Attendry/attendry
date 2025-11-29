/**
 * Competitive Intelligence Trends API
 * 
 * Enhancement 3: Trend Analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * GET /api/competitive-intelligence/trends
 * 
 * Get trends for all competitors or a specific competitor
 * 
 * Query params:
 * - competitor: Optional competitor name
 * - metric: Optional metric ('event_count', 'activity_score', etc.)
 * - period: Optional period ('week', 'month', 'quarter')
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
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
    const competitor = searchParams.get('competitor');
    const metric = searchParams.get('metric') || 'event_count';
    const period = searchParams.get('period') || 'month';

    const supabase = supabaseAdmin();

    let query = supabase
      .from('competitor_trends')
      .select('*')
      .eq('user_id', user.id)
      .eq('metric', metric);

    if (competitor) {
      query = query.eq('competitor_name', competitor);
    }

    // Filter by period
    const now = new Date();
    let periodStart: Date;
    if (period === 'week') {
      periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else { // quarter
      periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    query = query.gte('period_start', periodStart.toISOString().split('T')[0]);

    const { data: trends, error } = await query.order('period_start', { ascending: false });

    if (error) {
      console.error('[CompetitorTrends] Error fetching trends:', error);
      return NextResponse.json(
        { error: 'Failed to fetch trends', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      trends: trends || [],
      count: trends?.length || 0,
      period,
      metric
    });
  } catch (error: any) {
    console.error('[CompetitorTrends] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

