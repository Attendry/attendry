export const runtime = "nodejs";
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { SearchService } from "@/lib/services/search-service";

/**
 * Verify cron request authentication
 * Supports both Vercel Cron (x-vercel-cron header) and manual testing (Authorization header)
 */
function verifyCronRequest(req: NextRequest): boolean {
  // Check for Vercel Cron header (automatically added by Vercel)
  // Vercel adds this header when triggering cron jobs
  const vercelCronHeader = req.headers.get('x-vercel-cron');
  
  // Log all headers for debugging (in production, check logs)
  const allHeaders = Object.fromEntries(
    Array.from(req.headers.entries()).map(([key, value]) => [key, value])
  );
  console.log('[CRON AUTH] Headers received:', JSON.stringify(allHeaders));
  console.log('[CRON AUTH] x-vercel-cron header:', vercelCronHeader);
  console.log('[CRON AUTH] CRON_SECRET set:', !!process.env.CRON_SECRET);
  
  if (vercelCronHeader) {
    console.log('[CRON AUTH] ✅ Authenticated via x-vercel-cron header');
    return true; // Vercel automatically adds this header for cron jobs
  }

  // Fallback: Check for manual Authorization header (for testing)
  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;
  
  if (expectedToken && authHeader === `Bearer ${expectedToken}`) {
    console.log('[CRON AUTH] ✅ Authenticated via Authorization header');
    return true;
  }

  // Additional check: If request appears to be from Vercel Cron infrastructure
  // Vercel Cron may not always send x-vercel-cron header, but we can detect it
  // by checking for Vercel-specific headers or user-agent
  const userAgent = req.headers.get('user-agent') || '';
  const vercelId = req.headers.get('x-vercel-id');
  const isVercelRequest = vercelId || userAgent.includes('vercel') || userAgent.includes('Vercel');
  
  if (isVercelRequest && !expectedToken) {
    // If it looks like a Vercel request and no CRON_SECRET is set, allow it
    console.log('[CRON AUTH] ✅ Authenticated via Vercel infrastructure detection (no CRON_SECRET)');
    return true;
  }

  // If CRON_SECRET is set but no valid auth, reject
  if (expectedToken) {
    console.log('[CRON AUTH] ❌ CRON_SECRET is set but no valid auth provided');
    console.log('[CRON AUTH] User-Agent:', userAgent);
    console.log('[CRON AUTH] X-Vercel-Id:', vercelId);
    return false;
  }

  // If no CRON_SECRET is set, allow (for development)
  console.log('[CRON AUTH] ⚠️ No CRON_SECRET set, allowing (development mode)');
  return true;
}

/**
 * Run the deep event collection job
 * Weekly comprehensive collection across extended markets
 */
async function runDeepEventCollection() {
  const startTime = Date.now();
  const MAX_RUNTIME_MS = 240000; // 4 minutes (leave 60s buffer before 5min timeout)
  const MIN_REMAINING_TIME_MS = 60000; // Exit if less than 60s remaining

  console.log(`[CRON] Starting deep event collection`);
  console.log(`[CRON] Max runtime: ${MAX_RUNTIME_MS / 1000}s, will exit with ${MIN_REMAINING_TIME_MS / 1000}s remaining`);

  const results = [];
  
  // Deep collection parameters - comprehensive coverage
  const industries = ['legal-compliance', 'fintech', 'healthcare', 'general'];
  const countries = ['de', 'fr', 'uk', 'us', 'nl', 'ch', 'at', 'se', 'it', 'es', 'be', 'dk', 'fi', 'no'];
  const monthsAhead = 12; // 12 months ahead for deep collection

  // TTL sweep: purge expired durable caches (best-effort, non-user-facing)
  try {
    const supabase = await supabaseServer();
    // direct delete via RPC-less approach (requires policy allowing delete or service key)
    const { error } = await supabase.from('search_cache').delete().lt('ttl_at', new Date().toISOString());
    if (!error) console.log(JSON.stringify({ at: "cron", action: "ttl_sweep_done" }));
  } catch {
    // ignore; does not impact user collection
  }

  // Limit combinations per run to prevent timeout
  // Process only 3 combinations per run for deep collection
  const MAX_COMBINATIONS = 3;
  let processedCount = 0;

  // Run comprehensive searches for each industry/country combination
  for (const industry of industries) {
    for (const country of countries) {
      // Check if we've processed enough combinations
      if (processedCount >= MAX_COMBINATIONS) {
        console.log(`[CRON] Reached max combinations limit (${MAX_COMBINATIONS}), stopping to prevent timeout`);
        break;
      }

      // Check remaining time before starting new combination
      const elapsed = Date.now() - startTime;
      const remaining = MAX_RUNTIME_MS - elapsed;
      
      if (remaining < MIN_REMAINING_TIME_MS) {
        console.log(`[CRON] ⚠️ Only ${Math.round(remaining / 1000)}s remaining, exiting early to prevent timeout`);
        break;
      }

      try {
        console.log(`[CRON] Collecting deep events for ${industry} in ${country} (${Math.round(remaining / 1000)}s remaining)`);
        
        // Calculate date range for comprehensive search
        const today = new Date();
        const from = today.toISOString().split('T')[0];
        const to = new Date(today.getFullYear(), today.getMonth() + monthsAhead, today.getDate())
          .toISOString().split('T')[0];

        // Run comprehensive search using shared service with Firecrawl
        const searchData = await SearchService.runEventDiscovery({
          q: "", // Use default query from search config
          country,
          from,
          to,
          provider: "firecrawl" // Use Firecrawl for better results
        });

        // Log if no results found (extraction will be skipped)
        if (searchData.events.length === 0) {
          console.log(`[CRON] ⚠️ No events found for ${industry}/${country}, skipping extraction`);
        }

        // Store events in database
        let eventsStored = 0;
        if (searchData.events.length > 0) {
          eventsStored = await storeEventsInDatabase(searchData.events, {
            industry,
            country,
            from,
            to,
            collectedAt: new Date().toISOString(),
            source: 'cron_firecrawl_deep'
          });
        }

        processedCount++;
        const elapsedAfter = Date.now() - startTime;
        const remainingAfter = MAX_RUNTIME_MS - elapsedAfter;

        results.push({
          industry,
          country,
          success: true,
          eventsFound: searchData.events.length,
          eventsStored: eventsStored,
          enhancement: searchData.enhancement,
          elapsedSeconds: Math.round(elapsedAfter / 1000),
          remainingSeconds: Math.round(remainingAfter / 1000)
        });

        console.log(`[CRON] ✅ Completed ${industry}/${country}: ${eventsStored} events stored, ${Math.round(remainingAfter / 1000)}s remaining`);

        // Check again after processing
        if (remainingAfter < MIN_REMAINING_TIME_MS) {
          console.log(`[CRON] ⚠️ Time running low after processing, exiting early`);
          break;
        }
      } catch (error: any) {
        console.error(`[CRON] Error collecting deep events for ${industry}/${country}:`, error);
        processedCount++;
        results.push({
          industry,
          country,
          success: false,
          error: error.message
        });
      }
    }
    
    // Break outer loop if we've hit limits
    if (processedCount >= MAX_COMBINATIONS) {
      break;
    }
  }

  const successCount = results.filter(r => r.success).length;
  const totalEvents = results.reduce((sum, r) => sum + (r.eventsFound || 0), 0);
  const totalElapsed = Math.round((Date.now() - startTime) / 1000);

  console.log(`[CRON] Deep collection complete: ${successCount}/${results.length} successful, ${totalEvents} total events, ${totalElapsed}s elapsed`);

  return {
    success: true,
    timestamp: new Date().toISOString(),
    collectionType: 'deep',
    results,
    summary: {
      totalJobs: results.length,
      successfulJobs: successCount,
      totalEventsCollected: totalEvents,
      industries: industries.length,
      countries: countries.length,
      monthsAhead,
      maxCombinations: MAX_COMBINATIONS,
      elapsedSeconds: totalElapsed,
      earlyExit: processedCount < (industries.length * countries.length)
    }
  };
}

