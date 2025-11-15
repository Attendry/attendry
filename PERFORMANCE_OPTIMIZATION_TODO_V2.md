# Performance Optimization TODO List - V2 (Updated with Extraction Optimizations)

**Generated from:** PERFORMANCE_ARCHITECTURE_REVIEW.md + PHASE1_FINAL_PERFORMANCE_ANALYSIS.md  
**Date:** 2025-11-15  
**Total Items:** 42 tasks (5 new extraction optimization tasks added)

---

## Phase 1: Critical Fixes (Week 1) - UPDATED
**Expected Impact:** 50-70% reduction in search time, 60-74% reduction in extraction time

### Caching (3 tasks)
- [x] **perf-1.1.1** - Implement Redis/Distributed Cache ✅ **COMPLETED**
  - Replace in-memory Map in `src/app/api/events/search/route.ts` with Redis (Upstash/Vercel KV)
  - Cache key: `search:{query_hash}:{country}:{date_range}`
  - TTL: 6 hours for search results, 24 hours for extracted events

- [x] **perf-1.1.2** - Implement multi-level caching ✅ **COMPLETED**
  - L1: In-memory (5 min TTL)
  - L2: Redis (6 hour TTL)
  - L3: Database (24 hour TTL)
  - Update cache service to check all three levels

- [ ] **perf-1.1.3** - Implement cache warming strategy (Phase 3)
  - Background job to pre-populate cache with common queries
  - Cache-aside pattern with database fallback
  - **FIXED:** Use supabaseAdmin() instead of supabaseServer() for cache warming

### Parallelization (4 tasks)
- [x] **perf-1.3.1** - Parallelize independent database operations ✅ **COMPLETED**
  - In `src/lib/services/search-service.ts runEventDiscovery()`
  - Use `Promise.all()` to load searchConfig and userProfile in parallel

- [x] **perf-1.3.2** - Parallelize search execution and database cache check ✅ **COMPLETED**
  - In `SearchService.executeSearch()`
  - Run `executeSearch()` and `checkDatabaseForEvents()` in parallel

- [x] **perf-2.1.1** - Parallelize search provider attempts ✅ **COMPLETED**
  - In `src/lib/search/unified-search-core.ts unifiedSearch()`
  - Use `Promise.allSettled()` to try Firecrawl, CSE, and database in parallel
  - Use first successful result

- [x] **perf-2.1.2** - Implement smart timeout strategy ✅ **COMPLETED**
  - Firecrawl: 8s timeout
  - CSE: 5s timeout
  - Database: 2s timeout
  - Total max: 8s instead of 60s

### Cache Optimization (2 tasks)
- [x] **perf-2.1.3** - Implement unified cache check ✅ **COMPLETED**
  - Check cache once before trying any provider
  - Cache key includes provider preference
  - Return cached result immediately

- [x] **perf-2.2.1** - Increase extraction concurrency ✅ **COMPLETED**
  - In `src/app/api/events/extract/route.ts`
  - Increase limit from 4 to 12 concurrent extractions
  - Increase targets from 15 to 20 URLs
  - **ALSO FIXED:** `src/lib/optimized-orchestrator.ts` to use adaptive concurrency (12 for small batches)

### Extraction Optimization - NEW (5 tasks) 🔴 **CRITICAL**
**Based on analysis: Extraction taking 38s (5x slower than expected)**

- [ ] **perf-ext-1** - Batch Gemini API calls for metadata extraction 🔴 **CRITICAL**
  - **Location:** `src/lib/event-analysis.ts` - `extractEventMetadata()`
  - **Current:** Processing 4-6 chunks in parallel but each chunk gets its own API call (~8-18s per event)
  - **Fix:** Combine all metadata chunks into single Gemini prompt (Gemini 2.5 Flash supports 1M token context)
  - **Expected:** 8-18s → ~2-3s per event (80-85% faster)
  - **Implementation:**
    - Collect all metadata chunks from all events being processed
    - Create single batch prompt with all chunks labeled by event/chunk index
    - Single Gemini API call with structured JSON response schema
    - Parse response to map results back to correct events/chunks
    - **Note:** Gemini doesn't have native batch API - combine into single prompt
    - **Reference:** Similar to `BatchGeminiService.processUrlPrioritizationBatch()` pattern

