import type { Pool } from 'pg';
import { normalize } from 'path';

type QueryResultRow = Record<string, unknown>;

type QueryResult = {
  rows: QueryResultRow[];
};

type MockDocument = {
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
  authority_score?: number | null;
  embedding?: number[];
};

type Vector = number[];

function cosineSimilarity(a: Vector, b: Vector): number {
  const dot = a.reduce((sum, value, idx) => sum + value * (b[idx] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  if (!normA || !normB) return 0;
  return dot / (normA * normB);
}

function normaliseVector(vector: Vector): Vector {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!norm) return vector.map(() => 0);
  return vector.map((value) => value / norm);
}

export type MockPool = Pick<Pool, 'query'>;

export function createMockPool(documents: MockDocument[], embed: (text: string) => number[]): MockPool {
  const docs = documents.map((doc) => {
    const embedding = doc.embedding ?? normaliseVector(embed(`${doc.title} ${doc.body}`));
    return { ...doc, embedding };
  });

  return {
    async query(text: string, values: unknown[]): Promise<QueryResult> {
      if (text.includes('embedding <=>')) {
        return runSemanticQuery(text, values, docs);
      }
      if (text.includes('ts_rank_cd')) {
        return runLexicalQuery(values, docs);
      }
      throw new Error(`MockPool: unsupported query: ${text}`);
    },
  };

  function runLexicalQuery(values: unknown[], sourceDocs: typeof docs): QueryResult {
    const limit = Number(values.at(-1)) || 50;
    const queryString = String(values.at(-2) ?? '').toLowerCase();
    const country = String(values[0] ?? '').toLowerCase();
    const tokens = queryString.split(/\s+/).filter(Boolean);

    const rows = sourceDocs
      .filter((doc) => doc.country?.toLowerCase() === country)
      .map((doc) => {
        const haystack = `${doc.title} ${doc.body} ${doc.tags.join(' ')}`.toLowerCase();
        const matches = tokens.filter((token) => haystack.includes(token));
        const score_raw = tokens.length ? matches.length / tokens.length : 0;
        return { ...doc, score_raw };
      })
      .filter((row) => row.score_raw > 0)
      .sort((a, b) => b.score_raw - a.score_raw)
      .slice(0, limit);

    return { rows };
  }

  function runSemanticQuery(_text: string, values: unknown[], sourceDocs: typeof docs): QueryResult {
    const queryVector = Array.isArray(values[0]) ? normaliseVector(values[0] as number[]) : [];
    const country = String(values[1] ?? '').toLowerCase();
    const limit = Number(values[2]) || 50;

    const rows = sourceDocs
      .filter((doc) => doc.country?.toLowerCase() === country)
      .map((doc) => {
        const score_vector = Math.max(0, Math.min(1, cosineSimilarity(doc.embedding ?? [], queryVector)));
        return { ...doc, score_vector };
      })
      .sort((a, b) => b.score_vector - a.score_vector)
      .slice(0, limit);

    return { rows };
  }
}

export function createEmbed(dim = 32): (text: string) => number[] {
  return (text: string) => {
    const vector = new Array(dim).fill(0);
    const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    for (const token of tokens) {
      const idx = (token.charCodeAt(0) + token.length) % dim;
      vector[idx] += 1;
    }
    return normaliseVector(vector);
  };
}
