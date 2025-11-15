# Performance Optimization Plan - Tasks & Phases Outline

**Date:** 2025-11-15  
**Total Tasks:** 42  
**Status:** Phase 1 - 9/14 completed, 5 remaining

---

## 📊 Overview

| Phase | Priority | Tasks | Completed | Remaining | Expected Impact |
|-------|----------|-------|-----------|-----------|-----------------|
| **Phase 1** | 🔴 CRITICAL | 14 | 9 | 5 | 50-70% search time reduction, 60-74% extraction time reduction |
| **Phase 2** | 🟠 HIGH | 13 | 0 | 13 | 30-40% additional improvement, better scalability |
| **Phase 3** | 🟡 MEDIUM | 15 | 0 | 15 | Better UX, reduced costs |

---

## 🔴 PHASE 1: Critical Fixes (Week 1)

**Expected Impact:** 50-70% reduction in search time, 60-74% reduction in extraction time

### ✅ Completed Tasks (9/14)

#### Caching (2/3 completed)
- ✅ **perf-1.1.1** - Implement Redis/Distributed Cache
- ✅ **perf-1.1.2** - Implement multi-level caching (L1/L2/L3)

#### Parallelization (4/4 completed)
- ✅ **perf-1.3.1** - Parallelize independent database operations
- ✅ **perf-1.3.2** - Parallelize search execution and database cache check
- ✅ **perf-2.1.1** - Parallelize search provider attempts (Firecrawl, CSE, Database)
- ✅ **perf-2.1.2** - Implement smart timeout strategy (8s/5s/2s)

#### Cache Optimization (2/2 completed)
- ✅ **perf-2.1.3** - Implement unified cache check
- ✅ **perf-2.2.1** - Increase extraction concurrency (4→12, targets 15→20)

---

### 🔴 Remaining Tasks (5/14) - CRITICAL

#### Extraction Optimization (5 tasks)
**Based on analysis: Extraction taking 38s (5x slower than expected)**

1. **perf-ext-1** - Batch Gemini metadata extraction 🔴 **CRITICAL**
   - **Location:** `src/lib/event-analysis.ts` - `extractEventMetadata()`
   - **Current:** 4-6 chunks per event, each gets own API call (~8-18s per event)
   - **Fix:** Combine all metadata chunks into single Gemini prompt (1M token context)
   - **Expected:** 8-18s → 2-3s per event (80-85% faster)
   - **Effort:** Medium (2-3 hours)
   - **Risk:** Low

2. **perf-ext-2** - Batch Gemini speaker extraction 🔴 **CRITICAL**
   - **Location:** `src/lib/event-analysis.ts` - `extractAndEnhanceSpeakers()`
   - **Current:** 4-6 chunks per event, each gets own API call (~8-18s per event)
   - **Fix:** Combine all speaker chunks into single Gemini prompt (1M token context)
   - **Expected:** 8-18s → 2-3s per event (80-85% faster)
   - **Effort:** Medium (2-3 hours)
   - **Risk:** Low

3. **perf-ext-3** - Cache extracted metadata by URL hash 🔴 **CRITICAL**
   - **Location:** `src/lib/optimized-orchestrator.ts` - `extractEventDetails()`
   - **Current:** Re-extracting metadata for same URLs
   - **Fix:** Cache extracted metadata by URL hash with 24 hour TTL
   - **Expected:** 38s → 10s for cached URLs (74% faster)
   - **Effort:** Low (1-2 hours)
   - **Risk:** Very Low

4. **perf-ext-4** - Increase prioritization timeout 🟡 **MEDIUM**
   - **Location:** `src/lib/optimized-orchestrator.ts` - Gemini prioritization
   - **Current:** 12s timeout (too tight, causing ~50% failures)
   - **Fix:** Increase to 15s with better error handling
   - **Expected:** Reduce timeout failures to <5%
   - **Effort:** Very Low (15 minutes)
   - **Risk:** Very Low

5. **perf-ext-5** - Implement early termination for extraction 🟡 **MEDIUM**
   - **Location:** `src/lib/optimized-orchestrator.ts` - `extractEventDetails()`
   - **Current:** Processing all chunks even if enough data found
   - **Fix:** Stop processing once core fields extracted (title, date, location)
   - **Expected:** 38s → 20-25s (35-47% faster)
   - **Effort:** Medium (2-3 hours)
   - **Risk:** Low

#### Caching (1/3 remaining)
- [ ] **perf-1.1.3** - Implement cache warming strategy (moved to Phase 3)

---

## 🟠 PHASE 2: High Priority (Week 2-3)

**Expected Impact:** 30-40% additional improvement, better scalability, 60-74% extraction improvement

### Database Optimization (6 tasks)

1. **perf-1.2.1** - Increase database connection pool size
   - Increase maxConnections from 10 to 50
   - Add minConnections: 5
   - Add healthCheckInterval: 30000

2. **perf-1.2.2** - Implement separate connection pools per operation type
   - Read pool: 30 connections
   - Write pool: 10 connections
   - Admin pool: 5 connections

