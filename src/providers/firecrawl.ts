import type { SearchParams } from './types';

export async function search(params: { q: string; dateFrom?: string; dateTo?: string }) {
  const body:any = {
    query: params.q,
    limit: 20,
    sources: ['web'],
    // Only pass typed dates if the backend actually supports them; otherwise omit.
    // DO NOT pass tbs/location unless behind a flag.
  };

  // Example feature flag (default false)
  if (process.env.FIRECRAWL_LEGACY_KNOBS === 'true') {
    body.tbs = `cdr:1,cd_min:${params.dateFrom ?? ''},cd_max:${params.dateTo ?? ''}`;
    body.location = 'Germany';
  }

  if (body.tbs || body.location) {
    console.warn('[firecrawl] legacy knobs in use', { tbs: body.tbs, location: body.location });
  }

  const res = await fetch('https://api.firecrawl.dev/v1/search', { method: 'POST', headers: {'content-type':'application/json', 'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`}, body: JSON.stringify(body) });
  const json = await res.json();

  // Map to {items:string[]}
  const items: string[] = (json?.data ?? json?.results ?? json?.webResults ?? [])
    .map((x:any) => x?.url || x?.link)
    .filter((u:string) => typeof u === 'string' && u.startsWith('http'));

  return { items, debug: { rawCount: items.length } };
}
