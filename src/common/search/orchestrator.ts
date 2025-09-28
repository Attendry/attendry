// common/search/orchestrator.ts
import { loadActiveConfig } from './config';
import { buildSearchQuery } from './queryBuilder';
import { extractUrlsFromFirecrawl, extractUrlsFromCSE, dedupe } from './normalize';
import { search as firecrawlSearch } from '../../providers/firecrawl';
import { search as cseSearch } from '../../providers/cse';

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
    const urls = extractUrlsFromFirecrawl(res?.items || res?.data || res?.webResults || []);
    console.log('[orchestrator] Extracted Firecrawl URLs:', urls.length, urls.slice(0, 3));
    logs.push({ at: 'provider_result', provider: 'firecrawl', count: urls.length, q: query, debug: res.debug });
    return urls;
  };

  const runCSE = async (query: string) => {
    providersTried.push('cse');
    console.log('[orchestrator] Calling CSE with query:', query);
    const res = await cseSearch({ q: query, country: country || 'DE' }).catch(() => ({ items: [] }));
    console.log('[orchestrator] CSE response:', JSON.stringify(res, null, 2));
    const urls = extractUrlsFromCSE(res?.items || []);
    console.log('[orchestrator] Extracted CSE URLs:', urls.length, urls.slice(0, 3));
    logs.push({ at: 'provider_result', provider: 'cse', count: urls.length, q: query, debug: res.debug });
    return urls;
  };

  // Try firecrawl then cse (primary query)
  let urls = await runFirecrawl(q);
  let providerUsed: 'firecrawl' | 'cse' = 'firecrawl';
  if (urls.length === 0) {
    const cseUrls = await runCSE(q);
    if (cseUrls.length) {
      urls = cseUrls; providerUsed = 'cse';
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