3. **perf-1.2.3** - Add query queuing for database pool
   - Priority queue: search > extraction > analytics
   - Max wait time: 10 seconds before timeout

4. **perf-1.2.4** - Configure Supabase connection pooling
   - Use Supabase pooler connection string
   - Implement transaction mode for read-heavy operations

5. **perf-2.4.1** - Batch database queries
   - Use `Promise.all()` to load search config and user profile in parallel
   - Combine cache lookups into single queries where possible

6. **perf-2.4.2** - Add database indexes
   - `idx_search_cache_key` on `search_cache(cache_key, ttl_at)`
   - `idx_ai_decisions_hash` on `ai_decisions(item_hash)`
   - `idx_url_extractions_normalized` on `url_extractions(url_normalized)`
   - `idx_extracted_metadata_url_hash` on `extracted_metadata(url_hash, expires_at)`

### Extraction Optimization (3 tasks)

7. **perf-2.2.2** - Implement early termination strategy
   - Stop extraction once 10 high-quality events found
   - Use prioritization scores to extract best URLs first
   - Skip low-priority URLs if time limit approaching
   - **ENHANCED:** Also stop chunk processing once core fields extracted

8. **perf-2.2.4** - Implement extraction caching
   - Cache extracted events by URL with 24 hour TTL
   - Skip extraction if URL already cached
   - Background refresh for stale cache entries
   - **ENHANCED:** Cache both metadata and speaker data separately

9. **perf-ext-6** - Optimize chunk processing parallelism 🟡 **NEW**
   - **Location:** `src/lib/event-analysis.ts`
   - **Current:** Chunks processed in parallel but sequentially per event
   - **Fix:** Process all chunks from all events in single parallel batch
   - **Expected:** Additional 20-30% improvement

### Database Writes (1 task)

10. **perf-2.4.3** - Make database writes async
    - Don't await database saves in search route
    - Use `.catch()` for error handling
    - Apply to `saveSearchResults()` and `writeSearchCacheDB()`

### Monitoring (3 tasks)

11. **perf-monitoring-1** - Set up performance monitoring
    - Track average search time (p50, p95, p99)
    - Cache hit rate
    - API call count per search
    - Database query count per search
    - **NEW:** Extraction time per URL, Gemini API call count
    - Use Vercel Analytics and custom dashboard

12. **perf-monitoring-2** - Set up resource usage monitoring
    - Database connection pool utilization
    - API rate limit usage
    - Cache memory usage
    - Function execution time
    - **NEW:** Gemini API latency, extraction pipeline metrics
    - Set up alerts for thresholds

13. **perf-monitoring-3** - Set up user experience metrics
    - Time to first result
    - Time to complete results
    - Error rate
    - **NEW:** Time to first extracted event, extraction completion rate
    - Create user satisfaction score dashboard

---

## 🟡 PHASE 3: Medium Priority (Week 4-6)

**Expected Impact:** Better user experience, reduced costs

### Rate Limiting (3 tasks)

1. **perf-1.4.1** - Implement centralized rate limit service
   - Create `RateLimitService` using Redis
   - Track limits for firecrawl, cse, and gemini services
   - 1-minute windows

2. **perf-1.4.2** - Implement request queuing with priority
   - Queue requests when rate limit hit
   - Priority: user-initiated > background > cron
   - Max queue time: 30 seconds

3. **perf-1.4.3** - Implement adaptive rate limiting
   - Monitor API response times
   - Reduce rate when APIs are slow
   - Increase rate when APIs are fast

### Progressive Results (2 tasks)

4. **perf-1.3.3** - Implement progressive result streaming
   - Use async generators to return partial results
   - Implement Server-Sent Events (SSE) or WebSocket
   - Real-time updates

5. **perf-1.3.4** - Move non-critical operations to background
   - Move event enhancement and analytics to background jobs
   - Return initial results immediately
   - Update via WebSocket/SSE when enhancement completes
   - **ENHANCED:** Also move prioritization to background

### Extraction Enhancements (2 tasks)

6. **perf-2.2.3** - Implement progressive results for extraction
   - Return results as they are extracted
   - Use Server-Sent Events (SSE) or WebSocket
   - Show partial results in UI immediately

7. **perf-2.2.5** - Implement batch extraction API
   - Use Firecrawl batch API if available
   - Extract multiple URLs in single API call
   - Reduce API overhead

### AI Optimization (4 tasks)

8. **perf-2.3.1** - Combine AI operations
   - Create single AI call for filter + prioritize
   - Returns both filtered items and priority scores
   - In `GeminiService`

9. **perf-2.3.2** - Cache AI decisions
   - Cache AI decisions by URL hash in Redis
   - Key: `ai_decision:{item_hash}`
   - Check cache before making AI calls
   - **ENHANCED:** Also cache prioritization results

10. **perf-2.3.3** - Optimize AI batch processing
    - Process multiple items in single AI call
    - Use batch API when available
    - Optimize token usage
    - **ENHANCED:** Already implemented in perf-ext-1 and perf-ext-2

11. **perf-2.3.4** - Move AI enhancement to background
    - Return search results immediately
    - Enhance events in background
    - Update UI when enhancement completes

