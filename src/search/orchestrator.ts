/**
 * Search Orchestrator
 * 
 * Runs tiers, then retry with base if 0
 */

import { buildTierQueries, assertClean } from './query';
import { firecrawlSearch } from './providers/firecrawl';
import { cseSearch } from './providers/cse';
import { prefilter } from './url-filters';

const MIN_URLS = 8;

export async function runSearch(opts: { baseQuery: string; country?: string; days?: number; enableAug?: boolean }) {
  const country = (opts.country ?? 'DE').toUpperCase();
  const tiers = buildTierQueries(opts.baseQuery, !!opts.enableAug);
  const urlsAll: string[] = [];

  const fcParams = {
    limit: 20,
    sources: ['web'],
    ignoreInvalidURLs: true,
    scrapeOptions: {
      formats: ['markdown'],
      onlyMainContent: false,
      waitFor: 800,
      blockAds: true,
      removeBase64Images: true,
      location: { country, languages: ['de','en'] }
    }
  };

  async function providerOnce(q: string) {
    try { return await firecrawlSearch(q, fcParams); }
    catch { return await cseSearch(q); }
  }

  for (const b of tiers) {
    assertClean(b.q);
    urlsAll.push(...await providerOnce(b.q));
  }

  let urls = prefilter(Array.from(new Set(urlsAll)));

  // Retry with base chips + .de shard if too few or noisy:
  let retriedWithBase = false;
  if (urls.length < MIN_URLS) {
    retriedWithBase = true;
    const chips = ['Konferenz','Kongress','Tagung','Seminar','Workshop','Veranstaltung','Berlin','München','Frankfurt','Köln','Hamburg','Düsseldorf','Stuttgart'];
    for (const w of chips) {
      const q = `(${opts.baseQuery}) ${w}`;
      assertClean(q);
      urls.push(...await providerOnce(q));
      const qDe = `(${opts.baseQuery}) site:.de ${w}`;
      urls.push(...await cseSearch(qDe));
    }
    urls = prefilter(Array.from(new Set(urls)));
  }

  console.info(JSON.stringify({ at:'search_summary_urls', count: urls.length, sample: urls.slice(0,6) }, null, 2));
  return { urls, retriedWithBase };
}
