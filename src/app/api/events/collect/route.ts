export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/events/collect
 * 
 * Backend data collection endpoint for comprehensive event discovery.
 * This runs scheduled searches with broader date ranges to build a comprehensive
 * event database that can be used to enrich user searches.
 * 
 * Request Body:
 * - industry: Industry to search for (optional, defaults to "legal-compliance")
 * - country: Country code (optional, defaults to "de")
 * - monthsAhead: Number of months to search ahead (optional, defaults to 6)
 * - forceRefresh: Whether to force refresh existing data (optional, defaults to false)
 */
export async function POST(req: NextRequest) {
  try {
    const { 
      industry = "legal-compliance", 
      country = "de", 
      monthsAhead = 6,
      forceRefresh = false 
    } = await req.json();

    // Calculate date range for comprehensive search
    const today = new Date();
    const from = today.toISOString().split('T')[0];
    const to = new Date(today.getFullYear(), today.getMonth() + monthsAhead, today.getDate())
      .toISOString().split('T')[0];

    console.log(`[COLLECT] Starting comprehensive search for ${industry} in ${country} from ${from} to ${to}`);

    // Check if we already have recent data for this search
    if (!forceRefresh) {
      // TODO: Check database for recent comprehensive data
      // If data exists and is less than 24 hours old, skip collection
    }

    // Run comprehensive search using the existing run endpoint
    const searchResponse = await fetch(`${req.nextUrl.origin}/api/events/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: "", // Use default query from search config
        country,
        from,
        to,
        provider: "cse"
      })
    });

    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.statusText}`);
    }

    const searchData = await searchResponse.json();
    const events = searchData.events || [];

    console.log(`[COLLECT] Found ${events.length} events for ${industry} in ${country}`);

    // Store events in database for future user searches
    // TODO: Implement database storage with deduplication
    const storedEvents = await storeEventsInDatabase(events, {
      industry,
      country,
      searchDate: from,
      searchRange: { from, to }
    });

    return NextResponse.json({
      success: true,
      industry,
      country,
      dateRange: { from, to },
      eventsFound: events.length,
      eventsStored: storedEvents.length,
      searchData: {
        search: searchData.search,
        extract: searchData.extract,
        deduped: searchData.deduped
      }
    });

  } catch (error: any) {
    console.error('[COLLECT] Error:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

/**
 * Store events in database with deduplication
 */
async function storeEventsInDatabase(events: any[], metadata: any) {
  try {
    // Import Supabase client
    const { supabaseServer } = await import('@/lib/supabase-server');
    const supabase = await supabaseServer();
    
    if (!supabase) {
      console.log('[COLLECT] No Supabase connection, skipping database storage');
      return events;
    }

    // Create a collection batch record
    const { data: batch, error: batchError } = await supabase
      .from('collection_batches')
      .insert({
        industry: metadata.industry,
        country: metadata.country,
        date_range_start: metadata.searchDate,
        date_range_end: metadata.searchRange.to,
        events_found: events.length,
        status: 'running'
      })
      .select()
      .single();

    if (batchError) {
      console.error('[COLLECT] Error creating batch:', batchError);
      return events;
    }

    let storedCount = 0;
    let updatedCount = 0;

    // Process each event
    for (const event of events) {
      try {
        // Check if event already exists
        const { data: existing } = await supabase
          .from('collected_events')
          .select('id')
          .eq('source_url', event.source_url)
          .single();

        const eventData = {
          title: event.title,
          starts_at: event.starts_at,
          ends_at: event.ends_at,
          city: event.city,
          country: event.country,
          venue: event.venue,
          organizer: event.organizer,
          description: event.description,
          topics: event.topics || [],
          speakers: event.speakers || [],
          sponsors: event.sponsors || [],
          participating_organizations: event.participating_organizations || [],
          partners: event.partners || [],
          competitors: event.competitors || [],
          source_url: event.source_url,
          source_domain: new URL(event.source_url).hostname,
          extraction_method: 'firecrawl',
          confidence: event.confidence || 0.8,
          collection_batch_id: batch.id,
          industry: metadata.industry,
          search_terms: [metadata.industry],
          verification_status: 'unverified'
        };

        if (existing) {
          // Update existing event
          const { error: updateError } = await supabase
            .from('collected_events')
            .update({
              ...eventData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          if (!updateError) updatedCount++;
        } else {
          // Insert new event
          const { error: insertError } = await supabase
            .from('collected_events')
            .insert(eventData);

          if (!insertError) storedCount++;
        }
      } catch (error) {
        console.error('[COLLECT] Error processing event:', error);
      }
    }

    // Update batch status
    await supabase
      .from('collection_batches')
      .update({
        status: 'completed',
        events_stored: storedCount,
        events_updated: updatedCount,
        completed_at: new Date().toISOString()
      })
      .eq('id', batch.id);

    console.log(`[COLLECT] Stored ${storedCount} new events, updated ${updatedCount} existing events`);
    return events.slice(0, storedCount + updatedCount);

  } catch (error) {
    console.error('[COLLECT] Database storage error:', error);
    return events;
  }
}

/**
 * GET /api/events/collect
 * 
 * Get status of data collection and available data ranges
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const industry = searchParams.get('industry') || 'legal-compliance';
    const country = searchParams.get('country') || 'de';

    // TODO: Query database for available data
    const availableData = {
      industry,
      country,
      lastUpdated: new Date().toISOString(),
      dateRange: {
        from: new Date().toISOString().split('T')[0],
        to: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      eventCount: 0, // TODO: Get from database
      coverage: {
        totalDays: 180,
        coveredDays: 0, // TODO: Calculate from database
        lastCollectionRun: null // TODO: Get from database
      }
    };

    return NextResponse.json(availableData);

  } catch (error: any) {
    console.error('[COLLECT] GET Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