- [ ] **perf-ext-2** - Batch Gemini API calls for speaker extraction 🔴 **CRITICAL**
  - **Location:** `src/lib/event-analysis.ts` - `extractAndEnhanceSpeakers()`
  - **Current:** Processing 4-6 chunks in parallel but each chunk gets its own API call (~8-18s per event)
  - **Fix:** Combine all speaker chunks into single Gemini prompt (Gemini 2.5 Flash supports 1M token context)
  - **Expected:** 8-18s → ~2-3s per event (80-85% faster)
  - **Implementation:**
    - Collect all speaker chunks from all events being processed
    - Create single batch prompt with all chunks labeled by event/chunk index
    - Single Gemini API call with structured JSON response schema (already uses `responseSchema`)
    - Parse response to map speakers back to correct events/chunks
    - **Note:** Gemini doesn't have native batch API - combine into single prompt
    - **Reference:** Similar to `BatchGeminiService.processUrlPrioritizationBatch()` pattern

- [ ] **perf-ext-3** - Cache extracted metadata by URL hash 🔴 **CRITICAL**
  - **Location:** `src/lib/optimized-orchestrator.ts` - `extractEventDetails()`
  - **Current:** Re-extracting metadata for same URLs
  - **Fix:** Cache extracted metadata by URL hash with 24 hour TTL
  - **Cache key:** `extracted_metadata:{url_hash}`
  - **Expected:** 38s → ~10s for cached URLs (74% faster)
  - **Implementation:**
    - Hash URL to create cache key
    - Check cache before extraction
    - Store extracted metadata in cache after extraction
    - Use UnifiedCacheService with CACHE_CONFIGS.EXTRACTED_EVENTS

- [ ] **perf-ext-4** - Increase prioritization timeout 🟡 **MEDIUM**
  - **Location:** `src/lib/optimized-orchestrator.ts` - Gemini prioritization
  - **Current:** 12s timeout (too tight, causing timeouts)
  - **Fix:** Increase to 15s with better error handling
  - **Expected:** Reduce timeout failures from ~50% to <5%
  - **Implementation:**
    - Change timeout from 12000ms to 15000ms
    - Add retry logic with exponential backoff
    - Cache prioritization results to avoid repeated calls

- [ ] **perf-ext-5** - Implement early termination for extraction 🟡 **MEDIUM**
  - **Location:** `src/lib/optimized-orchestrator.ts` - `extractEventDetails()`
  - **Current:** Processing all chunks even if enough data found
  - **Fix:** Stop processing once required fields extracted
  - **Expected:** 38s → ~20-25s (35-47% faster)
  - **Implementation:**
    - Track extracted fields per event
    - Stop chunk processing once core fields found (title, date, location)
    - Skip low-priority chunks if time limit approaching
    - Use quality gate to determine if enough data extracted

---

## Phase 2: High Priority (Week 2-3) - UPDATED
**Expected Impact:** 30-40% additional improvement, better scalability, 60-74% extraction improvement

### Database Optimization (6 tasks)
- [ ] **perf-1.2.1** - Increase database connection pool size
  - Update `src/lib/database-pool.ts`
  - Increase maxConnections from 10 to 50
  - Add minConnections: 5
  - Add healthCheckInterval: 30000

- [ ] **perf-1.2.2** - Implement separate connection pools per operation type
  - Read pool: 30 connections
  - Write pool: 10 connections
  - Admin pool: 5 connections

- [ ] **perf-1.2.3** - Add query queuing for database pool
  - Priority queue: search > extraction > analytics
  - Max wait time: 10 seconds before timeout

- [ ] **perf-1.2.4** - Configure Supabase connection pooling
  - Use Supabase pooler connection string
  - Implement transaction mode for read-heavy operations

- [ ] **perf-2.4.1** - Batch database queries
  - Use `Promise.all()` to load search config and user profile in parallel
  - Combine cache lookups into single queries where possible

- [ ] **perf-2.4.2** - Add database indexes
  - `idx_search_cache_key` on `search_cache(cache_key, ttl_at)`
  - `idx_ai_decisions_hash` on `ai_decisions(item_hash)`
  - `idx_url_extractions_normalized` on `url_extractions(url_normalized)`
  - **NEW:** `idx_extracted_metadata_url_hash` on `extracted_metadata(url_hash, expires_at)`

