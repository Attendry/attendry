import type { SearchParams } from './types';

export async function search(params: { 
  q: string; 
  dateFrom?: string; 
  dateTo?: string;
  country?: string;
  limit?: number;
  scrapeContent?: boolean;
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
      timeout: 10000
    };

    // Add content scraping if requested
    if (params.scrapeContent) {
      body.scrapeOptions = {
        formats: ['markdown', 'links'],
        onlyMainContent: true
      };
    }

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
          
          // Try without time restriction if no results
          if (params.dateFrom && params.dateTo) {
            // For specific date ranges, also try without time restriction
            console.log('[firecrawl] Will try without time restriction if no results');
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
    
    // Log response structure for debugging
    if (json?.data?.web) {
      console.log('[firecrawl] Web results found:', json.data.web.length);
      if (json.data.web.length > 0) {
        console.log('[firecrawl] First result:', JSON.stringify(json.data.web[0], null, 2));
      }
    } else {
      console.log('[firecrawl] No web results in response');
    }
    
    // If no results and we have a complex query, try a simpler fallback
    if ((!json?.data?.web || json.data.web.length === 0) && params.q.includes(' ')) {
      console.log('[firecrawl] No results with complex query, trying simpler fallback');
      const simpleQuery = params.q.split(' ').slice(0, 2).join(' '); // Take first 2 words
      if (simpleQuery !== params.q) {
        console.log('[firecrawl] Trying fallback query:', simpleQuery);
        const fallbackBody = { ...body, query: simpleQuery };
        const fallbackRes = await fetch('https://api.firecrawl.dev/v2/search', { 
          method: 'POST', 
          headers: {
            'content-type':'application/json', 
            'Authorization': `Bearer ${apiKey}`
          }, 
          body: JSON.stringify(fallbackBody) 
        });
        
        if (fallbackRes.ok) {
          const fallbackJson = await fallbackRes.json();
          console.log('[firecrawl] Fallback response:', JSON.stringify(fallbackJson, null, 2));
          if (fallbackJson?.data?.web && fallbackJson.data.web.length > 0) {
            console.log('[firecrawl] Fallback found results:', fallbackJson.data.web.length);
            json = fallbackJson; // Use fallback results
          }
        }
      }
    }

    // Map to {items: string[]} or {items: Array<{url, content}>} based on scrapeContent
    const webResults = json?.data?.web || [];
    
    if (params.scrapeContent) {
      // Return items with content for content-based prioritization
      const itemsWithContent = Array.isArray(webResults) 
        ? webResults
            .map((x: any) => ({
              url: x?.url || x?.link,
              title: x?.title,
              description: x?.description,
              content: x?.markdown || x?.content,
              links: x?.links || []
            }))
            .filter((item: any) => typeof item.url === 'string' && item.url.startsWith('http'))
        : [];

      console.log('[firecrawl] Extracted items with content:', itemsWithContent.length);
      return { items: itemsWithContent, debug: { rawCount: itemsWithContent.length, responseKeys: Object.keys(json) } };
    } else {
      // Return URLs only for URL-based prioritization
      const items: string[] = Array.isArray(webResults) 
        ? webResults
            .map((x:any) => x?.url || x?.link)
            .filter((u:string) => typeof u === 'string' && u.startsWith('http'))
        : [];

      console.log('[firecrawl] Extracted URLs:', items.length, items.slice(0, 3));
      return { items, debug: { rawCount: items.length, responseKeys: Object.keys(json) } };
    }
  } catch (error) {
    console.error('[firecrawl] Request failed:', error);
    return { items: [], debug: { error: error instanceof Error ? error.message : 'Unknown error', rawCount: 0 } };
  }
}
