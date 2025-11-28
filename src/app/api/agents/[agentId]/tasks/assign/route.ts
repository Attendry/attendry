import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { 
  AssignTaskRequest, 
  AssignTaskResponse,
  TaskPriority,
  AgentTask
} from '@/lib/types/agents';
import { OutreachAgent } from '@/lib/agents/outreach-agent';

export const runtime = 'nodejs';

/**
 * POST /api/agents/[agentId]/tasks/assign
 * Assign a task to an agent
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { agentId: string } }
): Promise<NextResponse<AssignTaskResponse>> {
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
    const body: AssignTaskRequest = await req.json();
    const { taskType, priority = 'medium', inputData } = body;

    // Verify agent ownership and status
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

    if (agent.status === 'paused' || agent.status === 'error') {
      return NextResponse.json(
        { success: false, error: `Agent is ${agent.status}. Please update status before assigning tasks.` },
        { status: 400 }
      );
    }

    // Validate task type is supported by agent
    const capabilities = agent.capabilities || [];
    if (!capabilities.includes(taskType)) {
      return NextResponse.json(
        { success: false, error: `Agent does not support task type: ${taskType}` },
        { status: 400 }
      );
    }

    // Determine if task requires approval
    let requiresApproval = false;
    if (agent.agent_type === 'outreach') {
      const config = agent.config as any;
      requiresApproval = !config.autoApprove;
    } else {
      // Default to requiring approval for other agent types
      requiresApproval = true;
    }

    // Create task
    const { data: task, error: taskError } = await supabase
      .from('agent_tasks')
      .insert({
        agent_id: agentId,
        task_type: taskType,
        status: 'pending',
        priority,
        input_data: inputData,
        requires_approval: requiresApproval
      })
      .select()
      .single();

    if (taskError || !task) {
      return NextResponse.json(
        { success: false, error: taskError?.message || 'Failed to create task' },
        { status: 500 }
      );
    }

    // Trigger task processing asynchronously
    // In production, this would use a job queue
    // For now, we'll process immediately if agent is idle
    if (agent.status === 'idle') {
      // Process task in background (don't await)
      processTaskAsync(agentId, task.id, agent.agent_type).catch(error => {
        console.error('Error processing task asynchronously:', error);
      });
    }

    return NextResponse.json({
      success: true,
      task: task as AgentTask
    });
  } catch (error: any) {
    console.error('Error assigning task:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Process task asynchronously
 * In production, this would be handled by a job queue worker
 */
async function processTaskAsync(agentId: string, taskId: string, agentType: string): Promise<void> {
  try {
    // Import agent class based on type
    let agent;
    if (agentType === 'outreach') {
      agent = new OutreachAgent(agentId);
      await agent.initialize();
      await agent.processNextTask();
    } else {
      // Other agent types will be implemented in later phases
      console.log(`Agent type ${agentType} not yet implemented for async processing`);
    }
  } catch (error) {
    console.error('Error in async task processing:', error);
  }
}


