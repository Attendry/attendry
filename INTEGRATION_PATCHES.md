# Integration Patches for QC Fixes

This document provides surgical patches to integrate the new utilities into existing modules.

## Table of Contents
- [A) Discovery De-dupe (unified-firecrawl)](#a-discovery-de-dupe)
- [B) Sub-page URL Resolution (event-analysis)](#b-sub-page-url-resolution)
- [C) LLM Robustness (event-analysis)](#c-llm-robustness)
- [D) DOM Extraction First (event-analysis)](#d-dom-extraction-first)
- [E) Page Type Filtering (optimized-orchestrator)](#e-page-type-filtering)
- [F) Idempotent Domain Filtering (optimized-orchestrator)](#f-idempotent-domain-filtering)
- [G) Throughput Guardrails (optimized-orchestrator)](#g-throughput-guardrails)

---

## A) Discovery De-dupe

### File: `src/lib/search/unified-firecrawl.ts`

**Add imports at top:**
```typescript
import { firecrawlDeduplicator } from '../utils/request-deduplicator';
```

**Wrap Firecrawl API call:**

Find the existing Firecrawl fetch call (around line 300) and wrap it:

```typescript
// BEFORE:
const response = await fetch(`${FIRECRAWL_API_URL}/search`, {
  method: 'POST',
  headers,
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(timeoutMs)
});

// AFTER:
const response = await firecrawlDeduplicator.execute(
  {
    query: narrativeQuery,
    location: params.location,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    limit: body.limit,
    sources: body.sources
  },
  async () => {
    return await fetch(`${FIRECRAWL_API_URL}/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
  }
);
```

---

## B) Sub-page URL Resolution

### File: `src/lib/event-analysis.ts`

**Add imports at top:**
```typescript
import { toAbsoluteUrl, extractBaseHref, extractSubPageUrls } from './utils/url';
```

**Replace extractSubPageUrls function** (around line 450-500):

```typescript
// BEFORE:
function extractSubPageUrls(eventUrl: string, content: string): string[] {
  // ... old implementation with manual href extraction
}

// AFTER:
// Remove old function, use imported one instead
// The utility already handles all cases including language segments
```

**Update deep crawl sub-page resolution** (around line 630):

```typescript
// BEFORE:
const allSubPageUrls = extractSubPageUrls(eventUrl, results[0]?.content || '');
const prioritizedSubPageUrls = prioritizeSubPagesForSpeakers(allSubPageUrls);

// AFTER:
const documentBaseHref = extractBaseHref(results[0]?.content || '');
const rawSubPageUrls = extractSubPageUrls(eventUrl, results[0]?.content || '');

// Filter out empty/invalid URLs
const validSubPageUrls = rawSubPageUrls.filter(url => url && url.length > 0);

const prioritizedSubPageUrls = prioritizeSubPagesForSpeakers(validSubPageUrls);

console.log('[event-analysis] Sub-page extraction:', {
  totalFound: rawSubPageUrls.length,
  validUrls: validSubPageUrls.length,
  prioritized: prioritizedSubPageUrls.slice(0, 2).map(u => u.split('/').pop())
});
```

---

## C) LLM Robustness

### File: `src/lib/event-analysis.ts`

**Add imports:**
```typescript
import { 
  executeLLMWithRetry, 
  createSpeakerPrompt, 
  createMetadataPrompt,
  cleanSpeakers
} from './utils/llm-retry';
```

**Replace speaker extraction** (around line 1200):

```typescript
// BEFORE:
const chunkPromises = chunks.map((chunk, i) => processChunk(chunk, i));
const chunkResults = await Promise.allSettled(chunkPromises);

// AFTER:
const result = await executeLLMWithRetry(
  chunks,
  async (chunk, index) => {
    const prompt = createSpeakerPrompt(chunk, index, chunks.length);
    
    try {
      const response = await model.generateContent(prompt);
      const text = response.response?.text();
      return text || null;
    } catch (error) {
      console.warn(`[llm-retry] Speaker extraction chunk ${index + 1} error:`, error);
      return null;
    }
  },
  {
    maxRetries: 2,
    requireJsonKey: 'speakers',
    timeoutMs: 15000
  }
);

if (result.success && result.data) {
  const cleanedSpeakers = cleanSpeakers(result.data);
  cleanedSpeakers.forEach(speaker => {
    if (!speakerMap.has(speaker.name)) {
      speakerMap.set(speaker.name, speaker);
    }
  });
  
  console.log(`[event-analysis] LLM extracted ${cleanedSpeakers.length} speakers in ${result.attempts} attempts`);
}
```

**Replace metadata extraction** (around line 800):

```typescript
// BEFORE:
for (let i = 0; i < chunks.length; i++) {
  const chunk = chunks[i];
  console.log(`[event-analysis] Calling Gemini for metadata chunk ${i + 1}/${chunks.length}`);
  
  const prompt = `Extract factual event metadata...`;
  // ... existing Gemini call
}

