/**
 * Firecrawl Provider Adapter
 * 
 * Sends exactly what we built - no transformations
 */

export async function firecrawlSearch(q: string, params: any): Promise<string[]> {
  console.info(JSON.stringify({ at: 'sending_to_firecrawl', query: q, len: q.length }, null, 2));
  // DO NOT transform `q` here. No synonyms. No appends.
  const res = await firecrawl.search({ query: q, ...params });
  return (res?.webResults || []).map((r: any) => r.url).filter(Boolean);
}
