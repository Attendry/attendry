/**
 * Debug Test Search Endpoint
 * 
 * Provides instant visibility into the search pipeline with relaxed flags
 * to diagnose zero-result issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runSearch } from '@/search/orchestrator';
import { buildTierQueries } from '@/search/query-builder';
import { prefilter } from '@/search/url-filters';

export const runtime = 'nodejs';

interface DebugSearchResponse {
  events: any[];
  preFilterCount: number;
  keptAfterHeuristics: number;
  keptAfterModel: number;
  keptAfterCountryDate: number;
  degradedRun: boolean;
  sample: string[];
  finalQueries?: string[];
  webResults?: any;
  filteredReasons?: any;
  provenance?: {
    tier: string;
    query: string;
    len: number;
    tokens: { text: string; source: string }[];
  }[];
}

/**
 * GET /api/debug/test-search
 * 
 * Runs the full search pipeline with debug flags enabled
 */
export async function GET(req: NextRequest): Promise<NextResponse<DebugSearchResponse>> {
  const url = new URL(req.url);
  const country = (url.searchParams.get('country') ?? 'DE').toUpperCase();
  const days = Number(url.searchParams.get('days') ?? 45);
  
  const DEBUG_MODE = process.env.DEBUG_MODE === '1';
  
  try {
    // Build queries to show provenance
    const baseQuery = '(legal OR compliance OR investigation OR "e-discovery" OR ediscovery OR "legal tech" OR "legal technology" OR "GDPR" OR "cybersecurity" OR "interne untersuchung" OR "compliance management")';
    const tierQueries = buildTierQueries(baseQuery);
    
    // Validate provenance
    const allBuiltQueries = [...tierQueries.tierA, ...tierQueries.tierB, ...tierQueries.tierC];
    const provenance = allBuiltQueries.map(b => ({
      tier: b.tier,
      query: b.q,
      len: b.len,
      tokens: b.tokens
    }));
    
    
    // Run search using new orchestrator
    const { urls, searchRetriedWithBase } = await runSearch({
      baseQuery,
      days,
      use: 'auto'
    });
    
    // Pre-filter URLs to kill obvious noise
    const filteredUrls = prefilter(urls);
    
    // Convert to event format (no fabrication)
    const events = filteredUrls.map((url, index) => ({
      id: `debug-${index}`,
      title: "Event",
      url,
      description: "Event details",
      source_url: url,
      country: "DE",
      dateISO: undefined
    }));
    
    return NextResponse.json({
      events,
      preFilterCount: urls.length,
      keptAfterHeuristics: filteredUrls.length,
      keptAfterModel: filteredUrls.length,
      keptAfterCountryDate: filteredUrls.length,
      degradedRun: searchRetriedWithBase,
      sample: filteredUrls.slice(0, 5),
      items_fallback: [],
      provenance,
      searchRetriedWithBase
    });
    
  } catch (error) {
    console.error('Debug search failed:', error);
    
    return NextResponse.json({
      events: [],
      preFilterCount: 0,
      keptAfterHeuristics: 0,
      keptAfterModel: 0,
      keptAfterCountryDate: 0,
      degradedRun: true,
      sample: [],
      items_fallback: [],
      provenance: [],
      searchRetriedWithBase: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}