/**
 * PHASE 3: Event Lifecycle Refresh Cron Job
 * 
 * Automatically refreshes event data to detect changes and prevent staleness.
 * Runs daily to check for updates in speakers, dates, venues, etc.
 */

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { LifecycleManagementEngine } from "@/lib/services/lifecycle-management-engine";

/**
 * Verify cron request authentication
 * Matches pattern from existing cron jobs for consistency
 */
function verifyCronRequest(req: NextRequest): boolean {
  const vercelCronHeader = req.headers.get('x-vercel-cron');
  const userAgent = req.headers.get('user-agent') || '';
  const vercelId = req.headers.get('x-vercel-id');
  
  console.log('[refresh-event-lifecycle] [CRON AUTH] x-vercel-cron header:', vercelCronHeader);
  console.log('[refresh-event-lifecycle] [CRON AUTH] user-agent:', userAgent);
  console.log('[refresh-event-lifecycle] [CRON AUTH] x-vercel-id:', vercelId);
  console.log('[refresh-event-lifecycle] [CRON AUTH] CRON_SECRET set:', !!process.env.CRON_SECRET);
  
  if (vercelCronHeader) {
    console.log('[refresh-event-lifecycle] [CRON AUTH] ✅ Authenticated via x-vercel-cron header');
    return true;
  }

  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;
  
  if (expectedToken && authHeader === `Bearer ${expectedToken}`) {
    console.log('[refresh-event-lifecycle] [CRON AUTH] ✅ Authenticated via Authorization header');
    return true;
  }

  const isVercelRequest = vercelId || userAgent.includes('vercel') || userAgent.includes('Vercel');
  
  if (isVercelRequest && !expectedToken) {
    console.log('[refresh-event-lifecycle] [CRON AUTH] ✅ Authenticated via Vercel infrastructure detection (no CRON_SECRET)');
    return true;
  }

  if (expectedToken) {
    console.log('[refresh-event-lifecycle] [CRON AUTH] ❌ CRON_SECRET is set but no valid auth provided');
    return false;
  }

  console.log('[refresh-event-lifecycle] [CRON AUTH] ⚠️ No CRON_SECRET set, allowing (development mode)');
  return true; // Development mode
}

/**
 * Main cron job handler
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const MAX_RUNTIME_MS = 240000; // 4 minutes
  const MIN_REMAINING_TIME_MS = 60000; // Exit if less than 60s remaining

  // Verify authentication
  if (!verifyCronRequest(req)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[refresh-event-lifecycle] Starting lifecycle refresh cron job');

  try {
    const supabase = await supabaseServer();

    // Get events that have opportunities (these are the ones we care about)
    const { data: opportunities, error: oppError } = await supabase
      .from('user_opportunities')
      .select('event_id')
      .eq('status', 'new')
      .limit(1000); // Process up to 1000 events per run

    if (oppError) {
      throw new Error(`Failed to fetch opportunities: ${oppError.message}`);
    }

    if (!opportunities || opportunities.length === 0) {
      console.log('[refresh-event-lifecycle] No opportunities to refresh');
      return NextResponse.json({
        success: true,
        message: 'No opportunities to refresh',
        eventsProcessed: 0,
        updatesDetected: 0,
        duration_ms: Date.now() - startTime
      });
    }

    // Get unique event IDs
    const eventIds = [...new Set(opportunities.map(o => o.event_id))];
    console.log(`[refresh-event-lifecycle] Processing ${eventIds.length} events`);

    let eventsProcessed = 0;
    let updatesDetected = 0;
    let errors = 0;

    // Process events in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_RUNTIME_MS - MIN_REMAINING_TIME_MS) {
        console.log(`[refresh-event-lifecycle] ⚠️ Approaching timeout, stopping batch processing`);
        break;
      }

      const batch = eventIds.slice(i, i + BATCH_SIZE);
      console.log(`[refresh-event-lifecycle] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} events)`);

      // Process batch
      for (const eventId of batch) {
        try {
          const lifecycleInfo = await LifecycleManagementEngine.refreshEventLifecycle(eventId);
          
          eventsProcessed++;
          if (lifecycleInfo.has_updates) {
            updatesDetected++;
            console.log(`[refresh-event-lifecycle] Updates detected for event ${eventId}: ${lifecycleInfo.update_summary}`);
          }
        } catch (error) {
          errors++;
          console.error(`[refresh-event-lifecycle] Error refreshing event ${eventId}:`, error);
        }

        // Small delay between events
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Auto-archive expired opportunities
    const archivedCount = await LifecycleManagementEngine.archiveExpiredOpportunities();
    console.log(`[refresh-event-lifecycle] Archived ${archivedCount} expired opportunities`);

    const duration = Date.now() - startTime;
    console.log(`[refresh-event-lifecycle] ✅ Lifecycle refresh completed: ${eventsProcessed} processed, ${updatesDetected} updates, ${errors} errors, ${archivedCount} archived`);

    return NextResponse.json({
      success: true,
      message: 'Lifecycle refresh completed',
      eventsProcessed,
      updatesDetected,
      errors,
      archivedCount,
      duration_ms: duration
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[refresh-event-lifecycle] ❌ Cron job failed:', error);
    
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

