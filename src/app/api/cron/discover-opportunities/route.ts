/**
 * PHASE 3: Scheduled Discovery Opportunities Cron Job
 * 
 * Automatically discovers opportunities for all users based on their discovery profiles.
 * Runs on a schedule (hourly/daily/weekly) based on user preferences.
 * 
 * This cron job:
 * 1. Queries all active user_discovery_profiles
 * 2. Filters by discovery_frequency
 * 3. Processes discovery runs in batches
 * 4. Respects rate limits and handles errors
 */

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { DiscoveryEngine } from "@/lib/services/discovery-engine";
import { CostOptimizationService } from "@/lib/services/cost-optimization-service";

/**
 * Verify cron request authentication
 * Matches pattern from existing cron jobs for consistency
 */
function verifyCronRequest(req: NextRequest): boolean {
  // Check for Vercel Cron header (automatically added by Vercel)
  const vercelCronHeader = req.headers.get('x-vercel-cron');
  
  // Log headers for debugging (matching existing cron pattern)
  const userAgent = req.headers.get('user-agent') || '';
  const vercelId = req.headers.get('x-vercel-id');
  console.log('[discover-opportunities] [CRON AUTH] x-vercel-cron header:', vercelCronHeader);
  console.log('[discover-opportunities] [CRON AUTH] user-agent:', userAgent);
  console.log('[discover-opportunities] [CRON AUTH] x-vercel-id:', vercelId);
  console.log('[discover-opportunities] [CRON AUTH] CRON_SECRET set:', !!process.env.CRON_SECRET);
  
  if (vercelCronHeader) {
    console.log('[discover-opportunities] [CRON AUTH] ✅ Authenticated via x-vercel-cron header');
    return true;
  }

  // Fallback: Check for manual Authorization header (for testing)
  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;
  
  if (expectedToken && authHeader === `Bearer ${expectedToken}`) {
    console.log('[discover-opportunities] [CRON AUTH] ✅ Authenticated via Authorization header');
    return true;
  }

  // Additional check: Vercel infrastructure detection
  // Vercel Cron may not always send x-vercel-cron header, but we can detect it
  // by checking for Vercel-specific headers or user-agent
  const isVercelRequest = vercelId || userAgent.includes('vercel') || userAgent.includes('Vercel');
  
  if (isVercelRequest && !expectedToken) {
    console.log('[discover-opportunities] [CRON AUTH] ✅ Authenticated via Vercel infrastructure detection (no CRON_SECRET)');
    return true;
  }

  // If CRON_SECRET is set but no valid auth, reject
  if (expectedToken) {
    console.log('[discover-opportunities] [CRON AUTH] ❌ CRON_SECRET is set but no valid auth provided');
    return false;
  }

  // If no CRON_SECRET is set, allow (for development)
  console.log('[discover-opportunities] [CRON AUTH] ⚠️ No CRON_SECRET set, allowing (development mode)');
  return true;
}

/**
 * Determine which users should run discovery based on frequency and last run time
 */
async function getUsersForDiscovery(frequency: 'hourly' | 'daily' | 'weekly'): Promise<string[]> {
  const supabase = await supabaseServer();
  
  // Calculate cutoff time based on frequency
  const now = new Date();
  let cutoffTime: Date;
  
  switch (frequency) {
    case 'hourly':
      cutoffTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      break;
    case 'daily':
      cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      break;
    case 'weekly':
      cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      break;
  }

  // Query profiles with this frequency
  const { data: profiles, error } = await supabase
    .from('user_discovery_profiles')
    .select('user_id, discovery_frequency')
    .eq('discovery_frequency', frequency);

  if (error) {
    console.error('[discover-opportunities] Error fetching profiles:', error);
    return [];
  }

  if (!profiles || profiles.length === 0) {
    return [];
  }

  // Get last run times for these users
  const userIds = profiles.map(p => p.user_id);
  const { data: lastRuns, error: runsError } = await supabase
    .from('discovery_run_logs')
    .select('user_id, completed_at')
    .in('user_id', userIds)
    .order('completed_at', { ascending: false });

  if (runsError) {
    console.error('[discover-opportunities] Error fetching last runs:', runsError);
    // If we can't check last runs, run for all users (conservative approach)
    return userIds;
  }

  // Filter users who need discovery
  const lastRunMap = new Map<string, Date>();
  if (lastRuns) {
    for (const run of lastRuns) {
      if (!lastRunMap.has(run.user_id)) {
        lastRunMap.set(run.user_id, new Date(run.completed_at));
      }
    }
  }

  const usersToProcess: string[] = [];
  for (const userId of userIds) {
    const lastRun = lastRunMap.get(userId);
    if (!lastRun || lastRun < cutoffTime) {
      usersToProcess.push(userId);
    }
  }

  return usersToProcess;
}

