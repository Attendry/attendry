// app/api/events/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeSearch } from '@/common/search/orchestrator';

// Helper function to process search results and create basic event objects
function processSearchResults(res: any, country: string | null, dateFrom: string | null, dateTo: string | null) {
  // Create basic event objects from URLs
  const basicEvents = res.items.map((url: string, index: number) => ({
    id: `event_${index}`,
    title: `Event from ${new URL(url).hostname}`,
    source_url: url,
    starts_at: null,
    country: null,
    venue: null,
    description: null,
    speakers: []
  }));

  // Simple filtering based on URL patterns for German events
  const filteredEvents = basicEvents.filter((event: any) => {
    const url = event.source_url.toLowerCase();
    // Keep events from German domains or known legal event sites
    return url.includes('.de') || 
           url.includes('legal') || 
           url.includes('conference') || 
           url.includes('compliance') ||
           url.includes('veranstaltung') ||
           url.includes('konferenz');
  });

  return {
    count: filteredEvents.length,
    saved: [],
    events: filteredEvents,
    marker: 'RUN_V4',
    country,
    provider: res.providerUsed,
    searchConfig: { source: 'active', baseQueryUsed: true },
    effectiveQ: res.effectiveQ,
    searchRetriedWithBase: res.searchRetriedWithBase,
    search: { status: 200, provider: res.providerUsed, items: res.items.length },
    urls: { unique: res.items.length, sample: res.items.slice(0, 10) },
    extract: { status: 200, version: 'basic_events', eventsBeforeFilter: basicEvents.length, sampleTrace: [] },
    deduped: { count: res.items.length },
    dateFiltering: {
      from: dateFrom, to: dateTo, beforeCount: basicEvents.length, allowUndated: true, afterCount: filteredEvents.length
    },
    filter: { 
      kept: filteredEvents.length, 
      reasons: { 
        kept: filteredEvents.length, 
        wrongCountry: basicEvents.length - filteredEvents.length, 
        ambiguous: 0 
      } 
    },
    upsert: { saved: 0 },
    providersTried: res.providersTried,
    logs: res.logs,
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userText: string = url.searchParams.get('userText') ?? 'legal conference 2025';
    const country: string | null = url.searchParams.get('country') ?? 'DE';
    const dateFrom: string | null = url.searchParams.get('dateFrom');
    const dateTo: string | null = url.searchParams.get('dateTo');
    const locale: 'de' | 'en' = (url.searchParams.get('locale') === 'en' ? 'en' : 'de');

    const res = await executeSearch({ userText, country, dateFrom, dateTo, locale });
    const result = processSearchResults(res, country, dateFrom, dateTo);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'search_failed', debug: { crashed: true } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userText: string = body?.userText ?? '';   // <- canonical
    const country: string | null = body?.country ?? 'DE';
    const dateFrom: string | null = body?.dateFrom ?? null;
    const dateTo: string | null = body?.dateTo ?? null;
    const locale: 'de' | 'en' = (body?.locale === 'en' ? 'en' : 'de');

    const res = await executeSearch({ userText, country, dateFrom, dateTo, locale });
    const result = processSearchResults(res, country, dateFrom, dateTo);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'search_failed', debug: { crashed: true } }, { status: 500 });
  }
}