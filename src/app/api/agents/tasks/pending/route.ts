import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { AgentTask, AgentType } from '@/lib/types/agents';

export const runtime = 'nodejs';

/**
 * GET /api/agents/tasks/pending
 * Get all pending tasks across all user's agents (for approval)
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
    const agentType = searchParams.get('agentType') as AgentType | null;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get user's agents
    let agentsQuery = supabase
      .from('ai_agents')
      .select('id, agent_type, name')
      .eq('user_id', user.id);

    if (agentType) {
      agentsQuery = agentsQuery.eq('agent_type', agentType);
    }

    const { data: agents } = await agentsQuery;

    if (!agents || agents.length === 0) {
      return NextResponse.json({
        success: true,
        tasks: [],
        total: 0
      });
    }

    const agentIds = agents.map(a => a.id);

    // Get pending tasks that require approval
    const { data: tasks, error, count } = await supabase
      .from('agent_tasks')
      .select('*', { count: 'exact' })
      .in('agent_id', agentIds)
      .eq('requires_approval', true)
      .in('status', ['pending', 'completed'])
      .order('assigned_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Enrich with agent info
    const tasksWithAgent = (tasks || []).map(task => {
      const agent = agents.find(a => a.id === task.agent_id);
      return {
        ...task,
        agent: agent ? {
          id: agent.id,
          agent_type: agent.agent_type,
          name: agent.name
        } : null
      };
    });

    return NextResponse.json({
      success: true,
      tasks: tasksWithAgent as (AgentTask & { agent: any })[],
      total: count || 0
    });
  } catch (error: any) {
    console.error('Error fetching pending tasks:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


