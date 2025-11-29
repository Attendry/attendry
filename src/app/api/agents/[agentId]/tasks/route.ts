import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { AgentTask, TaskStatus } from '@/lib/types/agents';

export const runtime = 'nodejs';

/**
 * GET /api/agents/[agentId]/tasks
 * Get agent's tasks
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { agentId: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { agentId } = params;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as TaskStatus | null;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Verify agent ownership
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('id')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single();

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    let query = supabase
      .from('agent_tasks')
      .select('*', { count: 'exact' })
      .eq('agent_id', agentId)
      .order('assigned_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: tasks, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tasks: (tasks || []) as AgentTask[],
      total: count || 0
    });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


