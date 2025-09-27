/**
 * Search Orchestrator
 * 
 * Runs tiers, then retry with base if 0
 */

import { buildTierQueries, assertQueryIsClean } from './query-builder';
import { firecrawlSearch } from './providers/firecrawl';
import { cseSearch } from './providers/cse';
import { prefilter } from './url-filters';

const MIN_URLS = 8;

export async function runSearch({ baseQuery, days=60 }: { baseQuery: string; days?: number }) {
  const { A, B, C } = buildTierQueries(baseQuery);
  const tiers = [A,B,C].flat();

  const params = {
    limit: 20,
    sources: ['web'],
    // avoid brittle 'tbs' here; Firecrawl's date filters have been noisy in your logs
    ignoreInvalidURLs: true,
    scrapeOptions: {
      formats: ['markdown'],
      onlyMainContent: false,
      waitFor: 800,
      blockAds: true,
      removeBase64Images: true,
      location: { country: 'DE', languages: ['de','en'] }
    }
  };

  async function providerOnce(q: string) {
    try { return await firecrawlSearch(q, params); }
    catch { return await cseSearch(q); } // clean fallback
  }

  let urls: string[] = [];
  for (const b of tiers) {
    assertQueryIsClean(b.q);
    urls.push(...await providerOnce(b.q));
  }
  urls = Array.from(new Set(urls));
  urls = prefilter(urls);

  // Retry with base chips if too few / junk
  let retriedWithBase = false;
  if (urls.length < MIN_URLS) {
    retriedWithBase = true;
    const chips = ['Konferenz','Kongress','Tagung','Seminar','Workshop','Veranstaltung'];
    for (const w of chips) {
      const q = `(${baseQuery}) ${w}`;
      assertQueryIsClean(q);
      urls.push(...await providerOnce(q));
    }
    urls = prefilter(Array.from(new Set(urls)));
  }

  // Curated site shards (DE legal event-heavy)
  if (urls.length < MIN_URLS) {
    const sites = [
      'site:juve.de', 'site:anwaltverein.de', 'site:dav.de',
      'site:forum-institut.de', 'site:euroforum.de', 'site:beck-akademie.de',
      'site:beck-shop.de', 'site:bitkom.org', 'site:handelsblatt.com',
      'site:uni-*.de'
    ];
    for (const s of sites) {
      const q = `(${baseQuery}) ${s}`;
      assertQueryIsClean(q);
      urls.push(...await cseSearch(q));
      if (urls.length >= MIN_URLS) break;
    }
    urls = prefilter(Array.from(new Set(urls)));
  }

  console.info(JSON.stringify({ at:'search_summary_urls', count: urls.length, sample: urls.slice(0,6) }, null, 2));
  return { urls, retriedWithBase };
}
