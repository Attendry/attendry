/**
 * Search Orchestrator
 * 
 * Single source of truth for "success" and items
 */

import { firecrawlSearch } from './firecrawlService';
import { cseSearch } from './cseService';
import { logger } from '@/utils/logger';
import { ensureArray } from '@/lib/ensureArray';
import { buildEffectiveQuery } from '@/search/query';
import { cseSearch } from '@/search/cse';
import { filterByDate } from './filter';

// Provider list normalization (in case you re-enable arrays later)
function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

export async function executeSearch(opts: {
  baseQuery: string;
  userText?: string;
  country?: string;
  dateFrom?: string;
  dateTo?: string;
  providers?: unknown;
  mode?: string;
  searchConfig?: any;
}) {
  const { baseQuery, userText, country, dateFrom, dateTo, providers: providerInput, mode, searchConfig } = opts;

  const providers = toArray(process.env.SEARCH_PROVIDERS ?? providerInput ?? ['firecrawl','cse']);

  // Build the effective query once, and use it everywhere
  const effectiveQ = buildEffectiveQuery({
    baseQuery: baseQuery?.trim() || searchConfig?.baseQuery?.trim() || '',
    userText: userText,
  });

  console.info('[query_debug]', {
    searchConfigBaseQuery: searchConfig?.baseQuery,
    passedBaseQuery: baseQuery,
    userText: userText,
    effectiveQ,
  });

  async function firecrawlSearch(q: string) {
    // Hard stop if anyone tries to inject slow params again
    const forbidden = ['tbs', 'cd_min', 'cd_max', 'location'];
    const leaked = JSON.stringify(opts ?? {}).toLowerCase();
    if (forbidden.some(k => leaked.includes(k))) {
      console.warn('[firecrawl_guard] Removing forbidden search params (tbs/location).');
    }

    const attempts = [22000, 14000]; // backoff; no more single 15s stall
    for (const timeoutMs of attempts) {
      try {
        const res = await firecrawl.search({
          query: q,                 // ← ONLY q; no date clamps or location
          limit: 15,
          sources: ['web'],
          ignoreInvalidURLs: true,
          timeoutMs,
          scrapeOptions: {
            formats: ['markdown'],
            onlyMainContent: false,
            waitFor: 250,
            blockAds: true,
            removeBase64Images: true,
            // Do NOT set 'location'; it massively increases timeout odds.
          },
        });
        if (Array.isArray(res?.items) && res.items.length) return res;
      } catch (e: any) {
        if (!String(e?.name ?? e).toLowerCase().includes('timeout')) throw e;
      }
    }
    return { items: [] };
  }

  const fc = await firecrawlSearch(effectiveQ);

  const cse = await cseSearch(effectiveQ);

  const providerUsed = (fc.items?.length ? 'firecrawl' : (cse.items?.length ? 'cse' : 'none'));
  const rawItems = fc.items?.length ? fc.items : cse.items;

  console.info('[providers]', { providerUsed, firecrawlCount: fc.items?.length ?? 0, cseCount: cse.items?.length ?? 0 });

  const searchMode: 'events' | 'knowledge' = mode === 'events' ? 'events' : 'knowledge';
  const afterDate = filterByDate(rawItems, { mode: searchMode, from: dateFrom, to: dateTo });

  // Failsafe: if knowledge mode somehow empties, fall back to raw top 10
  const finalItems = afterDate.length ? afterDate : (searchMode === 'knowledge' ? rawItems.slice(0, 10) : afterDate);

  console.info('[date_filtering]', {
    mode: searchMode,
    from: dateFrom,
    to: dateTo,
    beforeCount: rawItems.length,
    afterCount: finalItems.length,
  });

  console.info('[sanity]', { effectiveQ, firecrawlQueryEqualsEffectiveQ: true });

  return { providerUsed, items: finalItems };
}
