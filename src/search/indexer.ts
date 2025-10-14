import type { Pool, PoolClient, ClientBase } from 'pg';
import { logger } from '../utils/logger';

export type EmbeddingGenerator = (input: string) => Promise<number[]>;

export type CanonicalDocument = {
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

export const POSTGRES_DDL = {
  table: `
    CREATE TABLE IF NOT EXISTS search_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      url TEXT NOT NULL,
      domain TEXT NOT NULL,
      tags TEXT[] DEFAULT array[]::TEXT[],
      lang TEXT,
      country TEXT,
      published_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      authority_score DOUBLE PRECISION,
      embedding VECTOR(1536)
    );
  `,
  tsvector: `
    ALTER TABLE search_documents
      ADD COLUMN IF NOT EXISTS tsv tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(body, '')), 'B') ||
        setweight(to_tsvector('simple', array_to_string(tags, ' ')), 'C')
      ) STORED;
  `,
  indexes: `
    CREATE INDEX IF NOT EXISTS idx_search_documents_tsv ON search_documents USING GIN (tsv);
    CREATE INDEX IF NOT EXISTS idx_search_documents_country_published ON search_documents (country, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_search_documents_domain ON search_documents (domain);
  `,
  vector: `
    CREATE INDEX IF NOT EXISTS idx_search_documents_embedding ON search_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  `,
};

export interface ExternalIndexerAdapter {
  name: 'meilisearch' | 'typesense' | 'opensearch';
  upsert(docs: CanonicalDocument[]): Promise<void>;
  delete(ids: string[]): Promise<void>;
  flush?(): Promise<void>;
}

type IndexResult = {
  indexed: number;
  skipped: number;
};

export type IndexerOptions = {
  pgPool?: Pool;
  chunkSize?: number;
  adapter?: ExternalIndexerAdapter;
  embedder?: EmbeddingGenerator;
};

export async function upsertDocuments(
  documents: CanonicalDocument[],
  opts: IndexerOptions
): Promise<IndexResult> {
  if (!documents.length) {
    return { indexed: 0, skipped: 0 };
  }

  const chunkSize = opts.chunkSize ?? 100;
  let indexed = 0;
  let skipped = 0;

  if (opts.pgPool) {
    await withTransaction(opts.pgPool, async (client) => {
      for (let i = 0; i < documents.length; i += chunkSize) {
        const chunk = documents.slice(i, i + chunkSize);

        const enrichedChunk = await Promise.all(chunk.map(async (doc) => {
          if (!doc.embedding && opts.embedder) {
            try {
              const embedding = await opts.embedder(`${doc.title}\n${doc.body}`);
              return { ...doc, embedding };
            } catch (error) {
              logger.warn({ at: 'search.indexer.embedder_failed', id: doc.id, error: error instanceof Error ? error.message : String(error) });
            }
          }
          return doc;
        }));

        const values = enrichedChunk.map((doc) => [
          doc.id,
          doc.title,
          doc.body,
          doc.url,
          doc.domain,
          doc.tags,
          doc.lang,
          doc.country,
          doc.published_at,
          doc.updated_at,
          doc.authority_score ?? null,
          doc.embedding ?? null,
        ]);

        const placeholders = values
          .map((row, idx) =>
            `($${idx * row.length + 1}, $${idx * row.length + 2}, $${idx * row.length + 3}, $${idx * row.length + 4}, ` +
            `$${idx * row.length + 5}, $${idx * row.length + 6}, $${idx * row.length + 7}, $${idx * row.length + 8}, ` +
            `$${idx * row.length + 9}, $${idx * row.length + 10}, $${idx * row.length + 11}, $${idx * row.length + 12})`
          )
          .join(',');

        const flatValues = values.flat();

        await client.query(
          `INSERT INTO search_documents (
              id, title, body, url, domain, tags, lang, country, published_at, updated_at, authority_score, embedding
            ) VALUES ${placeholders}
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              body = EXCLUDED.body,
              url = EXCLUDED.url,
              domain = EXCLUDED.domain,
              tags = EXCLUDED.tags,
              lang = EXCLUDED.lang,
              country = EXCLUDED.country,
              published_at = EXCLUDED.published_at,
              updated_at = EXCLUDED.updated_at,
              authority_score = EXCLUDED.authority_score,
              embedding = COALESCE(EXCLUDED.embedding, search_documents.embedding)
          `,
          flatValues
        );

        indexed += chunk.length;
      }
    });
  } else {
    skipped = documents.length;
  }

  if (opts.adapter) {
    await opts.adapter.upsert(documents);
  }

  logger.info({
    at: 'search.indexer.upsertDocuments',
    indexed,
    skipped,
    adapter: opts.adapter?.name,
  });

  return { indexed, skipped };
}

export async function deleteDocuments(ids: string[], opts: IndexerOptions): Promise<void> {
  if (!ids.length) return;

  if (opts.pgPool) {
    await opts.pgPool.query('DELETE FROM search_documents WHERE id = ANY($1)', [ids]);
  }

  if (opts.adapter) {
    await opts.adapter.delete(ids);
  }

  logger.info({ at: 'search.indexer.deleteDocuments', count: ids.length });
}

async function withTransaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export type DeltaIndexInput = {
  documents: CanonicalDocument[];
  deletions?: string[];
  adapterOptions?: IndexerOptions;
};

export async function runDeltaIndex({
  documents,
  deletions,
  adapterOptions,
}: DeltaIndexInput): Promise<void> {
  const startedAt = Date.now();
  await upsertDocuments(documents, adapterOptions ?? {});
  if (deletions?.length) {
    await deleteDocuments(deletions, adapterOptions ?? {});
  }
  logger.info({
    at: 'search.indexer.deltaIndex.complete',
    tookMs: Date.now() - startedAt,
    inserted: documents.length,
    deleted: deletions?.length ?? 0,
  });
}

export type MeilisearchAdapterOptions = {
  client: { index: (name: string) => { addDocuments: (docs: unknown[]) => Promise<void>; deleteDocuments: (ids: string[]) => Promise<void> } };
  indexName: string;
};

export function createMeilisearchAdapter(opts: MeilisearchAdapterOptions): ExternalIndexerAdapter {
  const index = opts.client.index(opts.indexName);
  return {
    name: 'meilisearch',
    async upsert(docs) {
      await index.addDocuments(docs);
    },
    async delete(ids) {
      await index.deleteDocuments(ids);
    },
  };
}

export type TypesenseAdapterOptions = {
  client: {
    collections: {
      [key: string]: {
        documents: {
          upsert: (doc: unknown) => Promise<void>;
          delete: (query: { filter_by: string }) => Promise<void>;
        };
      };
    };
  };
  collectionName: string;
};

export function createTypesenseAdapter(opts: TypesenseAdapterOptions): ExternalIndexerAdapter {
  const collection = opts.client.collections[opts.collectionName];
  return {
    name: 'typesense',
    async upsert(docs) {
      for (const doc of docs) {
        await collection.documents.upsert(doc);
      }
    },
    async delete(ids) {
      await collection.documents.delete({ filter_by: `id:=[${ids.join(',')}]` });
    },
  };
}

export type OpenSearchAdapterOptions = {
  client: {
    bulk: (opts: { body: unknown[] }) => Promise<void>;
  };
  indexName: string;
};

export function createOpenSearchAdapter(opts: OpenSearchAdapterOptions): ExternalIndexerAdapter {
  return {
    name: 'opensearch',
    async upsert(docs) {
      const body: unknown[] = [];
      for (const doc of docs) {
        body.push({ index: { _index: opts.indexName, _id: doc.id } });
        body.push(doc);
      }
      await opts.client.bulk({ body });
    },
    async delete(ids) {
      const body: unknown[] = [];
      for (const id of ids) {
        body.push({ delete: { _index: opts.indexName, _id: id } });
      }
      await opts.client.bulk({ body });
    },
  };
}

export type PgClient = Pool | PoolClient | ClientBase;

export async function ensureSchema(client: PgClient): Promise<void> {
  await client.query(POSTGRES_DDL.table);
  await client.query(POSTGRES_DDL.tsvector);
  await client.query(POSTGRES_DDL.indexes);
  await client.query(POSTGRES_DDL.vector);
}

