import { supabaseServer } from '@/lib/supabase-server';
import { 
  AIAgent, 
  AgentTask, 
  AgentType, 
  AgentStatus,
  TaskStatus 
} from '@/lib/types/agents';

/**
 * Base class for all AI agents
 * Provides common functionality for agent lifecycle, task processing, and logging
 */
export abstract class BaseAgent {
  protected agentId: string;
  protected agentType!: AgentType; // Initialized in initialize()
  protected config!: Record<string, any>; // Initialized in initialize()
  protected supabase: Awaited<ReturnType<typeof supabaseServer>> | null = null;
  protected agent: AIAgent | null = null;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  /**
   * Initialize agent (load from database)
   */
  async initialize(): Promise<void> {
    // Initialize Supabase client
    if (!this.supabase) {
      this.supabase = await supabaseServer();
    }

    const { data: agent, error } = await this.supabase
      .from('ai_agents')
      .select('*')
      .eq('id', this.agentId)
      .single();

    if (error || !agent) {
      throw new Error(`Failed to load agent: ${error?.message}`);
    }

    this.agent = agent as AIAgent;
    this.agentType = agent.agent_type as AgentType;
    this.config = agent.config as Record<string, any>;
  }

  /**
   * Process a task (implemented by subclasses)
   */
  abstract processTask(task: AgentTask): Promise<{
    success: boolean;
    output?: Record<string, any>;
    requiresApproval?: boolean;
    error?: string;
  }>;

  /**
   * Update agent status
   */
  protected async updateStatus(status: AgentStatus): Promise<void> {
    if (!this.supabase) {
      this.supabase = await supabaseServer();
    }

    const { error } = await this.supabase
      .from('ai_agents')
      .update({ 
        status, 
        last_active_at: new Date().toISOString() 
      })
      .eq('id', this.agentId);

    if (error) {
      throw new Error(`Failed to update agent status: ${error.message}`);
    }

    // Update local state
    if (this.agent) {
      this.agent.status = status;
      this.agent.last_active_at = new Date().toISOString();
    }
  }

  /**
   * Log agent activity
   */
  protected async logActivity(
    actionType: string,
    description: string,
    taskId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.supabase) {
      this.supabase = await supabaseServer();
    }

