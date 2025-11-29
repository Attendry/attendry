import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { AgentOutreachDraft, DraftStatus } from '@/lib/types/agents';

export const runtime = 'nodejs';

/**
 * GET /api/agents/outreach/drafts
 * Get all outreach drafts (pending approval)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = (searchParams.get('status') as DraftStatus) || 'pending_approval';
    const agentId = searchParams.get('agentId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get user's outreach agents
    let agentsQuery = supabase
      .from('ai_agents')
      .select('id, agent_type, name')
      .eq('user_id', user.id)
      .eq('agent_type', 'outreach');

    if (agentId) {
      agentsQuery = agentsQuery.eq('id', agentId);
    }

    const { data: agents } = await agentsQuery;

    if (!agents || agents.length === 0) {
      return NextResponse.json({
        success: true,
        drafts: [],
        total: 0
      });
    }

    const agentIds = agents.map(a => a.id);

    // Get drafts
    let draftsQuery = supabase
      .from('agent_outreach_drafts')
      .select(`
        *,
        contact:saved_speaker_profiles(*),
        opportunity:user_opportunities(*)
      `, { count: 'exact' })
      .in('agent_id', agentIds)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: drafts, error, count } = await draftsQuery;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Enrich with agent info
    const enrichedDrafts = (drafts || []).map((draft: any) => {
      const agent = agents.find(a => a.id === draft.agent_id);
      return {
        ...draft,
        agent: agent ? {
          id: agent.id,
          agent_type: agent.agent_type,
          name: agent.name
        } : null
      };
    });

    return NextResponse.json({
      success: true,
      drafts: enrichedDrafts as (AgentOutreachDraft & {
        agent: any;
        contact: any;
        opportunity: any;
      })[],
      total: count || 0
    });
  } catch (error: any) {
    console.error('Error fetching drafts:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


