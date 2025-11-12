# Pipeline Integration Guide

This document shows how to integrate the new QC fixes into your existing event discovery pipeline.

## Overview

The fixes are organized in these modules:
- `src/lib/llm/json.ts` - JSON schema validation and auto-repair
- `src/lib/extract/speakers.ts` - Deterministic speaker validation
- `src/config/rerank.ts` - Rerank configuration and aggregator filtering

## Integration Steps

### 1. Pre-Filter Aggregators (Discovery Stage)

**File**: `src/lib/optimized-orchestrator.ts` or your discovery module

**Location**: After collecting URLs from Firecrawl, before calling Gemini/LLM

```typescript
import { isAggregatorUrl, RERANK_CONFIG } from '@/config/rerank';

// After: const uniqueUrls = [...new Set(allUrls)];

console.log('[discovery] Filtering aggregators before LLM...');

const { nonAggregators, aggregators } = uniqueUrls.reduce(
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

console.log(`[discovery] Found ${nonAggregators.length} non-aggregators, ${aggregators.length} aggregators`);

// Keep backstop aggregators only if we have too few URLs
let urlsForRerank = nonAggregators;

if (nonAggregators.length < RERANK_CONFIG.minNonAggregatorUrls && aggregators.length > 0) {
  const backstop = aggregators.slice(0, RERANK_CONFIG.maxBackstopAggregators);
  urlsForRerank = [...nonAggregators, ...backstop];
  console.log(`[discovery] Added ${backstop.length} aggregator backstop URLs`);
}

console.log(`[discovery] Proceeding with ${urlsForRerank.length} URLs to rerank`);
```

### 2. Voyage Rerank with Tie-Break Bonuses

**File**: Your rerank module (e.g., `src/lib/rerank.ts` or in orchestrator)

```typescript
import { 
  calculateUrlBonus, 
  buildRerankInstruction,
  createRerankMetrics,
  RERANK_CONFIG 
} from '@/config/rerank';

// Truncate to max input docs
const docsForRerank = urlsForRerank.slice(0, RERANK_CONFIG.maxInputDocs);

// Build instruction
const instruction = buildRerankInstruction({
  country: params.country,
  dateFrom: params.dateFrom,
  dateTo: params.dateTo,
  industry: userProfile?.industry
});

// Call Voyage rerank
const rerankResponse = await fetch('https://api.voyageai.com/v1/rerank', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${VOYAGE_API_KEY}`
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

if (!rerankResponse.ok) {
  console.warn('[rerank] Voyage API failed, using original order');
  // Fall back to original order
} else {
  const rerankData = await rerankResponse.json();
  
  // Apply tie-break bonuses
  const scoredResults = rerankData.results.map((r: any) => ({
    url: docsForRerank[r.index],
    score: r.relevance_score + calculateUrlBonus(docsForRerank[r.index]),
    originalScore: r.relevance_score
  }));
  
  // Re-sort by adjusted score
  scoredResults.sort((a, b) => b.score - a.score);
  
  // Extract top URLs
  const rerankedUrls = scoredResults.map(r => r.url);
  
  // Calculate metrics
  const deBiasHits = scoredResults.filter(r => r.score > r.originalScore).length;
  const avgScore = scoredResults.reduce((sum, r) => sum + r.score, 0) / scoredResults.length;
  
  const metrics = createRerankMetrics(
    true,
    docsForRerank.length,
    rerankedUrls.length,
    scoredResults.map(r => r.score),
    deBiasHits,
    aggregators.length,
    backstopKept
  );
  
  console.log('[rerank]', JSON.stringify(metrics));
  
  // Use reranked order for extraction
  urlsToExtract = rerankedUrls;
}
```

### 3. JSON Safe Parsing in Extractor

**File**: `src/lib/event-analysis.ts` or your extraction module

**Location**: Wherever you parse Gemini JSON responses

```typescript
import { parseWithRepair, repromptForValidJson } from '@/lib/llm/json';
import { filterSpeakers } from '@/lib/extract/speakers';

// Replace existing JSON.parse() with:

const parseResult = parseWithRepair(geminiResponseText);

if (!parseResult.ok) {
  console.warn('[extract] JSON parse failed, attempting reprompt...');
  
  // Create Gemini call wrapper
  const generateFn = async (prompt: string) => {
    const response = await geminiModel.generateContent(prompt);
    return response.response?.text() || null;
  };
  
  // Try reprompt (one attempt, 6s timeout)
  const reprompted = await repromptForValidJson(
    geminiResponseText,
    generateFn
  );
  
  if (reprompted && reprompted.length > 0) {
    console.log('[extract] Reprompt succeeded, got valid events');
    parseResult.data = reprompted;
    parseResult.ok = true;
  } else {
    console.error('[extract] Reprompt failed, dropping invalid JSON');
    console.log({ stage: 'extract', drop: 'invalid_json', url: eventUrl });
    continue; // Skip this URL
  }
}

