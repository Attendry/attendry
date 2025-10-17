import type { SearchParams } from './types';

export async function search(params: { 
  q: string; 
  dateFrom?: string; 
  dateTo?: string;
  country?: string;
  limit?: number;
}) {
  try {
    // Check for API key
    const apiKey = process.env.FIRECRAWL_KEY;
    
    if (!apiKey) {
      console.error('[firecrawl] Missing API key: FIRECRAWL_KEY not set');
      return { items: [], debug: { error: 'Missing API key: FIRECRAWL_KEY not set', rawCount: 0 } };
    }

    // Build optimized search body based on Firecrawl v2 API
    const body: any = {
      query: params.q,
      limit: params.limit || 20,
      // Use news source for better event discovery
      sources: ['web', 'news'],
      // Add timeout for better reliability
      timeout: 30000
    };

    // Add location-based search for better regional results
    if (params.country) {
      const countryMap: Record<string, string> = {
        'DE': 'Germany',
        'FR': 'France', 
        'IT': 'Italy',
        'ES': 'Spain',
        'NL': 'Netherlands',
        'GB': 'United Kingdom',
        'US': 'United States'
      };
      
      const location = countryMap[params.country] || params.country;
      body.location = location;
      console.log('[firecrawl] Using location-based search:', location);
    }

    // Add time-based search for recent events
    if (params.dateFrom || params.dateTo) {
      // Use past year for event searches to catch upcoming events
      body.tbs = 'qdr:y';
      console.log('[firecrawl] Using time-based search: past year');
    } else {
      // Default to past year for event searches
      body.tbs = 'qdr:y';
    }

    console.log('[firecrawl] Making request with body:', JSON.stringify(body, null, 2));

    const res = await fetch('https://api.firecrawl.dev/v2/search', { 
      method: 'POST', 
      headers: {
        'content-type':'application/json', 
        'Authorization': `Bearer ${apiKey}`
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

    // Map to {items:string[]} - v2 API structure
    const webResults = json?.data?.web || [];
    const items: string[] = Array.isArray(webResults) 
      ? webResults
          .map((x:any) => x?.url || x?.link)
          .filter((u:string) => typeof u === 'string' && u.startsWith('http'))
      : [];

    console.log('[firecrawl] Extracted URLs:', items.length, items.slice(0, 3));

    return { items, debug: { rawCount: items.length, responseKeys: Object.keys(json) } };
  } catch (error) {
    console.error('[firecrawl] Request failed:', error);
    return { items: [], debug: { error: error instanceof Error ? error.message : 'Unknown error', rawCount: 0 } };
  }
}
