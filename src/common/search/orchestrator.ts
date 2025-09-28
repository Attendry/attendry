// common/search/orchestrator.ts
import { loadActiveConfig } from './config';
import { buildSearchQuery } from './queryBuilder';
import { extractUrlsFromFirecrawl, extractUrlsFromCSE, dedupe } from './normalize';
import { search as firecrawlSearch } from '../../providers/firecrawl';
import { search as cseSearch } from '../../providers/cse';
import { search as databaseSearch } from '../../providers/database';

type ExecArgs = {
  userText?: string;
  country?: string | null;         // e.g., "DE"
  dateFrom?: string | null;        // "YYYY-MM-DD"
  dateTo?: string | null;          // "YYYY-MM-DD"
  locale?: 'de' | 'en';
};

const toUS = (iso: string) => {
  const [y,m,d] = iso.split('-');
  return `${m}/${d}/${y}`;
};

export async function executeSearch(args: ExecArgs) {
  const { userText = '', country = 'DE', dateFrom = null, dateTo = null, locale = 'de' } = args;

  const cfg = await loadActiveConfig();
  const baseQuery = cfg.baseQuery;
  const excludeTerms = cfg.excludeTerms || '';

  // Build exactly once
  const q = buildSearchQuery({ baseQuery, userText, excludeTerms });

  // Provider runners
  const providersTried: string[] = [];
  const logs: any[] = [];

  const runFirecrawl = async (query: string) => {
    providersTried.push('firecrawl');
    console.log('[orchestrator] Calling Firecrawl with query:', query);
    const res = await firecrawlSearch({ q: query, dateFrom, dateTo }); // existing helper
    console.log('[orchestrator] Firecrawl response:', JSON.stringify(res, null, 2));
    // The provider already returns URLs in res.items, no need to extract
    const urls = res?.items || [];
    console.log('[orchestrator] Firecrawl URLs:', urls.length, urls.slice(0, 3));
    logs.push({ at: 'provider_result', provider: 'firecrawl', count: urls.length, q: query, debug: res.debug });
    return urls;
  };

  const runCSE = async (query: string) => {
    providersTried.push('cse');
    console.log('[orchestrator] Calling CSE with query:', query);
    const res = await cseSearch({ q: query, country: country || 'DE' }).catch(() => ({ items: [] }));
    console.log('[orchestrator] CSE response:', JSON.stringify(res, null, 2));
    // The provider already returns URLs in res.items, no need to extract
    const urls = res?.items || [];
    console.log('[orchestrator] CSE URLs:', urls.length, urls.slice(0, 3));
    logs.push({ at: 'provider_result', provider: 'cse', count: urls.length, q: query, debug: res.debug });
    return urls;
  };

  // Try firecrawl then cse then database fallback
  let urls = await runFirecrawl(q);
  let providerUsed: 'firecrawl' | 'cse' | 'database' = 'firecrawl';
  
  if (urls.length === 0) {
    console.log('[orchestrator] Firecrawl returned 0 results, trying CSE...');
    const cseUrls = await runCSE(q);
    if (cseUrls.length) {
      urls = cseUrls; 
      providerUsed = 'cse';
    } else {
      console.log('[orchestrator] CSE also returned 0 results, using database fallback...');
      const dbUrls = await databaseSearch({ q, country: country || 'DE' });
      if (dbUrls.length) {
        urls = dbUrls;
        providerUsed = 'database';
        logs.push({ at: 'provider_result', provider: 'database', count: urls.length, q, debug: dbUrls.debug });
      }
    }
  }

  const unique = dedupe(urls);

  return {
    items: unique,
    providerUsed,
    providersTried,
    logs,
    effectiveQ: q,
    searchRetriedWithBase: false, // no second pattern anymore
  };
}
