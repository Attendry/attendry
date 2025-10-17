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
      // Use web source for better event discovery
      sources: ['web'],
      // Increase timeout for better reliability (docs suggest 60s)
      timeout: 60000
    };

    // Add content scraping if requested - use correct v2 API format
    if (params.scrapeContent) {
      body.scrapeOptions = {
        formats: ['markdown'],
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

          // Don't use time-based search initially - it can be too restrictive
          // Let Firecrawl return all relevant results, then filter if needed
          console.log('[firecrawl] Not using time-based search for broader results');

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
    
    // If no results found, try alternative targeted queries
    if (!json?.data?.web || json.data.web.length === 0) {
      console.log('[firecrawl] No results found with query:', params.q);
      
      // Try alternative targeted queries for legal/compliance events
      const alternatives = [
        `legal conference ${params.country || 'Germany'} 2025`,
        `compliance summit ${params.country || 'Germany'} 2025`,
        `GDPR conference ${params.country || 'Germany'} 2025`,
        `data protection event ${params.country || 'Germany'} 2025`
      ];
      
      for (const altQuery of alternatives) {
        console.log('[firecrawl] Trying alternative query:', altQuery);
        const altBody = { ...body, query: altQuery };
        const altRes = await fetch('https://api.firecrawl.dev/v2/search', { 
          method: 'POST', 
          headers: {
            'content-type':'application/json', 
            'Authorization': `Bearer ${apiKey}`
          }, 
          body: JSON.stringify(altBody) 
        });
        
        if (altRes.ok) {
          const altJson = await altRes.json();
          if (altJson?.data?.web && altJson.data.web.length > 0) {
            console.log('[firecrawl] Alternative query found results:', altJson.data.web.length);
            json = altJson; // Use alternative results
            break;
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
