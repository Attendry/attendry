/**
 * Example: Using the Integrated Event Pipeline
 * Shows how to wire Phases 1-4 into your existing code
 */

import {
  runIntegratedPipeline,
  preFilterAggregators,
  applyVoyageRerank,
  safeParseEventJson,
  filterEventSpeakers,
  createSmartChunks,
  type SearchParams
} from './integrated-event-pipeline';

/**
 * EXAMPLE 1: Complete Pipeline Usage
 * This shows the full integration of all 4 phases
 */
export async function exampleCompletePipeline() {
  // Your discovered URLs from Firecrawl/CSE
  const rawUrls = [
    'https://privacy-summit.de/2025',
    'https://vendelux.com/event/123',  // Will be filtered (aggregator)
    'https://compliance-conference.de/programm',  // Gets .de + /programm/ bonus
    'https://10times.com/event/456',  // Will be filtered (aggregator)
    'https://legal-event.com/speakers'
  ];
  
  const params: SearchParams = {
    country: 'DE',
    dateFrom: '2025-11-12',
    dateTo: '2025-11-19',
    industry: 'legal-compliance'
  };
  
  // Mock extraction function (replace with your actual implementation)
  const extractEventFn = async (url: string): Promise<string> => {
    // Your existing extraction logic here
    // Should return JSON string from Gemini/LLM
    return JSON.stringify({
      title: 'Privacy Conference 2025',
      starts_at: '2025-11-15',
      url: url,
      city: 'Berlin',
      country: 'DE',
      speakers: [
        { name: 'Dr. Andrea Müller', role: 'Privacy Officer' },
        { name: 'Privacy Summit' },  // Will be filtered out
        { name: 'Sebastian Koch', role: 'Compliance Lead' }
      ]
    });
  };
  
  // Mock Gemini call function (replace with your actual implementation)
  const geminiCallFn = async (prompt: string): Promise<string | null> => {
    // Your Gemini API call here
    return null;
  };
  
  // Run the complete integrated pipeline
  const result = await runIntegratedPipeline(
    rawUrls,
    params,
    {
      voyageApiKey: process.env.VOYAGE_API_KEY || '',
      geminiCallFn,
      extractEventFn
    }
  );
  
  console.log('Pipeline result:', {
    eventsFound: result.events.length,
    invalidJsonDropped: result.invalidJsonDropped,
    nonPersonsFiltered: result.nonPersonsFiltered
  });
  
  return result.events;
}

/**
 * EXAMPLE 2: Phase-by-Phase Integration
 * Shows how to integrate each phase separately into existing code
 */

// PHASE 3: Pre-filter aggregators (in your discovery/orchestrator)
export function example_Phase3_PreFilterAggregators(rawUrls: string[]) {
  console.log('=== PHASE 3: Pre-filter Aggregators ===');
  
  const { urls, aggregatorDropped, backstopKept } = preFilterAggregators(rawUrls);
  
  console.log(`Filtered: ${aggregatorDropped} aggregators, kept ${backstopKept} backstop`);
  console.log(`Proceeding with ${urls.length} URLs`);
  
  return urls;
}

// PHASE 4: Apply rerank with bonuses (in your rerank module)
export async function example_Phase4_Rerank(urls: string[], params: SearchParams) {
  console.log('=== PHASE 4: Voyage Rerank with Bonuses ===');
  
  const result = await applyVoyageRerank(
    urls,
    params,
    process.env.VOYAGE_API_KEY || ''
  );
  
  console.log('Rerank metrics:', result.metrics);
  return result.urls;
}

// PHASE 1: Safe JSON parsing (in your extraction module)
export async function example_Phase1_SafeJsonParsing(jsonText: string) {
  console.log('=== PHASE 1: Safe JSON Parsing ===');
  
  // Mock Gemini function
  const geminiCallFn = async (prompt: string) => {
    // Your Gemini API call
    return null;
  };
  
  const events = await safeParseEventJson(jsonText, geminiCallFn);
  
  console.log(`Parsed ${events.length} events`);
  return events;
}

// PHASE 2: Filter speakers (in your extraction module)
export function example_Phase2_FilterSpeakers(events: any[]) {
  console.log('=== PHASE 2: Filter Speakers ===');
  
  const { events: filtered, nonPersonsFiltered } = filterEventSpeakers(events);
  
  console.log(`Filtered ${nonPersonsFiltered} non-persons`);
  return filtered;
}