### Extraction Optimization (3 tasks) - UPDATED
- [ ] **perf-2.2.2** - Implement early termination strategy
  - Stop extraction once 10 high-quality events found
  - Use prioritization scores to extract best URLs first
  - Skip low-priority URLs if time limit approaching
  - **ENHANCED:** Also stop chunk processing once core fields extracted

- [ ] **perf-2.2.4** - Implement extraction caching
  - Cache extracted events by URL with 24 hour TTL
  - Skip extraction if URL already cached
  - Background refresh for stale cache entries
  - **ENHANCED:** Cache both metadata and speaker data separately

- [ ] **perf-ext-6** - Optimize chunk processing parallelism 🟡 **NEW**
  - **Location:** `src/lib/event-analysis.ts`
  - **Current:** Chunks processed in parallel but sequentially per event
  - **Fix:** Process all chunks from all events in single parallel batch
  - **Expected:** Additional 20-30% improvement
  - **Implementation:**
    - Collect all chunks from all events
    - Process in single Promise.all() batch
    - Distribute results back to events

### Database Writes (1 task)
- [ ] **perf-2.4.3** - Make database writes async
  - Don't await database saves in search route
  - Use `.catch()` for error handling
  - Apply to `saveSearchResults()` and `writeSearchCacheDB()`

### Monitoring (3 tasks)
- [ ] **perf-monitoring-1** - Set up performance monitoring
  - Track average search time (p50, p95, p99)
  - Cache hit rate
  - API call count per search
  - Database query count per search
  - **NEW:** Extraction time per URL, Gemini API call count
  - Use Vercel Analytics and custom dashboard

- [ ] **perf-monitoring-2** - Set up resource usage monitoring
  - Database connection pool utilization
  - API rate limit usage
  - Cache memory usage
  - Function execution time
  - **NEW:** Gemini API latency, extraction pipeline metrics
  - Set up alerts for thresholds

- [ ] **perf-monitoring-3** - Set up user experience metrics
  - Time to first result
  - Time to complete results
  - Error rate
  - **NEW:** Time to first extracted event, extraction completion rate
  - Create user satisfaction score dashboard

---

## Phase 3: Medium Priority (Week 4-6)
**Expected Impact:** Better user experience, reduced costs

### Rate Limiting (3 tasks)
- [ ] **perf-1.4.1** - Implement centralized rate limit service
  - Create `RateLimitService` using Redis
  - Track limits for firecrawl, cse, and gemini services
  - 1-minute windows

- [ ] **perf-1.4.2** - Implement request queuing with priority
  - Queue requests when rate limit hit
  - Priority: user-initiated > background > cron
  - Max queue time: 30 seconds

- [ ] **perf-1.4.3** - Implement adaptive rate limiting
  - Monitor API response times
  - Reduce rate when APIs are slow
  - Increase rate when APIs are fast

### Progressive Results (2 tasks)
- [ ] **perf-1.3.3** - Implement progressive result streaming
  - Use async generators to return partial results
  - Implement Server-Sent Events (SSE) or WebSocket
  - Real-time updates

- [ ] **perf-1.3.4** - Move non-critical operations to background
  - Move event enhancement and analytics to background jobs
  - Return initial results immediately
  - Update via WebSocket/SSE when enhancement completes
  - **ENHANCED:** Also move prioritization to background

### Extraction Enhancements (2 tasks)
- [ ] **perf-2.2.3** - Implement progressive results for extraction
  - Return results as they are extracted
  - Use Server-Sent Events (SSE) or WebSocket
  - Show partial results in UI immediately

- [ ] **perf-2.2.5** - Implement batch extraction API
  - Use Firecrawl batch API if available
  - Extract multiple URLs in single API call
  - Reduce API overhead

### AI Optimization (4 tasks)
- [ ] **perf-2.3.1** - Combine AI operations
  - Create single AI call for filter + prioritize
  - Returns both filtered items and priority scores
  - In `GeminiService`

- [ ] **perf-2.3.2** - Cache AI decisions
  - Cache AI decisions by URL hash in Redis
  - Key: `ai_decision:{item_hash}`
  - Check cache before making AI calls
  - **ENHANCED:** Also cache prioritization results

- [ ] **perf-2.3.3** - Optimize AI batch processing
  - Process multiple items in single AI call
  - Use batch API when available
  - Optimize token usage
  - **ENHANCED:** Already implemented in perf-ext-1 and perf-ext-2

- [ ] **perf-2.3.4** - Move AI enhancement to background
  - Return search results immediately
  - Enhance events in background
  - Update UI when enhancement completes