/**
 * GET /api/cron/collect-events-deep
 * 
 * Vercel Cron jobs use GET requests by default.
 * This endpoint runs the weekly deep event collection job.
 */
export async function GET(req: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    if (!verifyCronRequest(req)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { 
          status: 401,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );
    }

    const result = await runDeepEventCollection();
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
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
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
}

/**
 * POST /api/cron/collect-events-deep
 * 
 * Alternative endpoint for manual testing or external cron services.
 * Supports Authorization header authentication.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    if (!verifyCronRequest(req)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { 
          status: 401,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );
    }

    const result = await runDeepEventCollection();
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
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
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
}

/**
 * Store events in the database with metadata
 */
async function storeEventsInDatabase(events: any[], metadata: any): Promise<number> {
  try {
    const supabase = await supabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    // Prepare events for database insertion
    const eventsToInsert = events.map(event => {
      // Extract source domain from URL
      let sourceDomain = null;
      try {
        sourceDomain = new URL(event.source_url).hostname;
      } catch {
        // Invalid URL, skip domain extraction
      }

      // Calculate data completeness score
      const fields = {
        title: !!event.title,
        description: !!event.description,
        starts_at: !!event.starts_at,
        city: !!event.city,
        country: !!event.country,
        venue: !!event.venue,
        organizer: !!event.organizer,
        topics: !!(event.topics && event.topics.length > 0),
        speakers: !!(event.speakers && event.speakers.length > 0),
        sponsors: !!(event.sponsors && event.sponsors.length > 0),
        participating_organizations: !!(event.participating_organizations && event.participating_organizations.length > 0),
        partners: !!(event.partners && event.partners.length > 0),
        competitors: !!(event.competitors && event.competitors.length > 0),
      };
      const completenessScore = Object.values(fields).filter(Boolean).length / Object.keys(fields).length;

      return {
        title: event.title,
        description: event.description,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        city: event.city,
        country: event.country,
        location: event.location,
        venue: event.venue,
        organizer: event.organizer,
        source_url: event.source_url,
        source_domain: sourceDomain,
        topics: event.topics || [],
        speakers: event.speakers || [],
        sponsors: event.sponsors || [],
        participating_organizations: event.participating_organizations || [],
        partners: event.partners || [],
        competitors: event.competitors || [],
        extraction_method: metadata.source === 'cron_firecrawl' ? 'firecrawl' : 'run',
        confidence: event.confidence || 0.5,
        data_completeness: Math.round(completenessScore * 100) / 100,
        collected_at: new Date().toISOString(),
        industry: metadata.industry,
        search_terms: [metadata.industry],
        collection_metadata: {
          source: metadata.source,
          industry: metadata.industry,
          country: metadata.country,
          from: metadata.from,
          to: metadata.to,
          collectedAt: metadata.collectedAt
        }
      };
    });

    // Insert events (upsert to avoid duplicates)
    const { data, error } = await supabase
      .from('collected_events')
      .upsert(eventsToInsert, { 
        onConflict: 'source_url',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('Database insertion error:', error);
      throw error;
    }

    console.log(`[CRON] Stored ${eventsToInsert.length} events in database for ${metadata.country}/${metadata.industry}`);
    return eventsToInsert.length;

  } catch (error: any) {
    console.error('[CRON] Failed to store events in database:', error.message);
    return 0; // Return 0 instead of throwing to not break the cron job
  }
}

