import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { AgentPerformanceMetrics } from '@/lib/types/agents';

export const runtime = 'nodejs';

/**
 * GET /api/agents/[agentId]/performance
 * Get agent performance metrics with optional time range
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
    const days = parseInt(searchParams.get('days') || '30');

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

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get performance metrics
    const { data: metrics, error: metricsError } = await supabase
      .from('agent_performance_metrics')
      .select('*')
      .eq('agent_id', agentId)
      .gte('metric_date', startDateStr)
      .order('metric_date', { ascending: true });

    if (metricsError) {
      return NextResponse.json(
        { success: false, error: metricsError.message },
        { status: 500 }
      );
    }

    // Get draft statistics
    const { data: drafts } = await supabase
      .from('agent_outreach_drafts')
      .select('status, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', startDate.toISOString());

    // Get task statistics
    const { data: tasks } = await supabase
      .from('agent_tasks')
      .select('status, completed_at, started_at')
      .eq('agent_id', agentId)
      .gte('assigned_at', startDate.toISOString());

    // Calculate aggregated metrics
    const totalTasks = tasks?.length || 0;
    const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
    const failedTasks = tasks?.filter(t => t.status === 'failed').length || 0;
    const successRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const totalDrafts = drafts?.length || 0;
    const approvedDrafts = drafts?.filter(d => d.status === 'approved' || d.status === 'sent').length || 0;
    const rejectedDrafts = drafts?.filter(d => d.status === 'rejected').length || 0;
    const approvalRate = totalDrafts > 0 ? (approvedDrafts / totalDrafts) * 100 : 0;

    // Calculate average time to draft (from task assignment to draft creation)
    let avgTimeToDraft = 0;
    if (tasks && drafts) {
      const draftTimes: number[] = [];
      tasks.forEach(task => {
        if (task.completed_at && task.started_at) {
          const start = new Date(task.started_at).getTime();
          const end = new Date(task.completed_at).getTime();
          const hours = (end - start) / (1000 * 60 * 60);
          if (hours > 0 && hours < 24) { // Reasonable range
            draftTimes.push(hours);
          }
        }
      });
      if (draftTimes.length > 0) {
        avgTimeToDraft = draftTimes.reduce((sum, t) => sum + t, 0) / draftTimes.length;
      }
    }

    // Aggregate metrics by date for charts
    const metricsByDate = (metrics || []).reduce((acc: any, m: AgentPerformanceMetrics) => {
      const date = m.metric_date;
      if (!acc[date]) {
        acc[date] = {
          date,
          tasksCompleted: 0,
          tasksFailed: 0,
          messagesSent: 0,
          responsesReceived: 0,
          responseRate: 0,
          opportunitiesIdentified: 0
        };
      }
      acc[date].tasksCompleted += m.tasks_completed || 0;
      acc[date].tasksFailed += m.tasks_failed || 0;
      acc[date].messagesSent += m.messages_sent || 0;
      acc[date].responsesReceived += m.responses_received || 0;
      acc[date].opportunitiesIdentified += m.opportunities_identified || 0;
      if (m.response_rate) {
        acc[date].responseRate = m.response_rate;
      }
      return acc;
    }, {});

    const chartData = Object.values(metricsByDate).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate totals from metrics
    const totalMetrics = (metrics || []).reduce((acc, m) => ({
      tasksCompleted: acc.tasksCompleted + (m.tasks_completed || 0),
      tasksFailed: acc.tasksFailed + (m.tasks_failed || 0),
      messagesSent: acc.messagesSent + (m.messages_sent || 0),
      responsesReceived: acc.responsesReceived + (m.responses_received || 0),
      opportunitiesIdentified: acc.opportunitiesIdentified + (m.opportunities_identified || 0)
    }), {
      tasksCompleted: 0,
      tasksFailed: 0,
      messagesSent: 0,
      responsesReceived: 0,
      opportunitiesIdentified: 0
    });

    const overallResponseRate = totalMetrics.messagesSent > 0
      ? (totalMetrics.responsesReceived / totalMetrics.messagesSent) * 100
      : 0;

    return NextResponse.json({
      success: true,
      performance: {
        summary: {
          tasksCompleted: completedTasks || totalMetrics.tasksCompleted,
          tasksFailed: failedTasks || totalMetrics.tasksFailed,
          successRate,
          draftsCreated: totalDrafts,
          draftsApproved: approvedDrafts,
          draftsRejected: rejectedDrafts,
          approvalRate,
          messagesSent: totalMetrics.messagesSent,
          responsesReceived: totalMetrics.responsesReceived,
          responseRate: overallResponseRate,
          avgTimeToDraft: Math.round(avgTimeToDraft * 10) / 10,
          opportunitiesIdentified: totalMetrics.opportunitiesIdentified
        },
        chartData,
        period: {
          days,
          startDate: startDateStr,
          endDate: new Date().toISOString().split('T')[0]
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching performance:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

