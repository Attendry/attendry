# Performance Optimization Plan - Refactor Summary

**Date:** 2025-11-15  
**Based on:** Phase 1 Performance Analysis  
**Changes:** Added 5 new extraction optimization tasks, reorganized priorities

---

## Executive Summary

**Original Plan:** 37 tasks across 3 phases  
**Refactored Plan:** 42 tasks (5 new extraction optimization tasks)  
**Status:** Ready for review and implementation

**Key Changes:**
- ✅ Added 5 critical extraction optimization tasks to Phase 1
- ✅ Updated priorities based on performance analysis findings
- ✅ Enhanced existing tasks with extraction-specific improvements
- ✅ Added implementation details and expected improvements

---

## New Tasks Added

### 🔴 **CRITICAL - Phase 1 (5 new tasks)**

1. **perf-ext-1: Batch Gemini metadata extraction** 🔴
   - **Problem:** Processing 4-6 chunks in parallel but each gets its own API call (~8-18s per event)
   - **Solution:** Combine all metadata chunks into single Gemini prompt (1M token context)
   - **Expected:** 80-85% faster (8-18s → 2-3s per event)
   - **Effort:** Medium (2-3 hours)
   - **Risk:** Low
   - **Verified:** ✅ Gemini 2.5 Flash supports 1M token context window
   - **Note:** Gemini doesn't have native batch API - combine into single prompt

2. **perf-ext-2: Batch Gemini speaker extraction** 🔴
   - **Problem:** Processing 4-6 chunks in parallel but each gets its own API call (~8-18s per event)
   - **Solution:** Combine all speaker chunks into single Gemini prompt (1M token context)
   - **Expected:** 80-85% faster (8-18s → 2-3s per event)
   - **Effort:** Medium (2-3 hours)
   - **Risk:** Low
   - **Verified:** ✅ Already uses responseSchema, supports structured JSON
   - **Note:** Gemini doesn't have native batch API - combine into single prompt

3. **perf-ext-3: Cache extracted metadata by URL hash** 🔴
   - **Problem:** Re-extracting metadata for same URLs
   - **Solution:** Cache extracted metadata with 24 hour TTL
   - **Expected:** 74% faster for cached URLs (38s → 10s)
   - **Effort:** Low (1-2 hours)
   - **Risk:** Very Low

4. **perf-ext-4: Increase prioritization timeout** 🟡
   - **Problem:** 12s timeout too tight, causing ~50% timeout failures
   - **Solution:** Increase to 15s with better error handling
   - **Expected:** Reduce timeout failures to <5%
   - **Effort:** Very Low (15 minutes)
   - **Risk:** Very Low

5. **perf-ext-5: Early termination for extraction** 🟡
   - **Problem:** Processing all chunks even if enough data found
   - **Solution:** Stop processing once core fields extracted
   - **Expected:** 35-47% faster (38s → 20-25s)
   - **Effort:** Medium (2-3 hours)
   - **Risk:** Low

### 🟡 **Phase 2 (1 new task)**

6. **perf-ext-6: Optimize chunk processing parallelism** 🟡
   - **Problem:** Chunks processed sequentially per event
   - **Solution:** Process all chunks from all events in single parallel batch
   - **Expected:** Additional 20-30% improvement
   - **Effort:** Medium (2-3 hours)
   - **Risk:** Low

---

## Updated Task Status

### Phase 1 - Critical (14 tasks total)

**Completed (9 tasks):** ✅
- perf-1.1.1 - Redis/Distributed Cache
- perf-1.1.2 - Multi-level caching
- perf-1.3.1 - Parallelize DB operations
- perf-1.3.2 - Parallelize search execution
- perf-2.1.1 - Parallelize search providers
- perf-2.1.2 - Smart timeout strategy
- perf-2.1.3 - Unified cache check
- perf-2.2.1 - Increase extraction concurrency
- Cache warming fix (supabaseAdmin)

