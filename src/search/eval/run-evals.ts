import { readFileSync } from 'fs';
import { resolve } from 'path';
import yaml from 'yaml';
import { normalizeQuery } from '../query-schema';
import { hybridSearch } from '../hybridSearch';
import { metrics } from '../metrics';
import { logger } from '../../utils/logger';
import { FIXTURE_DOCUMENTS } from './fixtures';
import { createEmbed, createMockPool } from '../testing/mockPool';
import { MemoryCacheStore } from '../testing/mockCache';
import { SearchCache } from '../cache';

const embedder = createEmbed();
const mockPool = createMockPool(FIXTURE_DOCUMENTS, embedder);
const cache = new SearchCache(new MemoryCacheStore());

type GoldQuery = {
  query: string;
  country: string;
  expected_ids?: string[];
  must_domains?: string[];
  must_not_domains?: string[];
  k?: number;
};

type EvalResult = {
  precisionAtK: number;
  recallAtK: number;
  nDCG: number;
  localizationAccuracy: number;
  latencyMs: number;
};

function loadGoldQueries(): GoldQuery[] {
  const goldPath = resolve(process.cwd(), 'eval/gold.yaml');
  const content = readFileSync(goldPath, 'utf-8');
  return yaml.parse(content) as GoldQuery[];
}

async function evaluateQuery(gold: GoldQuery): Promise<EvalResult> {
  const normalized = normalizeQuery(gold, {});
  const start = Date.now();
  const result = await hybridSearch(normalized, {
    pgPool: mockPool,
    embed: async (text) => embedder(text),
    cache,
    documents: FIXTURE_DOCUMENTS,
    embedFn: embedder,
  }, {});

  const k = gold.k ?? 10;
  const expected = gold.expected_ids ?? [];

  const returnedIds = result.items.slice(0, k).map((item) => item.id);
  const relevantSet = new Set(expected);
  const retrievedRelevant = returnedIds.filter((id) => relevantSet.has(id)).length;

  const precisionAtK = returnedIds.length ? retrievedRelevant / returnedIds.length : 0;
  const recallAtK = expected.length ? retrievedRelevant / expected.length : 0;

  const gains = returnedIds.map((id, idx) => (relevantSet.has(id) ? 1 / Math.log2(idx + 2) : 0));
  const discounted = gains.reduce((sum, value) => sum + value, 0);

  const idealGains = expected.slice(0, k).map((_, idx) => 1 / Math.log2(idx + 2));
  const idealDiscounted = idealGains.reduce((sum, value) => sum + value, 0);

  const nDCG = idealDiscounted ? discounted / idealDiscounted : 0;

  const localizationAccuracy = result.items.every((item) => item.country?.toLowerCase() === gold.country.toLowerCase()) ? 1 : 0;

  const latencyMs = Date.now() - start;
  metrics.latencyMs.observe({ stage: 'eval' }, latencyMs);

  return { precisionAtK, recallAtK, nDCG, localizationAccuracy, latencyMs };
}

async function runEvals(): Promise<void> {
  const goldQueries = loadGoldQueries();
  const results: EvalResult[] = [];

  for (const gold of goldQueries) {
    try {
      const result = await evaluateQuery(gold);
      results.push(result);
    } catch (error) {
      logger.error({
        at: 'search.eval.runEvals.error',
        query: gold.query,
        error: error instanceof Error ? error.message : String(error),
      });
      process.exitCode = 1;
    }
  }

  const total = results.length;
  const precisionAvg = results.reduce((sum, res) => sum + res.precisionAtK, 0) / total;
  const recallAvg = results.reduce((sum, res) => sum + res.recallAtK, 0) / total;
  const nDCGAvg = results.reduce((sum, res) => sum + res.nDCG, 0) / total;
  const localizationAccuracy = results.reduce((sum, res) => sum + res.localizationAccuracy, 0) / total;
  const latencySorted = results.map((res) => res.latencyMs).sort((a, b) => a - b);
  const latencyP95 = latencySorted[Math.floor(0.95 * latencySorted.length)] ?? 0;

  console.table({
    averagePrecision: precisionAvg,
    averageRecall: recallAvg,
    averageNDCG: nDCGAvg,
    localizationAccuracy,
    latencyP95,
  });

  if (precisionAvg < 0.3 || localizationAccuracy < 0.95) {
    process.exitCode = 1;
  }
}

runEvals().catch((error) => {
  logger.error({
    at: 'search.eval.runEvals.fatal',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

