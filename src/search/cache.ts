/**
 * Cache Key Utilities
 * 
 * Prevents search:search: duplication
 */

export function makeCacheKey(provider: 'firecrawl'|'cse', q: string, country: string, from?: string, to?: string) {
  return `search:${provider}:${q}|${country}|${from ?? ''}|${to ?? ''}`;
}