### Database Caching (1 task)
- [ ] **perf-2.4.4** - Implement query result caching
  - Cache frequently accessed data (config, user profiles) in Redis
  - Invalidate cache on updates
  - TTL: 1 hour for config, 5 minutes for user profiles

### Scalability (5 tasks)
- [ ] **perf-3.1.1** - Implement per-user rate limiting
  - Add per-user quotas for API calls
  - Track usage per user ID
  - Implement usage quotas per user

- [ ] **perf-3.1.2** - Add request priority queue
  - Priority queue for requests
  - user-initiated > background > cron
  - Use Redis for queue management

- [ ] **perf-3.2.1** - Keep functions warm
  - Scheduled pings to keep serverless functions warm
  - Use Vercel cron or external service

- [ ] **perf-3.2.2** - Pre-warm cache
  - Background job to pre-warm cache with common queries
  - Run during off-peak hours

- [ ] **perf-3.2.3** - Implement edge caching
  - Use Vercel Edge Cache or Cloudflare
  - Cache search configs and user profiles at edge

### Cost Optimization (2 tasks)
- [ ] **perf-3.3.1** - Implement cost monitoring
  - Metrics tracking for API costs per user
  - Create dashboard for cost analysis
  - Set up alerts for cost thresholds

- [ ] **perf-3.3.2** - Deduplicate extractions globally
  - Check global cache before extracting
  - Share extraction results across all users
  - Use URL hash as cache key

---

## Summary by Priority

### 🔴 CRITICAL (14 tasks) - Week 1
**Status:** 9 completed, 5 remaining (extraction optimizations)

**Completed:**
- ✅ Caching: 2 tasks
- ✅ Parallelization: 4 tasks
- ✅ Cache optimization: 2 tasks
- ✅ Extraction concurrency: 1 task

**Remaining:**
- 🔴 **perf-ext-1** - Batch Gemini metadata extraction (NEW)
- 🔴 **perf-ext-2** - Batch Gemini speaker extraction (NEW)
- 🔴 **perf-ext-3** - Cache extracted metadata (NEW)
- 🔴 **perf-ext-4** - Increase prioritization timeout (NEW)
- 🔴 **perf-ext-5** - Early termination for extraction (NEW)

### 🟠 HIGH (13 tasks) - Week 2-3
- Database optimization: 6 tasks
- Extraction optimization: 3 tasks (1 new)
- Database writes: 1 task
- Monitoring: 3 tasks (enhanced with extraction metrics)

### 🟡 MEDIUM (15 tasks) - Week 4-6
- Rate limiting: 3 tasks
- Progressive results: 2 tasks
- Extraction enhancements: 2 tasks
- AI optimization: 4 tasks (enhanced)
- Database caching: 1 task
- Scalability: 5 tasks
- Cost optimization: 2 tasks

---

## Extraction Optimization Roadmap

### Immediate Actions (Week 1) - 🔴 **CRITICAL**

**Expected Impact:** 60-74% reduction in extraction time (38s → 10-15s)

1. **perf-ext-1: Batch Gemini metadata extraction** 🔴
   - **Impact:** 80-85% faster metadata extraction
   - **Effort:** Medium (2-3 hours)
   - **Risk:** Low (backward compatible)

2. **perf-ext-2: Batch Gemini speaker extraction** 🔴
   - **Impact:** 80-85% faster speaker extraction
   - **Effort:** Medium (2-3 hours)
   - **Risk:** Low (backward compatible)

3. **perf-ext-3: Cache extracted metadata** 🔴
   - **Impact:** 74% faster for cached URLs
   - **Effort:** Low (1-2 hours)
   - **Risk:** Very Low (uses existing cache service)

4. **perf-ext-4: Increase prioritization timeout** 🟡
   - **Impact:** Reduce timeout failures from ~50% to <5%
   - **Effort:** Very Low (15 minutes)
   - **Risk:** Very Low (simple config change)

5. **perf-ext-5: Early termination** 🟡
   - **Impact:** 35-47% faster extraction
   - **Effort:** Medium (2-3 hours)
   - **Risk:** Low (quality gate ensures data quality)

### Short-term (Week 2-3)

6. **perf-ext-6: Optimize chunk processing parallelism** 🟡
   - **Impact:** Additional 20-30% improvement
   - **Effort:** Medium (2-3 hours)
   - **Risk:** Low

