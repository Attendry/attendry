/**
 * Integrated Event Discovery Pipeline
 * Demonstrates Phases 1-4 integration:
 * - Phase 1: JSON safety with parseWithRepair
 * - Phase 2: Speaker filtering with filterSpeakers
 * - Phase 3: Aggregator pre-filtering
 * - Phase 4: Rerank with domain bonuses
 */

import { parseWithRepair, repromptForValidJson, type EventDTO } from '../llm/json';
import { filterSpeakers, isSpeakerSection, type RawSpeaker } from '../extract/speakers';
import {
  isAggregatorUrl,
  calculateUrlBonus,
  buildRerankInstruction,
  createRerankMetrics,
  RERANK_CONFIG,
  type RerankMetrics
} from '../../config/rerank';

/**
 * Search parameters
 */
export interface SearchParams {
  country?: string;
  dateFrom?: string;
  dateTo?: string;
  industry?: string;
  userText?: string;
}

/**
 * Discovery result
 */
export interface DiscoveryResult {
  urls: string[];
  aggregatorDropped: number;
  backstopKept: number;
}

/**
 * Rerank result
 */
export interface RerankResult {
  urls: string[];
  metrics: RerankMetrics;
}

/**
 * Extraction result
 */
export interface ExtractionResult {
  events: EventDTO[];
  invalidJsonDropped: number;
  nonPersonsFiltered: number;
}

/**
 * PHASE 3: Pre-filter aggregators before LLM
 * This must happen BEFORE any reranking or LLM calls
 * 
 * @param urls - Raw URLs from discovery
 * @returns Filtered URLs with metrics
 */
export function preFilterAggregators(urls: string[]): DiscoveryResult {
  console.log('[pipeline] Phase 3: Pre-filtering aggregators...');
  
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
  
  console.log(`[pipeline] Found ${nonAggregators.length} non-aggregators, ${aggregators.length} aggregators`);
  
  // Keep backstop aggregators only if we have too few URLs
  let finalUrls = nonAggregators;
  let backstopKept = 0;
  
  if (nonAggregators.length < RERANK_CONFIG.minNonAggregatorUrls && aggregators.length > 0) {
    const backstop = aggregators.slice(0, RERANK_CONFIG.maxBackstopAggregators);
    finalUrls = [...nonAggregators, ...backstop];
    backstopKept = backstop.length;
    console.log(`[pipeline] Added ${backstop.length} aggregator backstop URLs`);
  }
  
  console.log(`[pipeline] Proceeding with ${finalUrls.length} URLs (dropped ${aggregators.length - backstopKept} aggregators)`);
  
  return {
    urls: finalUrls,
    aggregatorDropped: aggregators.length - backstopKept,
    backstopKept
  };
}

/**
 * PHASE 4: Apply Voyage rerank with domain bonuses
 * Adds .de TLD bonus and conference path bonus
 * 
 * @param urls - Pre-filtered URLs
 * @param params - Search parameters
 * @param voyageApiKey - Voyage API key
 * @returns Reranked URLs with metrics
 */
export async function applyVoyageRerank(
  urls: string[],
  params: SearchParams,
  voyageApiKey: string
): Promise<RerankResult> {
  console.log('[pipeline] Phase 4: Applying Voyage rerank with bonuses...');
  
  // Truncate to max input docs
  const docsForRerank = urls.slice(0, RERANK_CONFIG.maxInputDocs);
  
  // Build instruction with hard excludes
  const instruction = buildRerankInstruction({
    country: params.country,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    industry: params.industry
  });
  
  console.log('[pipeline] Rerank instruction:', instruction.substring(0, 200) + '...');
  
  try {
    // Call Voyage rerank API
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
        top_k: RERANK_CONFIG.topK,
        return_documents: RERANK_CONFIG.returnDocuments
      }),
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      console.warn('[pipeline] Voyage API failed, using original order');
      const metrics = createRerankMetrics(false, docsForRerank.length, docsForRerank.length);
      return { urls: docsForRerank, metrics };
    }
    
    const data = await response.json();
    
    // Apply tie-break bonuses (.de TLD, conference paths)
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
      docsForRerank.length,
      rerankedUrls.length,
      scoredResults.map(r => r.score),
      deBiasHits,
      0, // aggregatorDropped (already filtered in Phase 3)
      0  // backstopKept (already filtered in Phase 3)
    );
    
    console.log('[pipeline]', JSON.stringify(metrics));
    
    return { urls: rerankedUrls, metrics };
    
  } catch (error) {
    console.error('[pipeline] Rerank failed:', error);
    const metrics = createRerankMetrics(false, docsForRerank.length, docsForRerank.length);
    return { urls: docsForRerank, metrics };
  }
}

