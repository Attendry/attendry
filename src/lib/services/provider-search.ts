/**
 * Provider Search Wrapper
 * 
 * Handles Firecrawl circuit breaker and CSE fallback
 */

import { googleCseSafe } from './google-cse-safe';
import { FirecrawlSearchService } from './firecrawl-search-service';

// Simple circuit breaker state
const circuitBreaker = {
  state: new Map<string, { isOpen: boolean; until: number }>(),
  
  isOpen(service: string): boolean {
    const state = this.state.get(service);
    if (!state) return false;
    if (Date.now() > state.until) {
      this.state.delete(service);
      return false;
    }
    return state.isOpen;
  },
  
  recordFailure(service: string) {
    this.state.set(service, { isOpen: false, until: Date.now() + 30000 }); // 30s backoff
  },
  
  open(service: string, duration: number) {
    this.state.set(service, { isOpen: true, until: Date.now() + duration });
  }
};

async function tryFirecrawl(q: string, params: any): Promise<string[]> {
  if (circuitBreaker.isOpen('firecrawl')) throw new Error('CIRCUIT_OPEN');
  try { 
    const result = await FirecrawlSearchService.searchEvents(params);
    return result.items?.map((item: any) => item.link) ?? [];
  }
  catch (e: any) {
    if (e?.message?.includes('timeout')) circuitBreaker.recordFailure('firecrawl');
    if (e?.message?.includes('CIRCUIT')) circuitBreaker.open('firecrawl', 60_000);
    throw e;
  }
}

export async function providerSearch(
  q: string, 
  opts: { 
    use: 'auto'|'firecrawl'|'cse', 
    fast?: boolean,
    country?: string,
    from?: string,
    to?: string,
    industry?: string,
    maxResults?: number,
    tbs?: string
  }
): Promise<string[]> {
  const results: string[] = [];
  const useFc = opts.use !== 'cse' && !circuitBreaker.isOpen('firecrawl');

  if (useFc) {
    try {
      // shorter wait for fast retry path
      const fcParams = { 
        query: q,
        country: opts.country,
        from: opts.from,
        to: opts.to,
        industry: opts.industry || "legal-compliance",
        maxResults: opts.maxResults || 20,
        tbs: opts.fast ? undefined : opts.tbs
      };
      const r = await tryFirecrawl(q, fcParams);
      results.push(...r);
      return results;
    } catch { 
      /* fall through to CSE */ 
    }
  }

  // Google CSE with param sanitization
  const r2 = await googleCseSafe(q);
  results.push(...r2);
  return results;
}

export { circuitBreaker };
