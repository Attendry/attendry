export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { SearchService } from "@/lib/services/search-service";

/**
 * POST /api/cron/collect-events
 * 
 * Scheduled job endpoint for automated event data collection.
 * This should be called by a cron service (Vercel Cron, GitHub Actions, etc.)
 * to regularly collect comprehensive event data.
 * 
 * This endpoint is designed to be called by external cron services
 * and will run comprehensive searches to build the event database.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determine collection type from query parameters
    const { searchParams } = new URL(req.url);
    const collectionType = searchParams.get('type') || 'standard';
    
    console.log(`[CRON] Starting ${collectionType} event collection`);

    const results = [];
    
    // Configure collection parameters based on type
    let industries, countries, monthsAhead;
    
    if (collectionType === 'deep') {
      // Weekly deep collection - more comprehensive
      industries = ['legal-compliance', 'fintech', 'healthcare', 'general'];
      countries = ['de', 'fr', 'uk', 'us', 'nl', 'ch', 'at', 'se', 'it', 'es', 'be', 'dk', 'fi', 'no'];
      monthsAhead = 12; // 12 months ahead for deep collection
    } else {
      // Daily standard collection - focused on key markets
      industries = ['legal-compliance', 'fintech', 'healthcare'];
      countries = ['de', 'fr', 'uk', 'us'];
      monthsAhead = 6; // 6 months ahead for standard collection
    }

    // TTL sweep: purge expired durable caches (best-effort, non-user-facing)
    try {
      const supabase = await supabaseServer();
      // direct delete via RPC-less approach (requires policy allowing delete or service key)
      const { error } = await supabase.from('search_cache').delete().lt('ttl_at', new Date().toISOString());
      if (!error) console.log(JSON.stringify({ at: "cron", action: "ttl_sweep_done" }));
    } catch {
      // ignore; does not impact user collection
    }

    // Run comprehensive searches for each industry/country combination
    for (const industry of industries) {
      for (const country of countries) {
        try {
          console.log(`[CRON] Collecting events for ${industry} in ${country}`);
          
          // Calculate date range for comprehensive search
          const today = new Date();
          const from = today.toISOString().split('T')[0];
          const to = new Date(today.getFullYear(), today.getMonth() + monthsAhead, today.getDate())
            .toISOString().split('T')[0];

          // Run comprehensive search using shared service
          const searchData = await SearchService.runEventDiscovery({
            q: "", // Use default query from search config
            country,
            from,
            to,
            provider: "cse"
          });

          results.push({
            industry,
            country,
            success: true,
            eventsFound: searchData.events.length,
            eventsStored: searchData.events.length // Simplified for now
          });
        } catch (error: any) {
          console.error(`[CRON] Error collecting ${industry}/${country}:`, error);
          results.push({
            industry,
            country,
            success: false,
            error: error.message
          });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalEvents = results.reduce((sum, r) => sum + (r.eventsFound || 0), 0);

    console.log(`[CRON] Collection complete: ${successCount}/${results.length} successful, ${totalEvents} total events`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      collectionType,
      results,
      summary: {
        totalJobs: results.length,
        successfulJobs: successCount,
        totalEventsCollected: totalEvents,
        industries: industries.length,
        countries: countries.length,
        monthsAhead
      }
    });

  } catch (error: any) {
    console.error('[CRON] Fatal error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/collect-events
 * 
 * Get status of the last cron run
 */
export async function GET(req: NextRequest) {
  try {
    // TODO: Get last run status from database
    return NextResponse.json({
      lastRun: new Date().toISOString(),
      status: 'healthy',
      nextScheduledRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

