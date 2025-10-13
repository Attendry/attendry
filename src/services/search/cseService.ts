/**
 * Google CSE Search Service
 * 
 * Fixes 400 handling and stops claiming "success: true" when it isn't
 */

import { buildEffectiveQuery } from '@/search/query';
import { withTimeoutAndRetry } from '@/utils/net/withTimeoutAndRetry';
import { logger } from '@/utils/logger';
import { RetryService } from '@/lib/services/retry-service';
import { executeWithCircuitBreaker, CIRCUIT_BREAKER_CONFIGS } from '@/lib/services/circuit-breaker';
import type { CountryContext } from '@/lib/utils/country';

type CSEArgs = {
  baseQuery: string;
  userText?: string;
  countryContext?: CountryContext;
  locale?: string;
  num?: number;
  dateRestrict?: string; // e.g., 'd7','w1','m1' (CSE supports dateRestrict; not tbs)
};

export async function cseSearch(args: CSEArgs) {
  const {
    baseQuery, userText, countryContext, locale,
    num = 50, dateRestrict
  } = args;

  if (!baseQuery?.trim()) throw new Error('cseSearch: baseQuery required');
  const q = buildEffectiveQuery({ baseQuery, userText, countryContext });

  // CSE: avoid 400s (trim query) and retry without locale clamps
  function buildCSEUrl(q: string, withLocale: boolean) {
    const u = new URL('https://www.googleapis.com/customsearch/v1');
    u.searchParams.set('q', q.slice(0, 256));         // trim long queries to reduce 400s
    u.searchParams.set('key', process.env.GOOGLE_CSE_KEY!);
    
    // Add Custom Search Engine ID if available
    const cx = process.env.GOOGLE_CSE_CX;
    if (cx) {
      u.searchParams.set('cx', cx);
    } else {
      // If no CSE ID, use a default one or disable CSE
      console.warn('[cse] GOOGLE_CSE_CX not configured, CSE search will fail');
      return null; // Return null to indicate CSE is not properly configured
    }
    
    u.searchParams.set('num', String(Math.min(num, 10)));
    u.searchParams.set('safe', 'off');
    if (withLocale) {
      if (countryContext?.locale || locale) {
        u.searchParams.set('hl', (countryContext?.locale || locale || 'en').toLowerCase());
      }
      if (countryContext?.iso2) {
        u.searchParams.set('gl', countryContext.iso2);
      }
      if (dateRestrict) {
        u.searchParams.set('dateRestrict', dateRestrict);
      }
      // Avoid lr/cr which often trigger 400 when combined with other params
    }
    return u.toString();
  }

  async function cseSearchRobust(q: string) {
    try {
      // Check if CSE is properly configured
      const url = buildCSEUrl(q, true);
      if (!url) {
        console.warn('[cse] CSE not properly configured, returning empty results');
        return { items: [] };
      }

      const result = await RetryService.executeWithRetry(
        'google_cse',
        'search',
        () => executeWithCircuitBreaker(
          'google_cse',
          async () => {
            let res = await fetch(url);
            if (res.status === 400) {
              const fallbackUrl = buildCSEUrl(q, false);
              if (fallbackUrl) {
                res = await fetch(fallbackUrl);
              }
            }
            if (!res.ok) {
              throw new Error(`CSE API returned ${res.status}: ${res.statusText}`);
            }
            const json = await res.json().catch(() => ({}));
            return { items: Array.isArray(json.items) ? json.items : [] };
          },
          CIRCUIT_BREAKER_CONFIGS.GOOGLE_CSE
        )
      );
      return result.data;
    } catch (error) {
      console.warn('[cse] Search failed after retries and circuit breaker:', error);
      return { items: [] };
    }
  }

  return await cseSearchRobust(q);
}
