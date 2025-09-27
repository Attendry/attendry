/**
 * Search Tier Guardrails
 * 
 * Implements multi-tier search with fallbacks to prevent zero-result runs.
 */

import { FLAGS } from '@/config/flags';
import { addQueryToTrace, updateResultsStats, type SearchTrace } from '@/lib/trace';

export interface SearchTier {
  tier: 'A' | 'B' | 'C';
  query: string;
  limit: number;
  tbs: string;
  sources: string[];
  scrapeOptions: {
    location: {
      country: string;
      languages: string[];
    };
  };
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  tier: string;
}

/**
 * Generate search tiers with guardrails
 */
export function generateSearchTiers(
  baseQuery: string,
  country: string,
  windowDays: number,
  trace: SearchTrace
): SearchTier[] {
  const tiers: SearchTier[] = [];
  const tbs = `qdr:${windowDays}d`;
  
  // Tier A: Primary search with full query
  tiers.push({
    tier: 'A',
    query: baseQuery,
    limit: FLAGS.FIRECRAWL_LIMIT,
    tbs,
    sources: ['web'],
    scrapeOptions: {
      location: {
        country: country.toUpperCase(),
        languages: country.toLowerCase() === 'de' ? ['de', 'en'] : ['en']
      }
    }
  });
  
  // Tier B: Simplified query if Tier A fails
  if (FLAGS.MAX_QUERY_TIERS >= 2) {
    const simplifiedQuery = baseQuery
      .replace(/\([^)]*\)/g, '') // Remove parentheses
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    tiers.push({
      tier: 'B',
      query: simplifiedQuery,
      limit: FLAGS.FIRECRAWL_LIMIT,
      tbs,
      sources: ['web'],
      scrapeOptions: {
        location: {
          country: country.toUpperCase(),
          languages: country.toLowerCase() === 'de' ? ['de', 'en'] : ['en']
        }
      }
    });
  }
  
  // Tier C: Curation tier with allowlisted sites
  if (FLAGS.MAX_QUERY_TIERS >= 3 && FLAGS.ENABLE_CURATION_TIER) {
    const curationQuery = `site:legaltech.de OR site:compliance-magazin.de OR site:datenschutz-praxis.de OR site:legal-tribune.de OR site:anwalt.de OR site:kanzlei.de OR site:recht.de OR site:justiz.de OR site:bundesanzeiger.de OR site:bundesregierung.de (${baseQuery})`;
    
    tiers.push({
      tier: 'C',
      query: curationQuery,
      limit: FLAGS.FIRECRAWL_LIMIT,
      tbs,
      sources: ['web'],
      scrapeOptions: {
        location: {
          country: country.toUpperCase(),
          languages: ['de', 'en']
        }
      }
    });
  }
  
  return tiers;
}

/**
 * Execute search tier with fallbacks
 */
export async function executeSearchTier(
  tier: SearchTier,
  trace: SearchTrace
): Promise<SearchResult[]> {
  try {
    addQueryToTrace(trace, tier.tier, tier.query);
    
    // Simulate search execution (replace with actual search service call)
    const results = await performSearch(tier);
    
    trace.results.tiersExecuted++;
    return results;
  } catch (error) {
    console.warn(`Tier ${tier.tier} failed:`, error);
    return [];
  }
}

/**
 * Execute all tiers with guardrails
 */
export async function executeAllTiers(
  baseQuery: string,
  country: string,
  windowDays: number,
  trace: SearchTrace
): Promise<SearchResult[]> {
  const tiers = generateSearchTiers(baseQuery, country, windowDays, trace);
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();
  
  for (const tier of tiers) {
    const tierResults = await executeSearchTier(tier, trace);
    
    // Deduplicate within tier
    const newResults = tierResults.filter(result => {
      if (seenUrls.has(result.url)) return false;
      seenUrls.add(result.url);
      return true;
    });
    
    allResults.push(...newResults);
    
    // Check if we have enough results
    if (allResults.length >= FLAGS.MIN_KEEP_AFTER_PRIOR) {
      break;
    }
  }
  
  // If still not enough results, try without TLD preference
  if (allResults.length < FLAGS.MIN_KEEP_AFTER_PRIOR && FLAGS.ENABLE_TLD_PREFERENCE) {
    const fallbackTier: SearchTier = {
      tier: 'C',
      query: baseQuery.replace(/site:[^\s]+/g, ''), // Remove site restrictions
      limit: FLAGS.FIRECRAWL_LIMIT,
      tbs: `qdr:${windowDays}d`,
      sources: ['web'],
      scrapeOptions: {
        location: {
          country: country.toUpperCase(),
          languages: ['de', 'en']
        }
      }
    };
    
    const fallbackResults = await executeSearchTier(fallbackTier, trace);
    const newFallbackResults = fallbackResults.filter(result => {
      if (seenUrls.has(result.url)) return false;
      seenUrls.add(result.url);
      return true;
    });
    
    allResults.push(...newFallbackResults);
    trace.fallbacks.used = true;
    trace.fallbacks.reason = 'TLD preference removed';
    trace.fallbacks.itemsAdded = newFallbackResults.length;
  }
  
  updateResultsStats(trace, allResults.length, allResults.length, 
    allResults.slice(0, 5).map(r => r.url));
  
  return allResults;
}

/**
 * Placeholder for actual search implementation
 */
async function performSearch(tier: SearchTier): Promise<SearchResult[]> {
  // This would be replaced with actual Firecrawl or Google CSE calls
  // Return empty array to avoid stubs in production
  return [];
}
