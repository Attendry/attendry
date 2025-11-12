# Quick Start: Applying QC Fixes

## Overview

This guide walks you through applying the QC fixes surgically to your event discovery system.

## 📋 Prerequisites

- Node.js 18+ installed
- Git repository on branch `fix/qc-nov12`
- TypeScript compilation passing
- Existing tests passing

---

## 🚀 5-Minute Quick Apply

### Step 1: Verify New Files Exist

```bash
ls -la src/lib/utils/request-deduplicator.ts
ls -la src/lib/utils/url.ts
ls -la src/lib/utils/llm-retry.ts
ls -la src/lib/filters/pageType.ts
ls -la src/lib/filters/scope.ts
ls -la src/lib/extractors/dom-extractors.ts
```

All should exist (1.7K lines total).

### Step 2: Run Unit Tests

```bash
npm test src/lib/utils/__tests__/url.test.ts
npm test src/lib/filters/__tests__/pageType.test.ts
npm test src/lib/filters/__tests__/scope.test.ts
```

All should pass (21 tests total).

### Step 3: Apply Integration Patches

Open `INTEGRATION_PATCHES.md` and apply each patch:

1. **A) Discovery De-dupe** → `src/lib/search/unified-firecrawl.ts`
2. **B) Sub-page URL Resolution** → `src/lib/event-analysis.ts`
3. **C) LLM Robustness** → `src/lib/event-analysis.ts`
4. **D) DOM Extraction** → `src/lib/event-analysis.ts`
5. **E) Page Type Filtering** → `src/lib/optimized-orchestrator.ts`
6. **F) Idempotent Filtering** → `src/lib/optimized-orchestrator.ts`
7. **G) Throughput Guardrails** → `src/lib/optimized-orchestrator.ts`

### Step 4: Compile & Test

```bash
npm run build
npm test
npm run lint
```

All should pass with 0 errors.

### Step 5: Commit & Push

```bash
git add .
git commit -m "Apply QC fixes (A-H): de-dupe, URL resolution, LLM retry, filtering"
git push origin fix/qc-nov12
```

---

## 📝 Detailed Integration (30 minutes)

### A) Discovery De-dupe (5 min)

**File**: `src/lib/search/unified-firecrawl.ts`

**Location**: Find the Firecrawl API fetch call (around line 300)

**Change**:
```typescript
// Add import at top
import { firecrawlDeduplicator } from '../utils/request-deduplicator';

// Wrap the fetch call
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

**Test**: Search twice with identical params, second should log `Cache HIT`.

---

### B) Sub-page URL Resolution (5 min)

**File**: `src/lib/event-analysis.ts`

**Location**: Around line 450 (extractSubPageUrls function)

**Change**:
```typescript
// Add imports at top
import { toAbsoluteUrl, extractBaseHref, extractSubPageUrls } from './utils/url';

// In deepCrawlEvent function, replace sub-page extraction:
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

**Test**: Crawl German event, verify no `Prioritized: ['', '']` in logs.

---

### C) LLM Robustness (10 min)

**File**: `src/lib/event-analysis.ts`

**Location**: Speaker extraction (around line 1200), Metadata extraction (around line 800)

**Change**:
```typescript
// Add imports at top
import { 
  executeLLMWithRetry, 
  createSpeakerPrompt, 
  createMetadataPrompt,
  cleanSpeakers
} from './utils/llm-retry';

// Replace speaker extraction parallel processing:
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

// Similar change for metadata extraction
```

**Test**: Force empty LLM response, verify retry with smaller chunk.

---

### D) DOM Extraction First (5 min)

**File**: `src/lib/event-analysis.ts`

**Location**: Start of extractAndEnhanceSpeakers function (around line 1150)

**Change**:
```typescript
// Add import at top
import { extractSpeakersFromDOM, extractMetadataFromDOM } from './extractors/dom-extractors';

// At start of extractAndEnhanceSpeakers:
console.log('[event-analysis] Trying deterministic DOM extraction first...');

const domSpeakers = extractSpeakersFromDOM(serializedSections, eventUrl);

if (domSpeakers.length > 0) {
  console.log(`[event-analysis] DOM extraction found ${domSpeakers.length} speakers`);
  domSpeakers.forEach(speaker => {
    if (!speakerMap.has(speaker.name)) {
      speakerMap.set(speaker.name, speaker);
    }
  });
}

// If sufficient speakers found, skip LLM
if (domSpeakers.length >= 3) {
  console.log('[event-analysis] Sufficient speakers from DOM, skipping LLM');
  return Array.from(speakerMap.values());
}

console.log('[event-analysis] DOM found few speakers, trying LLM...');
// ... continue with existing LLM extraction
```

**Test**: Crawl event with schema.org markup, verify `DOM extraction found N speakers`.

---

### E) Page Type Filtering (5 min)

**File**: `src/lib/optimized-orchestrator.ts`

**Location**: After candidate discovery (around line 1150), After extraction (around line 1400)

**Change**:
```typescript
// Add imports at top
import { classifyPageType, isObviouslyNonEvent } from './filters/pageType';
import { passesScope } from './filters/scope';

// After deduplication:
console.log('[optimized-orchestrator] Applying early page-type filter...');

const filteredByType = uniqueUrls.filter(url => {
  if (isObviouslyNonEvent(url)) {
    console.log(`[optimized-orchestrator] Filtered obvious non-event: ${url}`);
    return false;
  }
  return true;
});

console.log(`[optimized-orchestrator] Page-type filter: ${uniqueUrls.length} → ${filteredByType.length} URLs`);

// After extraction:
console.log('[optimized-orchestrator] Classifying extracted events...');

const classified = extracted.filter(event => {
  const classification = classifyPageType(
    event.url,
    event.title,
    event.description
  );
  
  if (!classification.isEvent) {
    console.log(`[optimized-orchestrator] Filtered ${classification.type} page: ${event.url}`);
    return false;
  }
  
  return true;
});

console.log(`[optimized-orchestrator] Classification filter: ${extracted.length} → ${classified.length} events`);
```

