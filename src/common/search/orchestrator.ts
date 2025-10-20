// common/search/orchestrator.ts
import { loadActiveConfig } from './config';
import { buildSearchQuery } from './queryBuilder';
import { dedupe } from './normalize';
import { unifiedSearch } from '@/lib/search/unified-search-core';
import { ensureCorrelation } from '@/lib/obs/corr';
import { stageCounter, logSuppressedSamples, type Reason } from '@/lib/obs/triage-metrics';

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
  const { userText = '', country = null, dateFrom = null, dateTo = null, locale = 'de' } = args;

  const cfg = await loadActiveConfig();
  const baseQuery = cfg.baseQuery;
  const excludeTerms = cfg.excludeTerms || '';

  // Build exactly once
  const correlationId = ensureCorrelation();
  const q = buildSearchQuery({ baseQuery, userText, excludeTerms });
  console.log(JSON.stringify({ correlationId, at: 'query', query: q }));

  // Use Unified Search Core
  const providersTried: string[] = [];
  const logs: any[] = [];

  console.log(JSON.stringify({ correlationId, at: 'unified_search_start', query: q }));
  
  const unifiedSearchResult = await unifiedSearch({
    q,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    country: country || 'DE',
    limit: 20,
    useCache: true
  });
  
  const urls = unifiedSearchResult.items;
  providersTried.push(...unifiedSearchResult.providers);
  
  console.log(JSON.stringify({ 
    correlationId, 
    at: 'unified_search_result', 
    providers: unifiedSearchResult.providers,
    totalItems: unifiedSearchResult.totalItems,
    metrics: unifiedSearchResult.metrics
  }));
  
  logs.push({
    at: 'unified_search',
    providers: unifiedSearchResult.providers,
    totalItems: unifiedSearchResult.totalItems,
    debug: unifiedSearchResult.debug,
    metrics: unifiedSearchResult.metrics
  });
  
  const providerUsed = unifiedSearchResult.providers[0] as 'firecrawl' | 'cse' | 'database';

  const duplicates = urls.filter((url, idx, arr) => arr.indexOf(url) !== idx);
  const unique = dedupe(urls);
  const dropReasons: Reason[] = [];
  if (duplicates.length) {
    dropReasons.push({ key: 'dedupe', count: duplicates.length, samples: duplicates.slice(0, 3) });
  }
  stageCounter('dedupe', urls, unique, dropReasons);
  logSuppressedSamples('dedupe', dropReasons);

  return {
    items: unique,
    providerUsed,
    providersTried,
    logs,
    effectiveQ: q,
    searchRetriedWithBase: false, // no second pattern anymore
  };
}