// AFTER:
const result = await executeLLMWithRetry(
  chunks,
  async (chunk, index) => {
    const prompt = createMetadataPrompt(chunk, index, chunks.length);
    
    try {
      const response = await model.generateContent(prompt);
      const text = response.response?.text();
      return text || null;
    } catch (error) {
      console.warn(`[llm-retry] Metadata extraction chunk ${index + 1} error:`, error);
      return null;
    }
  },
  {
    maxRetries: 2,
    requireJsonKey: 'event',
    timeoutMs: 15000
  }
);

if (result.success && result.data) {
  // Merge metadata from all chunks
  for (const eventData of result.data) {
    if (eventData && typeof eventData === 'object') {
      // Merge fields with preference for non-null values
      Object.keys(eventData).forEach(key => {
        if (eventData[key] && !metadata[key]) {
          metadata[key] = eventData[key];
        }
      });
    }
  }
  
  console.log(`[event-analysis] LLM extracted metadata in ${result.attempts} attempts`);
}
```

---

## D) DOM Extraction First

### File: `src/lib/event-analysis.ts`

**Add imports:**
```typescript
import { extractSpeakersFromDOM, extractMetadataFromDOM } from './extractors/dom-extractors';
```

**Add DOM extraction before LLM in speaker extraction** (around line 1150):

```typescript
// Add at the start of extractAndEnhanceSpeakers function:

console.log('[event-analysis] Trying deterministic DOM extraction first...');

// 1. Try DOM extraction
const domSpeakers = extractSpeakersFromDOM(serializedSections, eventUrl);

if (domSpeakers.length > 0) {
  console.log(`[event-analysis] DOM extraction found ${domSpeakers.length} speakers`);
  domSpeakers.forEach(speaker => {
    if (!speakerMap.has(speaker.name)) {
      speakerMap.set(speaker.name, speaker);
    }
  });
}

// If we found enough speakers via DOM, skip LLM
if (domSpeakers.length >= 3) {
  console.log('[event-analysis] Sufficient speakers from DOM, skipping LLM');
  return Array.from(speakerMap.values());
}

// 2. Otherwise, proceed with LLM extraction...
console.log('[event-analysis] DOM found few speakers, trying LLM...');
```

**Add DOM extraction for metadata** (around line 750):

```typescript
// Add at the start of extractEventMetadata function:

console.log('[event-analysis] Trying deterministic DOM extraction first...');

// 1. Try DOM extraction
const domMetadata = extractMetadataFromDOM(combinedContent, eventUrl);

// Pre-populate metadata with DOM results
const metadata: any = { ...domMetadata };

console.log('[event-analysis] DOM metadata:', {
  name: !!metadata.name,
  start_date: !!metadata.start_date,
  city: !!metadata.city,
  country_code: !!metadata.country_code
});

// If DOM found all critical fields, skip LLM
if (metadata.name && metadata.start_date && metadata.city) {
  console.log('[event-analysis] Complete metadata from DOM, skipping LLM');
  return metadata;
}

// 2. Otherwise, proceed with LLM to fill gaps...
console.log('[event-analysis] DOM metadata incomplete, using LLM to fill gaps...');
```

---

## E) Page Type Filtering

### File: `src/lib/optimized-orchestrator.ts`

**Add imports:**
```typescript
import { classifyPageType, isObviouslyNonEvent } from './filters/pageType';
import { passesScope } from './filters/scope';
```

**Add early filtering after candidate discovery** (around line 1150, after deduplication):

```typescript
// After: const uniqueUrls = [...new Set(allUrls)];

// Filter obviously non-event pages early
console.log('[optimized-orchestrator] Applying early page-type filter...');

const filteredByType = uniqueUrls.filter(url => {
  if (isObviouslyNonEvent(url)) {
    console.log(`[optimized-orchestrator] Filtered obvious non-event: ${url}`);
    return false;
  }
  return true;
});

console.log(`[optimized-orchestrator] Page-type filter: ${uniqueUrls.length} → ${filteredByType.length} URLs`);
```

**Add classification after extraction** (around line 1400, after extractEventDetails):

```typescript
// After: const extracted = await extractEventDetails(...);

console.log('[optimized-orchestrator] Classifying extracted events...');

const classified = extracted.filter(event => {
  const classification = classifyPageType(
    event.url,
    event.title,
    event.description
  );
  
  if (!classification.isEvent) {
    console.log(`[optimized-orchestrator] Filtered ${classification.type} page: ${event.url} (${classification.reason})`);
    return false;
  }
  
  return true;
});