/**
 * Run discovery for a single user
 */
async function runDiscoveryForUser(userId: string): Promise<{ success: boolean; opportunitiesCreated: number; error?: string }> {
  const supabase = await supabaseServer();
  const startTime = Date.now();
  let runLogId: string | undefined;

  try {
    // Log discovery run start
    const { data: runLog, error: logError } = await supabase
      .from('discovery_run_logs')
      .insert({
        user_id: userId,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) {
      console.error(`[discover-opportunities] Error creating run log for user ${userId}:`, logError);
    } else {
      runLogId = runLog?.id;
    }

    // Run discovery
    const result = await DiscoveryEngine.runDiscovery(userId);

    // Update run log
    if (runLogId) {
      const duration = Date.now() - startTime;
      await supabase
        .from('discovery_run_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          opportunities_created: result.opportunitiesCreated || 0,
          duration_ms: duration,
          error_message: null
        })
        .eq('id', runLogId);
    }

    return {
      success: true,
      opportunitiesCreated: result.opportunitiesCreated || 0
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[discover-opportunities] Error running discovery for user ${userId}:`, error);

    // Update run log if it exists
    if (runLogId) {
      await supabase
        .from('discovery_run_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          error_message: errorMessage
        })
        .eq('id', runLogId);
    }

    return {
      success: false,
      opportunitiesCreated: 0,
      error: errorMessage
    };
  }
}

/**
 * Main cron job handler
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const MAX_RUNTIME_MS = 240000; // 4 minutes (leave buffer before 5min timeout)
  const MIN_REMAINING_TIME_MS = 60000; // Exit if less than 60s remaining

  // Verify authentication
  if (!verifyCronRequest(req)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get frequency from query param (hourly/daily/weekly) or default to all
  const searchParams = req.nextUrl.searchParams;
  const frequencyParam = searchParams.get('frequency') as 'hourly' | 'daily' | 'weekly' | null;

  console.log('[discover-opportunities] Starting discovery cron job');
  console.log(`[discover-opportunities] Frequency filter: ${frequencyParam || 'all'}`);

  const results = {
    hourly: { processed: 0, opportunities: 0, errors: 0 },
    daily: { processed: 0, opportunities: 0, errors: 0 },
    weekly: { processed: 0, opportunities: 0, errors: 0 }
  };

  try {
    // Process each frequency
    const frequencies: ('hourly' | 'daily' | 'weekly')[] = frequencyParam 
      ? [frequencyParam] 
      : ['hourly', 'daily', 'weekly'];

    for (const frequency of frequencies) {
      // Check if we have enough time remaining
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_RUNTIME_MS - MIN_REMAINING_TIME_MS) {
        console.log(`[discover-opportunities] ⚠️ Approaching timeout, stopping after ${frequency} frequency`);
        break;
      }

      console.log(`[discover-opportunities] Processing ${frequency} frequency users...`);

      // Get users who need discovery
      const userIds = await getUsersForDiscovery(frequency);
      console.log(`[discover-opportunities] Found ${userIds.length} users for ${frequency} frequency`);

      // Process in batches (respect rate limits)
      const BATCH_SIZE = 5; // Process 5 users at a time
      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        // Check timeout
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_RUNTIME_MS - MIN_REMAINING_TIME_MS) {
          console.log(`[discover-opportunities] ⚠️ Approaching timeout, stopping batch processing`);
          break;
        }

        const batch = userIds.slice(i, i + BATCH_SIZE);
        console.log(`[discover-opportunities] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} users)`);

        // Process batch sequentially to respect rate limits
        for (const userId of batch) {
          const result = await runDiscoveryForUser(userId);
          
          results[frequency].processed++;
          results[frequency].opportunities += result.opportunitiesCreated;
          if (!result.success) {
            results[frequency].errors++;
          }

          // Small delay between users to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Delay between batches
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const totalProcessed = results.hourly.processed + results.daily.processed + results.weekly.processed;
    const totalOpportunities = results.hourly.opportunities + results.daily.opportunities + results.weekly.opportunities;
    const totalErrors = results.hourly.errors + results.daily.errors + results.weekly.errors;
    const duration = Date.now() - startTime;

    console.log('[discover-opportunities] ✅ Discovery cron job completed');
    console.log(`[discover-opportunities] Processed: ${totalProcessed} users, Created: ${totalOpportunities} opportunities, Errors: ${totalErrors}, Duration: ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Discovery cron job completed',
      results: {
        hourly: results.hourly,
        daily: results.daily,
        weekly: results.weekly,
        totals: {
          processed: totalProcessed,
          opportunities: totalOpportunities,
          errors: totalErrors
        }
      },
      duration_ms: duration
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[discover-opportunities] ❌ Cron job failed:', error);
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  }
}

