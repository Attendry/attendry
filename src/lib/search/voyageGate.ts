/**
 * Voyage Rerank Gate
 * Filters and reranks URLs before LLM extraction
 */

import { SearchCfg, SPEAKER_PATH_PATTERNS } from '@/config/search';
import {
  RERANK_CONFIG,
  buildRerankInstruction,
  calculateUrlBonus,
  isAggregatorUrl,
  createRerankMetrics,
  type RerankMetrics
} from '@/config/rerank';

export interface VoyageGateParams {
  country?: string;
  dateFrom: string;
  dateTo: string;
  industry?: string;
}

export interface VoyageGateResult {
  urls: string[];
  metrics: RerankMetrics;
}

/**
 * Apply Voyage rerank gate with aggregator pre-filtering and DE bias
 * This runs BEFORE any LLM/Gemini calls
 * 
 * @param urls - Raw URLs from discovery
 * @param params - Search parameters
 * @param voyageApiKey - Voyage API key
 * @returns Reranked and filtered URLs with metrics
 */
export async function applyVoyageGate(
  urls: string[],
  params: VoyageGateParams,
  voyageApiKey?: string
): Promise<VoyageGateResult> {
  console.log('[voyage-gate] Starting rerank with', urls.length, 'URLs');
  
  // Step 1: Pre-filter aggregators BEFORE reranking
  const { nonAggregators, aggregators } = urls.reduce(
    (acc, url) => {
      if (isAggregatorUrl(url)) {
        acc.aggregators.push(url);
      } else {
        acc.nonAggregators.push(url);
      }
      return acc;
    },
    { nonAggregators: [] as string[], aggregators: [] as string[] }
  );
  
  let filteredUrls = nonAggregators;
  let backstopKept = 0;
  
  // Keep backstop aggregators only if we have too few URLs
  if (nonAggregators.length < SearchCfg.minNonAggregatorUrls && aggregators.length > 0) {
    const backstop = aggregators.slice(0, SearchCfg.maxBackstopAggregators);
    filteredUrls = [...nonAggregators, ...backstop];
    backstopKept = backstop.length;
    console.log(`[voyage-gate] Added ${backstop.length} aggregator backstop URLs`);
  }
  
  console.log(`[voyage-gate] Pre-filter: ${urls.length} → ${filteredUrls.length} URLs (dropped ${aggregators.length - backstopKept} aggregators, kept ${backstopKept} backstop)`);
  
  // If no URLs remain, return empty
  if (filteredUrls.length === 0) {
    return {
      urls: [],
      metrics: createRerankMetrics(
        false,
        urls.length,
        0,
        undefined,
        0,
        aggregators.length,
        0
      )
    };
  }
  
  // Step 2: Truncate to max input docs for Voyage
  const docsForRerank = filteredUrls.slice(0, SearchCfg.maxVoyageDocs);
  
  // Step 3: Call Voyage rerank if API key available
  if (!voyageApiKey || !RERANK_CONFIG.enabled) {
    console.log('[voyage-gate] Voyage disabled or no API key, applying micro-bias only');
    return applyMicroBias(docsForRerank, urls.length, aggregators.length - backstopKept, backstopKept);
  }
  
  try {
    const instruction = buildRerankInstruction({
      country: params.country,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      industry: params.industry
    });
    
    console.log('[voyage-gate] Calling Voyage rerank with instruction:', instruction.substring(0, 150) + '...');
    
    const response = await fetch('https://api.voyageai.com/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${voyageApiKey}`
      },
      body: JSON.stringify({
        query: instruction,
        documents: docsForRerank,
        model: RERANK_CONFIG.model,
        top_k: SearchCfg.voyageTopK,
        return_documents: RERANK_CONFIG.returnDocuments
      }),
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      console.warn('[voyage-gate] Voyage API failed, falling back to micro-bias');
      return applyMicroBias(docsForRerank, urls.length, aggregators.length - backstopKept, backstopKept);
    }
    
    const data = await response.json();
    
    // Step 4: Apply micro-bias (.de TLD, speaker paths)
    const scoredResults = data.results.map((r: any) => {
      const url = docsForRerank[r.index];
      const bonus = calculateUrlBonus(url);
      
      return {
        url,
        originalScore: r.relevance_score,
        score: r.relevance_score + bonus,
        hadBonus: bonus > 0
      };
    });
    
    // Re-sort by adjusted score
    scoredResults.sort((a, b) => b.score - a.score);
    
    // Extract top URLs
    const rerankedUrls = scoredResults.map(r => r.url);
    
    // Calculate metrics
    const deBiasHits = scoredResults.filter(r => r.hadBonus).length;
    const avgScore = scoredResults.reduce((sum, r) => sum + r.score, 0) / scoredResults.length;
    
    const metrics = createRerankMetrics(
      true,
      urls.length,
      rerankedUrls.length,
      scoredResults.map(r => r.score),
      deBiasHits,
      aggregators.length - backstopKept,
      backstopKept
    );
    
    console.log('[voyage-gate] Rerank complete:', JSON.stringify(metrics));
    
    return {
      urls: rerankedUrls,
      metrics
    };
    
  } catch (error) {
    console.error('[voyage-gate] Rerank failed:', error);
    return applyMicroBias(docsForRerank, urls.length, aggregators.length - backstopKept, backstopKept);
  }
}

/**
 * Apply micro-bias without calling Voyage API
 * Fallback when Voyage is disabled or fails
 */
function applyMicroBias(
  urls: string[],
  originalCount: number,
  aggregatorDropped: number,
  backstopKept: number
): VoyageGateResult {
  console.log('[voyage-gate] Applying micro-bias without Voyage rerank');
  
  // Score each URL based on bonuses
  const scored = urls.map(url => ({
    url,
    score: calculateUrlBonus(url),
    hadBonus: calculateUrlBonus(url) > 0
  }));
  
  // Sort by score (higher = better)
  scored.sort((a, b) => b.score - a.score);
  
  // Take top K
  const topUrls = scored.slice(0, SearchCfg.voyageTopK);
  
  const deBiasHits = topUrls.filter(r => r.hadBonus).length;
  
  const metrics = createRerankMetrics(
    false,
    originalCount,
    topUrls.length,
    topUrls.map(r => r.score),
    deBiasHits,
    aggregatorDropped,
    backstopKept
  );
  
  console.log('[voyage-gate] Micro-bias complete:', JSON.stringify(metrics));
  
  return {
    urls: topUrls.map(r => r.url),
    metrics
  };
}

/**
 * Check if URL has speaker/program path (for early detection)
 */
export function hasSpeakerPath(url: string): boolean {
  const lower = url.toLowerCase();
  return SPEAKER_PATH_PATTERNS.some(pattern => pattern.test(lower));
}

