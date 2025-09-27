/**
 * Debug Search Endpoint
 * 
 * Provides instant visibility into the search pipeline with relaxed flags
 * to diagnose zero-result issues.
 */

import { runSearch } from '@/search/orchestrator';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const country = (url.searchParams.get('country') ?? 'DE').toUpperCase();
  const days = Number(url.searchParams.get('days') ?? '60');
  const baseQuery = process.env.DEBUG_BASE_QUERY
    ?? '(compliance OR investigation OR "e-discovery" OR ediscovery OR "legal tech" OR "legal technology" OR "GDPR" OR "cybersecurity" OR "interne untersuchung" OR "compliance management")';

  const { urls, retriedWithBase } = await runSearch({ baseQuery, country, days, enableAug: false });

  return Response.json({
    items: urls,
    count: urls.length,
    country,
    searchRetriedWithBase: retriedWithBase
  });
}