### Expected Performance After Extraction Optimizations

| Metric | Current | After Optimizations | Improvement |
|-------|---------|---------------------|-------------|
| **Extraction Time (Cold)** | 38s | **10-15s** | **60-74% faster** |
| **Extraction Time (Warm)** | 38s | **2-5s** | **87-95% faster** |
| **Total Search (Cold)** | ~26s+ | **~20-25s** | Similar |
| **Total Search (Warm)** | 52s | **~13-18s** | **65-75% faster** |

---

## Quick Start Guide - UPDATED

### Immediate Actions (Day 1-2) - Extraction Optimization
1. **perf-ext-3** - Cache extracted metadata (easiest, highest impact)
2. **perf-ext-4** - Increase prioritization timeout (quick fix)
3. **perf-ext-1** - Batch Gemini metadata extraction
4. **perf-ext-2** - Batch Gemini speaker extraction
5. **perf-ext-5** - Early termination (if time permits)

### Week 1 Focus - UPDATED
- ✅ Complete remaining Phase 1 critical tasks (extraction optimizations)
- Expected: 60-74% reduction in extraction time
- Expected: 65-75% faster warm searches (52s → 13-18s)

### Week 2-3 Focus
- Database optimization
- Monitoring setup
- Extraction parallelism optimization
- Expected: 30-40% additional improvement

### Week 4-6 Focus
- User experience enhancements
- Cost optimization
- Advanced features

---

## Implementation Details

### perf-ext-1: Batch Gemini Metadata Extraction

**Current Implementation:**
```typescript
// src/lib/event-analysis.ts - extractEventMetadata()
// Processing chunks in parallel but each gets its own API call
const chunkPromises = chunks.map((chunk, i) => processMetadataChunk(chunk, i));
const chunkResults = await Promise.allSettled(chunkPromises);
// Each chunk makes separate Gemini API call (~2-3s per call)
```

**Optimized Implementation:**
```typescript
// Collect all chunks from all events being processed concurrently
const allChunks = events.flatMap((event, eventIdx) => 
  event.chunks.map((chunk, chunkIdx) => ({
    chunk,
    eventIdx,
    chunkIdx,
    url: event.url // For context
  }))
);

// Build single batch prompt (Gemini 2.5 Flash supports 1M token context)
const batchPrompt = `Extract event metadata from the following chunks.
Each chunk is labeled with its event index and chunk index.

CHUNKS:
${allChunks.map((c, idx) => `
--- Event ${c.eventIdx}, Chunk ${c.chunkIdx} (Index ${idx}) ---
URL: ${c.url}
Content:
${c.chunk}
`).join('\n')}

Return JSON array with metadata for each chunk:
[
  {
    "chunkIndex": 0,
    "eventIndex": 0,
    "metadata": { "title": "...", "date": "...", "location": "...", ... }
  },
  ...
]`;

// Single Gemini API call with structured response
const response = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: batchPrompt }] }],
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: batchMetadataSchema // Array of chunk results
  }
});

// Parse and distribute results back to events
const batchResults = JSON.parse(response.text);
events.forEach((event, eventIdx) => {
  const eventChunks = batchResults.filter(r => r.eventIndex === eventIdx);
  event.metadata = mergeMetadataChunks(eventChunks);
});
```

**Key Considerations:**
- **Token Limit:** Monitor total tokens (1M limit, but should stay well under)
- **Response Parsing:** Must correctly map results back to events/chunks
- **Error Handling:** If batch fails, fallback to individual calls
- **Reference:** Similar pattern to `BatchGeminiService.processUrlPrioritizationBatch()`

**Expected Improvement:** 8-18s → 2-3s per event (80-85% faster)

### perf-ext-2: Batch Gemini Speaker Extraction

**Current Implementation:**
```typescript
// src/lib/event-analysis.ts - extractAndEnhanceSpeakers()
// Processing chunks in parallel but each gets its own API call
const processChunk = async (chunk: string, index: number) => {
  const response = await model.generateContent({...}); // Separate call per chunk
};
```

**Optimized Implementation:**
```typescript
// Collect all speaker chunks from all events
const allChunks = events.flatMap((event, eventIdx) => 
  event.chunks.map((chunk, chunkIdx) => ({
    chunk,
    eventIdx,
    chunkIdx,
    url: event.url
  }))
);

// Build single batch prompt
const batchPrompt = `Extract speakers from the following chunks.
Each chunk is labeled with its event index and chunk index.