/**
 * PHASE 1: Safe JSON parsing with auto-repair
 * Replaces all JSON.parse() calls in extraction
 * 
 * @param jsonText - Raw JSON from Gemini/LLM
 * @param geminiCallFn - Function to call Gemini for reprompt (optional)
 * @returns Parsed events or empty array
 */
export async function safeParseEventJson(
  jsonText: string,
  geminiCallFn?: (prompt: string) => Promise<string | null>
): Promise<EventDTO[]> {
  console.log('[pipeline] Phase 1: Safe JSON parsing with auto-repair...');
  
  // Try direct parse with repair
  let result = parseWithRepair(jsonText);
  
  if (result.ok) {
    console.log(`[pipeline] JSON parsed successfully (repaired: ${result.repaired})`);
    return result.data;
  }
  
  // If failed and we have a Gemini function, try reprompt
  if (geminiCallFn) {
    console.warn('[pipeline] JSON parse failed, attempting reprompt...');
    
    const reprompted = await repromptForValidJson(jsonText, geminiCallFn);
    
    if (reprompted && reprompted.length > 0) {
      console.log('[pipeline] Reprompt succeeded');
      return reprompted;
    }
  }
  
  // Failed completely
  console.error('[pipeline] JSON parsing failed completely');
  return [];
}

/**
 * PHASE 2: Filter speakers to only include persons
 * Removes non-person entities like "Privacy Summit", "Reserve Seat"
 * 
 * @param events - Events with raw speakers
 * @returns Events with filtered speakers and metrics
 */
export function filterEventSpeakers(events: EventDTO[]): {
  events: EventDTO[];
  nonPersonsFiltered: number;
} {
  console.log('[pipeline] Phase 2: Filtering speakers to only persons...');
  
  let totalFiltered = 0;
  
  const filteredEvents = events.map(event => {
    if (!event.speakers || event.speakers.length === 0) {
      return event;
    }
    
    const rawCount = event.speakers.length;
    const validSpeakers = filterSpeakers(event.speakers as RawSpeaker[]);
    const filtered = rawCount - validSpeakers.length;
    
    totalFiltered += filtered;
    
    if (filtered > 0) {
      console.log(`[pipeline] Event "${event.title}": ${rawCount} raw → ${validSpeakers.length} validated (filtered ${filtered})`);
    }
    
    return {
      ...event,
      speakers: validSpeakers
    };
  });
  
  console.log(`[pipeline] Total non-persons filtered: ${totalFiltered}`);
  
  return {
    events: filteredEvents,
    nonPersonsFiltered: totalFiltered
  };
}

/**
 * Complete pipeline: Discovery → Pre-filter → Rerank → Extract → Filter
 * Integrates all 4 phases
 * 
 * @param rawUrls - URLs from discovery (Firecrawl, etc.)
 * @param params - Search parameters
 * @param options - Pipeline options
 * @returns Extraction result with metrics
 */
