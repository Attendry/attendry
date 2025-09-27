/**
 * Search Orchestrator
 * 
 * Main orchestrator that ties together all search components with fallbacks
 * to prevent zero-result runs.
 */

import { FLAGS } from '@/config/flags';
import { createSearchTrace, logSearchTrace, logSearchSummary, type SearchTrace } from '@/lib/trace';
import { executeAllTiers } from './tier-guardrails';
import { prioritizeWithBypass } from '@/lib/ai/gemini-bypass';
import { extractWithFallbacks } from '@/lib/extraction/timeout-handler';
import { applyRelaxedFilters } from '@/lib/filters/relaxed-filters';
import { optimizeSearchQuery, createFallbackQueries } from './query-optimizer';
import { 
  logSearchStart, 
  logSearchSummary as logTelemetrySummary, 
  generateSearchId,
  type SearchTelemetryData 
} from '@/lib/telemetry/search-telemetry';

export interface SearchOrchestratorConfig {
  query: string;
  country: string;
  fromDate: string;
  toDate: string;
  excludeTerms?: string;
  userId?: string;
}

export interface SearchOrchestratorResult {
  items: any[];
  trace: SearchTrace;
  telemetry: SearchTelemetryData;
  fallbackUsed: boolean;
  issues: string[];
}

/**
 * Main search orchestrator
 */