console.log(`[optimized-orchestrator] Classification filter: ${extracted.length} → ${classified.length} events`);
```

---

## F) Idempotent Domain Filtering

### File: `src/lib/optimized-orchestrator.ts`

**Replace aggregator filtering** (around line 890):

```typescript
// BEFORE:
const filtered = urls.filter(url => {
  const hostname = new URL(url).hostname;
  if (AGGREGATOR_HOSTS.has(hostname)) {
    console.log(`[optimized-orchestrator] Filtering out aggregator domain: ${hostname}`);
    return false;
  }
  return true;
});

// AFTER:
const seenAggregators = new Set<string>();

const filtered = urls.filter(url => {
  const hostname = new URL(url).hostname;
  
  if (AGGREGATOR_HOSTS.has(hostname)) {
    // Log only once per domain
    if (!seenAggregators.has(hostname)) {
      console.log(`[optimized-orchestrator] Filtering out aggregator domain: ${hostname}`);
      seenAggregators.add(hostname);
    }
    return false;
  }
  return true;
});

console.log(`[optimized-orchestrator] Filtered ${seenAggregators.size} aggregator domains (${urls.length - filtered.length} URLs removed)`);
```

---

## G) Throughput Guardrails

### File: `src/lib/optimized-orchestrator.ts`

**Add prioritization guardrails** (around line 1200, in prioritizeCandidates):

```typescript
// BEFORE:
const chunks = [];
for (let i = 0; i < filteredUrls.length; i += chunkSize) {
  chunks.push(filteredUrls.slice(i, i + chunkSize));
}

// AFTER:
const MAX_URLS_PER_BATCH = 12;

// Cap total URLs to prevent timeouts
const cappedUrls = filteredUrls.slice(0, MAX_URLS_PER_BATCH);

if (filteredUrls.length > MAX_URLS_PER_BATCH) {
  console.log(`[optimized-orchestrator] Capping prioritization: ${filteredUrls.length} → ${MAX_URLS_PER_BATCH} URLs`);
}

const chunks = [];
for (let i = 0; i < cappedUrls.length; i += chunkSize) {
  chunks.push(cappedUrls.slice(i, i + chunkSize));
}
```

**Add timeout fallback** (around line 1250, after Gemini prioritization):

```typescript
// After attempting Gemini prioritization, before results processing:

// If Gemini is taking too long, use lexical fallback for remaining URLs
const PRIORITIZATION_TIMEOUT = 9000; // 9s

let prioritizedResults = [];
let remainingUrls = [];

const prioritizationPromise = Promise.race([
  attemptGeminiPrioritization(chunks), // Your existing Gemini call
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Prioritization timeout')), PRIORITIZATION_TIMEOUT)
  )
]).then(results => {
  prioritizedResults = results;
}).catch(error => {
  console.warn('[optimized-orchestrator] Prioritization timeout, using fallback for remaining');
  
  // Use event-keyword scoring for remaining URLs
  remainingUrls = cappedUrls.map(url => ({
    url,
    score: scoreby EventKeywords(url), // Implement based on POSITIVE_KEYWORDS from filters
    reason: 'lexical-fallback'
  }));
});

await prioritizationPromise;

// Merge prioritized + fallback results
const allResults = [...prioritizedResults, ...remainingUrls]
  .sort((a, b) => b.score - a.score);
```

---

## H) Enhanced Logging

### File: `src/lib/event-analysis.ts`

**Add logging for sub-page URL extraction** (around line 630):

```typescript
// After sub-page extraction:

console.log('[event-analysis] Sub-page extraction results:', {
  totalLinks: rawSubPageUrls.length,
  validAbsoluteUrls: validSubPageUrls.length,
  afterPrioritization: prioritizedSubPageUrls.length,
  taking: Math.min(2, prioritizedSubPageUrls.length)
});
```

**Add logging for LLM retries** (in llm-retry.ts, already included):

```typescript
// Logs automatically generated:
// [llm-retry] Retry 1/2 with reduced chunk: 2100 chars
// [llm-retry] Chunk 3 FAILED after 3 attempts
```

---

## Summary

These patches integrate the new utilities into existing modules with minimal disruption:

1. **Request de-duplication** prevents duplicate Firecrawl calls
2. **URL resolution** fixes empty sub-page URLs and preserves language segments
3. **LLM robustness** adds retries and adaptive chunking
4. **DOM extraction** runs before LLM to save API calls
5. **Page-type filtering** removes non-event pages early
6. **Idempotent domain filtering** reduces log noise
7. **Throughput guardrails** prevent timeouts
8. **Enhanced logging** improves observability

All changes maintain existing public interfaces and can be applied surgically to the codebase.

