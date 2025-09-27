/**
 * Debug Search Endpoint
 * 
 * Provides instant visibility into the search pipeline with relaxed flags
 * to diagnose zero-result issues.
 */

import { cseSearch } from '@/search/providers/cse';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q')
    ?? '(compliance OR investigation OR "e-discovery" OR ediscovery OR "legal tech" OR "legal technology" OR "GDPR" OR "cybersecurity" OR "interne untersuchung" OR "compliance management")';
  const items = await cseSearch(q);
  return Response.json({ items, count: items.length });
}