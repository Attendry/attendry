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
import { cseSearch as cseSearchRobust } from './cse';
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
}) {
  const { baseQuery, userText, country, dateFrom, dateTo, providers: providerInput, mode } = opts;

  const providers = toArray(process.env.SEARCH_PROVIDERS ?? providerInput ?? ['firecrawl','cse']);

  // Build the effective query once, and use it everywhere
  const effectiveQ = buildEffectiveQuery({
    baseQuery: baseQuery?.trim() || '',
    userText: userText,
  });

  console.info('[query_debug]', {
    searchConfigBaseQuery: baseQuery,
    passedBaseQuery: baseQuery,
    userText: userText,
    effectiveQ,
  });

  async function firecrawlSearch(q: string) {
    const timeouts = [20000, 12000]; // two tries, ~32s max
    for (const timeoutMs of timeouts) {
      try {
        const res = await firecrawl.search({
          query: q,             // ← NO overrides, NO tbs, NO "Germany" injector
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
            // DO NOT set 'location' here; it slows and often timeouts
          },
        });
        if (Array.isArray(res?.items) && res.items.length) return res;
      } catch (e: any) {
        // Rethrow non-timeouts; swallow timeouts and let loop retry
        if (!String(e?.name ?? e).toLowerCase().includes('timeout')) throw e;
      }
    }
    return { items: [] };
  }

  const firecrawlResult = await firecrawlSearch(effectiveQ);

  const cseResult = await cseSearchRobust(effectiveQ);

  const providerUsed =
    firecrawlResult.items?.length ? 'firecrawl'
    : cseResult.items?.length ? 'cse'
    : 'none';

  console.info('[provider_used]', { providerUsed, fc: firecrawlResult.items?.length ?? 0, cse: cseResult.items?.length ?? 0 });

  const searchMode: 'events' | 'knowledge' = mode === 'events' ? 'events' : 'knowledge';

  const raw = firecrawlResult.items?.length ? firecrawlResult.items : cseResult.items;
  const afterDate = filterByDate(raw, { mode: searchMode, from: dateFrom, to: dateTo });

  // Failsafe: if we somehow filtered everything out in knowledge mode, serve top N raw
  const finalItems = afterDate.length ? afterDate : (searchMode === 'knowledge' ? raw.slice(0, 10) : afterDate);

  console.info('[date_filtering]', {
    mode: searchMode,
    from: dateFrom,
    to: dateTo,
    beforeCount: raw.length,
    afterCount: finalItems.length,
  });

  console.info('[sanity]', {
    effectiveQ,
    firecrawlQueryEchoDisabled: true,   // we no longer log a different FC query
  });

  console.info('[counts]', {
    firecrawl: firecrawlResult.items?.length ?? 0,
    cse: cseResult.items?.length ?? 0,
    final: finalItems.length,
  });

  return { providerUsed, items: finalItems };
}