/**
 * EXAMPLE 3: Integration into existing orchestrator
 * This shows the typical flow in your existing code
 */
export async function exampleOrchestratorIntegration(discoveredUrls: string[]) {
  // Your existing discovery code produces: discoveredUrls
  
  // ✅ ADD: Phase 3 - Pre-filter aggregators BEFORE rerank
  const { urls: filteredUrls, aggregatorDropped } = preFilterAggregators(discoveredUrls);
  console.log(`[orchestrator] Filtered ${aggregatorDropped} aggregators, ${filteredUrls.length} remaining`);
  
  // ✅ ADD: Phase 4 - Rerank with bonuses
  const { urls: rerankedUrls, metrics } = await applyVoyageRerank(
    filteredUrls,
    {
      country: 'DE',
      dateFrom: '2025-11-12',
      dateTo: '2025-11-19'
    },
    process.env.VOYAGE_API_KEY || ''
  );
  console.log('[orchestrator] Rerank metrics:', metrics);
  
  // Your existing extraction code
  const extractedEvents = [];
  
  for (const url of rerankedUrls) {
    try {
      // Your existing Gemini call that returns JSON string
      const jsonResponse = await callGeminiForExtraction(url);
      
      // ✅ REPLACE: JSON.parse(jsonResponse) with safe parsing
      const events = await safeParseEventJson(jsonResponse, async (prompt) => {
        // Your Gemini call function
        return await callGemini(prompt);
      });
      
      if (events.length > 0) {
        extractedEvents.push(...events);
      }
    } catch (error) {
      console.error('[orchestrator] Extraction failed:', error);
    }
  }
  
  // ✅ ADD: Phase 2 - Filter speakers before saving
  const { events: finalEvents, nonPersonsFiltered } = filterEventSpeakers(extractedEvents);
  console.log(`[orchestrator] Filtered ${nonPersonsFiltered} non-persons, ${finalEvents.length} final events`);
  
  return finalEvents;
}

/**
 * EXAMPLE 4: Integration into existing extraction module
 */
export async function exampleExtractionIntegration(eventUrl: string, eventContent: string) {
  // ✅ ADD: Smart chunking with speaker prioritization
  const chunks = createSmartChunks(eventContent, 6);
  console.log(`[extraction] Created ${chunks.length} smart chunks`);
  
  const allSpeakers = [];
  
  for (const chunk of chunks) {
    try {
      // Your existing Gemini call for speaker extraction
      const geminiResponse = await callGeminiForSpeakers(chunk);
      
      // ✅ REPLACE: JSON.parse(geminiResponse) with safe parsing
      const result = await safeParseEventJson(geminiResponse);
      
      if (result.length > 0 && result[0].speakers) {
        allSpeakers.push(...result[0].speakers);
      }
    } catch (error) {
      console.warn('[extraction] Chunk failed, continuing...', error);
      // Don't increment error count - we have fallback
    }
  }
  
  // ✅ ADD: Filter speakers before returning
  const validSpeakers = filterEventSpeakers([{ 
    title: 'Event',
    starts_at: '2025-11-15',
    url: eventUrl,
    speakers: allSpeakers
  }]);
  
  return validSpeakers.events[0].speakers;
}

/**
 * EXAMPLE 5: Drop-in replacements for existing code
 */

// Replace this:
// const events = JSON.parse(geminiResponse);

// With this:
// const events = await safeParseEventJson(geminiResponse, geminiCallFn);

// Replace this:
// return speakerList;

// With this:
// const validated = filterSpeakers(speakerList);
// return validated;

// Add this before rerank:
// const { urls: filtered } = preFilterAggregators(rawUrls);

// Add this for rerank bonuses:
// const { urls: reranked, metrics } = await applyVoyageRerank(filtered, params, apiKey);

/**
 * Mock functions (replace with your actual implementations)
 */
async function callGeminiForExtraction(url: string): Promise<string> {
  // Your implementation
  return '{}';
}

async function callGemini(prompt: string): Promise<string> {
  // Your implementation
  return '{}';
}

async function callGeminiForSpeakers(chunk: string): Promise<string> {
  // Your implementation
  return '{}';
}