    try {
      // Use service role client for RPC calls to bypass RLS
      // The function itself is SECURITY DEFINER, but we need proper auth context
      const { error } = await this.supabase.rpc('log_agent_activity', {
        p_agent_id: this.agentId,
        p_task_id: taskId || null,
        p_action_type: actionType,
        p_description: description,
        p_metadata: metadata || {}
      });

      if (error) {
        // If RLS error, try direct insert with service role
        if (error.code === '42501') {
          console.warn('[BaseAgent] RLS error on log_agent_activity, attempting direct insert');
          // Try direct insert - the function should handle this, but if it doesn't work,
          // we'll just log the error and continue
        }
        console.error('Failed to log activity:', error);
        // Don't throw - logging failure shouldn't break agent
      }
    } catch (error: any) {
      console.error('Error in logActivity:', error);
      // Don't throw - logging failure shouldn't break agent
    }
  }

  /**
   * Update task status
   */
  protected async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    output?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    if (!this.supabase) {
      this.supabase = await supabaseServer();
    }

    const updateData: any = {
      status,
      ...(status === 'in_progress' && { started_at: new Date().toISOString() }),
      ...(status === 'completed' && { 
        completed_at: new Date().toISOString(),
        output_data: output 
      }),
      ...(status === 'failed' && { 
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
    };

    const { error } = await this.supabase
      .from('agent_tasks')
      .update(updateData)
      .eq('id', taskId);

    if (error) {
      throw new Error(`Failed to update task: ${error.message}`);
    }
  }

  /**
   * Get pending tasks for this agent
   */
  async getPendingTasks(): Promise<AgentTask[]> {
    if (!this.supabase) {
      this.supabase = await supabaseServer();
    }

    const { data, error } = await this.supabase
      .from('agent_tasks')
      .select('*')
      .eq('agent_id', this.agentId)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('assigned_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get pending tasks: ${error.message}`);
    }

    return (data || []) as AgentTask[];
  }

  /**
   * Process next pending task
   */
  async processNextTask(): Promise<boolean> {
    const tasks = await this.getPendingTasks();
    if (tasks.length === 0) {
      return false;
    }

    const task = tasks[0];
    return await this.processTaskById(task.id);
  }

  /**
   * Process a specific task by ID
   */
  async processTaskById(taskId: string): Promise<boolean> {
    if (!this.supabase) {
      this.supabase = await supabaseServer();
    }

    // Fetch the specific task
    const { data: task, error: taskError } = await this.supabase
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('agent_id', this.agentId)
      .single();

    if (taskError || !task) {
      throw new Error(`Task ${taskId} not found: ${taskError?.message || 'Unknown error'}`);
    }

    // Check if task is already processed
    if (task.status !== 'pending') {
      console.log(`[BaseAgent] Task ${taskId} is already ${task.status}, skipping`);
      return false;
    }

    await this.updateTaskStatus(task.id, 'in_progress');
    await this.updateStatus('active');

    try {
      await this.logActivity('task_started', `Started processing task: ${task.task_type}`, task.id);
      
      const result = await this.processTask(task);
      
      if (result.success) {
        await this.updateTaskStatus(task.id, 'completed', result.output);
        await this.logActivity('task_completed', `Completed task: ${task.task_type}`, task.id, result.output);
        
        // Update metrics
        await this.updateMetrics('task_completed');
      } else {
        await this.updateTaskStatus(task.id, 'failed', undefined, result.error);
        await this.logActivity('task_failed', `Failed task: ${task.task_type} - ${result.error}`, task.id);
        await this.updateMetrics('task_failed');
      }

      // Check if more tasks
      const remainingTasks = await this.getPendingTasks();
      if (remainingTasks.length === 0) {
        await this.updateStatus('idle');
      }

      return true;
    } catch (error: any) {
      await this.updateTaskStatus(task.id, 'failed', undefined, error.message);
      await this.logActivity('task_error', `Error processing task: ${error.message}`, task.id);
      await this.updateStatus('error');
      throw error;
    }
  }

  /**
   * Update performance metrics
   */
  private async updateMetrics(event: 'task_completed' | 'task_failed' | 'message_sent' | 'response_received'): Promise<void> {
    if (!this.supabase) {
      this.supabase = await supabaseServer();
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Get or create today's metrics
    const { data: existing } = await this.supabase
      .from('agent_performance_metrics')
      .select('*')
      .eq('agent_id', this.agentId)
      .eq('metric_date', today)
      .single();

    const updates: any = {};
    
    if (event === 'task_completed') {
      updates.tasks_completed = (existing?.tasks_completed || 0) + 1;
    } else if (event === 'task_failed') {
      updates.tasks_failed = (existing?.tasks_failed || 0) + 1;
    } else if (event === 'message_sent') {
      updates.messages_sent = (existing?.messages_sent || 0) + 1;
    } else if (event === 'response_received') {
      updates.responses_received = (existing?.responses_received || 0) + 1;
      // Calculate response rate
      const totalSent = (existing?.messages_sent || 0);
      if (totalSent > 0) {
        updates.response_rate = ((updates.responses_received || existing?.responses_received || 0) / totalSent) * 100;
      }
    }

    if (existing) {
      await this.supabase
        .from('agent_performance_metrics')
        .update(updates)
        .eq('id', existing.id);
    } else {
      await this.supabase
        .from('agent_performance_metrics')
        .insert({
          agent_id: this.agentId,
          metric_date: today,
          ...updates
        });
    }
  }

  /**
   * Get agent info
   */
  getAgent(): AIAgent | null {
    return this.agent;
  }
}