### Database Caching (1 task)

12. **perf-2.4.4** - Implement query result caching
    - Cache frequently accessed data (config, user profiles) in Redis
    - Invalidate cache on updates
    - TTL: 1 hour for config, 5 minutes for user profiles

### Scalability (5 tasks)

13. **perf-3.1.1** - Implement per-user rate limiting
    - Add per-user quotas for API calls
    - Track usage per user ID
    - Implement usage quotas per user

14. **perf-3.1.2** - Add request priority queue
    - Priority queue for requests
    - user-initiated > background > cron
    - Use Redis for queue management

15. **perf-3.2.1** - Keep functions warm
    - Scheduled pings to keep serverless functions warm
    - Use Vercel cron or external service

16. **perf-3.2.2** - Pre-warm cache
    - Background job to pre-warm cache with common queries
    - Run during off-peak hours

17. **perf-3.2.3** - Implement edge caching
    - Use Vercel Edge Cache or Cloudflare
    - Cache search configs and user profiles at edge

### Cost Optimization (2 tasks)

18. **perf-3.3.1** - Implement cost monitoring
    - Metrics tracking for API costs per user
    - Create dashboard for cost analysis
    - Set up alerts for cost thresholds

19. **perf-3.3.2** - Deduplicate extractions globally
    - Check global cache before extracting
    - Share extraction results across all users
    - Use URL hash as cache key

### Caching (1 task from Phase 1)

20. **perf-1.1.3** - Implement cache warming strategy
    - Background job to pre-populate cache with common queries
    - Cache-aside pattern with database fallback
    - **FIXED:** Use supabaseAdmin() instead of supabaseServer() for cache warming

---

## 📋 Implementation Priority

### Week 1 - Immediate Actions (Day 1-2)

**Recommended Order:**
1. **perf-ext-3** - Cache extracted metadata (easiest, highest impact) - 1-2 hours
2. **perf-ext-4** - Increase prioritization timeout (quick fix) - 15 minutes
3. **perf-ext-1** - Batch Gemini metadata extraction - 2-3 hours
4. **perf-ext-2** - Batch Gemini speaker extraction - 2-3 hours
5. **perf-ext-5** - Early termination (if time permits) - 2-3 hours

**Total Effort:** ~8-12 hours

### Week 2-3 Focus

- Database optimization (6 tasks)
- Monitoring setup (3 tasks)
- Extraction parallelism optimization (1 task)
- Database writes optimization (1 task)
- Early termination strategy (1 task)
- Extraction caching enhancement (1 task)

**Total Effort:** ~40-60 hours

### Week 4-6 Focus

- Rate limiting (3 tasks)
- Progressive results (2 tasks)
- Extraction enhancements (2 tasks)
- AI optimization (4 tasks)
- Database caching (1 task)
- Scalability (5 tasks)
- Cost optimization (2 tasks)
- Cache warming (1 task)

**Total Effort:** ~60-80 hours

---

## 📈 Expected Performance Improvements

### Phase 1 (After Completion)

| Metric | Current | After Phase 1 | Improvement |
|--------|---------|---------------|-------------|
| **Discovery (Cold)** | 15s | 15s | ✅ Maintained |
| **Discovery (Warm)** | 3ms | <10ms | ✅ Maintained |
| **Extraction (Cold)** | 38s | **10-15s** | **60-74% faster** |
| **Extraction (Warm)** | 38s | **2-5s** | **87-95% faster** |
| **Total Search (Cold)** | ~26s+ | **~20-25s** | ✅ Similar |
| **Total Search (Warm)** | 52s | **~13-18s** | **65-75% faster** |

### Phase 2 (After Completion)

| Metric | After Phase 1 | After Phase 2 | Additional Improvement |
|--------|---------------|---------------|------------------------|
| **Extraction (Cold)** | 10-15s | **8-12s** | **20-30% faster** |
| **Database Queries** | Baseline | **50% faster** | Better scalability |
| **Monitoring** | None | **Full visibility** | Better insights |

### Phase 3 (After Completion)

| Metric | After Phase 2 | After Phase 3 | Additional Improvement |
|--------|---------------|---------------|------------------------|
| **User Experience** | Good | **Excellent** | Progressive results |
| **Costs** | Baseline | **30-40% lower** | Better efficiency |
| **Scalability** | Good | **Excellent** | Multi-user ready |

---

## 🎯 Success Criteria

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
- ✅ Database query performance: 50% improvement

### Phase 3 Complete When:
- ✅ Progressive results implemented
- ✅ Cost monitoring operational
- ✅ Multi-user scalability verified
- ✅ User satisfaction score: >90%

---

## 📝 Notes

- **No code changes should be made without approval**
- Each task should be tested independently
- Monitor performance metrics after each phase
- Roll back if performance degrades
- Document all changes in code comments
- **NEW:** Test extraction optimizations with real URLs before deploying
- **NEW:** Monitor Gemini API usage and costs after batching

---

**Last Updated:** 2025-11-15  
**Status:** Phase 1 - 9/14 completed, 5 remaining (extraction optimizations)