**Test**: Feed `/terms` URL, verify filtered out early.

---

### F) Idempotent Domain Filtering (2 min)

**File**: `src/lib/optimized-orchestrator.ts`

**Location**: Aggregator filtering (around line 890)

**Change**:
```typescript
const seenAggregators = new Set<string>();

const filtered = urls.filter(url => {
  const hostname = new URL(url).hostname;
  
  if (AGGREGATOR_HOSTS.has(hostname)) {
    if (!seenAggregators.has(hostname)) {
      console.log(`[optimized-orchestrator] Filtering out aggregator domain: ${hostname}`);
      seenAggregators.add(hostname);
    }
    return false;
  }
  return true;
});

console.log(`[optimized-orchestrator] Filtered ${seenAggregators.size} aggregator domains`);
```

**Test**: Verify each aggregator logged once, not 10+ times.

---

### G) Throughput Guardrails (3 min)

**File**: `src/lib/optimized-orchestrator.ts`

**Location**: prioritizeCandidates function (around line 1200)

**Change**:
```typescript
const MAX_URLS_PER_BATCH = 12;

// Cap total URLs
const cappedUrls = filteredUrls.slice(0, MAX_URLS_PER_BATCH);

if (filteredUrls.length > MAX_URLS_PER_BATCH) {
  console.log(`[optimized-orchestrator] Capping prioritization: ${filteredUrls.length} → ${MAX_URLS_PER_BATCH} URLs`);
}

const chunks = [];
for (let i = 0; i < cappedUrls.length; i += chunkSize) {
  chunks.push(cappedUrls.slice(i, i + chunkSize));
}
```

**Test**: Send 20 URLs, verify capped to 12.

---

## ✅ Verification Checklist

After applying all patches, verify:

### Build & Tests
- [ ] `npm run build` succeeds
- [ ] `npm test` passes (all tests)
- [ ] `npm run lint` shows 0 errors

### Smoke Test (Local)
- [ ] Start dev server: `npm run dev`
- [ ] Run search: Country=DE, Dates=Next week
- [ ] Check console logs for:
  - [ ] `[request-deduplicator] Cache HIT` (on 2nd identical search)
  - [ ] `[event-analysis] Sub-page extraction:` (with validUrls count)
  - [ ] `[event-analysis] DOM extraction found N speakers`
  - [ ] `[llm-retry]` messages if LLM fails
  - [ ] `[optimized-orchestrator] Page-type filter:` (with counts)
  - [ ] `[optimized-orchestrator] Filtering out aggregator domain:` (once per domain)
  - [ ] `[optimized-orchestrator] Capping prioritization:` (if > 12 URLs)

### Results Quality
- [ ] No `/terms`, `/privacy`, `/impressum` pages in results
- [ ] No empty speaker names like `''` or `Reserve Seat`
- [ ] German events have speakers extracted (if available on page)
- [ ] Search completes in < 60s (was 90-120s)

---

## 🐛 Troubleshooting

### Issue: TypeScript errors after applying patches

**Solution**: Check imports match new file paths:
```typescript
import { firecrawlDeduplicator } from '../utils/request-deduplicator';
import { toAbsoluteUrl } from './utils/url';
import { classifyPageType } from './filters/pageType';
```

### Issue: Tests fail with "module not found"

**Solution**: Verify new files exist in correct paths:
```bash
tree src/lib/utils src/lib/filters src/lib/extractors
```

### Issue: Empty speakers still extracted

**Solution**: Verify DOM extraction runs BEFORE LLM:
```typescript
// Should see this order in logs:
// 1. [event-analysis] Trying deterministic DOM extraction first...
// 2. [event-analysis] DOM extraction found N speakers
// 3. [event-analysis] DOM found few speakers, trying LLM... (if < 3)
```

### Issue: Duplicate Firecrawl calls still happening

**Solution**: Verify de-duplicator is imported and wrapping the fetch:
```typescript
// unified-firecrawl.ts should have:
import { firecrawlDeduplicator } from '../utils/request-deduplicator';

const response = await firecrawlDeduplicator.execute(...);
```

---

## 📊 Success Metrics

After deployment, monitor:

1. **Search latency**: Should drop from 90-120s → 50-70s
2. **Cache hit rate**: Look for `Cache HIT` in ~30% of searches
3. **LLM retry rate**: Should be < 20% (log `[llm-retry] Retry`)
4. **DOM success rate**: Should cover 40%+ (log `DOM extraction found N`)
5. **False positives**: Spot-check results, should be < 2%

---

## 📞 Support

If you encounter issues:

1. **Check logs**: Most issues show clear error messages
2. **Review patches**: `INTEGRATION_PATCHES.md` has detailed examples
3. **Run tests**: `npm test` isolates utility issues
4. **Compare branches**: `git diff main fix/qc-nov12` shows all changes

---

## 🎯 Next Steps

After successful deployment:

1. Monitor production logs for 24 hours
2. Collect metrics on search latency and quality
3. Tune configuration knobs if needed (see `QC_FIXES_NOV12_README.md`)
4. Plan future enhancements (persistent cache, ML classifier, etc.)

---

**Estimated Time**: 30-45 minutes for full integration  
**Risk Level**: Low (all changes are additive, no breaking changes)  
**Rollback Time**: < 5 minutes (git revert)

Good luck! 🚀