**Remaining (5 tasks):** 🔴
- perf-ext-1 - Batch Gemini metadata extraction
- perf-ext-2 - Batch Gemini speaker extraction
- perf-ext-3 - Cache extracted metadata
- perf-ext-4 - Increase prioritization timeout
- perf-ext-5 - Early termination

---

## Expected Performance Improvements

### Current Performance

| Metric | Current | Target |
|--------|---------|--------|
| **Discovery (Cold)** | 15s | 15s ✅ |
| **Discovery (Warm)** | 3ms | <10ms ✅ |
| **Extraction (Cold)** | 38s | 10-15s ⚠️ |
| **Extraction (Warm)** | 38s | 2-5s ⚠️ |
| **Total (Cold)** | ~26s+ | 20-25s ✅ |
| **Total (Warm)** | 52s | <15s ⚠️ |

### After Extraction Optimizations

| Metric | Current | After Optimizations | Improvement |
|--------|---------|---------------------|-------------|
| **Extraction (Cold)** | 38s | **10-15s** | **60-74% faster** |
| **Extraction (Warm)** | 38s | **2-5s** | **87-95% faster** |
| **Total (Warm)** | 52s | **~13-18s** | **65-75% faster** |

---

## Implementation Priority

### Week 1 - Immediate Actions (Day 1-2)

**Recommended Order:**
1. **perf-ext-3** - Cache extracted metadata (easiest, highest impact)
2. **perf-ext-4** - Increase prioritization timeout (quick fix)
3. **perf-ext-1** - Batch Gemini metadata extraction
4. **perf-ext-2** - Batch Gemini speaker extraction
5. **perf-ext-5** - Early termination (if time permits)

**Expected Timeline:**
- Day 1: perf-ext-3, perf-ext-4 (2-3 hours)
- Day 2: perf-ext-1, perf-ext-2 (4-6 hours)
- Day 3: perf-ext-5 (2-3 hours)

**Total Effort:** ~8-12 hours

---

## Implementation Details

### perf-ext-1 & perf-ext-2: Batch Gemini Calls

**Key Finding:** Gemini doesn't have a native batch API. Instead, combine multiple items into a single prompt using the large context window (1M tokens).

**Current Flow:**
```
Event 1: Chunk 1 → Gemini API Call 1 (2-3s)
         Chunk 2 → Gemini API Call 2 (2-3s)
         Chunk 3 → Gemini API Call 3 (2-3s)
Event 2: Chunk 1 → Gemini API Call 4 (2-3s)
         ...
Total: 10-15 API calls × 2-3s = 20-45s
```

**Optimized Flow:**
```
All Events: [Chunk 1, Chunk 2, ..., Chunk N] → Single Gemini API Call (2-3s)
            ↓
            Parse JSON response (structured schema)
            ↓
            Distribute results to events
Total: 1 API call × 2-3s = 2-3s
```

**Key Changes:**
- Collect all chunks from all events being processed concurrently
- Create single batch prompt with labeled chunks (event/chunk index)
- Single Gemini API call with structured JSON response schema
- Parse response and map results back to correct events/chunks
- **Reference:** Similar to existing `BatchGeminiService.processUrlPrioritizationBatch()` pattern

**Files to Modify:**
- `src/lib/event-analysis.ts` - `extractEventMetadata()`
- `src/lib/event-analysis.ts` - `extractAndEnhanceSpeakers()`

**Technical Notes:**
- See `GEMINI_BATCH_OPTIMIZATION_NOTES.md` for detailed implementation guide
- Token limit: 1M tokens (current chunks well within limit)
- Response schema: Use structured JSON schema for reliable parsing
- Error handling: Fallback to individual calls on batch failure

### perf-ext-3: Cache Extracted Metadata

**Implementation:**
- Use existing UnifiedCacheService
- Cache key: `extracted_metadata:{url_hash}`
- TTL: 24 hours
- Check cache before extraction
- Store after extraction

**Files to Modify:**
- `src/lib/optimized-orchestrator.ts` - `extractEventDetails()`
- `src/lib/cache/unified-cache-service.ts` - Add EXTRACTED_EVENTS config

### perf-ext-4: Increase Prioritization Timeout

