/**
 * Cache Key Utilities
 * 
 * Prevents search:search: duplication and normalizes cache keys
 */

export function makeCacheKey(parts: Array<string | number | undefined | null>) {
  return parts
    .filter(Boolean)
    .map(s => String(s).trim())
    .join('|')
    .replace(/\|+/g, '|');
}

// usage (replace all ad-hoc constructions):
// ❌ "search:search:firecrawl:" + key
// ✅
export function searchCacheKey({
  provider,
  query,
  country,
  from,
  to,
}: {
  provider: 'firecrawl' | 'cse';
  query: string;
  country?: string;
  from?: string;
  to?: string;
}) {
  return makeCacheKey(['search', provider, query, country, from, to]);
}
