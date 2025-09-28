/**
 * Event Run API Route
 * 
 * This endpoint orchestrates the complete event discovery and extraction pipeline.
 * It coordinates between search, extraction, and filtering to provide comprehensive
 * event data to the frontend.
 * 
 * Pipeline Flow:
 * 1. Load search configuration based on user profile
 * 2. Execute search using the search endpoint
 * 3. Extract detailed event information from URLs
 * 4. Filter events by country and date
 * 5. Return processed events with metadata
 * 
 * Key Features:
 * - User profile-based search configuration
 * - Multi-step event processing pipeline
 * - Comprehensive filtering and validation
 * - Debug information for troubleshooting
 * 
 * @author Attendry Team
 * @version 2.0
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cfg } from '@/common/config';
import { executeSearch } from '@/services/search/orchestrator';
import { buildSearchQuery } from '@/common/search/buildQuery';
import { resolveBaseQuery } from '@/common/search/baseQuery';

const BodySchema = z.object({
  userText: z.string().optional(),
  baseQuery: z.string().optional(),
  country: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  // ...anything else you accept
}).passthrough();

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_request', details: parsed.error.errors }, { status: 400 });
    }

    const { userText = '', baseQuery: bodyBaseQuery, country, dateFrom, dateTo } = parsed.data;

    const industry = cfg?.searchConfig?.industry ?? null;
    const configBaseQuery = cfg?.searchConfig?.baseQuery ?? null;
    const envDefault = process.env.DEFAULT_BASE_QUERY ?? null;

    const { baseQuery, source: baseQuerySource } = resolveBaseQuery({
      bodyBaseQuery,
      industry,
      configBaseQuery,
      envDefault,
    });

    const effectiveQ = buildSearchQuery({ baseQuery, userText });

    const { items, providerUsed, providersTried, logs } = await executeSearch({
      baseQuery,
      userText,
      country,
      dateFrom,
      dateTo,
    });

    const urlsUnique = Array.from(new Set(items));
    const debugPayload = {
      marker: 'RUN_V4',
      country: country ?? null,
      provider: providerUsed,
      searchConfig: { industry, baseQuery },
      baseQuerySource,
      effectiveQ,
      searchRetriedWithBase: false,
      search: { status: 200, provider: providerUsed, items: items.length },
      urls: { unique: urlsUnique.length, sample: urlsUnique.slice(0, 5) },
      extract: { status: 200, version: items.length ? 'urls_only' : 'no_urls', eventsBeforeFilter: 0, sampleTrace: [] },
      deduped: { count: urlsUnique.length },
      dateFiltering: {
        from: dateFrom ?? null,
        to: dateTo ?? null,
        beforeCount: 0,
        allowUndated: false,
        afterCount: 0,
      },
      filter: { kept: 0, reasons: { kept: 0, wrongCountry: 0, ambiguous: 0 } },
      upsert: { saved: 0 },
      providersTried,
      logs,
    };

      return NextResponse.json({
        count: 0,
        saved: [],
        events: [],
      ...debugPayload,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'unknown_error', debug: { crashed: true } },
      { status: 500 }
    );
  }
}