// Extract events from parse result
const events = parseResult.data;

// Filter speakers for each event
for (const event of events) {
  if (event.speakers && event.speakers.length > 0) {
    const validSpeakers = filterSpeakers(event.speakers);
    
    console.log(`[extract] Speakers: ${event.speakers.length} raw → ${validSpeakers.length} validated`);
    
    event.speakers = validSpeakers;
  }
}
```

### 4. Smart Chunking with Speaker Section Targeting

**File**: `src/lib/event-analysis.ts` or chunking module

**Location**: In your chunking function, before generic chunking

```typescript
import { isSpeakerSection } from '@/lib/extract/speakers';

function createSmartChunks(content: string, maxChunks: number = 6): string[] {
  const chunks: string[] = [];
  
  // 1. Try to extract speaker sections first
  const sections = extractSections(content); // Your existing section extractor
  
  const speakerSections = sections.filter(section => 
    isSpeakerSection(section.heading || section.title || '')
  );
  
  if (speakerSections.length > 0) {
    console.log(`[chunking] Found ${speakerSections.length} speaker sections, prioritizing`);
    
    // Create chunks from speaker sections (up to 8-12k chars each)
    for (const section of speakerSections) {
      const sectionText = section.content;
      
      if (sectionText.length <= 12000) {
        chunks.push(sectionText);
      } else {
        // Split large section into smaller chunks
        const subChunks = splitIntoChunks(sectionText, 12000);
        chunks.push(...subChunks);
      }
      
      if (chunks.length >= maxChunks) break;
    }
  }
  
  // 2. If no speaker sections or need more chunks, use generic chunking
  if (chunks.length === 0) {
    console.log('[chunking] No speaker sections found, using generic chunking');
    return genericChunking(content, maxChunks);
  }
  
  return chunks.slice(0, maxChunks);
}

function extractSections(content: string): Array<{heading?: string; content: string}> {
  // Look for sections by headings, IDs, or semantic markers
  const sectionPatterns = [
    /(?:^|\n)(?:#{1,3}\s+)?([A-Z][A-Za-zäöüß\s]+)(?:\n|$)/gm, // Markdown headings
    /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi, // HTML headings
    /id=["']([^"']*(?:speaker|referent|program|agenda)[^"']*)["']/gi // IDs with keywords
  ];
  
  // Your section extraction logic...
  // Return array of {heading, content} objects
}
```

### 5. Date Normalization and DE Gate

**File**: `src/lib/event-analysis.ts` or post-extraction filter

**Location**: After extraction, before saving to database

```typescript
import { parseEventDate, isGermany, isGermanCity } from '@/lib/filters/scope';

function normalizeAndFilterEvents(events: EventDTO[], params: SearchParams): EventDTO[] {
  const filtered: EventDTO[] = [];
  
  for (const event of events) {
    // 1. Normalize dates to ISO (YYYY-MM-DD) in Europe/Berlin
    if (event.starts_at) {
      const parsed = parseEventDate(event.starts_at);
      if (parsed) {
        event.starts_at = parsed.toISOString().split('T')[0];
      }
    }
    
    if (event.ends_at) {
      const parsed = parseEventDate(event.ends_at);
      if (parsed) {
        event.ends_at = parsed.toISOString().split('T')[0];
      }
    }
    
    // 2. Hard DE gate
    if (params.country === 'DE') {
      const hasGermanyCountry = event.country && isGermany(event.country);
      const hasGermanCity = event.city && isGermanCity(event.city);
      
      if (!hasGermanyCountry && !hasGermanCity) {
        console.log({
          stage: 'qa',
          gate: 'country_fail',
          url: event.url,
          country: event.country,
          city: event.city
        });
        continue; // Skip non-German event
      }
    }
    
    filtered.push(event);
  }
  
  return filtered;
}
```

### 6. Timeouts and Retries

**File**: Where you call Gemini for different operations

```typescript
// Metadata extraction (chunks)
const metadataPromise = geminiModel.generateContent(metadataPrompt);
const metadataResult = await Promise.race([
  metadataPromise,
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Metadata timeout')), 12000)
  )
]);

// Speaker extraction (no retries, we have deterministic fallback)
try {
  const speakerPromise = geminiModel.generateContent(speakerPrompt);
  const speakerResult = await Promise.race([
    speakerPromise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Speaker timeout')), 8000)
    )
  ]);
  
  // Process result...
} catch (error) {
  console.warn('[extract] Gemini speaker extraction timed out, using manual fallback');
  // Don't increment error count, just move on
  // Manual extractor will run next
}

