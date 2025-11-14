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
  const vercelCronHeader = req.headers.get('x-vercel-cron');
  if (vercelCronHeader) {
    return true; // Vercel automatically adds this header for cron jobs
  }

  // Fallback: Check for manual Authorization header (for testing)
  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;
  
  if (expectedToken && authHeader === `Bearer ${expectedToken}`) {
    return true;
  }

  // If CRON_SECRET is set but no valid auth, reject
  if (expectedToken) {
    return false;
  }

  // If no CRON_SECRET is set, allow (for development)
  return true;
}

/**
 * Run the deep event collection job
 * Weekly comprehensive collection across extended markets
 */
async function runDeepEventCollection() {
  console.log(`[CRON] Starting deep event collection`);

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

        // Run comprehensive search using shared service with Firecrawl
        const searchData = await SearchService.runEventDiscovery({
          q: "", // Use default query from search config
          country,
          from,
          to,
          provider: "firecrawl" // Use Firecrawl for better results
        });

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

        results.push({
          industry,
          country,
          success: true,
          eventsFound: searchData.events.length,
          eventsStored: eventsStored,
          enhancement: searchData.enhancement
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

  console.log(`[CRON] Deep collection complete: ${successCount}/${results.length} successful, ${totalEvents} total events`);

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
      monthsAhead
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
    const eventsToInsert = events.map(event => ({
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
      speakers: event.speakers || [],
      confidence: event.confidence || 0.5,
      collected_at: new Date().toISOString(),
      collection_metadata: {
        source: metadata.source,
        industry: metadata.industry,
        country: metadata.country,
        from: metadata.from,
        to: metadata.to,
        collectedAt: metadata.collectedAt
      }
    }));

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

