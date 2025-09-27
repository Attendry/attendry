/**
 * Search Orchestrator
 * 
 * Single source of truth for "success" and items
 */

import { firecrawlSearch } from './firecrawlService';
import { cseSearch } from './cseService';
import { logger } from '@/utils/logger';
import { ensureArray, safeFilter } from '@/lib/arrays';
import { buildSearchQuery } from '@/search/buildQuery';

// Normalize provider lists once at the edge
function normalizeProviders(input?: unknown) {
  const list = ensureArray<string>(input);
  // Default order if nothing is provided
  return (list.length ? list : ['firecrawl', 'cse']).map(s => s.trim());
}

export async function executeSearch(opts: {
  baseQuery: string;
  userText?: string;
  country?: string;
  dateFrom?: string;
  dateTo?: string;
  providers?: unknown;
}) {
  const { baseQuery, userText, country, dateFrom, dateTo, providers: providerInput } = opts;

  // Normalize providers to always be an array
  const providers = normalizeProviders(providerInput || process.env.SEARCH_PROVIDERS);

  // Add debug logging in non-production
  if (process.env.NODE_ENV !== 'production') {
    console.info('[providers_debug]', {
      raw: providerInput || process.env.SEARCH_PROVIDERS,
      normalized: providers,
    });
    
    console.info('[query_debug]', {
      baseFromConfig: baseQuery,
      userText: userText,
      effectiveQ: buildSearchQuery({ baseQuery, userText }),
    });
  }

  // Try each provider in order
  for (const provider of providers) {
    try {
      let result: any = null;

      if (provider === 'firecrawl') {
        result = await firecrawlSearch({
          baseQuery,
          userText,
          location: country,
          dateFrom,
          dateTo,
        });
      } else if (provider === 'cse') {
        result = await cseSearch({
          baseQuery,
          userText,
          crCountry: country ? `country${country.toUpperCase()}` : undefined,
          gl: country?.toLowerCase(),
          lr: 'lang_de|lang_en',
          dateRestrict: undefined, // or 'w1' if you need a rolling week
        });
      }

      // Use defensive helper to ensure items is always an array
      const items = ensureArray(result?.items).filter(Boolean);
      
      if (items.length > 0) {
        logger.info({ at: 'search_service', provider, items: items.length });
        return { providerUsed: provider, items };
      }
    } catch (e) {
      logger.warn({ at: 'search_service', provider, err: String(e) });
    }
  }

  // Consistent empty result
  return { providerUsed: null, items: [] };
}
