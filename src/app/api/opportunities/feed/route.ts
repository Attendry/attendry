/**
 * PHASE 1: Opportunity Feed API
 * 
 * GET /api/opportunities/feed
 * 
 * Returns a paginated feed of opportunities for the authenticated user.
 * Supports filtering by status, signal strength, and sorting by relevance/date.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { TemporalIntelligenceEngine } from '@/lib/services/temporal-intelligence-engine';

export const runtime = 'nodejs';

interface FeedQueryParams {
  status?: string; // Comma-separated: 'new,viewed,saved'
  signal_strength?: 'strong' | 'medium' | 'weak';
  sort?: 'relevance' | 'date' | 'urgency';
  page?: number;
  limit?: number;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const statusFilter = searchParams.get('status')?.split(',') || ['new', 'viewed', 'saved'];
    const signalStrength = searchParams.get('signal_strength') as FeedQueryParams['signal_strength'] | null;
    const sortBy = searchParams.get('sort') || 'relevance';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    // Build query
    let query = supabase
      .from('user_opportunities')
      .select(`
        *,
        event:collected_events (
          id,
          title,
          starts_at,
          ends_at,
          city,
          country,
          venue,
          organizer,
          description,
          topics,
          source_url
        )
      `)
      .eq('user_id', user.id)
      .in('status', statusFilter);

    // Filter by signal strength
    if (signalStrength) {
      query = query.eq('signal_strength', signalStrength);
    }

    // Sort
    if (sortBy === 'relevance') {
      query = query.order('relevance_score', { ascending: false });
    } else if (sortBy === 'date') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('relevance_score', { ascending: false });
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: opportunities, error } = await query;

    if (error) {
      console.error('[opportunities-feed] Error fetching opportunities:', error);
      return NextResponse.json(
        { error: 'Failed to fetch opportunities' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('user_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', statusFilter);

    // Format response with temporal intelligence
    const formattedOpportunities = (opportunities || []).map(opp => {
      const event = opp.event as any;
      const actionTiming = TemporalIntelligenceEngine.calculateActionTiming(
        event?.starts_at || null
      );

      return {
        id: opp.id,
        event: opp.event,
        signals: {
          target_accounts_attending: opp.target_accounts_attending,
          icp_matches: opp.icp_matches,
          competitor_presence: opp.competitor_presence,
          account_connections: opp.account_connections
        },
        relevance: {
          score: opp.relevance_score,
          reasons: opp.relevance_reasons || [],
          signal_strength: opp.signal_strength
        },
        action_timing: actionTiming,
        status: opp.status,
        dismissal_reason: opp.dismissal_reason,
        discovery_method: opp.discovery_method,
        created_at: opp.created_at,
        viewed_at: opp.viewed_at,
        actioned_at: opp.actioned_at
      };
    });

    return NextResponse.json({
      success: true,
      opportunities: formattedOpportunities,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('[opportunities-feed] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