// If Gemini returns empty for a chunk, don't treat as error
if (!geminiResult || !geminiResult.text()) {
  console.log('[extract] Empty Gemini response for chunk, skipping to next');
  continue; // Move to next chunk
}
```

### 7. Integration Checklist

After applying all patches:

- [ ] Pre-filter aggregators before LLM calls
- [ ] Voyage rerank returns top-K with bonuses applied
- [ ] JSON parsing uses `parseWithRepair` with reprompt fallback
- [ ] Speakers filtered with `filterSpeakers()` before saving
- [ ] Smart chunking prioritizes speaker sections
- [ ] Dates normalized to ISO format
- [ ] Hard DE gate applied
- [ ] Timeouts tuned per operation type
- [ ] Metrics logged: `stage=rerank`, `stage=extract`, `stage=qa`

### 8. Testing Integration

Run your pipeline with these test cases:

```typescript
// Test 1: Aggregator filtering
const testUrls = [
  'https://example.com/conference',       // Should pass
  'https://vendelux.com/event',           // Should be filtered
  'https://10times.com/event',            // Should be filtered
  'https://conference-site.de/programm'   // Should pass with .de bonus
];

// Test 2: Speaker validation
const testSpeakers = [
  { name: 'Dr. Thomas Weber' },           // Should pass
  { name: 'Privacy Summit' },             // Should fail
  { name: 'Reserve Seat' },               // Should fail
  { name: 'Sarah Johnson' }               // Should pass
];

// Test 3: JSON repair
const testJson = `{
  "title": "Event",
  "starts_at": "2025-11-15",
  "url": "https://example.com",
}`;  // Trailing comma should be repaired

// Test 4: Country gate
const testEvents = [
  { city: 'Berlin', country: 'DE' },      // Should pass
  { city: 'London', country: 'UK' },      // Should fail (if DE gate active)
  { city: 'München', country: null }      // Should pass (German city)
];
```

## Acceptance Criteria

Your integration is complete when:

1. ✅ No "Expected double-quoted property name" crashes
2. ✅ Speaker lists contain only persons (no "Summit", "Forum", etc.)
3. ✅ Rerank logs show `used=true` and Voyage ordering respected
4. ✅ Aggregators only appear if < 6 total candidates
5. ✅ For country=DE, non-German events are filtered out
6. ✅ Date range expansion works without trying LLM on aggregators

## Troubleshooting

### Issue: Still getting non-person speakers

**Check**: Is `filterSpeakers()` called after both manual AND Gemini extraction?

```typescript
// After manual extraction
const manualSpeakers = extractSpeakersManually(content);
const validManual = filterSpeakers(manualSpeakers);

// After Gemini extraction
const geminiSpeakers = parseGeminiSpeakers(response);
const validGemini = filterSpeakers(geminiSpeakers);
```

### Issue: JSON still crashing

**Check**: Are you using `parseWithRepair` instead of `JSON.parse`?

```typescript
// ❌ Bad
const events = JSON.parse(geminiResponse);

// ✅ Good
const result = parseWithRepair(geminiResponse);
if (!result.ok) {
  // Handle error or reprompt
}
const events = result.data;
```

### Issue: Aggregators still in results

**Check**: Is pre-filtering happening BEFORE Gemini/LLM calls?

```typescript
// Order should be:
// 1. Discovery (Firecrawl)
// 2. Filter aggregators ← THIS MUST BE HERE
// 3. Voyage rerank
// 4. LLM extraction
```

### Issue: Rerank not using Voyage order

**Check**: Are you re-sorting by relevance_score after rerank?

```typescript
// After Voyage returns results:
const reranked = voyageResults.results
  .map(r => ({
    url: docs[r.index],
    score: r.relevance_score + calculateUrlBonus(docs[r.index])
  }))
  .sort((a, b) => b.score - a.score)  // ← Must sort!
  .map(r => r.url);
```

## Performance Metrics

After integration, you should see:

- **Aggregator filtering**: 30-50% of URLs removed pre-LLM
- **Speaker validation**: 10-20% of raw speakers filtered out
- **JSON repair**: 5-10% of responses require repair
- **Rerank bonus hits**: 20-30% of URLs get .de or conference path bonus
- **Extraction success**: 95%+ of responses parsed successfully

## Next Steps

1. Apply all integration patches above
2. Run test suite: `npm test`
3. Deploy to staging
4. Monitor logs for metrics
5. Tune thresholds if needed (see `src/config/rerank.ts`)

