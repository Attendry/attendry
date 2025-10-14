import { randomUUID } from 'crypto';
import { retrieve, type RetrieveDependencies, type RetrieveResult } from './retrieve';
import { rerank, type RerankDeps } from './rerank';
import { assertCountry } from './filters';
import { normalizeQuery } from './query-schema';
import { logger } from '../utils/logger';
import { SearchCache, CacheKind, buildFiltersKey } from './cache';
import { metrics } from './metrics';
import { CanonicalDocument } from '../types';
import type { CanonicalDocument } from './indexer';
import { createMockPool, createEmbed } from './testing/mockPool';
import { MemoryCacheStore } from './testing/mockCache';

type HybridDeps = Partial<RetrieveDependencies> & RerankDeps & {
  cache?: SearchCache;
  documents?: CanonicalDocument[];
  embedFn?: (text: string) => number[];
};

export async function hybridSearch(
  queryInput: unknown,
  deps: HybridDeps = {},
  options?: {
    budgetTokens?: number;
    timeoutMs?: number;
    retries?: number;
  }
) {
  const correlationId = randomUUID();
  const normalized = normalizeQuery(queryInput, { correlationId });

  const embedder = deps.embedFn ?? createEmbed();
  const documents = deps.documents ?? [];
  const pgPool = deps.pgPool ?? createMockPool(documents, embedder);
  const cache = deps.cache ?? new SearchCache(new MemoryCacheStore());
  const embed = deps.embed ?? (async (text: string) => embedder(text));

  const retrieveDeps: RetrieveDependencies = {
    pgPool,
    embed,
    cache,
  };

  const timeoutMs = options?.timeoutMs ?? 3500;
  const budgetTokens = options?.budgetTokens ?? 6000;
  const retries = options?.retries ?? 1;

  const embeddingController = new AbortController();
  const timeout = setTimeout(() => embeddingController.abort(), timeoutMs);

  const cacheKey = cache ? SearchCache.keys.result({
    intent: normalized.intent,
    country: normalized.country,
    query: normalized.query,
    filters: buildFiltersKey(normalized),
  }) : null;

  const start = Date.now();
  metrics.searchesTotal.inc({ intent: normalized.intent, country: normalized.country.toUpperCase() });

  try {
    if (cache && cacheKey) {
      const cached = await cache.get<{ items: Array<{ id: string; title: string; url: string; country: string | null; score: number }>; debug: unknown }>(CacheKind.RESULT, cacheKey);
      if (cached) {
        metrics.cacheHitRatio.set({ cache: 'result' }, 1);
        return { ...cached, latencyMs: Date.now() - start, cached: true };
      }
      metrics.cacheHitRatio.set({ cache: 'result' }, 0);
    }

    let attempts = 0;
    let result: RetrieveResult | undefined;
    let lastError: unknown;

    while (attempts <= retries) {
      attempts += 1;
      const stageStart = Date.now();
      try {
        result = await retrieve(normalized, retrieveDeps, { signal: embeddingController.signal });
        metrics.latencyMs.observe({ stage: 'retrieve' }, Date.now() - stageStart);
        break;
      } catch (error) {
        lastError = error;
        metrics.errorsTotal.inc({ stage: 'retrieve' });
        if (attempts > retries) {
          throw error;
        }
        const jitter = Math.random() * 200;
        await new Promise((resolve) => setTimeout(resolve, 200 + jitter));
      }
    }

    if (!result) {
      throw lastError ?? new Error('retrieval failed');
    }

    assertCountry(result.candidates, normalized.country, normalized.intent);

    const rerankStart = Date.now();
    const reranked = await rerank(normalized.query, result.candidates, budgetTokens, deps, embeddingController.signal);
    metrics.latencyMs.observe({ stage: 'rerank' }, Date.now() - rerankStart);

    const items = reranked.map((candidate) => ({
      id: candidate.doc.id,
      title: candidate.doc.title,
      url: candidate.doc.url,
      country: candidate.doc.country,
      score: candidate.final_score ?? candidate.score,
    }));

    const debug = {
      correlationId,
      features: reranked.map((candidate) => ({
        id: candidate.doc.id,
        score_lex: candidate.score_lex,
        score_sem: candidate.score_sem,
        recency: candidate.recency,
        authority: candidate.authority,
        geo_match: candidate.geo_match,
        score: candidate.score,
        score_ce: candidate.score_ce,
        final_score: candidate.final_score ?? candidate.score,
      })),
    };

    const response = {
      items,
      debug,
      latencyMs: Date.now() - start,
      cached: false,
    };

    metrics.finalScoreDistribution.observe({}, items[0]?.score ?? 0);

    if (cache && cacheKey) {
      await cache.set(CacheKind.RESULT, cacheKey, { items, debug }).catch((error) => {
        logger.warn({ at: 'search.hybridSearch.cache.writeFailed', error: error instanceof Error ? error.message : String(error) });
      });
    }

    return response;
  } catch (error) {
    metrics.errorsTotal.inc({ stage: 'hybrid' });
    logger.error({
      at: 'search.hybridSearch.error',
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

