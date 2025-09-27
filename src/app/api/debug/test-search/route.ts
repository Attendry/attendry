/**
 * Debug Test Search Endpoint
 * 
 * Provides instant visibility into the search pipeline with relaxed flags
 * to diagnose zero-result issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SearchService } from '@/lib/services/search-service';
import { buildTierQueries } from '@/search/query-builder';
import { validateQueryProvenance } from '@/search/provenance-guard';

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
    
    // Check for blocked augmentation
    const allTokens = allBuiltQueries.flatMap(b => b.tokens);
    const validation = validateQueryProvenance(allTokens);
    
    if (!validation.isValid) {
      return NextResponse.json({
        events: [],
        preFilterCount: 0,
        keptAfterHeuristics: 0,
        keptAfterModel: 0,
        keptAfterCountryDate: 0,
        degradedRun: false,
        sample: [],
        items_fallback: [],
        provenance,
        error: 'Query validation failed',
        errors: validation.errors
      }, { status: 400 });
    }
    
    // Run search with relaxed parameters
    const result = await SearchService.executeSearch({
      q: 'legal compliance conference',
      country,
      from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
      num: 20
    });
    
    // Convert SearchItem[] to events format with proper metadata
    const events = result.items.map((item, index) => ({
      id: `debug-${index}`,
      title: item.title,
      url: item.link,
      description: item.snippet,
      source_url: item.link,
      // Add inferred metadata
      country: 'DE', // Will be properly inferred in the search service
      dateISO: new Date().toISOString().split('T')[0] // Placeholder, will be properly inferred
    }));
    
    // Only return fallback items if DEBUG_MODE is enabled
    let items_fallback: any[] = [];
    if (DEBUG_MODE) {
      items_fallback = [
        {
          id: 'fallback-1',
          title: 'Legal Tech Conference 2024 - Berlin',
          url: 'https://example.com/legal-tech-2024',
          description: 'Fallback event for debugging',
          source_url: 'https://example.com/legal-tech-2024',
          country: 'DE',
          dateISO: '2024-01-15'
        }
      ];
    }
    
    // If we have real results, return them
    if (events.length > 0) {
      return NextResponse.json({
        events,
        preFilterCount: result.items.length,
        keptAfterHeuristics: result.items.length,
        keptAfterModel: result.items.length,
        keptAfterCountryDate: result.items.length,
        degradedRun: false,
        sample: events.slice(0, 5).map(x => x.url),
        items_fallback,
        provenance
      });
    }
    
    // If no real results and DEBUG_MODE is enabled, return fallback
    if (DEBUG_MODE && items_fallback.length > 0) {
      return NextResponse.json({
        events: items_fallback,
        preFilterCount: 0,
        keptAfterHeuristics: 0,
        keptAfterModel: 0,
        keptAfterCountryDate: 0,
        degradedRun: true,
        sample: items_fallback.slice(0, 5).map(x => x.url),
        items_fallback
      });
    }
    
    // Return empty results if no real results and not in debug mode
    return NextResponse.json({
      events: [],
      preFilterCount: 0,
      keptAfterHeuristics: 0,
      keptAfterModel: 0,
      keptAfterCountryDate: 0,
      degradedRun: false,
      sample: [],
      items_fallback: []
    });
    
  } catch (error) {
    console.error('Debug search failed:', error);
    
    // Only return error fallback if DEBUG_MODE is enabled
    let items_fallback: any[] = [];
    if (DEBUG_MODE) {
      items_fallback = [
        {
          id: 'error-fallback-1',
          title: 'Error Fallback Event',
          url: 'https://example.com/error-fallback',
          description: 'Fallback event due to error',
          source_url: 'https://example.com/error-fallback',
          country: 'DE',
          dateISO: '2024-01-15'
        }
      ];
    }
    
    return NextResponse.json({
      events: items_fallback,
      preFilterCount: 0,
      keptAfterHeuristics: 0,
      keptAfterModel: 0,
      keptAfterCountryDate: 0,
      degradedRun: true,
      sample: items_fallback.map(x => x.url),
      items_fallback
    });
  }
}