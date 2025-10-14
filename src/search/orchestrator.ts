/**
 * Search Orchestrator
 * 
 * Runs tiers, then retry with base if 0
 */

import { buildTierQueries, assertClean, EVENT_DE, CITY_DE } from './query';
import { runFirecrawlSearch } from './firecrawlClient';
import { cseSearch } from './providers/cse';
import { prefilter } from './url-filters';
import { ensureCorrelation } from '@/lib/obs/corr';
import { stageCounter, logSuppressedSamples, type Reason } from '@/lib/obs/triage-metrics';
import { chunk } from '@/lib/utils/array';

const MIN_URLS = 8;
const MAX_CONCURRENT_FC = Number(process.env.FIRECRAWL_MAX_CONCURRENCY ?? 10);
const FC_PAGE_SIZE = Number(process.env.FIRECRAWL_PAGE_SIZE ?? 15);
const FC_MAX_PAGES = Number(process.env.FIRECRAWL_MAX_PAGES ?? 2);

export async function runSearch(opts: {
  baseQuery: string;
  country?: string; // no default - respect user input
  days?: number;    // currently unused by CSE reliably
  enableAug?: boolean;
}) {
  const country = opts.country ? opts.country.toUpperCase() : null;

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
      location: country ? { country, languages: ['de','en'] } : undefined
    }
  };

  async function providerOnce(q: string) {
    try {
      const results: string[] = [];
      for (let page = 0; page < FC_MAX_PAGES; page += 1) {
        const pageQuery = page === 0 ? q : `${q} page:${page + 1}`;
        const batch = await runFirecrawlSearch(pageQuery, { ...fcParams, limit: FC_PAGE_SIZE });
        results.push(...batch);
        if (batch.length < FC_PAGE_SIZE) break;
      }
      return results;
    } catch {
      return await cseSearch(q);
    }
  }

  const tierBatches = chunk(tiers.entries(), MAX_CONCURRENT_FC);
  for (const batch of tierBatches) {
    const promises = batch.map(async ([index, query]) => {
      assertClean(query);
      const result = await providerOnce(query);
      stageCounter(`tier:${index}`, [], result, [{ key: 'returned', count: result.length, samples: result.slice(0, 3) }]);
      urlsAll.push(...result);
    });
    await Promise.all(promises);
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

    // Only apply country-specific sharding if a specific country is requested
    if (country === 'DE') {
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
        urls.push(...await runFirecrawlSearch(qFc, fcParams));
      }
    } else {
      // For non-German or pan-European searches, use broader search terms
      const BROAD_SHARDS = [
        'conference', 'summit', 'event', 'workshop', 'seminar',
        'meeting', 'symposium', 'forum', 'exhibition'
      ];

      for (const w of BROAD_SHARDS) {
        const q = `(${opts.baseQuery}) ${w}`;
        assertClean(q);
        urls.push(...await runFirecrawlSearch(q, fcParams));
      }
    }

    urls = prefilter([...new Set(urls)]);
  }

  console.info(JSON.stringify({ at:'search_summary_urls', count: urls.length, sample: urls.slice(0,8) }, null, 2));
  return { urls, retriedWithBase };
}
