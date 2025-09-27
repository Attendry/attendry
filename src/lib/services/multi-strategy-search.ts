/**
 * Multi-Strategy Search Orchestrator
 * 
 * This module orchestrates the multi-tier search strategy for legal events,
 * handling Firecrawl calls, URL filtering, and result aggregation.
 */

import { QueryTier, buildDateFilter } from './enhanced-query-builder';
import { 
  DOMAIN_ALLOWLIST, 
  EXCLUDES, 
  PREFERRED_URL_PATHS, 
  NOISE_URL_PATHS,
  SEARCH_THRESHOLDS,
  COUNTRY_CODE
} from '@/config/search-legal-de';

export interface SearchOptions {
  fromISO: string;
  toISO: string;
  country?: string;
  maxResults?: number;
}

export interface SearchResult {
  url: string;
  title: string;
  snippet?: string;
  tier: string;
}

export interface SearchTrace {
  finalQueries: Array<{ name: string; query: string; length: number }>;
  urls: {
    checked: number;
    kept: number;
    filtered: Array<{ url: string; reason: string }>;
  };
  tiers: {
    [tierName: string]: {
      executed: boolean;
      results: number;
      urls: string[];
    };
  };
  filters: {
    reasons: string[];
  };
}

/**
 * Runs multi-strategy search with tiered fallback
 */
export async function runMultiStrategySearch(
  finalQueries: QueryTier[],
  options: SearchOptions
): Promise<{ results: SearchResult[]; trace: SearchTrace }> {
  const trace: SearchTrace = {
    finalQueries: finalQueries.map(q => ({ name: q.name, query: q.query, length: q.query.length })),
    urls: { checked: 0, kept: 0, filtered: [] },
    tiers: {},
    filters: { reasons: [] }
  };

  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();
  const dateFilter = buildDateFilter(options.fromISO, options.toISO);

  // Execute tiers in order
  for (const queryTier of finalQueries) {
    const tierName = queryTier.name;
    trace.tiers[tierName] = {
      executed: false,
      results: 0,
      urls: []
    };

    try {
      console.log(`Executing ${tierName}: ${queryTier.query}`);
      
      const tierResults = await executeFirecrawlSearch(queryTier, dateFilter, options);
      trace.tiers[tierName].executed = true;
      trace.tiers[tierName].results = tierResults.length;
      trace.tiers[tierName].urls = tierResults.map(r => r.url);

      // Filter and deduplicate results
      const filteredResults = filterAndDeduplicateResults(tierResults, seenUrls, trace);
      allResults.push(...filteredResults);

      // Check if we have enough results
      if (allResults.length >= SEARCH_THRESHOLDS.MIN_RESULTS_TIER_A) {
        console.log(`Sufficient results from ${tierName}, stopping early`);
        break;
      }

    } catch (error) {
      console.error(`Error executing ${tierName}:`, error);
      trace.tiers[tierName].executed = false;
    }
  }

  trace.urls.checked = allResults.length + trace.urls.filtered.length;
  trace.urls.kept = allResults.length;

  console.log('Multi-Strategy Search Complete:', {
    totalResults: allResults.length,
    tiersExecuted: Object.keys(trace.tiers).filter(t => trace.tiers[t].executed).length,
    trace
  });

  return { results: allResults, trace };
}

/**
 * Executes a single Firecrawl search
 */
async function executeFirecrawlSearch(
  queryTier: QueryTier,
  dateFilter: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  // This would integrate with your existing Firecrawl service
  // For now, returning mock structure - you'll need to adapt this to your actual Firecrawl implementation
  
  const searchParams = {
    query: queryTier.query,
    sources: ['web'],
    location: options.country || COUNTRY_CODE,
    tbs: dateFilter,
    scrapeOptions: {
      location: { 
        country: 'DE', 
        languages: ['de', 'en'] 
      },
      ignoreInvalidURLs: true
    },
    maxResults: options.maxResults || 20
  };

  // TODO: Replace with actual Firecrawl API call
  // const response = await firecrawlService.search(searchParams);
  
  // Mock response for now
  return [];
}

/**
 * Filters and deduplicates search results
 */
function filterAndDeduplicateResults(
  results: SearchResult[],
  seenUrls: Set<string>,
  trace: SearchTrace
): SearchResult[] {
  const filtered: SearchResult[] = [];

  for (const result of results) {
    // Skip if already seen
    if (seenUrls.has(result.url)) {
      trace.urls.filtered.push({ url: result.url, reason: 'duplicate' });
      continue;
    }

    // Apply URL filters
    const filterResult = filterUrl(result.url, result.title);
    if (!filterResult.keep) {
      trace.urls.filtered.push({ url: result.url, reason: filterResult.reason });
      continue;
    }

    // Keep the result
    seenUrls.add(result.url);
    filtered.push(result);
  }

  return filtered;
}

/**
 * Filters URLs based on various criteria
 */
function filterUrl(url: string, title: string): { keep: boolean; reason: string } {
  try {
    const urlObj = new URL(url);
    
    // Check TLD - prefer .de unless in allowlist
    if (!urlObj.hostname.endsWith('.de') && !isInAllowlist(urlObj.hostname)) {
      return { keep: false, reason: 'non-German TLD' };
    }

    // Check for noise paths
    for (const noisePath of NOISE_URL_PATHS) {
      if (urlObj.pathname.includes(noisePath)) {
        return { keep: false, reason: `noise path: ${noisePath}` };
      }
    }

    // Check for excluded terms in URL or title
    const urlAndTitle = `${url} ${title}`.toLowerCase();
    for (const exclude of EXCLUDES) {
      if (urlAndTitle.includes(exclude.toLowerCase())) {
        return { keep: false, reason: `excluded term: ${exclude}` };
      }
    }

    // Prefer URLs with event-related paths
    const hasPreferredPath = PREFERRED_URL_PATHS.some(path => 
      urlObj.pathname.includes(path)
    );

    if (hasPreferredPath) {
      return { keep: true, reason: 'preferred event path' };
    }

    // Check content size indicators (if available)
    if (url.includes('index') || url.includes('category') || url.includes('archive')) {
      return { keep: false, reason: 'likely index page' };
    }

    return { keep: true, reason: 'passed filters' };

  } catch (error) {
    return { keep: false, reason: 'invalid URL' };
  }
}

/**
 * Checks if domain is in allowlist
 */
function isInAllowlist(hostname: string): boolean {
  return DOMAIN_ALLOWLIST.some(domain => 
    hostname === domain || hostname.endsWith(`.${domain}`)
  );
}
