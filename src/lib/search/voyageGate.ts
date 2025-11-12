/**
 * Voyage Rerank Gate
 */

import { SearchCfg } from '@/config/search';
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

export async function applyVoyageGate(
  urls: string[],
  params: VoyageGateParams,
  voyageApiKey?: string
): Promise<VoyageGateResult> {
  console.log('[voyage-gate] Starting with', urls.length, 'URLs');
  
  // Pre-filter aggregators
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
  
  if (nonAggregators.length < SearchCfg.minNonAggregatorUrls && aggregators.length > 0) {
    const backstop = aggregators.slice(0, SearchCfg.maxBackstopAggregators);
    filteredUrls = [...nonAggregators, ...backstop];
    backstopKept = backstop.length;
  }
  
  console.log(`[voyage-gate] Pre-filter: ${urls.length} → ${filteredUrls.length} (dropped ${aggregators.length - backstopKept} aggregators)`);
  
  if (filteredUrls.length === 0) {
    return {
      urls: [],
      metrics: createRerankMetrics(false, urls.length, 0, undefined, 0, aggregators.length, 0)
    };
  }
  
  const docsForRerank = filteredUrls.slice(0, SearchCfg.maxVoyageDocs);
  
  if (!voyageApiKey || !RERANK_CONFIG.enabled) {
    return applyMicroBias(docsForRerank, urls.length, aggregators.length - backstopKept, backstopKept);
  }
  
  try {
    const instruction = buildRerankInstruction({
      country: params.country,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      industry: params.industry
    });
    
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
      console.warn('[voyage-gate] Voyage API failed, using micro-bias');
      return applyMicroBias(docsForRerank, urls.length, aggregators.length - backstopKept, backstopKept);
    }
    
    const data = await response.json();
    
    const scoredResults = data.results.map((r: any) => {
      const url = docsForRerank[r.index];
      const bonus = calculateUrlBonus(url);
      
      return {
        url,
        score: r.relevance_score + bonus,
        hadBonus: bonus > 0
      };
    });
    
    scoredResults.sort((a, b) => b.score - a.score);
    
    const rerankedUrls = scoredResults.map(r => r.url);
    const deBiasHits = scoredResults.filter(r => r.hadBonus).length;
    
    const metrics = createRerankMetrics(
      true,
      urls.length,
      rerankedUrls.length,
      scoredResults.map(r => r.score),
      deBiasHits,
      aggregators.length - backstopKept,
      backstopKept
    );
    
    console.log('[voyage-gate] Complete:', JSON.stringify(metrics));
    
    return { urls: rerankedUrls, metrics };
    
  } catch (error) {
    console.error('[voyage-gate] Failed:', error);
    return applyMicroBias(docsForRerank, urls.length, aggregators.length - backstopKept, backstopKept);
  }
}

function applyMicroBias(
  urls: string[],
  originalCount: number,
  aggregatorDropped: number,
  backstopKept: number
): VoyageGateResult {
  const scored = urls.map(url => ({
    url,
    score: calculateUrlBonus(url),
    hadBonus: calculateUrlBonus(url) > 0
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
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
  
  return { urls: topUrls.map(r => r.url), metrics };
}
