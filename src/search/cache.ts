/**
 * Cache Key Utilities
 * 
 * Prevents search:search: duplication and normalizes cache keys
 */

export function makeCacheKey(parts: Array<string | number | undefined | null>) {
  return parts
    .filter(Boolean)
    .map((s) => String(s).trim())
    .join('|')
    .replace(/\|+/g, '|');
}

export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  swrExpiresAt?: number;
};

export interface CacheStore {
  get<T>(key: string): Promise<CacheEntry<T> | undefined>;
  set<T>(key: string, value: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<void>;
}

export type CacheConfig = {
  ttlMs: number;
  swrMs?: number;
};

const DEFAULT_QCACHE_TTL = 1000 * 60 * 60 * 12; // 12h
const DEFAULT_QCACHE_SWR = 1000 * 60 * 15; // 15m
const DEFAULT_VECTOR_TTL = 1000 * 60 * 60 * 24; // 24h
const DEFAULT_RESULT_TTL = 1000 * 60 * 60 * 2; // 2h

export const enum CacheKind {
  QUERY = 'query',
  VECTOR = 'vector',
  RESULT = 'result',
}

type CacheKindConfig = Record<CacheKind, CacheConfig>;

const CONFIG: CacheKindConfig = {
  [CacheKind.QUERY]: { ttlMs: DEFAULT_QCACHE_TTL, swrMs: DEFAULT_QCACHE_SWR },
  [CacheKind.VECTOR]: { ttlMs: DEFAULT_VECTOR_TTL },
  [CacheKind.RESULT]: { ttlMs: DEFAULT_RESULT_TTL },
};

export const DEFAULT_CACHE_TTLS = {
  queryMs: DEFAULT_QCACHE_TTL,
  querySwrMs: DEFAULT_QCACHE_SWR,
  vectorMs: DEFAULT_VECTOR_TTL,
  resultMs: DEFAULT_RESULT_TTL,
} as const;

export function ttlConfig(kind: CacheKind): CacheConfig {
  return CONFIG[kind];
}

export type CacheKeys = {
  intent: string;
  country: string;
  query: string;
  filters?: string;
};

export function makeQueryCacheKey(keys: CacheKeys): string {
  return makeCacheKey([CacheKind.QUERY, keys.intent, keys.country, keys.query, keys.filters]);
}

export function makeVectorCacheKey(keys: CacheKeys): string {
  return makeCacheKey([CacheKind.VECTOR, keys.intent, keys.country, keys.query]);
}

export function makeResultCacheKey(keys: CacheKeys): string {
  return makeCacheKey([CacheKind.RESULT, keys.intent, keys.country, keys.query, keys.filters]);
}

export function buildFiltersKey(normalized: any): string | undefined {
  const filters: Record<string, unknown> = {};
  if (normalized.language_pref?.length) filters.language = normalized.language_pref;
  if (normalized.date_range) filters.date = normalized.date_range;
  if (normalized.freshness_days) filters.freshness = normalized.freshness_days;
  if (normalized.sources_allowlist?.length) filters.sources_allow = normalized.sources_allowlist;
  if (normalized.sources_blocklist?.length) filters.sources_block = normalized.sources_blocklist;
  return Object.keys(filters).length ? JSON.stringify(filters) : undefined;
}

export function isStale<T>(entry: CacheEntry<T>): boolean {
  return entry.expiresAt < Date.now();
}

export function isWithinSwr<T>(entry: CacheEntry<T>): boolean {
  return entry.swrExpiresAt ? entry.swrExpiresAt >= Date.now() : false;
}

export type CacheClient = {
  store: CacheStore;
};

export class SearchCache {
  private readonly store: CacheStore;

  constructor(store: CacheStore) {
    this.store = store;
  }

  async get<T>(kind: CacheKind, key: string): Promise<T | null> {
    const entry = await this.store.get<T>(key);
    if (!entry) return null;

    const now = Date.now();
    if (entry.expiresAt < now) {
      await this.store.delete(key).catch(() => undefined);
      return null;
    }
    return entry.value;
  }

  async set<T>(kind: CacheKind, key: string, value: T): Promise<void> {
    const { ttlMs, swrMs } = CONFIG[kind];
    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      expiresAt: now + ttlMs,
      swrExpiresAt: swrMs ? now + swrMs : undefined,
    };
    await this.store.set(key, entry);
  }

  static keys = {
    query: makeQueryCacheKey,
    vector: makeVectorCacheKey,
    result: makeResultCacheKey,
  };
}
