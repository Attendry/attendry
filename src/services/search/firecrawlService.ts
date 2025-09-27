/**
 * Firecrawl Search Service
 * 
 * Removes hard-coded "Germany" override and uses explicit query builder
 */

import { buildSearchQuery } from '@/search/buildQuery';
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
  const q = buildSearchQuery({ baseQuery, userText });

  // Build params WITHOUT rewriting the query text.
  const params: any = {
    query: q,
    limit,
    sources: ['web'],
    ignoreInvalidURLs: true,
    scrapeOptions: {
      formats: ['markdown'],
      onlyMainContent: false,
      waitFor: 500,
      blockAds: false,
      removeBase64Images: false,
      ...(location ? { location: { country: location === 'Germany' ? 'DE' : location } } : {}),
    },
  };

  // Only add tbs if both dates are provided. (CSE supports date restrict; Firecrawl mimics via tbs)
  if (dateFrom && dateTo) {
    // mm/dd/yyyy format expected by Google's cdr
    const toMDY = (d: string) => {
      const [Y, M, D] = d.split('-');
      return `${M}/${D}/${Y}`;
    };
    params.tbs = `cdr:1,cd_min:${toMDY(dateFrom)},cd_max:${toMDY(dateTo)}`;
  }

  logger.info({ at: 'firecrawl_search', query: q, params });

  // ✅ Increase timeout + retries to reduce spurious 15s timeouts.
  return withTimeoutAndRetry(
    () => doFirecrawl(params),  // your existing Firecrawl client
    { timeoutMs: 30000, maxRetries: 2, backoffMs: 600 }
  );
}

// Placeholder for actual Firecrawl client call
async function doFirecrawl(params: any) {
  // This would be your actual Firecrawl API call
  // For now, return a mock response
  return { items: [] };
}
