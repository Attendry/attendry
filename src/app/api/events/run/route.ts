// app/api/events/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeSearch } from '@/common/search/orchestrator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userText: string = body?.userText ?? '';   // <- canonical
    const country: string | null = body?.country ?? 'DE';
    const dateFrom: string | null = body?.dateFrom ?? null;
    const dateTo: string | null = body?.dateTo ?? null;
    const locale: 'de' | 'en' = (body?.locale === 'en' ? 'en' : 'de');

    const res = await executeSearch({ userText, country, dateFrom, dateTo, locale });

    return NextResponse.json({
      count: res.items.length,
      saved: [],
      events: [],
      marker: 'RUN_V4',
      country,
      provider: res.providerUsed,
      searchConfig: { source: 'active', baseQueryUsed: true },
      effectiveQ: res.effectiveQ,
      searchRetriedWithBase: res.searchRetriedWithBase,
      search: { status: 200, provider: res.providerUsed, items: res.items.length },
      urls: { unique: res.items.length, sample: res.items.slice(0, 10) },
      extract: { status: 200, version: 'no_urls', eventsBeforeFilter: 0, sampleTrace: [] },
      deduped: { count: res.items.length },
      dateFiltering: {
        from: dateFrom, to: dateTo, beforeCount: 0, allowUndated: false, afterCount: 0
      },
      filter: { kept: 0, reasons: { kept: 0, wrongCountry: 0, ambiguous: 0 } },
      upsert: { saved: 0 },
      providersTried: res.providersTried,
      logs: res.logs,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'search_failed', debug: { crashed: true } }, { status: 500 });
  }
}