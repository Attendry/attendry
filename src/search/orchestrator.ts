/**
 * Search Orchestrator
 * 
 * Runs tiers, then retry with base if 0
 */

import { buildTierQueries, assertQueryIsClean } from './query-builder';
import { firecrawlSearch } from './providers/firecrawl';
import { cseSearch } from './providers/cse';

export async function runSearch({ baseQuery, days = 60, use = 'auto' }: { baseQuery: string; days?: number; use?: 'auto'|'cse'|'firecrawl' }) {
  const { tierA, tierB, tierC } = buildTierQueries(baseQuery);
  const allTiers = [tierA, tierB, tierC].flat();
  let urls: string[] = [];

  const params = {
    limit: 20,
    sources: ['web'],
    tbs: days ? undefined : undefined, // Let provider internally handle date; Firecrawl CDR was noisy
    ignoreInvalidURLs: true,
    scrapeOptions: { formats: ['markdown'], onlyMainContent: false, waitFor: 800, blockAds: true, removeBase64Images: true, location: { country: 'DE', languages: ['de','en'] } }
  };

  const providerSearch = async (q: string) => {
    if (use === 'cse') return cseSearch(q);
    if (use === 'firecrawl') return firecrawlSearch(q, params);
    // auto: try firecrawl once, if it throws, go CSE
    try { return await firecrawlSearch(q, params); } catch { return cseSearch(q, { minimal: true }); }
  };

  for (const bq of allTiers) {
    assertQueryIsClean(bq.q);
    const batch = await providerSearch(bq.q);
    urls.push(...batch);
  }
  urls = Array.from(new Set(urls));

  // Retry with base + single German event chips if still zero
  let searchRetriedWithBase = false;
  if (urls.length === 0) {
    searchRetriedWithBase = true;
    for (const w of ['Konferenz','Kongress','Tagung','Seminar','Workshop','Veranstaltung']) {
      const q = `(${baseQuery}) ${w}`;
      assertQueryIsClean(q);
      const b = await providerSearch(q);
      urls.push(...b);
    }
    urls = Array.from(new Set(urls));
  }

  console.info(JSON.stringify({ at: 'search_summary_urls', count: urls.length, sample: urls.slice(0,5) }, null, 2));
  return { urls, searchRetriedWithBase };
}
