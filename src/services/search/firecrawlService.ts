/**
 * Firecrawl Search Service
 * 
 * Removes hard-coded "Germany" override and uses explicit query builder
 */

import { buildEffectiveQuery } from '@/search/query';
import { buildUnifiedQuery } from '@/lib/unified-query-builder';
import { withTimeoutAndRetry } from '@/utils/net/withTimeoutAndRetry';
import { logger } from '@/utils/logger';
import { RetryService } from '@/lib/services/retry-service';
import { executeWithCircuitBreaker, CIRCUIT_BREAKER_CONFIGS } from '@/lib/services/circuit-breaker';
import type { CountryContext } from '@/lib/utils/country';

type FirecrawlArgs = {
  baseQuery: string;
  userText?: string;
  limit?: number;
  location?: string;  // e.g., "Germany"
  locale?: string;
  dateFrom?: string;  // "YYYY-MM-DD"
  dateTo?: string;    // "YYYY-MM-DD"
  countryContext?: CountryContext;
};

export async function firecrawlSearch(args: FirecrawlArgs) {
  const { baseQuery, userText, limit = 20, location, locale, dateFrom, dateTo, countryContext } = args;
  if (!baseQuery?.trim()) throw new Error('firecrawlSearch: baseQuery required');

  // ✅ Use the explicit builder; never override with a fixed German literal string.
  const q = buildEffectiveQuery({ baseQuery, userText, countryContext });
  let narrativeQuery: string | undefined;
  try {
    const unified = await buildUnifiedQuery({
      userText: baseQuery,
      country: countryContext?.iso2,
      dateFrom,
      dateTo,
      language: countryContext?.locale?.startsWith('de') ? 'de' : 'en',
      userProfile: countryContext?.userProfile
    });
    narrativeQuery = unified.narrativeQuery;
  } catch (err) {
    console.warn('[firecrawlSearch] Failed to build unified narrative query:', err);
  }

  // Build params WITHOUT rewriting the query text.
  const fcParams = {
    query: narrativeQuery || q,
    limit: Math.min(limit, 15),
    sources: ['web'] as const,
    ignoreInvalidURLs: true,
    scrapeOptions: {
      formats: ['markdown'],
      onlyMainContent: false,
      waitFor: 300,           // reduce load
      blockAds: true,
      removeBase64Images: true,
      location: countryContext ? { country: countryContext.iso2, languages: [countryContext.locale] } : (locale ? { country: countryContext?.iso2 ?? location, languages: [locale] } : undefined),
    },
  };

  if (location) {
    (fcParams as any).location = location;
  } else if (countryContext) {
    (fcParams as any).location = countryContext.countryNames[0];
  }

  // No tbs/cd_min/cd_max - these cause timeouts and 400s

  console.info('[firecrawl_call]', { query: q, limit: fcParams.limit, location: (fcParams as any).location, languages: countryContext?.locale || locale || 'default' });

  // Firecrawl: no hardcoded query, add short backoff retries
  async function firecrawlSearchWithBackoff() {
    const timeouts = [12000, 7000, 4000]; // ~23s cumulative max
    for (const timeoutMs of timeouts) {
      try {
        const res = await doFirecrawl({ ...fcParams, timeoutMs, countryContext });
        if (res?.items?.length) {
          if (!res.content) {
            console.warn('[firecrawl] Result had URLs but no scraped content; continuing to next attempt');
            continue;
          }
          return res;
        }
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
    return { items: [], content: undefined };
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
          country: params.countryContext?.iso2 || params.country || 'DE',
          from: params.dateFrom,
          to: params.dateTo,
          maxResults: params.limit || 15,
          countryContext: params.countryContext,
          locale: params.countryContext?.locale,
          location: params.location,
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
