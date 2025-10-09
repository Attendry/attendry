// app/api/events/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeEnhancedSearch } from '@/common/search/enhanced-orchestrator';

// Helper function to process enhanced search results
function processEnhancedResults(res: any, country: string | null, dateFrom: string | null, dateTo: string | null) {
  const events = res.events || [];

  // Sort by confidence desc if available
  const sortedEvents = [...events].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  
  // EU country codes for broader filtering
  const euCountries = ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'NL', 'BE', 'LU', 'DK', 'SE', 'NO', 'FI', 'PL', 'CZ', 'HU', 'SK', 'SI', 'HR', 'BG', 'RO', 'EE', 'LV', 'LT', 'MT', 'CY', 'IE', 'PT', 'GR'];
  
  // Simple filtering based on country and date
  const filteredEvents = sortedEvents.filter((event: any) => {
    // Country filtering - if country is 'EU', accept any EU country
    if (country && event.country) {
      if (country.toUpperCase() === 'EU') {
        if (!euCountries.includes(event.country.toUpperCase())) {
          return false;
        }
      } else if (event.country.toUpperCase() !== country.toUpperCase()) {
        return false; 
      }
    }

    // Date filtering (if dates provided)
    if (dateFrom && event.starts_at && event.starts_at < dateFrom) {
      return false;
    }
    if (dateTo && event.starts_at && event.starts_at > dateTo) {
      return false;
    }
    
        return true; 
  });

  return {
    count: filteredEvents.length,
    saved: [],
    events: filteredEvents,
    marker: 'RUN_V4_ENHANCED',
    country,
    provider: 'enhanced_pipeline',
    searchConfig: { source: 'active', baseQueryUsed: true },
    effectiveQ: res.effectiveQ,
    searchRetriedWithBase: res.searchRetriedWithBase,
    search: { status: 200, provider: 'enhanced_pipeline', items: events.length, scored: true },
    urls: { unique: events.length, sample: events.slice(0, 10).map((e: any) => ({ url: e.source_url, confidence: e.confidence ?? null })) },
    extract: { status: 200, version: 'enhanced_extraction', eventsBeforeFilter: events.length, sampleTrace: [], confidenceRange: events.length ? { max: Math.max(...events.map((e: any) => e.confidence ?? 0)), min: Math.min(...events.map((e: any) => e.confidence ?? 0)) } : null },
    deduped: { count: events.length },
    dateFiltering: {
      from: dateFrom, to: dateTo, beforeCount: events.length, allowUndated: true, afterCount: filteredEvents.length
    },
    filter: { 
      kept: filteredEvents.length, 
      reasons: { 
        kept: filteredEvents.length, 
        wrongCountry: events.length - filteredEvents.length, 
        ambiguous: 0 
      } 
    },
    upsert: { saved: 0 },
    providersTried: res.providersTried || ['enhanced_pipeline'],
    logs: res.logs || [],
    scoring: {
      model: (res.logs || []).find((log: any) => log.at === 'prioritization')?.modelPath ?? null,
      rejected: (res.logs || []).find((log: any) => log.at === 'extraction')?.rejected ?? []
    },
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
    const location: string | null = url.searchParams.get('location');
    const timeframe: string | null = url.searchParams.get('timeframe');

    const res = await executeEnhancedSearch({ 
      userText, 
        country,
      dateFrom, 
      dateTo, 
      locale, 
      location, 
      timeframe 
    });
    const result = processEnhancedResults(res, country, dateFrom, dateTo);
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
    const location: string | null = body?.location ?? null;
    const timeframe: string | null = body?.timeframe ?? null;

    const res = await executeEnhancedSearch({ 
      userText, 
        country,
      dateFrom, 
      dateTo, 
      locale, 
      location, 
      timeframe 
    });
    const result = processEnhancedResults(res, country, dateFrom, dateTo);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'search_failed', debug: { crashed: true } }, { status: 500 });
  }
}