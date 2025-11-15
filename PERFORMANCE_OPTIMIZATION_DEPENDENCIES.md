# Performance Optimization Dependencies & Mitigation Plan

**Date:** 2025-01-27  
**Scope:** Dependencies across Phase 1-3 implementation tasks

---

## Executive Summary

This document identifies **critical dependencies** between optimization tasks and provides **mitigation strategies** to prevent blocking issues during implementation.

**Key Findings:**
- **1 Critical Blocking Dependency:** Redis setup blocks 8+ tasks
- **3 High Dependencies:** Database pool, monitoring, and prioritization scores
- **5 Medium Dependencies:** Background jobs, WebSocket/SSE, batch APIs
- **Mitigation Strategy:** Parallel work streams and fallback implementations

---

## Critical Dependencies (Blocking)

### 🔴 CRITICAL: Redis/Distributed Cache Infrastructure

**Blocking Tasks:**
- `perf-1.1.1` - Implement Redis/Distributed Cache (FOUNDATION)
- `perf-1.1.2` - Implement multi-level caching (depends on perf-1.1.1)
- `perf-2.1.3` - Unified cache check (depends on perf-1.1.1)
- `perf-2.2.4` - Extraction caching (depends on perf-1.1.1)
- `perf-2.3.2` - Cache AI decisions (depends on perf-1.1.1)
- `perf-2.4.4` - Query result caching (depends on perf-1.1.1)
- `perf-1.4.1` - Centralized rate limit service (depends on perf-1.1.1)
- `perf-3.1.2` - Request priority queue (depends on perf-1.1.1)
- `perf-3.3.2` - Deduplicate extractions globally (depends on perf-1.1.1)

**Current State:**
- ✅ Redis client infrastructure exists (`src/lib/cache/redis-client.ts`)
- ✅ Unified cache service exists (`src/lib/cache/unified-cache-service.ts`)
- ⚠️ **ISSUE:** Search route still uses in-memory Map (`src/app/api/events/search/route.ts:166`)
- ⚠️ **ISSUE:** Redis connection may not be configured (check `REDIS_URL` env var)
- ⚠️ **ISSUE:** Advanced cache has simulated Redis (`src/lib/advanced-cache.ts:310`)

**Dependency Chain:**
```
perf-1.1.1 (Redis Setup)
  └─> perf-1.1.2 (Multi-level cache)
  └─> perf-2.1.3 (Unified cache check)
  └─> perf-2.2.4 (Extraction caching)
  └─> perf-2.3.2 (AI decision caching)
  └─> perf-2.4.4 (Query result caching)
  └─> perf-1.4.1 (Rate limiting)
  └─> perf-3.1.2 (Priority queue)
  └─> perf-3.3.2 (Global deduplication)
```

**Mitigation Strategies:**

1. **Immediate Actions (Day 1)**
   - ✅ Verify Redis connection configuration
   - ✅ Check if `REDIS_URL` or `UPSTASH_REDIS_REST_URL` is set
   - ✅ Test Redis connectivity with existing `getRedisClient()`
   - ✅ If Redis not configured, set up Upstash Redis (free tier available)

2. **Fallback Implementation**
   - Use existing `UnifiedCacheService` which has Supabase fallback
   - Implement graceful degradation: Redis → Supabase → In-memory
   - All dependent tasks can proceed with Supabase fallback initially

3. **Parallel Work Stream**
   - **Stream A:** Redis setup and configuration (1 developer)
   - **Stream B:** Refactor search route to use `UnifiedCacheService` (1 developer)
   - **Stream C:** Implement multi-level cache logic (can work with Supabase first)

4. **Risk Mitigation**
   - **Risk:** Redis service unavailable or slow
   - **Mitigation:** Use Supabase as primary cache until Redis is stable
   - **Risk:** Redis connection overhead
   - **Mitigation:** Implement connection pooling and lazy connection

