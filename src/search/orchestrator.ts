/**
 * Search Orchestrator
 * 
 * Runs tiers, then retry with base if 0
 */

import { buildTierQueries, assertClean, EVENT_DE, CITY_DE } from './query';
import { firecrawlSearch } from './providers/firecrawl';
import { cseSearch } from './providers/cse';
import { prefilter } from './url-filters';

const MIN_URLS = 8;

export async function runSearch(opts: {
  baseQuery: string;
  country?: string; // default DE
  days?: number;    // currently unused by CSE reliably
  enableAug?: boolean;
}) {
  const country = (opts.country ?? 'DE').toUpperCase();

  const tiers = buildTierQueries(opts.baseQuery, !!opts.enableAug);
  const urlsAll: string[] = [];

  // Firecrawl params (kept small & robust)
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

  for (const t of tiers) {
    assertClean(t.q);
    urlsAll.push(...await providerOnce(t.q));
  }

  let urls = prefilter([...new Set(urlsAll)]);
  let retriedWithBase = false;

  if (urls.length < MIN_URLS) {
    retriedWithBase = true;

    // Strict German event sharding with .de constraint
    // Use short shards to avoid CSE 400s.
    const SHARDS = [
      ...EVENT_DE,
      ...CITY_DE,
      'Deutschland','DE'
    ];

    for (const w of SHARDS) {
      // 1) site:.de hard constraint
      const qDe = `(${opts.baseQuery}) site:.de ${w}`;
      assertClean(qDe);
      urls.push(...await cseSearch(qDe));

      // 2) allow Firecrawl a try with German token
      const qFc = `(${opts.baseQuery}) ${w}`;
      assertClean(qFc);
      urls.push(...await firecrawlSearch(qFc, fcParams));
    }

    urls = prefilter([...new Set(urls)]);
  }

  console.info(JSON.stringify({ at:'search_summary_urls', count: urls.length, sample: urls.slice(0,8) }, null, 2));
  return { urls, retriedWithBase };
}
