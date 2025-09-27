/**
 * Search Orchestrator
 * 
 * Single source of truth for "success" and items
 */

import { firecrawlSearch } from './firecrawlService';
import { cseSearch } from './cseService';
import { logger } from '@/utils/logger';
import { normalizeProviders, asArray } from '@/utils/array-helpers';

export async function executeSearch(opts: {
  baseQuery: string;
  userText?: string;
  country?: string;
  dateFrom?: string;
  dateTo?: string;
  providers?: string | string[];
}) {
  const { baseQuery, userText, country, dateFrom, dateTo, providers: providerInput } = opts;

  // Normalize providers to always be an array
  const providers = normalizeProviders(providerInput || process.env.SEARCH_PROVIDERS);

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

      // Use type guard to ensure items is always an array
      const items = asArray(result?.items).filter(Boolean);
      
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