**Implementation Order:**
1. **Day 1 Morning:** Verify/configure Redis connection
2. **Day 1 Afternoon:** Refactor search route to use `UnifiedCacheService`
3. **Day 2:** Implement multi-level cache with Redis + Supabase fallback
4. **Day 3+:** All dependent tasks can proceed

---

## High Dependencies

### 🟠 HIGH: Database Connection Pool Configuration

**Blocking Tasks:**
- `perf-1.2.1` - Increase database connection pool size
- `perf-1.2.2` - Separate connection pools per operation type (depends on perf-1.2.1)
- `perf-1.2.3` - Query queuing (depends on perf-1.2.2)
- `perf-1.2.4` - Supabase connection pooling (can be done in parallel)

**Dependency Chain:**
```
perf-1.2.1 (Increase pool size)
  └─> perf-1.2.2 (Separate pools)
      └─> perf-1.2.3 (Query queuing)
```

**Mitigation Strategies:**

1. **Independent Implementation**
   - `perf-1.2.4` (Supabase pooling) can be done immediately
   - No dependencies on other tasks

2. **Sequential but Fast**
   - Each task builds on previous (1-2 days each)
   - Can be done in parallel with Redis work

3. **Risk Mitigation**
   - **Risk:** Connection pool exhaustion during transition
   - **Mitigation:** Increase pool size gradually (10 → 25 → 50)
   - **Risk:** Supabase connection limits
   - **Mitigation:** Check Supabase plan limits before increasing

**Implementation Order:**
1. **Day 1:** `perf-1.2.4` (Supabase pooling) - Independent
2. **Day 2:** `perf-1.2.1` (Increase pool size)
3. **Day 3:** `perf-1.2.2` (Separate pools)
4. **Day 4:** `perf-1.2.3` (Query queuing)

---

### 🟠 HIGH: Prioritization Scores for Early Termination

**Blocking Tasks:**
- `perf-2.2.2` - Early termination strategy (requires prioritization scores)
- **Dependency:** Prioritization must be implemented first (already exists in codebase)

**Current State:**
- ✅ Prioritization exists in `SearchService.runEventDiscovery()` (line 2352)
- ✅ Uses `OptimizedAIService.processRequest()` for prioritization
- ⚠️ **ISSUE:** Prioritization scores may not be passed to extraction

**Mitigation Strategies:**

1. **Verify Existing Implementation**
   - Check if prioritization scores are available in extraction route
   - Ensure scores are passed from search to extraction

2. **Quick Fix if Missing**
   - Extract prioritization scores from `prioritization` result
   - Pass scores as metadata to extraction route
   - Sort URLs by score before extraction

3. **Fallback**
   - If prioritization not available, use URL order as priority
   - Implement basic scoring based on URL patterns

**Implementation Order:**
1. **Day 1:** Verify prioritization scores are available
2. **Day 1:** If missing, add score passing mechanism
3. **Day 2:** Implement early termination with scores

---

### 🟠 HIGH: Performance Monitoring Infrastructure

**Blocking Tasks:**
- `perf-monitoring-1` - Performance monitoring setup
- `perf-monitoring-2` - Resource usage monitoring
- `perf-monitoring-3` - User experience metrics

**Dependencies:**
- All monitoring tasks can be done in parallel
- No blocking dependencies
- Should be set up early to track improvements

**Mitigation Strategies:**

1. **Parallel Implementation**
   - All 3 monitoring tasks can be done simultaneously
   - Use different developers or sequential same developer

2. **Early Setup**
   - Set up basic monitoring before Phase 1 changes
   - Establish baseline metrics
   - Track improvements as changes are made

3. **Tool Dependencies**
   - Vercel Analytics: Already available
   - Supabase Dashboard: Already available
   - Custom Dashboard: Needs to be built

**Implementation Order:**
1. **Day 1:** Set up Vercel Analytics and Supabase monitoring
2. **Day 2:** Implement custom metrics collection
3. **Day 3:** Build dashboard (can be done in parallel with other work)

---

## Medium Dependencies

