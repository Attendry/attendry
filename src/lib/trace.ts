/**
 * Search Trace Instrumentation
 * 
 * Provides comprehensive tracing for search pipeline to identify where results are lost.
 */

export type StageStat = { 
  in: number; 
  out: number; 
  notes?: string[] 
};

export type SearchTrace = {
  marker: string;
  timestamp: string;
  dateRange: { 
    fromISO: string; 
    toISO: string; 
    tbs: string 
  };
  userCountry: string;
  queries: { 
    tier: 'A'|'B'|'C'; 
    q: string; 
    len: number;
    results?: number;
  }[];
  results: { 
    urlsSeen: number; 
    urlsKept: number; 
    sample: string[];
    tiersExecuted: number;
  };
  prioritization: { 
    model: string; 
    itemsIn: number; 
    itemsOut: number; 
    repairUsed: boolean; 
    bypassed: boolean; 
    errors?: string[];
    heuristicScore?: number;
  };
  filters: {
    country: StageStat;
    date: StageStat;
    legalHeuristics: StageStat;
    dedupe: StageStat;
  };
  extract: { 
    attempted: number; 
    timedOut: number; 
    speakersFound: number;
    successful: number;
    failed: number;
  };
  fallbacks: {
    used: boolean;
    reason?: string;
    itemsAdded: number;
  };
  performance: {
    totalMs: number;
    searchMs: number;
    prioritizationMs: number;
    extractionMs: number;
    filteringMs: number;
  };
};

/**
 * Create a new search trace
 */
export function createSearchTrace(marker: string, userCountry: string, fromISO: string, toISO: string): SearchTrace {
  const now = new Date().toISOString();
  const tbs = `qdr:${Math.ceil((Date.now() - new Date(fromISO).getTime()) / (1000 * 60 * 60 * 24))}d`;
  
  return {
    marker,
    timestamp: now,
    dateRange: { fromISO, toISO, tbs },
    userCountry,
    queries: [],
    results: { urlsSeen: 0, urlsKept: 0, sample: [], tiersExecuted: 0 },
    prioritization: { 
      model: 'gemini', 
      itemsIn: 0, 
      itemsOut: 0, 
      repairUsed: false, 
      bypassed: false 
    },
    filters: {
      country: { in: 0, out: 0 },
      date: { in: 0, out: 0 },
      legalHeuristics: { in: 0, out: 0 },
      dedupe: { in: 0, out: 0 }
    },
    extract: { 
      attempted: 0, 
      timedOut: 0, 
      speakersFound: 0,
      successful: 0,
      failed: 0
    },
    fallbacks: { used: false, itemsAdded: 0 },
    performance: {
      totalMs: 0,
      searchMs: 0,
      prioritizationMs: 0,
      extractionMs: 0,
      filteringMs: 0
    }
  };
}

/**
 * Add notes to a string array, creating it if it doesn't exist
 */
export function traceNote(arr: string[] | undefined, ...notes: string[]): string[] {
  if (!notes.length) return arr || [];
  if (!arr) return [...notes];
  arr.push(...notes);
  return arr;
}

/**
 * Update stage statistics
 */
export function updateStageStat(stat: StageStat, inCount: number, outCount: number, ...notes: string[]): void {
  stat.in = inCount;
  stat.out = outCount;
  if (notes.length > 0) {
    stat.notes = traceNote(stat.notes, ...notes);
  }
}

/**
 * Add query to trace
 */
export function addQueryToTrace(trace: SearchTrace, tier: 'A'|'B'|'C', query: string, results?: number): void {
  trace.queries.push({
    tier,
    q: query,
    len: query.length,
    results
  });
}

/**
 * Update results statistics
 */
export function updateResultsStats(trace: SearchTrace, urlsSeen: number, urlsKept: number, sample: string[]): void {
  trace.results.urlsSeen = urlsSeen;
  trace.results.urlsKept = urlsKept;
  trace.results.sample = sample.slice(0, 5); // Keep top 5 samples
}

/**
 * Update prioritization statistics
 */
export function updatePrioritizationStats(
  trace: SearchTrace, 
  itemsIn: number, 
  itemsOut: number, 
  bypassed: boolean = false,
  repairUsed: boolean = false,
  errors?: string[]
): void {
  trace.prioritization.itemsIn = itemsIn;
  trace.prioritization.itemsOut = itemsOut;
  trace.prioritization.bypassed = bypassed;
  trace.prioritization.repairUsed = repairUsed;
  if (errors && errors.length > 0) {
    trace.prioritization.errors = traceNote(trace.prioritization.errors, ...errors);
  }
}

/**
 * Update extraction statistics
 */
export function updateExtractionStats(
  trace: SearchTrace,
  attempted: number,
  successful: number,
  failed: number,
  timedOut: number = 0,
  speakersFound: number = 0
): void {
  trace.extract.attempted = attempted;
  trace.extract.successful = successful;
  trace.extract.failed = failed;
  trace.extract.timedOut = timedOut;
  trace.extract.speakersFound = speakersFound;
}

/**
 * Log search trace to console
 */
export function logSearchTrace(trace: SearchTrace, level: 'info' | 'warn' | 'error' = 'info'): void {
  const logData = {
    at: 'search_trace',
    marker: trace.marker,
    timestamp: trace.timestamp,
    summary: {
      queries: trace.queries.length,
      urlsSeen: trace.results.urlsSeen,
      urlsKept: trace.results.urlsKept,
      finalItems: trace.filters.dedupe.out,
      prioritizationBypassed: trace.prioritization.bypassed,
      extractionTimeouts: trace.extract.timedOut,
      fallbacksUsed: trace.fallbacks.used
    },
    trace
  };

  switch (level) {
    case 'warn':
      console.warn(JSON.stringify(logData, null, 2));
      break;
    case 'error':
      console.error(JSON.stringify(logData, null, 2));
      break;
    default:
      console.info(JSON.stringify(logData, null, 2));
  }
}

/**
 * Log search summary for telemetry
 */
export function logSearchSummary(items: any[], trace: SearchTrace): void {
  const summary = {
    at: 'search_summary',
    kept: items.length,
    undated: items.filter(x => x.undatedCandidate).length,
    trace: {
      marker: trace.marker,
      queries: trace.queries.length,
      urlsSeen: trace.results.urlsSeen,
      urlsKept: trace.results.urlsKept,
      prioritizationBypassed: trace.prioritization.bypassed,
      extractionTimeouts: trace.extract.timedOut,
      fallbacksUsed: trace.fallbacks.used,
      performance: trace.performance
    }
  };

  console.info(JSON.stringify(summary, null, 2));
}

/**
 * Check if trace indicates potential issues
 */
export function hasTraceIssues(trace: SearchTrace): string[] {
  const issues: string[] = [];
  
  if (trace.results.urlsSeen === 0) {
    issues.push('No URLs found in search');
  }
  
  if (trace.results.urlsKept === 0) {
    issues.push('All URLs filtered out');
  }
  
  if (trace.prioritization.bypassed) {
    issues.push('Prioritization bypassed due to errors');
  }
  
  if (trace.extract.timedOut > 0) {
    issues.push(`${trace.extract.timedOut} extraction timeouts`);
  }
  
  if (trace.filters.dedupe.out === 0) {
    issues.push('All items removed during deduplication');
  }
  
  return issues;
}