export async function runIntegratedPipeline(
  rawUrls: string[],
  params: SearchParams,
  options: {
    voyageApiKey: string;
    geminiCallFn?: (prompt: string) => Promise<string | null>;
    extractEventFn: (url: string) => Promise<string>; // Returns JSON string
  }
): Promise<ExtractionResult> {
  console.log('[pipeline] Starting integrated pipeline with', rawUrls.length, 'URLs');
  
  // PHASE 3: Pre-filter aggregators
  const { urls: preFilteredUrls, aggregatorDropped, backstopKept } = preFilterAggregators(rawUrls);
  
  if (preFilteredUrls.length === 0) {
    console.warn('[pipeline] No URLs remaining after pre-filtering');
    return {
      events: [],
      invalidJsonDropped: 0,
      nonPersonsFiltered: 0
    };
  }
  
  // PHASE 4: Voyage rerank with bonuses
  const { urls: rerankedUrls, metrics: rerankMetrics } = await applyVoyageRerank(
    preFilteredUrls,
    params,
    options.voyageApiKey
  );
  
  console.log('[pipeline] Extracting from', rerankedUrls.length, 'reranked URLs');
  
  // Extract events from each URL
  const allEvents: EventDTO[] = [];
  let invalidJsonDropped = 0;
  
  for (const url of rerankedUrls) {
    try {
      console.log('[pipeline] Extracting:', url);
      
      const jsonText = await options.extractEventFn(url);
      
      // PHASE 1: Safe JSON parsing
      const events = await safeParseEventJson(jsonText, options.geminiCallFn);
      
      if (events.length === 0) {
        invalidJsonDropped++;
        console.log('[pipeline] Invalid JSON, dropped:', url);
        continue;
      }
      
      allEvents.push(...events);
      
    } catch (error) {
      console.error('[pipeline] Extraction failed for', url, error);
      invalidJsonDropped++;
    }
  }
  
  console.log('[pipeline] Extracted', allEvents.length, 'events before speaker filtering');
  
  // PHASE 2: Filter speakers
  const { events: finalEvents, nonPersonsFiltered } = filterEventSpeakers(allEvents);
  
  console.log('[pipeline] Pipeline complete:', {
    totalUrls: rawUrls.length,
    aggregatorDropped,
    backstopKept,
    reranked: rerankedUrls.length,
    extracted: allEvents.length,
    invalidJsonDropped,
    nonPersonsFiltered,
    finalEvents: finalEvents.length
  });
  
  return {
    events: finalEvents,
    invalidJsonDropped,
    nonPersonsFiltered
  };
}

/**
 * Smart chunking with speaker section prioritization
 * Used in extraction to focus on speaker-rich content
 * 
 * @param content - Raw HTML/text content
 * @param maxChunks - Maximum chunks to create
 * @returns Array of content chunks
 */
export function createSmartChunks(content: string, maxChunks: number = 6): string[] {
  console.log('[pipeline] Creating smart chunks with speaker section prioritization...');
  
  const chunks: string[] = [];
  
  // Try to extract sections by headings
  const sections = extractSectionsFromContent(content);
  
  // Prioritize speaker sections
  const speakerSections = sections.filter(section => 
    isSpeakerSection(section.heading || '')
  );
  
  if (speakerSections.length > 0) {
    console.log(`[pipeline] Found ${speakerSections.length} speaker sections, prioritizing`);
    
    for (const section of speakerSections) {
      if (section.content.length <= 12000) {
        chunks.push(section.content);
      } else {
        // Split large section
        const subChunks = splitIntoChunks(section.content, 12000);
        chunks.push(...subChunks);
      }
      
      if (chunks.length >= maxChunks) break;
    }
  }
  
  // If no speaker sections or need more chunks, add other sections
  if (chunks.length === 0) {
    console.log('[pipeline] No speaker sections found, using generic chunking');
    return splitIntoChunks(content, 12000).slice(0, maxChunks);
  }
  
  return chunks.slice(0, maxChunks);
}

/**
 * Extract sections from content by headings
 */
function extractSectionsFromContent(content: string): Array<{heading: string; content: string}> {
  const sections: Array<{heading: string; content: string}> = [];
  
  // Match markdown headings or HTML headings
  const headingPattern = /(?:^|\n)(#{1,3}\s+([^\n]+)|<h[1-3][^>]*>([^<]+)<\/h[1-3]>)/gm;
  
  let lastIndex = 0;
  let lastHeading = '';
  let match;
  
  while ((match = headingPattern.exec(content)) !== null) {
    if (lastHeading) {
      sections.push({
        heading: lastHeading,
        content: content.substring(lastIndex, match.index).trim()
      });
    }
    
    lastHeading = match[2] || match[3] || '';
    lastIndex = match.index + match[0].length;
  }
  
  // Add final section
  if (lastHeading) {
    sections.push({
      heading: lastHeading,
      content: content.substring(lastIndex).trim()
    });
  }
  
  return sections;
}

/**
 * Split content into chunks of specified size
 */
function splitIntoChunks(content: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  
  for (let i = 0; i < content.length; i += chunkSize) {
    chunks.push(content.substring(i, i + chunkSize));
  }
  
  return chunks;
}