### 🟡 MEDIUM: Background Job Infrastructure

**Blocking Tasks:**
- `perf-1.3.4` - Move non-critical operations to background
- `perf-2.3.4` - Move AI enhancement to background
- `perf-3.2.2` - Pre-warm cache (background job)
- `perf-1.1.3` - Cache warming strategy (background job)

**Dependencies:**
- Requires background job system (Vercel Cron, Supabase Edge Functions, or external service)
- WebSocket/SSE for real-time updates (see below)

**Mitigation Strategies:**

1. **Use Existing Infrastructure**
   - Vercel Cron for scheduled jobs
   - Supabase Edge Functions for background processing
   - Vercel Queue for job queuing (if available)

2. **Progressive Implementation**
   - Start with Vercel Cron for cache warming
   - Add background processing incrementally
   - Use database queue table as fallback

3. **Fallback**
   - If background jobs not available, use async processing
   - Fire-and-forget pattern with error logging
   - Update cache/UI on next request

**Implementation Order:**
1. **Week 2:** Set up Vercel Cron for cache warming
2. **Week 3:** Implement background processing for enhancements
3. **Week 4:** Add real-time updates (if WebSocket/SSE ready)

---

### 🟡 MEDIUM: WebSocket/SSE Infrastructure

**Blocking Tasks:**
- `perf-1.3.3` - Progressive result streaming
- `perf-1.3.4` - Background updates via WebSocket/SSE
- `perf-2.2.3` - Progressive results for extraction

**Dependencies:**
- Requires WebSocket or Server-Sent Events (SSE) infrastructure
- Frontend must support streaming updates

**Mitigation Strategies:**

1. **Start with SSE (Simpler)**
   - Server-Sent Events easier to implement than WebSocket
   - Built into Next.js/React
   - No additional infrastructure needed

2. **Progressive Enhancement**
   - Implement streaming as enhancement
   - Fallback to polling if streaming not available
   - Graceful degradation for older clients

3. **Alternative: Polling**
   - Use polling as temporary solution
   - Poll for updates every 2-3 seconds
   - Upgrade to SSE/WebSocket later

**Implementation Order:**
1. **Week 4:** Implement SSE for progressive results
2. **Week 5:** Add WebSocket for real-time updates (optional)
3. **Week 6:** Optimize and add fallbacks

---

### 🟡 MEDIUM: Batch API Availability

**Blocking Tasks:**
- `perf-2.2.5` - Batch extraction API
- `perf-2.3.3` - Optimize AI batch processing

**Dependencies:**
- Requires Firecrawl batch API (need to verify availability)
- Requires Gemini batch API (need to verify availability)

**Mitigation Strategies:**

1. **Verify API Availability**
   - Check Firecrawl documentation for batch API
   - Check Gemini API for batch processing
   - Test with small batches first

2. **Fallback: Manual Batching**
   - If batch API not available, implement manual batching
   - Group requests and process in parallel
   - Use existing parallel processing infrastructure

3. **Progressive Implementation**
   - Start with manual batching
   - Upgrade to batch API when available
   - Monitor performance improvements

**Implementation Order:**
1. **Week 4:** Verify batch API availability
2. **Week 5:** Implement manual batching if needed
3. **Week 6:** Upgrade to batch API if available

---

## Dependency Matrix

### Phase 1 Dependencies

| Task | Depends On | Can Start | Blocked By |
|------|-----------|-----------|-----------|
| perf-1.1.1 | None | ✅ Day 1 | None |
| perf-1.1.2 | perf-1.1.1 | ⚠️ Day 2 | Redis setup |
| perf-1.3.1 | None | ✅ Day 1 | None |
| perf-1.3.2 | None | ✅ Day 1 | None |
| perf-2.1.1 | None | ✅ Day 1 | None |
| perf-2.1.2 | None | ✅ Day 1 | None |
| perf-2.1.3 | perf-1.1.1 | ⚠️ Day 2 | Redis setup |
| perf-2.2.1 | None | ✅ Day 1 | None |

