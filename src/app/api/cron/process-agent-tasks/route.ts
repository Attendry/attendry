/**
 * Cron Job: Process Agent Tasks
 * 
 * This endpoint processes pending agent tasks from the queue.
 * Should be called periodically (e.g., every 5 minutes) via Vercel Cron or similar.
 * 
 * Route: /api/cron/process-agent-tasks
 * Method: GET or POST
 * Auth: Requires CRON_SECRET header for security
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentTaskQueue, getQueueStatus, processAgentTask } from '@/lib/services/job-queue';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/**
 * Process pending agent tasks
 * This is a fallback mechanism if tasks weren't processed via the queue
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleCronRequest(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleCronRequest(req);
}

async function handleCronRequest(req: NextRequest): Promise<NextResponse> {
  try {
    // Verify cron secret for security
    const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '') || 
                       req.nextUrl.searchParams.get('secret');
    
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await supabaseServer();
    
    // Get pending tasks that haven't been processed
    const { data: pendingTasks, error: tasksError } = await supabase
      .from('agent_tasks')
      .select(`
        *,
        agent:ai_agents!inner(agent_type, status)
      `)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('assigned_at', { ascending: true })
      .limit(10); // Process up to 10 tasks per run

    if (tasksError) {
      console.error('[Cron] Error fetching pending tasks:', tasksError);
      return NextResponse.json(
        { error: 'Failed to fetch tasks', details: tasksError.message },
        { status: 500 }
      );
    }

    if (!pendingTasks || pendingTasks.length === 0) {
      const queueStatus = await getQueueStatus();
      return NextResponse.json({
        success: true,
        message: 'No pending tasks to process',
        queueStatus,
      });
    }

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each task
    for (const task of pendingTasks) {
      try {
        const agentType = (task.agent as any).agent_type;
        
        // Try to queue first, but process directly if queue fails
        try {
          await agentTaskQueue.add(
            'process-task',
            {
              agentId: task.agent_id,
              taskId: task.id,
              agentType,
            },
            {
              jobId: `task-${task.id}`,
              priority: task.priority === 'urgent' ? 1 : 
                       task.priority === 'high' ? 2 : 
                       task.priority === 'medium' ? 3 : 4,
            }
          );
          results.processed++;
        } catch (queueError: any) {
          // If queue fails, process directly
          console.warn(`[Cron] Queue failed for task ${task.id}, processing directly:`, queueError.message);
          await processAgentTask(task.agent_id, task.id, agentType);
          results.processed++;
        }
      } catch (error: any) {
        console.error(`[Cron] Error processing task ${task.id}:`, error);
        results.failed++;
        results.errors.push(`Task ${task.id}: ${error.message}`);
      }
    }

    const queueStatus = await getQueueStatus();

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} tasks, ${results.failed} failed`,
      results,
      queueStatus,
    });
  } catch (error: any) {
    console.error('[Cron] Error processing agent tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

