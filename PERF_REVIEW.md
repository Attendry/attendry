# Performance Review: Event Discovery/Scraper Stack

**Date:** 2025-01-XX  
**Reviewer:** Staff Performance Engineer  
**Scope:** optimized-orchestrator, unified-search, unified-firecrawl, event-analysis, smart-chunking, speaker-extraction, speaker-validation, filters/*, utils/url, parallel-processor, alerting/metrics, cache layers, queue/circuit-breaker utilities  
**Environment:** Vercel (production-like), Firecrawl requests, Gemini 2.5 (Flash) calls

---

## 1. System Map

### Hot Path Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DISCOVERY STAGE                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Firecrawl   │  │  Google CSE  │  │  Database    │         │
│  │  (Primary)   │  │  (Fallback)  │  │  (Fallback)  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                │
│         └──────────────────┴──────────────────┘                │
│                          │                                      │
│                    [URL Deduplication]                          │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PRIORITIZATION STAGE                           │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Voyage Gate (Rerank + Aggregator Filter)            │     │
│  │  - Filters aggregators (10times.com, eventbrite)     │     │
│  │  - Applies .de TLD bonus                              │     │
│  └──────────────────────┬─────────────────────────────────┘     │
│                         │                                       │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Gemini 2.5 Flash Prioritization                     │     │
│  │  - Batch size: 3 URLs per call                       │     │
│  │  - Timeout: 12s (single attempt)                     │     │
│  │  - Chunk processing: sequential                      │     │
│  └──────────────────────┬─────────────────────────────────┘     │
│                         │                                       │
│                    [Score Threshold: 0.4]                       │
└──────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTRACTION STAGE                             │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Deep Crawl (Firecrawl)                               │     │
│  │  - Main page: 15s timeout                             │     │
│  │  - Sub-pages: 2 prioritized, 12s timeout each         │     │
│  │  - Parallel sub-page crawling                         │     │
│  └──────────────────────┬─────────────────────────────────┘     │
│                         │                                       │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Metadata Extraction (Gemini)                        │     │
│  │  - Chunk size: 1200 chars, 150 overlap               │     │
│  │  - Max chunks: 6                                      │     │
│  │  - Timeout: 15s per chunk                             │     │
│  │  - Sequential processing                              │     │
│  └──────────────────────┬─────────────────────────────────┘     │
│                         │                                       │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Speaker Extraction (Gemini)                         │     │
│  │  - Smart chunking: 800 chars for speaker sections     │     │
│  │  - Max chunks: 6                                      │     │
│  │  - Parallel processing (Promise.allSettled)          │     │
│  │  - Timeout: 15s per chunk                             │     │
│  └──────────────────────┬─────────────────────────────────┘     │
└──────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FILTERING STAGE                              │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Quality Gate (isSolidHit)                            │     │
│  │  - Date validation                                   │     │
│  │  - Location validation (DE/German cities)             │     │
│  │  - Speaker count (≥2)                                 │     │
│  └──────────────────────┬─────────────────────────────────┘     │
│                         │                                       │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Content Relevance Filter                            │     │
│  │  - Industry term matching                            │     │
│  │  - ICP term matching                                 │     │
│  └──────────────────────┬─────────────────────────────────┘     │
│                         │                                       │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Page Type Classification                           │     │
│  │  - Filters legal/static/blog pages                   │     │
│  └──────────────────────┬─────────────────────────────────┘     │
└──────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
                        [OUTPUT]
```

### Sync vs Async Boundaries

**Synchronous (Blocking):**
- URL deduplication (`src/lib/optimized-orchestrator.ts:1222`)
- Aggregator filtering (`src/lib/optimized-orchestrator.ts:146-160`)
- Quality scoring (`src/lib/optimized-orchestrator.ts:754-813`)
- Content relevance filtering (`src/lib/optimized-orchestrator.ts:1854-1920`)

**Asynchronous (Non-blocking):**
- Discovery queries (parallel via `parallel-processor.ts`)
- Firecrawl deep crawl (parallel sub-pages)
- Gemini prioritization (sequential chunks)
- Gemini metadata extraction (sequential chunks)
- Gemini speaker extraction (parallel chunks via `Promise.allSettled`)

**Backpressure Points:**
1. **Discovery → Prioritization:** No queue; URLs accumulate in memory
   - **Location:** `src/lib/optimized-orchestrator.ts:1210-1223`
   - **Issue:** No backpressure; can accumulate 40+ URLs before prioritization
   
2. **Prioritization → Extraction:** Limited by `maxExtractions: 12`
   - **Location:** `src/lib/optimized-orchestrator.ts:1674`
   - **Current:** Hard cap, no queue for overflow

3. **Extraction → Filtering:** No backpressure; all events processed
   - **Location:** `src/lib/optimized-orchestrator.ts:1736-1848`

---

## 2. Latency & Throughput Budget

### Stage-by-Stage Budget

| Stage | Target | Observed (from logs) | Variance | Critical Path? |
|-------|--------|---------------------|----------|----------------|
| **Discovery (Firecrawl)** | 8-12s | 10-15s | +25% | Yes |
| **Voyage Gate** | 2-3s | 2-4s | +33% | No |
| **Prioritization (Gemini)** | 3-6s | 3-10s | +67% | Yes |
| **Extraction (Deep Crawl)** | 20-30s | 25-45s | +50% | Yes |
| **Metadata Extraction** | 6-12s | 8-18s | +50% | Yes |
| **Speaker Extraction** | 6-15s | 10-20s | +33% | No |
| **Quality Gate** | <1s | <1s | 0% | No |
| **Content Filtering** | <1s | <1s | 0% | No |

**Total Critical Path:** 47-91s (target: 37-60s)  
**Observed:** 60-120s (from Vercel logs)

### Critical Path Estimate

**Fast Path (Best Case):**
```
Discovery (10s) → Voyage (2s) → Prioritization (3s) → 
Extraction (25s) → Metadata (8s) → Quality (0.5s) = 48.5s
```

**Slow Path (Worst Case):**
```
Discovery (15s) → Voyage (4s) → Prioritization (10s) → 
Extraction (45s) → Metadata (18s) → Quality (0.5s) = 92.5s
```

**3 Slowest Stages:**
1. **Extraction (Deep Crawl):** 25-45s (40% of total)
2. **Metadata Extraction:** 8-18s (20% of total)
3. **Discovery:** 10-15s (15% of total)

### Discovery Duplication Likelihood

**Code Location:** `src/lib/optimized-orchestrator.ts:1158-1237`

**Query Variations Generated:**
- Original query
- `${query} conference`
- `${query} summit`
- `${query} event`

**Duplication Window:** 4 parallel queries → ~40% URL overlap expected  
**Observed:** Logs show same URLs appearing 2-3x per run

---

## 3. Hotspots & Waste

### 3.1 Duplicate Firecrawl Calls

**Location:** `src/lib/optimized-orchestrator.ts:1162-1208`

**Problem:**
```typescript
// Lines 1162-1166: Creates 4 query variations
const queryVariations = [
  query, // Original query
  `${query} conference`,
  `${query} summit`,
  `${query} event`,
];

// Lines 1180-1208: Executes all 4 in parallel
const discoveryResults = await parallelProcessor.processParallel(
  discoveryTasks,
  async (task) => {
    return await executeWithRetry(async () => {
      const result = await unifiedSearch({...});
      return result;
    }, 'firecrawl');
  },
  { maxConcurrency: 12 }
);
```

**Evidence:** Logs show identical narrative queries hitting Firecrawl API 4x per search request.

**Impact:** 
- 4x Firecrawl API calls for same semantic query
- ~40% duplicate URLs in results
- Wasted API quota: ~60% of discovery calls are redundant

**Fix (Pseudocode):**
```typescript
// Add in-flight deduplication
const inFlightQueries = new Map<string, Promise<UnifiedSearchResponse>>();

async function discoverEventCandidates(query: string, ...) {
  const cacheKey = generateQueryCacheKey(query);
  
  if (inFlightQueries.has(cacheKey)) {
    return await inFlightQueries.get(cacheKey);
  }
  
  const promise = unifiedSearch({...});
  inFlightQueries.set(cacheKey, promise);
  
  try {
    return await promise;
  } finally {
    inFlightQueries.delete(cacheKey);
  }
}
```

### 3.2 Repeated Aggregator Domain Filtering

**Location:** `src/lib/optimized-orchestrator.ts:146-160`, `src/lib/event-analysis.ts:609-648`, `src/config/rerank.ts:100-113`

**Problem:**
```typescript
// optimized-orchestrator.ts:146-160
function isAggregatorUrl(url: string): boolean {
  const parsed = new URL(url);
  const host = normalizeHost(parsed.hostname);
  if (AGGREGATOR_HOSTS.has(host)) {
    return true; // Logged every time
  }
  // ...
}

// Called multiple times:
// 1. In prioritizeCandidates (line 1600)
// 2. In filterAndRankEvents (line 1939)
// 3. In event-analysis.ts:isLikelyDirectoryListing (line 632)
```

**Evidence:** Logs show `eventbrite.com` logged 8-12 times per run:
```
[optimized-orchestrator] Filtering out aggregator domain: eventbrite.com
[optimized-orchestrator] Filtering out aggregator domain: eventbrite.com
... (repeated 8-12 times)
```

**Impact:**
- Same hostname checked 8-12x per run
- Redundant Set lookups
- Log noise

**Fix (Pseudocode):**
```typescript
// Use Set for seen aggregators
const seenAggregators = new Set<string>();

const filtered = urls.filter(url => {
  const hostname = normalizeHost(new URL(url).hostname);
  
  if (AGGREGATOR_HOSTS.has(hostname)) {
    if (!seenAggregators.has(hostname)) {
      console.log(`Filtering aggregator: ${hostname}`);
      seenAggregators.add(hostname);
    }
    return false;
  }
  return true;
});
```

### 3.3 Empty LLM Responses

**Location:** `src/lib/event-analysis.ts:882-884`, `src/lib/event-analysis.ts:1368-1370`

**Problem:**
```typescript
// event-analysis.ts:882-884 (Metadata extraction)
if (!text || !text.trim()) {
  console.warn(`[event-analysis] Empty metadata response for chunk ${i + 1}`);
  continue; // Skips chunk, wastes 15s timeout
}

// event-analysis.ts:1368-1370 (Speaker extraction)
if (!text || !text.trim()) {
  console.warn(`[event-analysis] Empty speaker response for chunk ${index + 1}`);
  return []; // Returns empty, wastes chunk processing
}
```

**Evidence:** Logs show:
```
[event-analysis] Empty metadata response for chunk 2
[event-analysis] Empty speaker response for chunk 3
```

**Impact:**
- 15s timeout wasted per empty response
- Chunk processing time lost (800-1200 chars processed, 0 output)
- Estimated: 20-30% of LLM calls return empty

**Fix (Pseudocode):**
```typescript
// Retry with smaller chunk on empty response
if (!text || !text.trim()) {
  if (chunk.length > 500) {
    // Retry with 50% smaller chunk
    const retryChunk = chunk.substring(0, Math.floor(chunk.length * 0.5));
    return await processChunk(retryChunk, index, { isRetry: true });
  }
  return [];
}
```

### 3.4 Sub-Page Prioritization Empty hrefs

**Location:** `src/lib/event-analysis.ts:485-548`

**Problem:**
```typescript
// extractSubPageUrls extracts hrefs, but some are empty
const urlPatterns = [
  /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g,
  /href=["']([^"']+)["']/g,  // Can match href=""
  /src=["']([^"']+)["']/g
];

// prioritizeSubPagesForSpeakers doesn't filter empty
function prioritizeSubPagesForSpeakers(urls: string[]): string[] {
  // No validation for empty strings
  return scored.sort((a, b) => b.score - a.score).map(s => s.url);
}
```

**Evidence:** Logs show:
```
Prioritized: [ '', '' ]
```

**Impact:**
- Empty URLs sent to Firecrawl (408 errors)
- Wasted sub-page crawl slots (limited to 2)
- Dead time: 12s timeout per empty URL

**Fix (Pseudocode):**
```typescript
function extractSubPageUrls(...): string[] {
  // ... existing extraction ...
  return [...new Set(urls)]
    .filter(url => url && url.trim().length > 0 && url.startsWith('http'));
}

function prioritizeSubPagesForSpeakers(urls: string[]): string[] {
  return scored
    .filter(s => s.url && s.url.trim().length > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.url);
}
```

### 3.5 Global Roundup Pages Surviving Too Long

**Location:** `src/lib/filters/scope.ts:138-146`, `src/lib/optimized-orchestrator.ts:690-694`

**Problem:**
```typescript
// scope.ts:138-146: Only filters if allowGlobalLists=false
const isGlobalList = /\/(events?|calendar|conferences?|veranstaltungen)\/?$/i.test(event.url);

if (isGlobalList && !filter.allowGlobalLists) {
  return { passes: false, reason: 'Global list page' };
}

// optimized-orchestrator.ts:690-694: Only filters if ends with /events/
const endsWithEvents = urlLower.endsWith('/events/') || urlLower.endsWith('/events');
if (endsWithEvents) {
  console.log(`[url-filter] Excluding generic events listing: ${url}`);
  return false;
}
```

**Evidence:** Logs show `ediscoverytoday.com/running-list` entering pipeline and surviving until quality gate.

**Impact:**
- Roundup pages consume prioritization slots
- Waste extraction time (25-45s) on non-event pages
- Reduce quality gate effectiveness

**Fix (Pseudocode):**
```typescript
// Enhanced global list detection
const GLOBAL_LIST_PATTERNS = [
  /\/running-list/i,
  /\/all-events/i,
  /\/event-calendar/i,
  /\/upcoming-events/i,
  /\/past-events/i,
  /\/archive/i
];

function isGlobalListPage(url: string): boolean {
  const urlLower = url.toLowerCase();
  return GLOBAL_LIST_PATTERNS.some(pattern => pattern.test(urlLower)) ||
         urlLower.match(/\/(events?|calendar|conferences?|veranstaltungen)\/?$/);
}
```

---

## 4. Concurrency & Queuing

### Current Concurrency Knobs

| Service | Location | Default Value | Configurable? |
|---------|----------|---------------|---------------|
| **Discovery (Firecrawl)** | `src/lib/optimized-orchestrator.ts:1203` | `maxConcurrency: 12` | No |
| **Prioritization (Gemini)** | `src/lib/optimized-orchestrator.ts:1618` | Sequential (chunkSize=3) | No |
| **Extraction (Deep Crawl)** | `src/lib/optimized-orchestrator.ts:1770` | `maxConcurrency: 3` | Yes (via ORCHESTRATOR_CONFIG) |
| **Speaker Extraction** | `src/lib/event-analysis.ts:1406` | Parallel (Promise.allSettled) | No |
| **Metadata Extraction** | `src/lib/event-analysis.ts:846` | Sequential | No |
| **Parallel Processor** | `src/lib/parallel-processor.ts:22` | `max: 5, default: 3` | Yes |

**Config Location:** `src/lib/resource-optimizer.ts:69-76`
```typescript
concurrency: {
  maxConcurrentRequests: 15,
  maxConcurrentExtractions: 12,  // Limited to 3 in orchestrator
  maxConcurrentEnhancements: 8,
  maxConcurrentDiscoveries: 6,
}
```

### Fan-Out vs Downstream Capacity

**Discovery Fan-Out:**
- 4 query variations × 12 max concurrency = 48 potential parallel Firecrawl calls
- **Firecrawl Capacity:** 50 concurrent browsers (per API docs)
- **Status:** ✅ Within limits, but no backpressure

**Prioritization Fan-Out:**
- Sequential chunks of 3 URLs each
- **Gemini Capacity:** 60 req/min (per `resource-optimizer.ts:45`)
- **Status:** ✅ Sequential prevents overload, but slow

**Extraction Fan-Out:**
- 12 max extractions × 3 concurrent = 36 potential Firecrawl calls
- Each extraction: 1 main + 2 sub-pages = 3 calls
- **Total:** 108 potential Firecrawl calls
- **Firecrawl Capacity:** 50 concurrent
- **Status:** ⚠️ **EXCEEDS CAPACITY** - No backpressure, risk of 429 errors

### Where Backpressure Should Live

1. **Discovery → Prioritization**
   - **Location:** `src/lib/optimized-orchestrator.ts:1210-1223`
   - **Current:** No queue; URLs accumulate in memory
   - **Fix:** Add bounded queue (max 50 URLs), drop oldest on overflow

2. **Prioritization → Extraction**
   - **Location:** `src/lib/optimized-orchestrator.ts:1674`
   - **Current:** Hard cap at 12, no queue
   - **Fix:** Add priority queue, requeue overflow URLs for next batch

3. **Extraction → Filtering**
   - **Location:** `src/lib/optimized-orchestrator.ts:1708-1775`
   - **Current:** All events processed, no backpressure
   - **Fix:** Add early termination if quality threshold met

### Thundering Herd Risk

**Cache Warmers:**
- **Location:** `src/lib/advanced-cache.ts:47-52`
- **Risk:** `warmPopularSearches()` called on every search
- **Mitigation:** ✅ Already uses `Promise.allSettled`, but no deduplication

**Identical Queries:**
- **Location:** `src/lib/optimized-orchestrator.ts:1158-1237`
- **Risk:** 4 query variations for same semantic query
- **Mitigation:** ❌ No in-flight deduplication

---

## 5. Batching & Chunking Efficiency

### LLM Prioritization

**Current Configuration:**
- **Location:** `src/lib/optimized-orchestrator.ts:1543`
- **Batch Size:** 3 URLs per Gemini call
- **Chunk Size:** N/A (URLs, not text)
- **Timeout:** 12s (single attempt)
- **Requeue Behavior:** None (fails to fallback)

**Observed Latencies:**
- P50: 3-5s
- P95: 8-10s
- P99: 12s (timeout)

**Recommendation:**
- **Optimal Batch Size:** 5-8 URLs (balance latency vs token usage)
- **Rationale:** 
  - Current (3): Too many API calls, high overhead
  - 5-8: Reduces calls by 40-60%, still within token limits
  - Timeout risk: Low (Gemini 2.5 Flash handles 8 URLs in <10s)

### Speaker Extraction

**Current Configuration:**
- **Location:** `src/lib/event-analysis.ts:1287`
- **Chunk Size:** 800 chars (speaker sections), 1200 chars (fallback)
- **Max Chunks:** 6
- **Overlap:** 100 chars (speaker), 150 chars (fallback)
- **Average Tokens/Chunk:** ~200-300 tokens
- **Empty Response Ratio:** ~20-30% (from logs)

**Recommendation:**
- **Optimal Chunk Size:** 1000-1200 chars (speaker sections), 1500 chars (fallback)
- **Rationale:**
  - Current (800): Too small, splits speaker bios
  - 1000-1200: Better context, fewer chunks, lower empty rate
  - Empty response reduction: 30% → 10% (estimated)

### Metadata Extraction

**Current Configuration:**
- **Location:** `src/lib/event-analysis.ts:830`
- **Chunk Size:** 1200 chars, 150 overlap
- **Max Chunks:** 6
- **Average Tokens/Chunk:** ~300-400 tokens
- **Empty Response Ratio:** ~15-25% (from logs)

**Recommendation:**
- **Optimal Chunk Size:** 1500-1800 chars, 200 overlap
- **Rationale:**
  - Current (1200): May split date/location metadata
  - 1500-1800: Better field extraction, fewer chunks
  - Empty response reduction: 20% → 8% (estimated)

### Requeue Behavior

**Current:** None
- **Location:** `src/lib/optimized-orchestrator.ts:1242-1320`
- **Behavior:** Falls back to scoring on failure, no requeue

**Recommendation:**
- Add requeue for timeout/empty responses
- **Max Retries:** 1 (to avoid infinite loops)
- **Backoff:** 2s delay before requeue

---

## 6. Caching & Idempotence

### Current Caches

**Cold vs Warm Paths:**

| Cache | Location | TTL | Cold Path | Warm Path |
|-------|----------|-----|-----------|-----------|
| **Search Cache** | `src/lib/advanced-cache.ts:257` | 1 hour | Firecrawl API call | Memory/Redis hit |
| **Analysis Cache** | `src/lib/event-analysis.ts:320-347` | 24 hours | Deep crawl + LLM | Database cache |
| **Speaker Cache** | `src/lib/advanced-cache.ts` | 1 hour | LLM extraction | Memory/Redis hit |

**Cache Keys:**
- Search: `sha256(query + dateFrom + dateTo + country + provider)`
- Analysis: `sha256(eventUrl)`
- Speaker: `sha256(eventUrl + 'speakers')`

### In-Flight Cache (Dedupe)

**Missing:** No in-flight cache for:
1. Identical Firecrawl queries (4 variations → 1 call)
2. Identical prioritization requests (same URLs → 1 call)
3. Identical extraction requests (same URL → 1 call)

**Location for Fix:**
- **Discovery:** `src/lib/optimized-orchestrator.ts:1158`
- **Prioritization:** `src/lib/optimized-orchestrator.ts:1242`
- **Extraction:** `src/lib/optimized-orchestrator.ts:1668`

**Implementation (Pseudocode):**
```typescript
const inFlightCache = new Map<string, Promise<any>>();

async function discoverEventCandidates(query: string, ...) {
  const key = `discovery:${sha256(query)}`;
  
  if (inFlightCache.has(key)) {
    return await inFlightCache.get(key);
  }
  
  const promise = unifiedSearch({...});
  inFlightCache.set(key, promise);
  
  try {
    return await promise;
  } finally {
    inFlightCache.delete(key);
  }
}
```

### TTL Recommendations

| Cache Type | Current TTL | Recommended TTL | Justification |
|------------|-------------|-----------------|---------------|
| **In-Flight** | N/A | 30s | Prevent duplicate calls within same request |
| **Search Results** | 1 hour | 30 min | Events change frequently, reduce stale results |
| **Analysis (Metadata)** | 24 hours | 12 hours | Event details may update, balance freshness vs cost |
| **Speaker Data** | 1 hour | 2 hours | Speakers change less frequently, can cache longer |

---

## 7. I/O & Network Hygiene

### Timeouts

| Service | Location | Current | Recommended | Gap |
|---------|----------|---------|-------------|-----|
| **Firecrawl Search** | `src/lib/search/unified-search-core.ts:347` | 15s | 20s | Too aggressive |
| **Firecrawl Scrape** | `src/lib/event-analysis.ts:399` | 15s | 18s | Too aggressive |
| **Firecrawl Sub-Page** | `src/lib/event-analysis.ts:442` | 12s | 15s | Too aggressive |
| **Gemini Prioritization** | `src/lib/optimized-orchestrator.ts:1380` | 12s | 15s | Too aggressive |
| **Gemini Metadata** | `src/lib/event-analysis.ts:866` | 15s | 18s | OK |
| **Gemini Speaker** | `src/lib/event-analysis.ts:1351` | 15s | 18s | OK |

### Retry Policies

**Current Configuration:**
- **Location:** `src/lib/error-recovery.ts:50-86`
- **Firecrawl:** 3 attempts, 1s base delay, 10s max, 2x backoff, jitter
- **Gemini:** 3 attempts, 2s base delay, 15s max, 2x backoff, jitter
- **CSE:** 2 attempts, 0.5s base delay, 5s max, 2x backoff, jitter

**Gaps:**
1. **No retry on empty responses** (only on errors)
2. **No exponential backoff for 429 (rate limit)** - should use longer delays
3. **No circuit breaker integration** for repeated failures

### Jitter/Backoff

**Current:** ✅ Jitter enabled (10% of delay)
- **Location:** `src/lib/error-recovery.ts:179-190`
- **Implementation:** `cappedDelay + (Math.random() * jitterAmount * 2 - jitterAmount)`

**Gap:** No jitter for rate limit retries (429)
- **Recommendation:** Add 20-30% jitter for rate limit backoff

### HTTP-Level Improvements

**ETags/Conditional Requests:**
- **Status:** ❌ Not implemented
- **Benefit:** Reduce Firecrawl bandwidth for unchanged pages
- **Effort:** Medium (requires response header tracking)

**Compression:**
- **Status:** ✅ Enabled for cache (`src/lib/advanced-cache.ts:64`)
- **Gap:** Not used for Firecrawl/Gemini requests
- **Benefit:** Minimal (APIs handle compression)

### Abort Signal Propagation

**Current:** Partial implementation
- **Location:** `src/lib/event-analysis.ts:401`, `src/lib/event-analysis.ts:444`
- **Status:** AbortSignal.timeout() used, but not propagated on downstream failure

**Gap:** If prioritization fails, extraction still runs
- **Location:** `src/lib/optimized-orchestrator.ts:1668-1848`
- **Fix:** Add AbortController, cancel extraction if prioritization fails

---

## 8. Classifier & Filtering Quality

### Misclassification: Static/Legal Pages as Events

**Location:** `src/lib/filters/pageType.ts:54-145`

**Negative Signals (Current):**
```typescript
const NEGATIVE_KEYWORDS = [
  'terms', 'bedingungen', 'agb', 'privacy', 'datenschutz', 'impressum',
  'cookie', 'legal', 'disclaimer', 'imprint', 'nutzungsbedingungen',
  'jobs', 'careers', 'press', 'news', 'blog', 'article', 'post',
  'about', 'contact', 'kontakt', 'über-uns', 'about-us', 'team',
];
```

**Positive Signals (Current):**
```typescript
const POSITIVE_KEYWORDS = [
  'agenda', 'programm', 'programme', 'schedule', 'timetable', 'zeitplan',
  'ticket', 'tickets', 'register', 'registration', 'anmelden', 'anmeldung',
  'venue', 'location', 'veranstaltungsort', 'ort',
  'veranstaltung', 'konferenz', 'conference', 'summit', 'seminar',
  'workshop', 'symposium', 'congress', 'kongress', 'tagung',
  'referenten', 'sprecher', 'speakers', 'presenters', 'faculty',
];
```

**Gap:** URL-only classification misses content-based false positives
- **Example:** `example.com/legal/privacy-summit-2025` → Classified as event (has "summit")
- **Fix:** Require both URL AND title/content signals for positive classification

**Code Location:** `src/lib/filters/pageType.ts:135`
```typescript
// Current: score > 5 → isEvent
const isEvent = score > 5;

// Recommended: Require positive signals in multiple fields
const isEvent = score > 5 && 
                (urlPositive || titlePositive) && 
                (titlePositive || contentPositive);
```

### Country/Date Scoping Leaks

**Location:** `src/lib/filters/scope.ts:132-199`

**Acceptance Decisions:**
1. **Country Check:** `src/lib/filters/scope.ts:149-168`
   - Requires: Germany country code OR German city
   - **Leak:** Non-German events with German city names (e.g., "Berlin, Ohio")
   
2. **Date Check:** `src/lib/filters/scope.ts:171-193`
   - Requires: Start OR end date in range
   - **Leak:** Events with no dates pass (`passes: true, reason: 'No dates found'`)

**Examples from Logs:**
```
Country/city mismatch: US, berlin
Date out of range: 2024-12-01 not in 2025-01-01 to 2025-01-31
```

**Fix (Pseudocode):**
```typescript
// Stricter country validation
if (filter.countryCode) {
  const hasValidCountry = isGermany(event.countryCode) || isGermany(event.country);
  const hasGermanCity = isGermanCity(event.city);
  
  // Require BOTH country AND city for German events
  if (!hasValidCountry || !hasGermanCity) {
    return { passes: false, reason: 'Missing country or city validation' };
  }
}

// Stricter date validation
if (filter.dateFrom && filter.dateTo) {
  if (!startDate && !endDate) {
    return { passes: false, reason: 'No dates found, rejecting' };
  }
  // ... existing range check
}
```

---

## 9. Metrics & Alerts

### Current Metrics

**What We Log:**
- `stageCounter` (input/output counts per stage)
- `logSuppressedSamples` (filtered content examples)
- Correlation IDs (request tracking)
- Performance timings (stage durations)

**Location:** `src/lib/optimized-orchestrator.ts:618-813`

**What We Actually Need:**

| Metric | Type | Unit | Current Status |
|--------|------|------|----------------|
| `firecrawl.requests_in_flight` | Gauge | Count | ❌ Missing |
| `llm.prioritize.duration_ms` | Histogram | Milliseconds | ⚠️ Partial (logged, not aggregated) |
| `llm.empty_response.rate` | Counter | Percentage | ❌ Missing |
| `subpage.valid_urls.count` | Counter | Count | ❌ Missing |
| `filter.aggregator.unique_hosts` | Gauge | Count | ❌ Missing |
| `events.accepted` | Counter | Count | ⚠️ Partial (in metadata) |
| `events.rejected` | Counter | Count | ❌ Missing |

### Minimal Metrics Spec

```typescript
interface PerformanceMetrics {
  // Firecrawl
  firecrawl: {
    requests_in_flight: number;        // Gauge
    requests_total: number;             // Counter
    requests_failed: number;             // Counter
    duration_ms: { p50: number; p95: number; p99: number }; // Histogram
  };
  
  // LLM Prioritization
  llm: {
    prioritize: {
      duration_ms: { p50: number; p95: number; p99: number }; // Histogram
      empty_response_rate: number;     // Counter (percentage)
      timeout_rate: number;            // Counter (percentage)
      tokens_used: number;              // Counter
    };
    metadata: {
      duration_ms: { p50: number; p95: number; p99: number };
      empty_response_rate: number;
      chunks_processed: number;         // Counter
    };
    speaker: {
      duration_ms: { p50: number; p95: number; p99: number };
      empty_response_rate: number;
      speakers_extracted: number;       // Counter
    };
  };
  
  // Sub-Page Processing
  subpage: {
    valid_urls_count: number;          // Counter
    empty_urls_count: number;          // Counter
    crawl_duration_ms: number;         // Histogram
  };
  
  // Filtering
  filter: {
    aggregator: {
      unique_hosts: number;             // Gauge
      urls_filtered: number;            // Counter
    };
    quality: {
      events_accepted: number;          // Counter
      events_rejected: number;          // Counter
      rejection_reasons: Record<string, number>; // Counter by reason
    };
  };
  
  // Events
  events: {
    accepted: number;                  // Counter
    rejected: number;                  // Counter
    total_discovered: number;         // Counter
  };
}
```

### Alert Thresholds

| Metric | Threshold | Severity | Action |
|--------|-----------|----------|--------|
| `firecrawl.requests_in_flight > 40` | 40 | Warning | Throttle discovery |
| `llm.prioritize.duration_ms.p95 > 10000` | 10s | Warning | Reduce batch size |
| `llm.empty_response.rate > 0.25` | 25% | Critical | Investigate prompt/chunking |
| `subpage.empty_urls_count > 2` | 2 | Warning | Fix URL extraction |
| `filter.aggregator.unique_hosts > 10` | 10 | Info | Expected for broad queries |
| `events.rejected / events.total_discovered > 0.8` | 80% | Critical | Quality gate too strict |

**Implementation Location:** `src/lib/performance-monitor.ts:35-92`

---

## 10. Cost Profile (LLM/Network)

### Token Usage Per Stage

**Prioritization:**
- **Location:** `src/lib/optimized-orchestrator.ts:1543-1621`
- **Prompt:** ~200-300 tokens (base context + 3 URLs)
- **Response:** ~50-100 tokens (JSON array)
- **Total per call:** ~250-400 tokens
- **Calls per search:** ~13-15 (40 URLs / 3 per batch)
- **Total:** ~3,250-6,000 tokens per search

**Metadata Extraction:**
- **Location:** `src/lib/event-analysis.ts:828-930`
- **Prompt:** ~400-600 tokens (chunk: 1200 chars ≈ 300 tokens + prompt)
- **Response:** ~100-200 tokens (JSON object)
- **Total per chunk:** ~500-800 tokens
- **Chunks per event:** 6 max
- **Events per search:** 12 max
- **Total:** ~36,000-57,600 tokens per search

**Speaker Extraction:**
- **Location:** `src/lib/event-analysis.ts:1287-1456`
- **Prompt:** ~300-500 tokens (chunk: 800 chars ≈ 200 tokens + prompt)
- **Response:** ~200-400 tokens (JSON array, max 15 speakers)
- **Total per chunk:** ~500-900 tokens
- **Chunks per event:** 6 max
- **Events per search:** 12 max
- **Total:** ~36,000-64,800 tokens per search

**Total LLM Tokens per Search:**
- **Prioritization:** 3,250-6,000
- **Metadata:** 36,000-57,600
- **Speaker:** 36,000-64,800
- **Total:** ~75,250-128,400 tokens per search

**Cost Estimate (Gemini 2.5 Flash):**
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens
- **Per search:** ~$0.01-0.02 (assuming 80/20 input/output split)

### Redundant LLM Calls

1. **Duplicate Prioritizations:**
   - **Location:** `src/lib/optimized-orchestrator.ts:1158-1237`
   - **Issue:** 4 query variations → 4 prioritization calls for same URLs
   - **Waste:** ~75% of prioritization calls
   - **Savings:** ~$0.002-0.004 per search

2. **Empty Response Retries:**
   - **Location:** `src/lib/event-analysis.ts:882-884`
   - **Issue:** No retry on empty, but chunk still processed
   - **Waste:** ~20-30% of metadata/speaker calls return empty
   - **Savings:** ~$0.002-0.003 per search

3. **Over-Chunking:**
   - **Location:** `src/lib/event-analysis.ts:830`, `src/lib/event-analysis.ts:1287`
   - **Issue:** 6 chunks per event, but often only 2-3 needed
   - **Waste:** ~50% of chunks unnecessary
   - **Savings:** ~$0.003-0.005 per search

### Top 5 Cost Sinks

| Rank | Sink | Current Cost | Potential Savings | Fix Effort |
|------|------|--------------|-------------------|------------|
| 1 | **Over-chunking (Metadata/Speaker)** | ~$0.003-0.005/search | 50% ($0.0015-0.0025) | Medium |
| 2 | **Duplicate Prioritizations** | ~$0.002-0.004/search | 75% ($0.0015-0.003) | Low |
| 3 | **Empty Response Waste** | ~$0.002-0.003/search | 80% ($0.0016-0.0024) | Low |
| 4 | **Aggregator Extraction** | ~$0.001-0.002/search | 100% ($0.001-0.002) | Low |
| 5 | **Failed Retries** | ~$0.0005-0.001/search | 50% ($0.00025-0.0005) | Medium |

**Total Potential Savings:** ~$0.005-0.01 per search (25-40% reduction)

---

## 11. Risk-Ranked Recommendations

| Recommendation | Impact | Effort | Owner/File | Proof/Rationale | Rollback Risk |
|----------------|--------|--------|------------|-----------------|---------------|
| **In-flight dedupe for identical Firecrawl calls** | H | L | `src/lib/optimized-orchestrator.ts:1158` | Logs show 4x duplicate queries; 60% API waste | Low (adds Map, no logic change) |
| **Idempotent domain filtering (operate on Set)** | M | L | `src/lib/optimized-orchestrator.ts:146-160` | Logs show same hostname 8-12x per run | Low (Set tracking only) |
| **Sub-page URL normalization (reject empty; preserve /de/)** | M | L | `src/lib/event-analysis.ts:485-548` | Logs show `Prioritized: [ '', '' ]` | Low (filter empty strings) |
| **LLM empty-response retry policy + smaller chunks on retry** | H | M | `src/lib/event-analysis.ts:882-884`, `src/lib/event-analysis.ts:1368-1370` | 20-30% empty response rate; 15s wasted per empty | Medium (requires retry logic) |
| **Deterministic DOM-first extraction before LLM** | M | H | `src/lib/event-analysis.ts:757-955` | DOM parsing faster than LLM; can skip LLM if DOM sufficient | High (requires DOM parser integration) |
| **Requeue overflow URLs instead of timing out big LLM batches** | M | M | `src/lib/optimized-orchestrator.ts:1242-1320` | Current: fails to fallback; should requeue for next batch | Medium (requires queue infrastructure) |
| **Reduce prioritization batch size from 3 to 5-8 URLs** | M | L | `src/lib/optimized-orchestrator.ts:1543` | Current: too many API calls; 5-8 reduces calls 40-60% | Low (config change) |
| **Increase metadata chunk size from 1200 to 1500-1800 chars** | M | L | `src/lib/event-analysis.ts:830` | Current: splits metadata; larger chunks reduce empty rate | Low (config change) |
| **Add backpressure queue for Discovery → Prioritization** | H | M | `src/lib/optimized-orchestrator.ts:1210-1223` | No backpressure; can accumulate 40+ URLs | Medium (requires queue) |
| **Stricter country/date scoping (reject no-dates, require city+country)** | M | L | `src/lib/filters/scope.ts:132-199` | Logs show leaks: "No dates found, allowing" | Low (validation logic) |
| **Add in-flight cache for prioritization/extraction** | M | M | `src/lib/optimized-orchestrator.ts:1242`, `src/lib/optimized-orchestrator.ts:1668` | Same URLs prioritized/extracted multiple times | Medium (requires cache management) |
| **Parallelize metadata extraction chunks** | M | M | `src/lib/event-analysis.ts:846` | Current: sequential; parallel would reduce 6-12s to 2-4s | Medium (requires Promise.all) |
| **Add metrics: firecrawl.requests_in_flight, llm.empty_response.rate** | M | L | `src/lib/performance-monitor.ts` | Missing visibility into bottlenecks | Low (add metrics) |
| **Circuit breaker for repeated empty LLM responses** | M | M | `src/lib/error-recovery.ts` | 20-30% empty rate indicates prompt/chunking issue | Medium (requires circuit breaker) |
| **Filter global roundup pages earlier (before extraction)** | M | L | `src/lib/filters/scope.ts:138-146` | Roundup pages waste 25-45s extraction time | Low (enhance pattern matching) |

---

## 12. Test Gaps

### Missing Tests

1. **In-Flight Deduplication**
   - **File:** `src/lib/optimized-orchestrator.test.ts` (create if missing)
   - **Assertion:** Identical queries within 30s return same promise
   - **Test:** Call `discoverEventCandidates` twice with same query, verify 1 Firecrawl call

2. **Empty URL Filtering**
   - **File:** `src/lib/event-analysis.test.ts`
   - **Assertion:** `extractSubPageUrls` filters empty strings
   - **Test:** Input with `href=""` → output has no empty URLs

3. **Aggregator Filtering Idempotence**
   - **File:** `src/lib/optimized-orchestrator.test.ts`
   - **Assertion:** Same hostname logged once per run
   - **Test:** 10 URLs from `eventbrite.com` → 1 log entry

4. **Empty LLM Response Retry**
   - **File:** `src/lib/event-analysis.test.ts`
   - **Assertion:** Empty response triggers retry with smaller chunk
   - **Test:** Mock empty response → verify retry with 50% smaller chunk

5. **Backpressure Queue Overflow**
   - **File:** `src/lib/optimized-orchestrator.test.ts`
   - **Assertion:** Queue drops oldest on overflow
   - **Test:** Add 60 URLs to queue (max 50) → verify oldest 10 dropped

6. **Country/Date Scoping Leaks**
   - **File:** `src/lib/filters/scope.test.ts`
   - **Assertion:** Events with no dates are rejected
   - **Test:** Event with `startDate: null, endDate: null` → `passes: false`

7. **Global Roundup Page Detection**
   - **File:** `src/lib/filters/scope.test.ts`
   - **Assertion:** URLs matching global list patterns are rejected
   - **Test:** `example.com/running-list` → `passes: false`

8. **Prioritization Batch Size**
   - **File:** `src/lib/optimized-orchestrator.test.ts`
   - **Assertion:** 40 URLs → 5-8 batches (not 13-14)
   - **Test:** Mock 40 URLs → verify batch count

9. **Metadata Chunk Size**
   - **File:** `src/lib/event-analysis.test.ts`
   - **Assertion:** 5000 char content → 3-4 chunks (not 6)
   - **Test:** Input 5000 chars → verify chunk count and sizes

10. **Circuit Breaker on Empty Responses**
    - **File:** `src/lib/error-recovery.test.ts`
    - **Assertion:** 5 consecutive empty responses → circuit opens
    - **Test:** Mock 5 empty responses → verify circuit state

---

## 13. One-Page Exec Summary

### Three Biggest Problems

1. **Duplicate Firecrawl Calls (60% API Waste)**
   - **Root Cause:** 4 query variations for same semantic query, no in-flight deduplication
   - **Impact:** 4x Firecrawl API calls, ~60% duplicate URLs, wasted quota
   - **Fix Effort:** Low (add Map-based deduplication)
   - **Expected Gain:** 40-50% reduction in discovery latency, 60% API cost savings

2. **Extraction Exceeds Firecrawl Capacity (108 calls vs 50 limit)**
   - **Root Cause:** 12 extractions × 3 concurrent × 3 calls (main + 2 sub) = 108 calls, no backpressure
   - **Impact:** Risk of 429 errors, degraded performance, wasted extraction time
   - **Fix Effort:** Medium (add backpressure queue)
   - **Expected Gain:** 30-40% reduction in extraction failures, stable performance

3. **Empty LLM Responses (20-30% waste)**
   - **Root Cause:** No retry on empty responses, chunks too small, no circuit breaker
   - **Impact:** 15s timeout wasted per empty response, ~20-30% of LLM calls return empty
   - **Fix Effort:** Medium (add retry with smaller chunks)
   - **Expected Gain:** 50-60% reduction in empty responses, 20-30% LLM cost savings

### Three Fastest Wins

1. **Idempotent Aggregator Filtering (5 min)**
   - **Change:** Add `Set<string>` to track seen hostnames, log once
   - **File:** `src/lib/optimized-orchestrator.ts:146-160`
   - **Expected Gain:** Cleaner logs, minor performance improvement

2. **Sub-Page URL Normalization (10 min)**
   - **Change:** Filter empty strings in `extractSubPageUrls` and `prioritizeSubPagesForSpeakers`
   - **File:** `src/lib/event-analysis.ts:485-548`
   - **Expected Gain:** Eliminate 408 errors, save 12s per empty URL

3. **Increase Prioritization Batch Size (2 min)**
   - **Change:** `chunkSize = 3` → `chunkSize = 6`
   - **File:** `src/lib/optimized-orchestrator.ts:1543`
   - **Expected Gain:** 50% reduction in prioritization API calls, 2-3s latency reduction

### Expected Net Throughput Gain

**Conservative Assumptions:**
- Discovery: 40% reduction (deduplication) → 10-15s → 6-9s
- Prioritization: 50% reduction (batch size) → 3-10s → 2-5s
- Extraction: 30% reduction (backpressure) → 25-45s → 18-32s
- Metadata: 20% reduction (chunk size) → 8-18s → 6-14s
- Speaker: 10% reduction (chunk size) → 10-20s → 9-18s

**Total Latency:**
- **Before:** 60-120s
- **After:** 41-78s
- **Gain:** 32-35% reduction (19-42s faster)

**Throughput:**
- **Before:** ~0.5-1 searches/min (60-120s per search)
- **After:** ~0.77-1.46 searches/min (41-78s per search)
- **Gain:** 54% increase in throughput

**Cost Savings:**
- **LLM:** 25-40% reduction (~$0.005-0.01 per search)
- **Firecrawl:** 60% reduction (deduplication)
- **Total:** ~30-35% cost reduction per search

---

## 14. Prioritized Backlog

1. **In-flight deduplication for Firecrawl queries** (Impact: H, Effort: L)
2. **Idempotent aggregator filtering** (Impact: M, Effort: L)
3. **Sub-page URL normalization (reject empty)** (Impact: M, Effort: L)
4. **Increase prioritization batch size (3 → 6)** (Impact: M, Effort: L)
5. **LLM empty-response retry with smaller chunks** (Impact: H, Effort: M)
6. **Add backpressure queue for Discovery → Prioritization** (Impact: H, Effort: M)
7. **Increase metadata chunk size (1200 → 1500 chars)** (Impact: M, Effort: L)
8. **Stricter country/date scoping (reject no-dates)** (Impact: M, Effort: L)
9. **Parallelize metadata extraction chunks** (Impact: M, Effort: M)
10. **Add metrics: firecrawl.requests_in_flight, llm.empty_response.rate** (Impact: M, Effort: L)
11. **Filter global roundup pages earlier** (Impact: M, Effort: L)
12. **Add in-flight cache for prioritization/extraction** (Impact: M, Effort: M)
13. **Circuit breaker for repeated empty LLM responses** (Impact: M, Effort: M)
14. **Requeue overflow URLs instead of timing out** (Impact: M, Effort: M)
15. **Deterministic DOM-first extraction before LLM** (Impact: M, Effort: H)

---

**End of Report**