### Phase 2 Dependencies

| Task | Depends On | Can Start | Blocked By |
|------|-----------|-----------|-----------|
| perf-1.2.1 | None | ✅ Week 2 | None |
| perf-1.2.2 | perf-1.2.1 | ⚠️ Week 2 Day 2 | Pool increase |
| perf-1.2.3 | perf-1.2.2 | ⚠️ Week 2 Day 3 | Separate pools |
| perf-1.2.4 | None | ✅ Week 2 Day 1 | None |
| perf-2.2.2 | Prioritization | ⚠️ Week 2 | Verify scores |
| perf-2.2.4 | perf-1.1.1 | ⚠️ Week 2 | Redis setup |
| perf-2.4.1 | None | ✅ Week 2 | None |
| perf-2.4.2 | None | ✅ Week 2 | None |
| perf-2.4.3 | None | ✅ Week 2 | None |
| perf-monitoring-* | None | ✅ Week 2 | None |

### Phase 3 Dependencies

| Task | Depends On | Can Start | Blocked By |
|------|-----------|-----------|-----------|
| perf-1.4.1 | perf-1.1.1 | ⚠️ Week 4 | Redis setup |
| perf-1.4.2 | perf-1.4.1 | ⚠️ Week 4 | Rate limiting |
| perf-1.4.3 | perf-1.4.1 | ⚠️ Week 4 | Rate limiting |
| perf-1.3.3 | SSE/WebSocket | ⚠️ Week 4 | Infrastructure |
| perf-1.3.4 | SSE/WebSocket | ⚠️ Week 4 | Infrastructure |
| perf-2.2.3 | SSE/WebSocket | ⚠️ Week 4 | Infrastructure |
| perf-2.2.5 | Batch API | ⚠️ Week 4 | API availability |
| perf-2.3.1 | None | ✅ Week 4 | None |
| perf-2.3.2 | perf-1.1.1 | ⚠️ Week 4 | Redis setup |
| perf-2.3.3 | Batch API | ⚠️ Week 4 | API availability |
| perf-2.3.4 | SSE/WebSocket | ⚠️ Week 4 | Infrastructure |
| perf-2.4.4 | perf-1.1.1 | ⚠️ Week 4 | Redis setup |
| perf-3.1.1 | perf-1.4.1 | ⚠️ Week 5 | Rate limiting |
| perf-3.1.2 | perf-1.1.1 | ⚠️ Week 4 | Redis setup |
| perf-3.2.1 | None | ✅ Week 4 | None |
| perf-3.2.2 | Background jobs | ⚠️ Week 4 | Infrastructure |
| perf-3.2.3 | None | ✅ Week 4 | None |
| perf-3.3.1 | None | ✅ Week 4 | None |
| perf-3.3.2 | perf-1.1.1 | ⚠️ Week 4 | Redis setup |

---

## Mitigation Roadmap

### Week 1: Foundation (Critical Path)

**Day 1:**
- ✅ **Morning:** Verify/configure Redis connection
- ✅ **Afternoon:** Refactor search route to use `UnifiedCacheService`
- ✅ **Parallel:** Start parallelization tasks (perf-1.3.1, perf-1.3.2, perf-2.1.1, perf-2.1.2, perf-2.2.1)

**Day 2:**
- ✅ **Morning:** Complete Redis setup and test
- ✅ **Afternoon:** Implement multi-level cache (perf-1.1.2)
- ✅ **Parallel:** Continue parallelization tasks

**Day 3-5:**
- ✅ Complete all Phase 1 critical tasks
- ✅ Set up basic monitoring (perf-monitoring-1)
- ✅ Test and validate improvements

### Week 2-3: Database & Optimization

