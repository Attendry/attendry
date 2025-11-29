/**
 * Job Queue Service
 * Handles background processing of agent tasks using BullMQ
 */

import { Queue, Worker, Job } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import { OutreachAgent } from '@/lib/agents/outreach-agent';

// Redis connection configuration
function getRedisConnection(): RedisOptions | null {
  // Priority 1: Check for standard Redis URL (most common, especially for Upstash)
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const url = new URL(redisUrl);
      const isTls = url.protocol === 'rediss:'; // rediss:// means TLS
      
      const connection: RedisOptions = {
        host: url.hostname,
        port: parseInt(url.port || '6379'),
        password: url.password || undefined,
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: false, // Don't check connection on init
        lazyConnect: true, // Connect only when needed
      };

      // Enable TLS if using rediss:// protocol (Upstash requires TLS)
      if (isTls) {
        connection.tls = {
          rejectUnauthorized: true,
        };
        console.log('[Job Queue] Using REDIS_URL with TLS (rediss://)');
      } else {
        console.log('[Job Queue] Using REDIS_URL without TLS (redis://)');
      }

      return connection;
    } catch (error) {
      console.warn('[Job Queue] Invalid REDIS_URL, falling back to direct processing');
    }
  }

  // Priority 2: Check for Upstash REST credentials and construct TCP connection
  // (Only if REDIS_URL is not set)
  const upstashRestUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashTcpPassword = process.env.UPSTASH_REDIS_TCP_PASSWORD;
  
  if (upstashRestUrl && upstashTcpPassword) {
    try {
      // Extract hostname from REST URL (e.g., https://xxx-xxx.upstash.io -> xxx-xxx.upstash.io)
      const restUrl = new URL(upstashRestUrl);
      const hostname = restUrl.hostname;
      
      // Upstash TCP endpoint uses the same hostname but port 6379 (or from env)
      const tcpPort = parseInt(process.env.UPSTASH_REDIS_TCP_PORT || '6379');
      
      console.log('[Job Queue] Using Upstash TCP connection for BullMQ');
      return {
        host: hostname,
        port: tcpPort,
        password: upstashTcpPassword,
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: false, // Don't check connection on init
        lazyConnect: true, // Connect only when needed
        tls: {
          // Upstash requires TLS for TCP connections
          rejectUnauthorized: true,
        },
      };
    } catch (error) {
      console.warn('[Job Queue] Failed to parse Upstash REST URL, trying other configs:', error);
    }
  }

  // Priority 3: Check for individual Redis config
  const redisHost = process.env.REDIS_HOST;
  if (redisHost && redisHost !== 'localhost') {
    return {
      host: redisHost,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false, // Don't check connection on init
      lazyConnect: true, // Connect only when needed
    };
  }

  // No Redis config found
  return null;
}

// Lazy initialization of queue (only create if Redis is available)
let agentTaskQueue: Queue | null = null;

function getQueue(): Queue | null {
  if (agentTaskQueue) {
    return agentTaskQueue;
  }

  const connection = getRedisConnection();
  if (!connection) {
    return null;
  }

  try {
    agentTaskQueue = new Queue('agent-tasks', {
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

    // Handle connection errors gracefully
    agentTaskQueue.on('error', (error) => {
      console.warn('[Job Queue] Queue error (will use fallback):', error.message);
    });

    return agentTaskQueue;
  } catch (error: any) {
    console.warn('[Job Queue] Failed to create queue (will use fallback):', error.message);
    return null;
  }
}

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

  const connection = getRedisConnection();
  if (!connection) {
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
 * Processes the specific task by ID
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
  } else if (agentType === 'followup') {
    const { FollowupAgent } = await import('@/lib/agents/followup-agent');
    agent = new FollowupAgent(agentId);
    await agent.initialize();
  } else {
    throw new Error(`Agent type ${agentType} not yet implemented for job queue processing`);
  }

  // Process the specific task by ID
  await agent.processTaskById(taskId);
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
  const queue = getQueue();
  const isServerless = process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV;
  
  // If no queue available (Redis not configured), process directly
  if (!queue) {
    console.log(`[Job Queue] Redis not configured, processing task ${taskId} directly`);
    try {
      await processAgentTask(agentId, taskId, agentType);
      console.log(`[Job Queue] Successfully processed task ${taskId} directly (no Redis)`);
      return;
    } catch (processError: any) {
      console.error(`[Job Queue] Failed to process task ${taskId} directly:`, processError);
      throw processError;
    }
  }

  try {
    // Try to add to queue
    const jobPriority = priority === 'urgent' ? 1 : priority === 'high' ? 2 : priority === 'medium' ? 3 : 4;

    await queue.add(
      'process-task',
      { agentId, taskId, agentType },
      {
        priority: jobPriority,
        jobId: `task-${taskId}`, // Use task ID as job ID to prevent duplicates
      }
    );

    console.log(`[Job Queue] Queued task ${taskId} for agent ${agentId} with priority ${priority}`);

    // In serverless environments, process immediately after queueing
    // since there's no persistent worker to process queued tasks
    if (isServerless) {
      console.log(`[Job Queue] Serverless environment detected, processing task ${taskId} immediately`);
      try {
        await processAgentTask(agentId, taskId, agentType);
        console.log(`[Job Queue] Successfully processed task ${taskId} immediately (serverless mode)`);
      } catch (processError: any) {
        console.error(`[Job Queue] Failed to process task ${taskId} immediately:`, processError);
        // Don't throw - task is queued and will be processed by cron job
      }
    }
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
  const queue = getQueue();
  if (!queue) {
    return { waiting: 0, active: 0, completed: 0, failed: 0 };
  }

  try {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  } catch (error) {
    console.warn('[Job Queue] Failed to get queue status:', error);
    return { waiting: 0, active: 0, completed: 0, failed: 0 };
  }
}

/**
 * Clean up old jobs (can be called periodically)
 */
export async function cleanOldJobs(): Promise<void> {
  const queue = getQueue();
  if (!queue) {
    return;
  }

  try {
    await queue.clean(24 * 3600 * 1000, 1000, 'completed'); // Clean completed jobs older than 24h
    await queue.clean(7 * 24 * 3600 * 1000, 100, 'failed'); // Clean failed jobs older than 7 days
  } catch (error) {
    console.warn('[Job Queue] Failed to clean old jobs:', error);
  }
}

