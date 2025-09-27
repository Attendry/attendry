/**
 * Firecrawl Search Service
 * 
 * Removes hard-coded "Germany" override and uses explicit query builder
 */

import { buildEffectiveQuery } from '@/search/query';
import { withTimeoutAndRetry } from '@/utils/net/withTimeoutAndRetry';
import { logger } from '@/utils/logger';

type FirecrawlArgs = {
  baseQuery: string;
  userText?: string;
  limit?: number;
  location?: string;  // e.g., "Germany"
  dateFrom?: string;  // "YYYY-MM-DD"
  dateTo?: string;    // "YYYY-MM-DD"
};

export async function firecrawlSearch(args: FirecrawlArgs) {
  const { baseQuery, userText, limit = 20, location, dateFrom, dateTo } = args;
  if (!baseQuery?.trim()) throw new Error('firecrawlSearch: baseQuery required');

  // ✅ Use the explicit builder; never override with a fixed German literal string.
  const q = buildEffectiveQuery({ baseQuery, userText });

  // Build params WITHOUT rewriting the query text.
  const fcParams = {
    query: q,                 // ← not a literal
    limit: 15,                // smaller to avoid timeouts
    sources: ['web'] as const,
    ignoreInvalidURLs: true,
    scrapeOptions: {
      formats: ['markdown'],
      onlyMainContent: false,
      waitFor: 300,           // reduce load
      blockAds: true,
      removeBase64Images: true,
    },
  };

  // No tbs/cd_min/cd_max - these cause timeouts and 400s

  logger.info({ at: 'firecrawl_search', query: q, params: fcParams });

  // Firecrawl: no hardcoded query, add short backoff retries
  async function firecrawlSearchWithBackoff() {
    const timeouts = [12000, 7000, 4000]; // ~23s cumulative max
    for (const timeoutMs of timeouts) {
      try {
        const res = await doFirecrawl({ ...fcParams, timeoutMs });
        if (res?.items?.length) return res;
      } catch (e: any) {
        // Only swallow timeouts; rethrow others
        if (!String(e?.name ?? e).toLowerCase().includes('timeout')) throw e;
      }
    }
    return { items: [] };
  }

  return await firecrawlSearchWithBackoff();
}


// Placeholder for actual Firecrawl client call
async function doFirecrawl(params: any) {
  // This would be your actual Firecrawl API call
  // For now, return a mock response
  return { items: [] };
}
