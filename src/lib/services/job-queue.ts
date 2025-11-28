/**
 * Job Queue Service
 * Handles background processing of agent tasks using BullMQ
 */

import { Queue, Worker, Job } from 'bullmq';
import { ConnectionOptions } from 'ioredis';
import { OutreachAgent } from '@/lib/agents/outreach-agent';

// Redis connection configuration
const connection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
};

// Job queue for agent tasks
export const agentTaskQueue = new Queue('agent-tasks', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds, exponential backoff
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

// Worker for processing agent tasks
// Note: In serverless environments, workers may not run continuously
// We'll use a hybrid approach: queue for reliability, direct processing as fallback
let agentTaskWorker: Worker | null = null;

/**
 * Initialize the worker (only if Redis is available and not in serverless mode)
 */
function initializeWorker(): Worker | null {
  // In serverless environments, don't create a persistent worker
  // Instead, rely on the cron job to process tasks
  if (process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV) {
    console.log('[Job Queue] Running in serverless environment - worker will be created per request');
    return null;
  }

  try {
    const worker = new Worker(
      'agent-tasks',
      async (job: Job) => {
        const { agentId, taskId, agentType } = job.data;

        console.log(`[Job Queue] Processing task ${taskId} for agent ${agentId} (type: ${agentType})`);

        try {
          await processAgentTask(agentId, taskId, agentType);
          console.log(`[Job Queue] Successfully processed task ${taskId}`);
          return { success: true, taskId, agentId };
        } catch (error: any) {
          console.error(`[Job Queue] Error processing task ${taskId}:`, error);
          throw error; // Re-throw to trigger retry logic
        }
      },
      {
        connection,
        concurrency: 5, // Process up to 5 tasks concurrently
        limiter: {
          max: 10, // Max 10 jobs
          duration: 1000, // Per second
        },
      }
    );

    // Event handlers for monitoring
    worker.on('completed', (job) => {
      console.log(`[Job Queue] Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[Job Queue] Job ${job?.id} failed:`, err.message);
    });

    worker.on('error', (err) => {
      console.error('[Job Queue] Worker error:', err);
    });

    return worker;
  } catch (error) {
    console.error('[Job Queue] Failed to initialize worker:', error);
    return null;
  }
}

// Initialize worker if not in serverless mode
if (!process.env.VERCEL && !process.env.NEXT_PUBLIC_VERCEL_ENV) {
  agentTaskWorker = initializeWorker();
}

/**
 * Process an agent task directly (used by worker and fallback)
 */
export async function processAgentTask(
  agentId: string,
  taskId: string,
  agentType: string
): Promise<void> {
  let agent;
  
  // Initialize appropriate agent based on type
  if (agentType === 'outreach') {
    agent = new OutreachAgent(agentId);
    await agent.initialize();
    await agent.processNextTask();
  } else if (agentType === 'followup') {
    // Will be implemented below
    const { FollowupAgent } = await import('@/lib/agents/followup-agent');
    agent = new FollowupAgent(agentId);
    await agent.initialize();
    await agent.processNextTask();
  } else {
    throw new Error(`Agent type ${agentType} not yet implemented for job queue processing`);
  }
}

/**
 * Add a task to the job queue
 * Falls back to direct processing if Redis is unavailable
 */
export async function queueAgentTask(
  agentId: string,
  taskId: string,
  agentType: string,
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
): Promise<void> {
  try {
    // Try to add to queue
    const jobPriority = priority === 'urgent' ? 1 : priority === 'high' ? 2 : priority === 'medium' ? 3 : 4;

    await agentTaskQueue.add(
      'process-task',
      { agentId, taskId, agentType },
      {
        priority: jobPriority,
        jobId: `task-${taskId}`, // Use task ID as job ID to prevent duplicates
      }
    );

    console.log(`[Job Queue] Queued task ${taskId} for agent ${agentId} with priority ${priority}`);
  } catch (error: any) {
    // If queue fails (e.g., Redis unavailable), process directly
    console.warn(`[Job Queue] Failed to queue task ${taskId}, processing directly:`, error.message);
    
    // Process task directly as fallback
    try {
      await processAgentTask(agentId, taskId, agentType);
      console.log(`[Job Queue] Successfully processed task ${taskId} directly (fallback mode)`);
    } catch (processError: any) {
      console.error(`[Job Queue] Failed to process task ${taskId} directly:`, processError);
      throw processError;
    }
  }
}

/**
 * Get queue status
 */
export async function getQueueStatus(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const [waiting, active, completed, failed] = await Promise.all([
    agentTaskQueue.getWaitingCount(),
    agentTaskQueue.getActiveCount(),
    agentTaskQueue.getCompletedCount(),
    agentTaskQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}

/**
 * Clean up old jobs (can be called periodically)
 */
export async function cleanOldJobs(): Promise<void> {
  await agentTaskQueue.clean(24 * 3600 * 1000, 1000, 'completed'); // Clean completed jobs older than 24h
  await agentTaskQueue.clean(7 * 24 * 3600 * 1000, 100, 'failed'); // Clean failed jobs older than 7 days
}

