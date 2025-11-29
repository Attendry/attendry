import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { GetAgentStatusResponse } from '@/lib/types/agents';

export const runtime = 'nodejs';

/**
 * GET /api/agents/[agentId]/status
 * Get comprehensive agent status
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { agentId: string } }
): Promise<NextResponse<GetAgentStatusResponse | { success: false; error: string }>> {
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

    // Get agent
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Get current tasks
    const { data: tasks } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('agent_id', agentId)
      .in('status', ['pending', 'in_progress'])
      .order('priority', { ascending: false })
      .order('assigned_at', { ascending: true });

    // Get pending approvals count
    const { count: pendingCount } = await supabase
      .from('agent_outreach_drafts')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', 'pending_approval');

    // Get recent activity
    const { data: activities } = await supabase
      .from('agent_activity_log')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get performance metrics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: metrics } = await supabase
      .from('agent_performance_metrics')
      .select('*')
      .eq('agent_id', agentId)
      .gte('metric_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('metric_date', { ascending: false });

    // Calculate summary performance
    const totalCompleted = metrics?.reduce((sum, m) => sum + (m.tasks_completed || 0), 0) || 0;
    const totalFailed = metrics?.reduce((sum, m) => sum + (m.tasks_failed || 0), 0) || 0;
    const totalTasks = totalCompleted + totalFailed;
    const successRate = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;

    // Calculate average response time (simplified - would need more data)
    const avgResponseTime = metrics && metrics.length > 0
      ? metrics.reduce((sum, m) => sum + (m.average_response_time_hours || 0), 0) / metrics.length
      : 0;

    return NextResponse.json({
      success: true,
      status: {
        agent,
        currentTasks: (tasks || []) as any[],
        pendingApprovals: pendingCount || 0,
        recentActivity: (activities || []) as any[],
        performance: {
          tasksCompleted: totalCompleted,
          successRate,
          averageResponseTime: avgResponseTime
        }
      }
    } as { success: true; status: GetAgentStatusResponse });
  } catch (error: any) {
    console.error('Error fetching agent status:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


