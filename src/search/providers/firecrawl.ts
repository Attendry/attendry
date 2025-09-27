/**
 * Firecrawl Provider Adapter
 * 
 * Sends exactly what we built - no transformations
 */

import { FirecrawlSearchService } from '../../lib/services/firecrawl-search-service';

export async function firecrawlSearch(q: string, params: any): Promise<string[]> {
  console.info(JSON.stringify({ at: 'sending_to_firecrawl', query: q, len: q.length }, null, 2));
  // DO NOT transform `q` here. No synonyms. No appends.
  const res = await FirecrawlSearchService.searchEvents({ query: q, ...params });
  return (res?.items || []).map((r: any) => r.link).filter(Boolean);
}
