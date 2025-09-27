/**
 * Search Orchestrator
 * 
 * Single source of truth for "success" and items
 */

import { firecrawlSearch } from './firecrawlService';
import { cseSearch } from './cseService';
import { logger } from '@/utils/logger';

export async function executeSearch(opts: {
  baseQuery: string;
  userText?: string;
  country?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const { baseQuery, userText, country, dateFrom, dateTo } = opts;

  try {
    // Try Firecrawl with longer timeout/retries
    const fc = await firecrawlSearch({
      baseQuery,
      userText,
      location: country,
      dateFrom,
      dateTo,
    });

    if (fc?.items?.length) {
      logger.info({ at: 'search_service', provider: 'firecrawl', items: fc.items.length });
      return { providerUsed: 'firecrawl', items: fc.items };
    }
  } catch (e) {
    logger.warn({ at: 'search_service', provider: 'firecrawl', err: String(e) });
  }

  // Fallback: CSE (don't mark success true if 400)
  try {
    const cse = await cseSearch({
      baseQuery,
      userText,
      crCountry: country ? `country${country.toUpperCase()}` : undefined,
      gl: country?.toLowerCase(),
      lr: 'lang_de|lang_en',
      dateRestrict: undefined, // or 'w1' if you need a rolling week
    });
    if (cse?.items?.length) {
      logger.info({ at: 'search_service', provider: 'cse', items: cse.items.length });
      return { providerUsed: 'cse', items: cse.items };
    }
  } catch (e) {
    logger.warn({ at: 'search_service', provider: 'cse', err: String(e) });
  }

  // Consistent empty result
  return { providerUsed: null, items: [] };
}
