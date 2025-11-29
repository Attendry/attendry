/**
 * PHASE 1: Single Opportunity API
 * 
 * GET /api/opportunities/[id]
 * 
 * Returns a single opportunity with full details including event data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const opportunityId = params.id;

    // Fetch opportunity with event details
    const { data: opportunity, error } = await supabase
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
          speakers,
          sponsors,
          participating_organizations,
          partners,
          competitors,
          source_url
        )
      `)
      .eq('id', opportunityId)
      .eq('user_id', user.id)
      .single();

    if (error || !opportunity) {
      return NextResponse.json(
        { error: 'Opportunity not found' },
        { status: 404 }
      );
    }

    // Mark as viewed if status is 'new'
    if (opportunity.status === 'new') {
      await supabase
        .from('user_opportunities')
        .update({ 
          status: 'viewed',
          viewed_at: new Date().toISOString()
        })
        .eq('id', opportunityId);
    }

    // Format response
    const formattedOpportunity = {
      id: opportunity.id,
      event: opportunity.event,
      signals: {
        target_accounts_attending: opportunity.target_accounts_attending,
        icp_matches: opportunity.icp_matches,
        competitor_presence: opportunity.competitor_presence,
        account_connections: opportunity.account_connections
      },
      relevance: {
        score: opportunity.relevance_score,
        reasons: opportunity.relevance_reasons || [],
        signal_strength: opportunity.signal_strength
      },
      status: opportunity.status,
      dismissal_reason: opportunity.dismissal_reason,
      discovery_method: opportunity.discovery_method,
      created_at: opportunity.created_at,
      viewed_at: opportunity.viewed_at,
      actioned_at: opportunity.actioned_at
    };

    return NextResponse.json({
      success: true,
      opportunity: formattedOpportunity
    });
  } catch (error) {
    console.error('[opportunities-detail] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

