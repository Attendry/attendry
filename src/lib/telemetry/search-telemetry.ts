/**
 * Search Telemetry System
 * 
 * Provides comprehensive logging and monitoring for search operations.
 */

import { logSearchSummary, type SearchTrace } from '@/lib/trace';
import { FLAGS } from '@/config/flags';

export interface TelemetryEvent {
  timestamp: string;
  eventType: string;
  data: any;
  metadata?: Record<string, any>;
}

export interface SearchTelemetryData {
  searchId: string;
  userId?: string;
  query: string;
  country: string;
  dateRange: {
    from: string;
    to: string;
  };
  results: {
    total: number;
    successful: number;
    failed: number;
    undated: number;
  };
  performance: {
    totalMs: number;
    searchMs: number;
    prioritizationMs: number;
    extractionMs: number;
    filteringMs: number;
  };
  flags: {
    bypassGemini: boolean;
    allowUndated: boolean;
    relaxCountry: boolean;
    relaxDate: boolean;
    enableCuration: boolean;
    enableTldPreference: boolean;
  };
  issues: string[];
  trace: SearchTrace;
}

/**
 * Create telemetry event
 */
export function createTelemetryEvent(
  eventType: string,
  data: any,
  metadata?: Record<string, any>
): TelemetryEvent {
  return {
    timestamp: new Date().toISOString(),
    eventType,
    data,
    metadata
  };
}

/**
 * Log search telemetry
 */
export function logSearchTelemetry(telemetryData: SearchTelemetryData): void {
  const event = createTelemetryEvent('search_completed', telemetryData, {
    version: '1.0',
    environment: process.env.NODE_ENV || 'development'
  });
  
  console.info(JSON.stringify(event, null, 2));
  
  // Also log the search summary
  logSearchSummary(
    Array.from({ length: telemetryData.results.total }, (_, i) => ({ id: i })),
    telemetryData.trace
  );
}

/**
 * Log search error
 */
export function logSearchError(
  searchId: string,
  error: Error,
  context: Record<string, any> = {}
): void {
  const event = createTelemetryEvent('search_error', {
    searchId,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context
  });
  
  console.error(JSON.stringify(event, null, 2));
}

/**
 * Log search performance metrics
 */
export function logSearchPerformance(
  searchId: string,
  performance: SearchTelemetryData['performance'],
  trace: SearchTrace
): void {
  const event = createTelemetryEvent('search_performance', {
    searchId,
    performance,
    trace: {
      marker: trace.marker,
      queries: trace.queries.length,
      urlsSeen: trace.results.urlsSeen,
      urlsKept: trace.results.urlsKept,
      prioritizationBypassed: trace.prioritization.bypassed,
      extractionTimeouts: trace.extract.timedOut,
      fallbacksUsed: trace.fallbacks.used
    }
  });
  
  console.info(JSON.stringify(event, null, 2));
}

/**
 * Log search quality metrics
 */
export function logSearchQuality(
  searchId: string,
  results: SearchTelemetryData['results'],
  issues: string[]
): void {
  const qualityScore = calculateQualityScore(results, issues);
  
  const event = createTelemetryEvent('search_quality', {
    searchId,
    quality: {
      score: qualityScore,
      results: results,
      issues: issues,
      hasIssues: issues.length > 0
    }
  });
  
  console.info(JSON.stringify(event, null, 2));
}

/**
 * Calculate search quality score
 */
function calculateQualityScore(
  results: SearchTelemetryData['results'],
  issues: string[]
): number {
  let score = 100;
  
  // Deduct for issues
  score -= issues.length * 10;
  
  // Deduct for low success rate
  if (results.total > 0) {
    const successRate = results.successful / results.total;
    if (successRate < 0.5) score -= 20;
    else if (successRate < 0.7) score -= 10;
  }
  
  // Deduct for too many undated results
  if (results.total > 0) {
    const undatedRate = results.undated / results.total;
    if (undatedRate > 0.5) score -= 15;
    else if (undatedRate > 0.3) score -= 10;
  }
  
  // Bonus for good results
  if (results.successful >= 10) score += 10;
  if (results.successful >= 20) score += 10;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Log search summary for monitoring
 */
export function logSearchSummary(
  searchId: string,
  query: string,
  country: string,
  results: SearchTelemetryData['results'],
  performance: SearchTelemetryData['performance'],
  trace: SearchTrace,
  issues: string[] = []
): void {
  const summary = {
    at: 'search_summary',
    searchId,
    query: query.substring(0, 100), // Truncate long queries
    country,
    results,
    performance,
    flags: {
      bypassGemini: FLAGS.BYPASS_GEMINI_JSON_STRICT,
      allowUndated: FLAGS.ALLOW_UNDATED,
      relaxCountry: FLAGS.RELAX_COUNTRY,
      relaxDate: FLAGS.RELAX_DATE,
      enableCuration: FLAGS.ENABLE_CURATION_TIER,
      enableTldPreference: FLAGS.ENABLE_TLD_PREFERENCE
    },
    issues,
    trace: {
      marker: trace.marker,
      queries: trace.queries.length,
      urlsSeen: trace.results.urlsSeen,
      urlsKept: trace.results.urlsKept,
      prioritizationBypassed: trace.prioritization.bypassed,
      extractionTimeouts: trace.extract.timedOut,
      fallbacksUsed: trace.fallbacks.used
    }
  };
  
  console.info(JSON.stringify(summary, null, 2));
}

/**
 * Log search start
 */
export function logSearchStart(
  searchId: string,
  query: string,
  country: string,
  dateRange: { from: string; to: string }
): void {
  const event = createTelemetryEvent('search_started', {
    searchId,
    query: query.substring(0, 100),
    country,
    dateRange,
    flags: {
      bypassGemini: FLAGS.BYPASS_GEMINI_JSON_STRICT,
      allowUndated: FLAGS.ALLOW_UNDATED,
      relaxCountry: FLAGS.RELAX_COUNTRY,
      relaxDate: FLAGS.RELAX_DATE,
      enableCuration: FLAGS.ENABLE_CURATION_TIER,
      enableTldPreference: FLAGS.ENABLE_TLD_PREFERENCE
    }
  });
  
  console.info(JSON.stringify(event, null, 2));
}

/**
 * Log search stage completion
 */
export function logSearchStage(
  searchId: string,
  stage: string,
  duration: number,
  results: number,
  errors?: string[]
): void {
  const event = createTelemetryEvent('search_stage', {
    searchId,
    stage,
    duration,
    results,
    errors
  });
  
  console.info(JSON.stringify(event, null, 2));
}

/**
 * Generate search ID
 */
export function generateSearchId(): string {
  return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log search metrics for monitoring
 */
export function logSearchMetrics(
  searchId: string,
  metrics: {
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    totalUrls: number;
    extractedUrls: number;
    filteredUrls: number;
    finalResults: number;
  }
): void {
  const event = createTelemetryEvent('search_metrics', {
    searchId,
    metrics
  });
  
  console.info(JSON.stringify(event, null, 2));
}