CHUNKS:
${allChunks.map((c, idx) => `
--- Event ${c.eventIdx}, Chunk ${c.chunkIdx} (Index ${idx}) ---
URL: ${c.url}
Content:
${c.chunk}
`).join('\n')}

Return JSON array with speakers for each chunk:
[
  {
    "chunkIndex": 0,
    "eventIndex": 0,
    "speakers": [{ "name": "...", "title": "...", "company": "...", ... }]
  },
  ...
]`;

// Single Gemini API call (already uses responseSchema)
const response = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: batchPrompt }] }],
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: batchSpeakerSchema // Array of chunk results with speakers
  }
});

// Parse and merge speakers back to events
const batchResults = JSON.parse(response.text);
events.forEach((event, eventIdx) => {
  const eventChunks = batchResults.filter(r => r.eventIndex === eventIdx);
  event.speakers = mergeSpeakersFromChunks(eventChunks);
});
```

**Key Considerations:**
- **Already uses responseSchema:** Current implementation already has structured output
- **Speaker deduplication:** Must handle fuzzy matching across chunks
- **Token Limit:** Monitor total tokens (1M limit)
- **Reference:** Similar pattern to `BatchGeminiService.processUrlPrioritizationBatch()`

**Expected Improvement:** 8-18s → 2-3s per event (80-85% faster)

### perf-ext-3: Cache Extracted Metadata

**Implementation:**
```typescript
// src/lib/optimized-orchestrator.ts - extractEventDetails()
const urlHash = createHash('sha256').update(url).digest('hex');
const cacheKey = `extracted_metadata:${urlHash}`;

// Check cache before extraction
const cached = await cacheService.get(cacheKey, CACHE_CONFIGS.EXTRACTED_EVENTS);
if (cached) {
  return cached; // Skip extraction
}

// Extract and cache
const extracted = await extractEvent(url);
await cacheService.set(cacheKey, extracted, CACHE_CONFIGS.EXTRACTED_EVENTS);
```

**Expected Improvement:** 38s → 10s for cached URLs (74% faster)

### perf-ext-4: Increase Prioritization Timeout

**Implementation:**
```typescript
// src/lib/optimized-orchestrator.ts
const PRIORITIZATION_TIMEOUT = 15000; // Changed from 12000
```

**Expected Improvement:** Reduce timeout failures from ~50% to <5%

### perf-ext-5: Early Termination

**Implementation:**
```typescript
// Stop processing once core fields extracted
const coreFields = ['title', 'date', 'location'];
const extractedFields = new Set();

for (const chunk of chunks) {
  const metadata = await extractChunk(chunk);
  Object.keys(metadata).forEach(field => extractedFields.add(field));
  
  // Early termination if core fields found
  if (coreFields.every(field => extractedFields.has(field))) {
    break; // Stop processing remaining chunks
  }
}
```

**Expected Improvement:** 38s → 20-25s (35-47% faster)

---

## Notes

- **No code changes should be made without approval**
- Each task should be tested independently
- Monitor performance metrics after each phase
- Roll back if performance degrades
- Document all changes in code comments
- **NEW:** Test extraction optimizations with real URLs before deploying
- **NEW:** Monitor Gemini API usage and costs after batching

---

## Dependencies

### Extraction Optimization Dependencies

**perf-ext-1 & perf-ext-2:**
- Depend on: Gemini 2.5 Flash large context window (1M tokens) ✅ Verified
- Depend on: Structured JSON response schema support ✅ Verified (already used)
- Block: None
- Blocked by: None
- **Note:** Gemini doesn't have native batch API - combine into single prompt (similar to existing BatchGeminiService pattern)

**perf-ext-3:**
- Depend on: UnifiedCacheService (already implemented)
- Block: None
- Blocked by: None

**perf-ext-4:**
- Depend on: None
- Block: None
- Blocked by: None

**perf-ext-5:**
- Depend on: Quality gate implementation
- Block: None
- Blocked by: None

**perf-ext-6:**
- Depend on: perf-ext-1 and perf-ext-2 (batching must work first)
- Block: None
- Blocked by: perf-ext-1, perf-ext-2

---

**Last Updated:** 2025-11-15  
**Changes:** Added 5 new extraction optimization tasks based on Phase 1 performance analysis

