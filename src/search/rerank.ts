import type { Candidate } from './retrieve';
import { logger } from '../utils/logger';

export type CrossEncoder = {
  tokenizeBudget: number;
  rerank: (input: {
    query: string;
    documents: Array<{ id: string; text: string }>;
    budgetTokens: number;
    signal?: AbortSignal;
  }) => Promise<Array<{ id: string; score: number }>>;
};

export type RerankDeps = {
  crossEncoder?: CrossEncoder;
};

export async function rerank(
  query: string,
  candidates: Candidate[],
  budgetTokens: number,
  deps: RerankDeps,
  signal?: AbortSignal
): Promise<Candidate[]> {
  if (!deps.crossEncoder || !candidates.length) {
    return fallbackTieBreak(candidates);
  }

  const { crossEncoder } = deps;

  const documents = candidates.slice(0, Math.min(candidates.length, 20)).map((candidate) => ({
    id: candidate.doc.id,
    text: `${candidate.doc.title}\n${candidate.doc.body.slice(0, 2000)}`,
  }));

  const started = Date.now();
  try {
    const results = await crossEncoder.rerank({
      query,
      documents,
      budgetTokens,
      signal,
    });

    const scoreMap = new Map(results.map((res) => [res.id, clampScore(res.score)]));

    return candidates
      .map((candidate) => {
        const score_ce = scoreMap.get(candidate.doc.id) ?? 0;
        const final = candidate.score * 0.7 + score_ce * 0.3;
        return {
          ...candidate,
          score_ce,
          final_score: final,
        };
      })
      .sort((a, b) => (b.final_score ?? b.score) - (a.final_score ?? a.score));
  } catch (error) {
    logger.error({
      at: 'search.rerank.error',
      error: error instanceof Error ? error.message : String(error),
    });
    return fallbackTieBreak(candidates);
  } finally {
    logger.info({
      at: 'search.rerank.complete',
      tookMs: Date.now() - started,
      usedCrossEncoder: !!deps.crossEncoder,
    });
  }
}

function fallbackTieBreak(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.score_lex + b.score_sem) - (a.score_lex + a.score_sem);
  });
}

function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  if (score < 0) return 0;
  if (score > 1) return 1;
  return score;
}

