/**
 * Gemini Bypass Implementation
 * 
 * Provides fallback prioritization when Gemini AI fails or returns invalid JSON.
 */

import { FLAGS } from '@/config/flags';
import { updatePrioritizationStats, type SearchTrace } from '@/lib/trace';

export interface PrioritizationItem {
  title: string;
  url: string;
  snippet: string;
  tier?: string;
}

export interface PrioritizationResult {
  prioritizedUrls: string[];
  prioritizationStats: {
    total: number;
    prioritized: number;
    reasons: string[];
  };
  bypassed: boolean;
  repairUsed: boolean;
  errors?: string[];
}

/**
 * Heuristic scoring for prioritization bypass
 */
export function calculateHeuristicScore(item: PrioritizationItem): number {
  let score = 0;
  const title = item.title?.toLowerCase() || '';
  const url = item.url?.toLowerCase() || '';
  const snippet = item.snippet?.toLowerCase() || '';
  const content = `${title} ${snippet}`;
  
  // Event keywords (high value)
  const eventKeywords = [
    'veranstaltung', 'konferenz', 'kongress', 'tagung', 'seminar', 
    'workshop', 'forum', 'summit', 'symposium', 'fortbildung',
    'conference', 'event', 'meeting', 'training', 'certification'
  ];
  
  eventKeywords.forEach(keyword => {
    if (content.includes(keyword)) score += 10;
  });
  
  // Legal keywords (high value)
  const legalKeywords = [
    'legal', 'compliance', 'investigation', 'e-discovery', 'ediscovery',
    'legal tech', 'legal technology', 'regulatory', 'governance',
    'risk management', 'audit', 'whistleblowing', 'data protection',
    'gdpr', 'dsgvo', 'privacy', 'cybersecurity', 'regtech', 'esg',
    'recht', 'compliance', 'untersuchung', 'datenschutz', 'dsgvo',
    'rechtsberatung', 'anwaltskanzlei', 'gericht', 'justiz'
  ];
  
  legalKeywords.forEach(keyword => {
    if (content.includes(keyword)) score += 8;
  });
  
  // Domain allowlist bonus
  const trustedDomains = [
    'legaltech.de', 'compliance-magazin.de', 'datenschutz-praxis.de',
    'legal-tribune.de', 'anwalt.de', 'kanzlei.de', 'recht.de',
    'justiz.de', 'bundesanzeiger.de', 'bundesregierung.de',
    'eventbrite.com', 'meetup.com', 'xing.com', 'linkedin.com'
  ];
  
  trustedDomains.forEach(domain => {
    if (url.includes(domain)) score += 15;
  });
  
  // URL path hints
  const urlHints = [
    '/event', '/veranstaltung', '/termine', '/conference', '/seminar',
    '/workshop', '/kongress', '/tagung', '/forum', '/summit'
  ];
  
  urlHints.forEach(hint => {
    if (url.includes(hint)) score += 5;
  });
  
  // Date-like segments in URL
  const datePattern = /\/(20\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
  if (datePattern.test(url)) score += 3;
  
  // German language bonus
  const germanWords = ['deutsch', 'deutschland', 'berlin', 'münchen', 'hamburg'];
  germanWords.forEach(word => {
    if (content.includes(word)) score += 2;
  });
  
  // Penalty for spam indicators
  const spamIndicators = ['free', 'download', 'pdf', 'ebook', 'guide', 'tips'];
  spamIndicators.forEach(indicator => {
    if (content.includes(indicator)) score -= 5;
  });
  
  return Math.max(0, score);
}

/**
 * Bypass Gemini with heuristic prioritization
 */
export function bypassGeminiPrioritization(
  items: PrioritizationItem[],
  trace: SearchTrace
): PrioritizationResult {
  console.warn('Bypassing Gemini prioritization with heuristics');
  
  // Calculate scores for all items
  const scoredItems = items.map(item => ({
    ...item,
    score: calculateHeuristicScore(item)
  }));
  
  // Sort by score (highest first)
  scoredItems.sort((a, b) => b.score - a.score);
  
  // Take top items (limit to reasonable number)
  const maxItems = Math.min(50, items.length);
  const prioritized = scoredItems.slice(0, maxItems);
  
  const reasons = [
    'Heuristic scoring based on event keywords',
    'Legal keyword matching',
    'Trusted domain bonus',
    'URL path analysis',
    'German language content'
  ];
  
  updatePrioritizationStats(
    trace,
    items.length,
    prioritized.length,
    true, // bypassed
    false, // repairUsed
    ['Gemini bypassed - using heuristics']
  );
  
  return {
    prioritizedUrls: prioritized.map(item => item.url),
    prioritizationStats: {
      total: items.length,
      prioritized: prioritized.length,
      reasons
    },
    bypassed: true,
    repairUsed: false,
    errors: ['Gemini bypassed - using heuristics']
  };
}

/**
 * Attempt JSON repair for Gemini responses
 */
export function attemptJsonRepair(jsonString: string): { success: boolean; data?: any; error?: string } {
  try {
    // Basic JSON repair attempts
    let repaired = jsonString.trim();
    
    // Remove trailing commas
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
    
    // Fix unquoted keys
    repaired = repaired.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
    
    // Fix single quotes to double quotes
    repaired = repaired.replace(/'/g, '"');
    
    // Try to parse
    const data = JSON.parse(repaired);
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: `JSON repair failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Process Gemini response with fallbacks
 */
export function processGeminiResponse(
  response: string,
  items: PrioritizationItem[],
  trace: SearchTrace
): PrioritizationResult {
  // Try to parse the response
  try {
    const data = JSON.parse(response);
    
    if (data.prioritizedUrls && Array.isArray(data.prioritizedUrls)) {
      updatePrioritizationStats(trace, items.length, data.prioritizedUrls.length, false, false);
      
      return {
        prioritizedUrls: data.prioritizedUrls,
        prioritizationStats: data.prioritizationStats || {
          total: items.length,
          prioritized: data.prioritizedUrls.length,
          reasons: ['Gemini prioritization successful']
        },
        bypassed: false,
        repairUsed: false
      };
    }
  } catch (error) {
    console.warn('Initial JSON parse failed:', error);
  }
  
  // Try JSON repair
  const repairResult = attemptJsonRepair(response);
  if (repairResult.success) {
    console.warn('JSON repair successful');
    updatePrioritizationStats(trace, items.length, repairResult.data?.prioritizedUrls?.length || 0, false, true);
    
    return {
      prioritizedUrls: repairResult.data.prioritizedUrls || [],
      prioritizationStats: repairResult.data.prioritizationStats || {
        total: items.length,
        prioritized: repairResult.data.prioritizedUrls?.length || 0,
        reasons: ['JSON repair successful']
      },
      bypassed: false,
      repairUsed: true
    };
  }
  
  // Fall back to heuristic prioritization
  console.warn('JSON repair failed, using heuristic prioritization');
  return bypassGeminiPrioritization(items, trace);
}

/**
 * Main prioritization function with bypass support
 */
export async function prioritizeWithBypass(
  items: PrioritizationItem[],
  query: string,
  trace: SearchTrace
): Promise<PrioritizationResult> {
  // If bypass flag is set, skip Gemini entirely
  if (FLAGS.BYPASS_GEMINI_JSON_STRICT) {
    return bypassGeminiPrioritization(items, trace);
  }
  
  try {
    // Attempt Gemini prioritization
    const geminiResponse = await callGeminiPrioritization(items, query);
    return processGeminiResponse(geminiResponse, items, trace);
  } catch (error) {
    console.warn('Gemini prioritization failed:', error);
    return bypassGeminiPrioritization(items, trace);
  }
}

/**
 * Placeholder for actual Gemini API call
 */
async function callGeminiPrioritization(items: PrioritizationItem[], query: string): Promise<string> {
  // This would be replaced with actual Gemini API call
  throw new Error('Gemini API not implemented');
}
