import type { Pool } from 'pg';
import type { NormalizedQuery } from './query-schema';
import { enforceCountry } from './filters';
import { logger } from '../utils/logger';
import { CacheKind, makeVectorCacheKey, SearchCache, buildFiltersKey, makeQueryCacheKey } from './cache';

export type RetrieveDependencies = {
  pgPool: Pool;
  embed: (text: string, opts?: { signal?: AbortSignal }) => Promise<number[]>;
  cache?: SearchCache;
};

export type LexicalRow = {
  id: string;
  title: string;
  body: string;
  url: string;
  domain: string;
  tags: string[];
  lang: string | null;
  country: string | null;
  published_at: Date | null;
  updated_at: Date | null;
  authority_score: number | null;
  score_raw: number;
};

export type SemanticRow = Omit<LexicalRow, 'score_raw'> & {
  score_vector: number;
};

export type Candidate = {
  doc: LexicalRow;
  score_lex: number;
  score_sem: number;
  recency: number;
  authority: number;
  geo_match: number;
  score: number;
  score_ce?: number;
  final_score?: number;
};

export type RetrieveResult = {
  candidates: Candidate[];
  debug: {
    features: Array<{
      id: string;
      score_lex: number;
      score_sem: number;
      recency: number;
      authority: number;
      geo_match: number;
      score: number;
    }>;
  };
};

const DEFAULT_WEIGHTS = {
  w_lex: 0.45,
  w_sem: 0.35,
  w_rec: 0.1,
  w_auth: 0.07,
  w_geo: 0.03,
};

const MAX_SEMANTIC_DIM = 1536;

export async function retrieve(
  normalized: NormalizedQuery,
  deps: RetrieveDependencies,
  opts?: { weights?: Partial<typeof DEFAULT_WEIGHTS>; signal?: AbortSignal }
): Promise<RetrieveResult> {
  const weights = { ...DEFAULT_WEIGHTS, ...opts?.weights };

  const maxLex = normalized.top_k_lex;
  const maxSem = normalized.top_k_sem;

  const filtersKey = buildFiltersKey(normalized);
  const cache = deps.cache;
  const queryCacheKey = cache ? makeQueryCacheKey({
    intent: normalized.intent,
    country: normalized.country,
    query: normalized.query,
    filters: filtersKey,
  }) : null;

  let lexicalRows: LexicalRow[];

  if (cache && queryCacheKey) {
    const cachedLexical = await cache.get<LexicalRow[]>(CacheKind.QUERY, queryCacheKey);
    if (cachedLexical) {
      lexicalRows = cachedLexical;
    } else {
      lexicalRows = await runLexicalQuery(normalized, deps.pgPool, maxLex);
      await cache.set(CacheKind.QUERY, queryCacheKey, lexicalRows).catch((error) => {
        logger.warn({ at: 'search.retrieve.lexicalCache.writeFailed', error: error instanceof Error ? error.message : String(error) });
      });
    }
  } else {
    lexicalRows = await runLexicalQuery(normalized, deps.pgPool, maxLex);
  }

  const semanticRowsRaw = await runSemanticQuery(normalized, deps, maxSem, opts?.signal);

  const lexScores = lexicalRows.map((row) => row.score_raw);
  const semScores = semanticRowsRaw.map((row) => row.score_vector);

  const normalizedLexScores = normalizeScores(lexScores);
  const normalizedSemScores = normalizeScores(semScores);

  const semanticRows = semanticRowsRaw.map((row, idx) => ({
    ...row,
    score_vector: normalizedSemScores[idx] ?? 0,
  }));

  const indexedCandidates = new Map<string, Candidate>();

  lexicalRows.forEach((row, idx) => {
    const scoreLex = normalizedLexScores[idx] ?? 0;
    indexedCandidates.set(row.id, buildCandidate(row, scoreLex, 0, normalized.country));
  });

  semanticRows.forEach((row) => {
    const existing = indexedCandidates.get(row.id);
    const candidate = existing ?? buildCandidate(row, 0, row.score_vector, normalized.country);
    candidate.score_sem = row.score_vector;
    candidate.score = computeHybridScore(candidate, weights);
    indexedCandidates.set(row.id, candidate);
  });

  const mergedCandidates = enforceCountry(Array.from(indexedCandidates.values()), normalized.country);

  const rescored = mergedCandidates.map((candidate) => ({
    ...candidate,
    score: computeHybridScore(candidate, weights),
  }));

  rescored.sort((a, b) => b.score - a.score);

  const debug = {
    features: rescored.map((candidate) => ({
      id: candidate.doc.id,
      score_lex: candidate.score_lex,
      score_sem: candidate.score_sem,
      recency: candidate.recency,
      authority: candidate.authority,
      geo_match: candidate.geo_match,
      score: candidate.score,
    })),
  };

  logger.info({
    at: 'search.retrieve',
    correlationId: normalized.correlationId,
    countLexical: lexicalRows.length,
    countSemantic: semanticRows.length,
    merged: rescored.length,
  });

  return { candidates: rescored.slice(0, normalized.top_k_rerank), debug };
}