**Implementation:**
- Change timeout from 12000ms to 15000ms
- Add retry logic
- Better error handling

**Files to Modify:**
- `src/lib/optimized-orchestrator.ts` - Prioritization timeout constant

### perf-ext-5: Early Termination

**Implementation:**
- Track extracted fields per event
- Stop chunk processing once core fields found
- Skip low-priority chunks if time limit approaching

**Files to Modify:**
- `src/lib/event-analysis.ts` - `extractEventMetadata()`
- `src/lib/optimized-orchestrator.ts` - `extractEventDetails()`

---

## Risk Assessment

### Low Risk Tasks
- ✅ **perf-ext-3** - Uses existing cache service, backward compatible
- ✅ **perf-ext-4** - Simple config change, no logic changes
- ✅ **perf-ext-5** - Quality gate ensures data quality

### Medium Risk Tasks
- ⚠️ **perf-ext-1** - Batch processing may have edge cases
- ⚠️ **perf-ext-2** - Batch processing may have edge cases

**Mitigation:**
- Test with real URLs before deploying
- Monitor Gemini API responses
- Fallback to sequential processing on errors
- Gradual rollout (feature flag)

---

## Dependencies

### Extraction Optimization Dependencies

**perf-ext-1 & perf-ext-2:**
- **Depend on:** Gemini API batch support (verify availability)
- **Block:** None
- **Blocked by:** None

**perf-ext-3:**
- **Depend on:** UnifiedCacheService (already implemented) ✅
- **Block:** None
- **Blocked by:** None

**perf-ext-4:**
- **Depend on:** None
- **Block:** None
- **Blocked by:** None

**perf-ext-5:**
- **Depend on:** Quality gate implementation (already exists) ✅
- **Block:** None
- **Blocked by:** None

**perf-ext-6:**
- **Depend on:** perf-ext-1 and perf-ext-2 (batching must work first)
- **Block:** None
- **Blocked by:** perf-ext-1, perf-ext-2

---

## Testing Strategy

### Unit Tests
- Test batch Gemini calls with mock data
- Test cache hit/miss scenarios
- Test early termination logic

### Integration Tests
- Test with real URLs
- Test with various event types
- Test error handling and fallbacks

### Performance Tests
- Measure extraction time before/after
- Monitor Gemini API usage
- Track cache hit rates

---

## Monitoring

### Key Metrics to Track
- Extraction time per URL
- Gemini API call count
- Cache hit rate for extracted metadata
- Prioritization timeout rate
- Early termination rate

### Alerts to Set Up
- Extraction time > 20s
- Gemini API error rate > 5%
- Cache hit rate < 50%
- Prioritization timeout rate > 10%

---

## Rollback Plan

### If Issues Occur
1. **perf-ext-1 & perf-ext-2:** Feature flag to disable batching
2. **perf-ext-3:** Cache can be disabled via config
3. **perf-ext-4:** Revert timeout to 12s
4. **perf-ext-5:** Disable early termination via config

### Monitoring
- Watch for increased error rates
- Monitor extraction quality
- Track user complaints

---

## Success Criteria

### Phase 1 Complete When:
- ✅ All 14 critical tasks completed
- ✅ Extraction time: 38s → 10-15s (60-74% improvement)
- ✅ Warm search time: 52s → 13-18s (65-75% improvement)
- ✅ Cache hit rate: >80% for warm searches
- ✅ Prioritization timeout rate: <5%

### Phase 2 Complete When:
- ✅ Database optimizations implemented
- ✅ Monitoring dashboard operational
- ✅ Extraction time: 10-15s → 8-12s (additional 20-30% improvement)

---

## Next Steps

1. **Review this refactored plan** ✅
2. **Approve extraction optimization tasks**
3. **Start with perf-ext-3 and perf-ext-4** (lowest risk, highest impact)
4. **Implement perf-ext-1 and perf-ext-2** (batch processing)
5. **Add perf-ext-5** (early termination)
6. **Test and monitor**
7. **Continue with Phase 2**

---

**Last Updated:** 2025-11-15  
**Status:** Ready for Review