**Week 2:**
- ✅ Database pool optimization (perf-1.2.1, perf-1.2.2, perf-1.2.3, perf-1.2.4)
- ✅ Database query optimization (perf-2.4.1, perf-2.4.2, perf-2.4.3)
- ✅ Early termination (perf-2.2.2)
- ✅ Extraction caching (perf-2.2.4) - if Redis ready
- ✅ Complete monitoring setup (perf-monitoring-2, perf-monitoring-3)

**Week 3:**
- ✅ Complete any remaining Phase 2 tasks
- ✅ Performance testing and validation
- ✅ Prepare for Phase 3

### Week 4-6: Advanced Features

**Week 4:**
- ✅ Set up background job infrastructure
- ✅ Set up SSE/WebSocket infrastructure
- ✅ Verify batch API availability
- ✅ Start Phase 3 tasks that don't depend on infrastructure

**Week 5-6:**
- ✅ Complete all Phase 3 tasks
- ✅ Final performance testing
- ✅ Documentation and handoff

---

## Risk Mitigation Checklist

### Before Starting Phase 1
- [ ] Verify Redis connection or set up Upstash account
- [ ] Test `UnifiedCacheService` with existing infrastructure
- [ ] Verify Supabase connection pool limits
- [ ] Set up basic monitoring dashboard
- [ ] Create rollback plan for each major change

### During Phase 1
- [ ] Monitor Redis connection health
- [ ] Track cache hit rates
- [ ] Monitor database connection pool usage
- [ ] Set up alerts for performance degradation
- [ ] Test with multiple concurrent users

### Before Starting Phase 2
- [ ] Verify database pool changes don't exceed Supabase limits
- [ ] Test early termination with real data
- [ ] Verify prioritization scores are available
- [ ] Set up database index monitoring

### Before Starting Phase 3
- [ ] Verify background job infrastructure is ready
- [ ] Test SSE/WebSocket connectivity
- [ ] Verify batch API availability
- [ ] Set up cost monitoring

---

## Parallel Work Streams

### Stream A: Caching & Infrastructure (Critical Path)
- Developer 1: Redis setup and cache refactoring
- **Tasks:** perf-1.1.1, perf-1.1.2, perf-2.1.3, perf-2.2.4, perf-2.3.2, perf-2.4.4

### Stream B: Parallelization (Independent)
- Developer 2: Code parallelization
- **Tasks:** perf-1.3.1, perf-1.3.2, perf-2.1.1, perf-2.1.2, perf-2.2.1

### Stream C: Database Optimization (Independent)
- Developer 3: Database improvements
- **Tasks:** perf-1.2.1, perf-1.2.2, perf-1.2.3, perf-1.2.4, perf-2.4.1, perf-2.4.2, perf-2.4.3

### Stream D: Monitoring & Testing (Support)
- Developer 4: Monitoring and validation
- **Tasks:** perf-monitoring-1, perf-monitoring-2, perf-monitoring-3, testing

---

## Critical Success Factors

1. **Redis Setup Must Be Day 1 Priority**
   - Blocks 8+ tasks
   - Can use Supabase fallback temporarily
   - Must be stable before Phase 2

2. **Parallelization Can Start Immediately**
   - No dependencies
   - High impact
   - Can be done in parallel with Redis work

3. **Database Changes Need Careful Testing**
   - Monitor connection pool usage
   - Test with multiple users
   - Have rollback plan ready

4. **Infrastructure for Phase 3 Should Start Early**
   - Background jobs: Week 2
   - SSE/WebSocket: Week 3
   - Batch APIs: Week 3 (verification)

---

## Conclusion

**Critical Path:** Redis setup → Multi-level cache → All cache-dependent tasks

**Fast Track:** Parallelization tasks can proceed immediately (no dependencies)

**Risk Areas:**
1. Redis connection issues (mitigate with Supabase fallback)
2. Database pool limits (mitigate with gradual increase)
3. Infrastructure for Phase 3 (mitigate with early setup)

**Recommendation:** Start with Redis setup and parallelization in parallel on Day 1. This unblocks the most tasks and provides immediate performance improvements.

---

**Last Updated:** 2025-01-27

