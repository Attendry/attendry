import type { SearchParams } from './types';

export async function search(params: { q: string; dateFrom?: string; dateTo?: string }) {
  try {
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

    console.log('[firecrawl] Making request with body:', JSON.stringify(body, null, 2));

    const res = await fetch('https://api.firecrawl.dev/v1/search', { 
      method: 'POST', 
      headers: {
        'content-type':'application/json', 
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
      }, 
      body: JSON.stringify(body) 
    });

    console.log('[firecrawl] Response status:', res.status, res.statusText);

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[firecrawl] API error:', res.status, errorText);
      return { items: [], debug: { error: `HTTP ${res.status}: ${errorText}`, rawCount: 0 } };
    }

    const json = await res.json();
    console.log('[firecrawl] Response data:', JSON.stringify(json, null, 2));

    // Map to {items:string[]}
    const items: string[] = (json?.data ?? json?.results ?? json?.webResults ?? [])
      .map((x:any) => x?.url || x?.link)
      .filter((u:string) => typeof u === 'string' && u.startsWith('http'));

    console.log('[firecrawl] Extracted URLs:', items.length, items.slice(0, 3));

    return { items, debug: { rawCount: items.length, responseKeys: Object.keys(json) } };
  } catch (error) {
    console.error('[firecrawl] Request failed:', error);
    return { items: [], debug: { error: error instanceof Error ? error.message : 'Unknown error', rawCount: 0 } };
  }
}
