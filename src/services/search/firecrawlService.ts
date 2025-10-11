/**
 * Firecrawl Search Service
 * 
 * Removes hard-coded "Germany" override and uses explicit query builder
 */

import { buildEffectiveQuery } from '@/search/query';
import { withTimeoutAndRetry } from '@/utils/net/withTimeoutAndRetry';
import { logger } from '@/utils/logger';
import { RetryService } from '@/lib/services/retry-service';
import { executeWithCircuitBreaker, CIRCUIT_BREAKER_CONFIGS } from '@/lib/services/circuit-breaker';

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

  console.info('[firecrawl_call]', { query: q, limit: 15, noTbs: true, noLocation: true });

  // Firecrawl: no hardcoded query, add short backoff retries
  async function firecrawlSearchWithBackoff() {
    const timeouts = [12000, 7000, 4000]; // ~23s cumulative max
    for (const timeoutMs of timeouts) {
      try {
        const res = await doFirecrawl({ ...fcParams, timeoutMs });
        if (res?.items?.length) return res;
      } catch (e: any) {
        console.warn('[firecrawl] Search attempt failed:', e?.message || e);
        // Only swallow timeouts; rethrow others
        if (!String(e?.name ?? e).toLowerCase().includes('timeout')) {
          console.error('[firecrawl] Non-timeout error, rethrowing:', e);
          throw e;
        }
      }
    }
    console.warn('[firecrawl] All retry attempts failed, returning empty results');
    return { items: [] };
  }

  return await firecrawlSearchWithBackoff();
}


// Actual Firecrawl client call using the proper service with retry and circuit breaker
async function doFirecrawl(params: any) {
  const { FirecrawlSearchService } = await import('../../lib/services/firecrawl-search-service');
  
  try {
    const result = await RetryService.executeWithRetry(
      'firecrawl',
      'searchEvents',
      () => executeWithCircuitBreaker(
        'firecrawl',
        () => FirecrawlSearchService.searchEvents({
          query: params.query,
          country: params.country || 'DE',
          from: params.dateFrom,
          to: params.dateTo,
          maxResults: params.limit || 15
        }),
        CIRCUIT_BREAKER_CONFIGS.FIRECRAWL
      )
    );
    
    return {
      items: result.data.items?.map((item: any) => ({
        url: item.url || item.link,
        title: item.title,
        snippet: item.snippet || item.description
      })) || []
    };
  } catch (error) {
    console.warn('[firecrawl] Search failed after retries and circuit breaker:', error);
    return { items: [] };
  }
}
