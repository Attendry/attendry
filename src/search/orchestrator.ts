/**
 * Search Orchestrator
 * 
 * Runs tiers, then retry with base if 0
 */

import { buildTierQueries, assertClean, EVENT_DE, CITY_DE, buildDeEventQuery } from './query';
import { DEFAULT_SHARD_KEYWORDS } from '@/config/search-dictionaries';
import { unifiedSearch } from '@/lib/search/unified-search-core';
import { prefilter } from './url-filters';
import { ensureCorrelation } from '@/lib/obs/corr';
import { stageCounter, logSuppressedSamples, type Reason } from '@/lib/obs/triage-metrics';
// Simple chunk function to replace the missing import
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

const MIN_URLS = 8;
const MAX_CONCURRENT_FC = Number(process.env.FIRECRAWL_MAX_CONCURRENCY ?? 25);
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
  const baseQuery = country === 'DE' ? buildDeEventQuery() : opts.baseQuery;
  const tiers = buildTierQueries(baseQuery, !!opts.enableAug);
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
      const unifiedResult = await unifiedSearch({
        q,
        country: country || undefined,
        limit: FC_PAGE_SIZE * FC_MAX_PAGES,
        useCache: true
      });
      return unifiedResult.items;
    } catch (error) {
      console.warn('[search-orchestrator] Unified search failed for query:', q, error);
      return [];
    }
  }

  const tierEntries = Array.from(tiers.entries());
  const tierBatches = chunk(tierEntries, MAX_CONCURRENT_FC);
  for (const batch of tierBatches) {
    const promises = batch.map(async ([index, query]: [number, string]) => {
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
        const deResult = await unifiedSearch({ q: qDe, country: 'DE', useCache: true });
        urls.push(...deResult.items);

        // 2) allow unified search a try with German token
        const qFc = `(${opts.baseQuery}) ${w}`;
        assertClean(qFc);
        const fcResult = await unifiedSearch({ q: qFc, country: 'DE', useCache: true });
        urls.push(...fcResult.items);
      }
    } else {
      // For non-German or pan-European searches, use broader search terms
      for (const w of DEFAULT_SHARD_KEYWORDS) {
        const q = `(${opts.baseQuery}) ${w}`;
        assertClean(q);
        const result = await unifiedSearch({ q, country: country || undefined, useCache: true });
        urls.push(...result.items);
      }
    }

    urls = prefilter([...new Set(urls)]);
  }

  console.info(JSON.stringify({ at:'search_summary_urls', count: urls.length, sample: urls.slice(0,8) }, null, 2));
  return { urls, retriedWithBase };
}