function normalizeScores(scores: number[]): number[] {
  if (!scores.length) return [];
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  if (max === min) {
    return scores.map(() => 0.5);
  }
  return scores.map((score) => (score - min) / (max - min));
}

function computeHybridScore(candidate: Candidate, weights: typeof DEFAULT_WEIGHTS): number {
  return (
    weights.w_lex * candidate.score_lex +
    weights.w_sem * candidate.score_sem +
    weights.w_rec * candidate.recency +
    weights.w_auth * candidate.authority +
    weights.w_geo * candidate.geo_match
  );
}

function buildCandidate(
  row: LexicalRow | SemanticRow,
  scoreLex: number,
  scoreSem: number,
  expectedCountry: string
): Candidate {
  const now = Date.now();
  const published = row.published_at?.getTime() ?? row.updated_at?.getTime();
  const ageDays = published ? (now - published) / (1000 * 60 * 60 * 24) : Infinity;
  const recency = Number.isFinite(ageDays) ? Math.exp(-ageDays / 365) : 0;
  const authority = normaliseAuthority(row.authority_score ?? null);
  const geoMatch = row.country?.toLowerCase() === expectedCountry ? 1 : 0;

  return {
    doc: row,
    score_lex: scoreLex,
    score_sem: scoreSem,
    recency,
    authority,
    geo_match: geoMatch,
    score: 0,
  };
}

function normaliseAuthority(authority: number | null): number {
  if (!authority || authority <= 0) return 0;
  return Math.min(Math.log10(1 + authority) / 5, 1);
}

async function runLexicalQuery(query: NormalizedQuery, pool: Pool, limit: number): Promise<LexicalRow[]> {
  const { country, language_pref, date_range } = query;
  const values: Array<string | number | null> = [];
  const filters: string[] = ['country = $1'];
  values.push(country);
  let idx = values.length;

  if (language_pref?.length) {
    filters.push(`lang = ANY($${++idx})`);
    values.push(language_pref);
  }

  if (date_range?.from) {
    filters.push(`published_at >= $${++idx}`);
    values.push(date_range.from);
  }

  if (date_range?.to) {
    filters.push(`published_at <= $${++idx}`);
    values.push(date_range.to);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const q = `
    SELECT
      id,
      title,
      body,
      url,
      domain,
      tags,
      lang,
      country,
      published_at,
      updated_at,
      authority_score,
      ts_rank_cd(tsv, websearch_to_tsquery('simple', $${++idx})) AS score_raw
    FROM search_documents
    ${whereClause}
    ORDER BY score_raw DESC
    LIMIT $${++idx};
  `;
  values.push(query.query);
  values.push(limit);

  const { rows } = await pool.query<LexicalRow>(q, values);
  return rows;
}

async function runSemanticQuery(
  query: NormalizedQuery,
  deps: RetrieveDependencies,
  limit: number,
  signal?: AbortSignal
): Promise<SemanticRow[]> {
  const cache = deps.cache;
  const cacheKey = cache ? makeVectorCacheKey({
    intent: query.intent,
    country: query.country,
    query: query.query,
  }) : null;

  let embedding: number[] | null = null;

  if (cache && cacheKey) {
    try {
      embedding = await cache.get<number[]>(CacheKind.VECTOR, cacheKey);
    } catch (error) {
      logger.warn({ at: 'search.retrieve.vectorCache.miss', error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (!embedding) {
    embedding = await deps.embed(query.query, { signal });
    if (cache && cacheKey) {
      await cache.set(CacheKind.VECTOR, cacheKey, embedding).catch((error) => {
        logger.warn({ at: 'search.retrieve.vectorCache.writeFailed', error: error instanceof Error ? error.message : String(error) });
      });
    }
  }

  if (embedding.length > MAX_SEMANTIC_DIM) {
    throw new Error(`Embedding dimension too large: ${embedding.length}`);
  }

  const { rows } = await deps.pgPool.query<SemanticRow>(
    `
      SELECT
        id,
        title,
        body,
        url,
        domain,
        tags,
        lang,
        country,
        published_at,
        updated_at,
        authority_score,
        1 - (embedding <=> $1::vector) AS score_vector
      FROM search_documents
      WHERE country = $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `,
    [embedding, query.country, limit]
  );

  return rows;
}

export type { Candidate };