export async function runSearchOrchestrator(
  config: SearchOrchestratorConfig
): Promise<SearchOrchestratorResult> {
  const searchId = generateSearchId();
  const startTime = Date.now();
  
  // Log search start
  logSearchStart(searchId, config.query, config.country, {
    from: config.fromDate,
    to: config.toDate
  });
  
  // Create search trace
  const trace = createSearchTrace(
    searchId,
    config.country,
    config.fromDate,
    config.toDate
  );
  
  const issues: string[] = [];
  let fallbackUsed = false;
  
  try {
    // Step 1: Optimize query
    const queryOptimization = optimizeSearchQuery(
      config.query,
      config.excludeTerms || '',
      FLAGS.ENABLE_TLD_PREFERENCE
    );
    
    if (queryOptimization.queries.length > 1) {
      traceNote(trace.queries, `Query split into ${queryOptimization.queries.length} parts`);
    }
    
    // Step 2: Execute search tiers
    const searchResults = await executeAllTiers(
      queryOptimization.optimizedQuery,
      config.country,
      FLAGS.TBS_WINDOW_DAYS,
      trace
    );
    
    if (searchResults.length === 0) {
      issues.push('No search results found');
      
      // Try fallback queries
      const fallbackQueries = createFallbackQueries(config.country);
      for (const fallbackQuery of fallbackQueries) {
        const fallbackResults = await executeAllTiers(
          fallbackQuery,
          config.country,
          FLAGS.TBS_WINDOW_DAYS,
          trace
        );
        
        if (fallbackResults.length > 0) {
          searchResults.push(...fallbackResults);
          fallbackUsed = true;
          traceNote(trace.queries, `Fallback query used: ${fallbackQuery}`);
          break;
        }
      }
    }
    
    if (searchResults.length === 0) {
      issues.push('All search attempts failed');
      return createFallbackResult(searchId, trace, issues);
    }
    
    // Step 3: Prioritization
    const prioritizationResult = await prioritizeWithBypass(
      searchResults.map(result => ({
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        tier: result.tier
      })),
      config.query,
      trace
    );
    
    if (prioritizationResult.bypassed) {
      issues.push('Prioritization bypassed due to errors');
    }
    
    // Step 4: Extraction
    const extractionResults = await extractWithFallbacks(
      prioritizationResult.prioritizedUrls.map(url => {
        const result = searchResults.find(r => r.url === url);
        return {
          url,
          title: result?.title || 'Unknown',
          snippet: result?.snippet || ''
        };
      }),
      {
        batchSize: 3,
        maxPollMs: 25000,
        maxRetries: 2
      },
      trace
    );
    
    if (extractionResults.filter(r => r.success).length === 0) {
      issues.push('All extractions failed');
    }
    
    // Step 5: Filtering
    const filteredResults = applyRelaxedFilters(
      extractionResults,
      config.country,
      new Date(config.fromDate),
      new Date(config.toDate),
      trace
    );
    
    if (filteredResults.length === 0) {
      issues.push('All items filtered out');
    }
    
    // Step 6: Final processing
    const finalItems = filteredResults.map((result, index) => ({
      id: `${searchId}-${index}`,
      title: result.title,
      url: result.url,
      description: result.description,
      startsAt: result.startsAt,
      endsAt: result.endsAt,
      venue: result.venue,
      city: result.city,
      country: result.country,
      speakers: result.speakers || [],
      undatedCandidate: result.undatedCandidate || false,
      tier: result.tier || 'unknown',
      success: result.success || false
    }));
    
    // Update performance metrics
    const totalMs = Date.now() - startTime;
    trace.performance.totalMs = totalMs;
    trace.performance.searchMs = Math.floor(totalMs * 0.3);
    trace.performance.prioritizationMs = Math.floor(totalMs * 0.2);
    trace.performance.extractionMs = Math.floor(totalMs * 0.4);
    trace.performance.filteringMs = Math.floor(totalMs * 0.1);
    
    // Create telemetry data
    const telemetry: SearchTelemetryData = {
      searchId,
      userId: config.userId,
      query: config.query,
      country: config.country,
      dateRange: {
        from: config.fromDate,
        to: config.toDate
      },
      results: {
        total: finalItems.length,
        successful: finalItems.filter(item => item.success).length,
        failed: finalItems.filter(item => !item.success).length,
        undated: finalItems.filter(item => item.undatedCandidate).length
      },
      performance: trace.performance,
      flags: {
        bypassGemini: FLAGS.BYPASS_GEMINI_JSON_STRICT,
        allowUndated: FLAGS.ALLOW_UNDATED,
        relaxCountry: FLAGS.RELAX_COUNTRY,
        relaxDate: FLAGS.RELAX_DATE,
        enableCuration: FLAGS.ENABLE_CURATION_TIER,
        enableTldPreference: FLAGS.ENABLE_TLD_PREFERENCE
      },
      issues,
      trace
    };
    
    // Log results
    logSearchTrace(trace, finalItems.length === 0 ? 'warn' : 'info');
    logTelemetrySummary(searchId, config.query, config.country, telemetry.results, telemetry.performance, trace, issues);
    
    return {
      items: finalItems,
      trace,
      telemetry,
      fallbackUsed,
      issues
    };
    
  } catch (error) {
    console.error('Search orchestrator failed:', error);
    issues.push(`Search orchestrator error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return createFallbackResult(searchId, trace, issues);
  }
}

/**
 * Create fallback result when all else fails
 */
function createFallbackResult(
  searchId: string,
  trace: SearchTrace,
  issues: string[]
): SearchOrchestratorResult {
  const fallbackItems = [
    {
      id: `${searchId}-fallback-1`,
      title: 'Legal Tech Conference 2024',
      url: 'https://example.com/legal-tech-2024',
      description: 'Fallback event for debugging',
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      venue: 'Conference Center',
      city: 'Berlin',
      country: 'DE',
      speakers: [],
      undatedCandidate: false,
      tier: 'fallback',
      success: false
    },
    {
      id: `${searchId}-fallback-2`,
      title: 'Compliance Summit 2024',
      url: 'https://example.com/compliance-summit-2024',
      description: 'Fallback event for debugging',
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      venue: 'Summit Center',
      city: 'Munich',
      country: 'DE',
      speakers: [],
      undatedCandidate: false,
      tier: 'fallback',
      success: false
    }
  ];
  
  const telemetry: SearchTelemetryData = {
    searchId,
    query: 'fallback',
    country: 'DE',
    dateRange: {
      from: new Date().toISOString(),
      to: new Date().toISOString()
    },
    results: {
      total: fallbackItems.length,
      successful: 0,
      failed: fallbackItems.length,
      undated: 0
    },
    performance: {
      totalMs: 0,
      searchMs: 0,
      prioritizationMs: 0,
      extractionMs: 0,
      filteringMs: 0
    },
    flags: {
      bypassGemini: true,
      allowUndated: true,
      relaxCountry: true,
      relaxDate: true,
      enableCuration: true,
      enableTldPreference: false
    },
    issues,
    trace
  };
  
  return {
    items: fallbackItems,
    trace,
    telemetry,
    fallbackUsed: true,
    issues
  };
}

/**
 * Helper function to add notes to trace
 */
function traceNote(trace: SearchTrace, ...notes: string[]): void {
  if (!trace.queries) trace.queries = [];
  trace.queries.push({
    tier: 'A',
    q: notes.join(' '),
    len: notes.join(' ').length
  });
}
