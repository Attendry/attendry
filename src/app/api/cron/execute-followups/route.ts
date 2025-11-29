/**
 * Cron Job: Execute Follow-ups
 * 
 * This endpoint executes scheduled follow-ups that are due.
 * Should be called periodically (e.g., every hour) via Vercel Cron or similar.
 * 
 * Route: /api/cron/execute-followups
 * Method: GET or POST
 * Auth: Requires CRON_SECRET header for security
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { processAgentTask } from '@/lib/services/job-queue';

export const runtime = 'nodejs';

/**
 * Execute due follow-ups
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
    const now = new Date().toISOString();
    
    // Get due follow-ups (scheduled_for <= now and status = 'scheduled')
    const { data: dueFollowups, error: followupsError } = await supabase
      .from('agent_followup_schedule')
      .select(`
        *,
        agent:ai_agents!inner(agent_type, id)
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(20); // Process up to 20 follow-ups per run

    if (followupsError) {
      console.error('[Cron] Error fetching due follow-ups:', followupsError);
      return NextResponse.json(
        { error: 'Failed to fetch follow-ups', details: followupsError.message },
        { status: 500 }
      );
    }

    if (!dueFollowups || dueFollowups.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No due follow-ups to execute',
        executed: 0,
      });
    }

    const results = {
      executed: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Execute each follow-up
    for (const followup of dueFollowups) {
      try {
        const agentId = (followup.agent as any).id;
        
        // Create execute_followup task
        const { data: task, error: taskError } = await supabase
          .from('agent_tasks')
          .insert({
            agent_id: agentId,
            task_type: 'execute_followup',
            status: 'pending',
            priority: 'high',
            input_data: {
              followupId: followup.id,
              contactId: followup.contact_id,
              originalOutreachId: followup.original_outreach_id,
            },
            requires_approval: false,
          })
          .select()
          .single();

        if (taskError || !task) {
          throw new Error(`Failed to create task: ${taskError?.message}`);
        }

        // Process the task
        try {
          await processAgentTask(agentId, task.id, 'followup');
          results.executed++;
        } catch (processError: any) {
          console.error(`[Cron] Error processing follow-up ${followup.id}:`, processError);
          results.failed++;
          results.errors.push(`Follow-up ${followup.id}: ${processError.message}`);
        }
      } catch (error: any) {
        console.error(`[Cron] Error executing follow-up ${followup.id}:`, error);
        results.failed++;
        results.errors.push(`Follow-up ${followup.id}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Executed ${results.executed} follow-ups, ${results.failed} failed`,
      results,
    });
  } catch (error: any) {
    console.error('[Cron] Error executing follow-ups:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

