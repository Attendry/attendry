/**
 * Search Orchestrator
 * 
 * Runs tiers, then retry with base if 0
 */

import { buildTierQueries, assertClean, EVENT_DE, CITY_DE } from './query';
import { firecrawlSearch } from './providers/firecrawl';
import { cseSearch } from './providers/cse';
import { prefilter } from './url-filters';
import { ensureCorrelation } from '@/lib/obs/corr';
import { stageCounter, logSuppressedSamples, type Reason } from '@/lib/obs/triage-metrics';

const MIN_URLS = 8;

export async function runSearch(opts: {
  baseQuery: string;
  country?: string; // default DE
  days?: number;    // currently unused by CSE reliably
  enableAug?: boolean;
}) {
  const country = (opts.country ?? 'DE').toUpperCase();

  const correlationId = ensureCorrelation();
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
    const result = await providerOnce(t.q);
    stageCounter(`tier:${t.tier}`, [], result, [{ key: 'returned', count: result.length, samples: result.slice(0,3) }]);
    urlsAll.push(...result);
  }

  const duplicates = urlsAll.filter((url, idx, arr) => arr.indexOf(url) !== idx);
  const dedupeReasons: Reason[] = [];
  if (duplicates.length) {
    dedupeReasons.push({ key: 'duplicate_url', count: duplicates.length, samples: duplicates.slice(0, 3) });
  }
  const unique = [...new Set(urlsAll)];
  stageCounter('tier:dedupe', urlsAll, unique, dedupeReasons);
  logSuppressedSamples('tier:dedupe', dedupeReasons);

  let urls = prefilter(unique);
  if (urls.length !== unique.length) {
    const blocked = unique.filter((u) => !urls.includes(u));
    const blockedReason: Reason = { key: 'url_blocked', count: blocked.length, samples: blocked.slice(0, 3) };
    stageCounter('prefilter', unique, urls, [blockedReason]);
    logSuppressedSamples('prefilter', [blockedReason]);
  }
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
