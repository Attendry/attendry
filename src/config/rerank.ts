/**
 * Rerank configuration for event discovery pipeline
 * Controls aggregator filtering, domain bonuses, and Voyage rerank behavior
 */

/**
 * Aggregator domains to filter out before LLM processing
 * These sites list many events but are not primary sources
 */
export const AGGREGATOR_DOMAINS = [
  'vendelux.com',
  'linkedin.com',
  'internationalconferencealerts.com',
  '10times.com',
  'allevents.in',
  'eventbrite.com',
  'meetup.com',
  'conference-service.com',
  'conference2go.com',
  'eventora.com',
  'eventsworld.com',
  'globalriskcommunity.com',
  'cvent.com',
  'conferencealert.com',
  'conferenceseries.com',
  'waset.org',
  // Vendor product/resource pages (not actual events)
  'learn.microsoft.com',  // Always documentation
  'consumerfinancialserviceslawmonitor.com',  // Legal news blog
  'opentext.com',  // Vendor (only product pages, not their actual events if any)
  'casepoint.com',  // Vendor (only product pages, not their actual events if any)
  'relativity.com'  // Vendor (only product pages, not their actual events if any)
] as const;

/**
 * Bonus score for .de TLD (German events)
 * Applied as additive boost to relevance score
 */
export const DE_TLD_BONUS = 0.08;

/**
 * Bonus score for conference-related paths
 * Applied when URL path contains programm, agenda, speakers, etc.
 */
export const CONFERENCE_PATH_BONUS = 0.05;

/**
 * Conference keywords for path detection
 * Case-insensitive match in URL path
 */
export const CONFERENCE_PATH_KEYWORDS = [
  'programm',
  'programme',
  'program',
  'agenda',
  'schedule',
  'zeitplan',
  'referenten',
  'speakers',
  'sprecher',
  'faculty',
  'presenters',
  'keynote',
  'sessions',
  'workshops'
] as const;

/**
 * Rerank configuration
 */
export const RERANK_CONFIG = {
  /** Maximum documents to send to Voyage for reranking */
  maxInputDocs: 40,
  
  /** Number of top results to return from reranking */
  topK: 12,
  
  /** Minimum number of non-aggregator URLs before allowing aggregators */
  minNonAggregatorUrls: 6,
  
  /** Maximum aggregators to keep as backstop (when < minNonAggregatorUrls) */
  maxBackstopAggregators: 1,
  
  /** Enable Voyage reranking (set false to skip) */
  enabled: true,
  
  /** Voyage model to use */
  model: 'rerank-2' as const,
  
  /** Return documents in reranked response */
  returnDocuments: false
} as const;

/**
 * Check if a URL is from an aggregator domain
 * 
 * @param url - URL to check
 * @returns True if URL is from aggregator
 */
export function isAggregatorUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    
    // Remove 'www.' prefix for comparison
    const cleanHostname = hostname.replace(/^www\./, '');
    
    return AGGREGATOR_DOMAINS.some(domain => 
      cleanHostname === domain || cleanHostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * Check if URL has German TLD
 * 
 * @param url - URL to check
 * @returns True if .de domain
 */
export function hasGermanTld(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.endsWith('.de');
  } catch {
    return false;
  }
}

/**
 * Check if URL path contains conference keywords
 * 
 * @param url - URL to check
 * @returns True if path matches conference patterns
 */
export function hasConferencePath(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return CONFERENCE_PATH_KEYWORDS.some(keyword => 
      pathname.includes(keyword)
    );
  } catch {
    return false;
  }
}

/**
 * Calculate tie-break bonus for a URL
 * Combines German TLD bonus and conference path bonus
 * 
 * @param url - URL to score
 * @returns Total bonus score
 */
export function calculateUrlBonus(url: string): number {
  let bonus = 0;
  
  if (hasGermanTld(url)) {
    bonus += DE_TLD_BONUS;
  }
  
  if (hasConferencePath(url)) {
    bonus += CONFERENCE_PATH_BONUS;
  }
  
  return bonus;
}

/**
 * Build rerank instruction with hard excludes and preferences
 * 
 * @param params - Search parameters
 * @returns Instruction string for reranking model
 */
export function buildRerankInstruction(params: {
  country?: string;
  dateFrom?: string;
  dateTo?: string;
  industry?: string;
}): string {
  const parts: string[] = [];
  
  // HARD RULES
  parts.push('**Hard rules:**');
  
  // Country/date filtering
  if (params.dateFrom && params.dateTo) {
    if (params.country === 'DE' || params.country === 'Germany') {
      parts.push(`- Only include events in Germany within ${params.dateFrom}..${params.dateTo} (ISO dates). Strongly deprioritize others.`);
    } else {
      parts.push(`- Event window: ${params.dateFrom} to ${params.dateTo} (ISO format).`);
    }
  }
  
  // Aggregator exclusion
  parts.push('- Prefer official organizer/conference websites; avoid aggregators (Vendelux, 10times, Allevents, InternationalConferenceAlerts, Eventbrite, Meetup, LinkedIn).');
  
  // Content quality
  parts.push('- Prefer pages with clear "program/agenda/programm" or "speakers/referenten/faculty" sections.');
  parts.push('- Exclude blog posts, news recaps, generic index pages, and 404/"page not found".');
  
  // SOFT BOOSTS
  parts.push('**Soft boosts:**');
  parts.push('- Boost .de domains and URLs containing /programm|program|agenda|schedule|referenten|speakers/.');
  parts.push('- Prefer on-site events with venue/city present over webinars when ambiguous.');
  
  // Industry focus
  if (params.industry) {
    parts.push(`- Industry focus: ${params.industry}.`);
  }
  
  return parts.join(' ');
}

/**
 * Rerank metrics for logging
 */
export interface RerankMetrics {
  stage: 'rerank';
  used: boolean;
  items_in: number;
  items_out: number;
  avgScore?: number;
  deBiasHits?: number;
  aggregatorDropped?: number;
  backstopKept?: number;
}

/**
 * Create rerank metrics object
 * 
 * @param used - Whether rerank was actually used
 * @param itemsIn - Number of input URLs
 * @param itemsOut - Number of output URLs
 * @param scores - Relevance scores (if available)
 * @param deBiasHits - Number of .de/conference URLs boosted
 * @param aggregatorDropped - Number of aggregators filtered
 * @param backstopKept - Number of aggregators kept as backstop
 * @returns Metrics object for logging
 */
export function createRerankMetrics(
  used: boolean,
  itemsIn: number,
  itemsOut: number,
  scores?: number[],
  deBiasHits?: number,
  aggregatorDropped?: number,
  backstopKept?: number
): RerankMetrics {
  const metrics: RerankMetrics = {
    stage: 'rerank',
    used,
    items_in: itemsIn,
    items_out: itemsOut
  };
  
  if (scores && scores.length > 0) {
    metrics.avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  }
  
  if (deBiasHits !== undefined) {
    metrics.deBiasHits = deBiasHits;
  }
  
  if (aggregatorDropped !== undefined) {
    metrics.aggregatorDropped = aggregatorDropped;
  }
  
  if (backstopKept !== undefined) {
    metrics.backstopKept = backstopKept;
  }
  
  return metrics;
}

