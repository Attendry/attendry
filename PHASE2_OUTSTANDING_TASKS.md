# Phase 2 Outstanding Tasks

**Date:** 2025-11-15  
**Status:** All tasks pending (0/13 completed)  
**Expected Impact:** 30-40% additional improvement, better scalability

---

## 📊 Phase 2 Overview

| Category | Tasks | Status |
|----------|-------|--------|
| **Database Optimization** | 6 | 0/6 ⏳ |
| **Extraction Optimization** | 3 | 0/3 ⏳ |
| **Database Writes** | 1 | 0/1 ⏳ |
| **Monitoring** | 3 | 0/3 ⏳ |
| **Total** | **13** | **0/13** ⏳ |

---

## 🗄️ Database Optimization (6 tasks)

### 1. **perf-1.2.1** - Increase database connection pool size
- **Location:** `src/lib/database-pool.ts`
- **Current:** maxConnections: 10
- **Change:** 
  - Increase maxConnections from 10 to 50
  - Add minConnections: 5
  - Add healthCheckInterval: 30000
- **Impact:** Better handling of concurrent requests
- **Effort:** Low (1-2 hours)

### 2. **perf-1.2.2** - Implement separate connection pools per operation type
- **Location:** `src/lib/database-pool.ts`
- **Change:**
  - Read pool: 30 connections
  - Write pool: 10 connections
  - Admin pool: 5 connections
- **Impact:** Optimized connection allocation for different operation types
- **Effort:** Medium (3-4 hours)

### 3. **perf-1.2.3** - Add query queuing for database pool
- **Location:** `src/lib/database-pool.ts`
- **Change:**
  - Priority queue: search > extraction > analytics
  - Max wait time: 10 seconds before timeout
- **Impact:** Better handling of high-load scenarios
- **Effort:** Medium (3-4 hours)

### 4. **perf-1.2.4** - Configure Supabase connection pooling
- **Location:** Database configuration
- **Change:**
  - Use Supabase pooler connection string
  - Implement transaction mode for read-heavy operations
- **Impact:** Better connection management with Supabase
- **Effort:** Low (1-2 hours)

### 5. **perf-2.4.1** - Batch database queries
- **Location:** Various service files
- **Change:**
  - Use `Promise.all()` to load search config and user profile in parallel
  - Combine cache lookups into single queries where possible
- **Impact:** Reduced database round trips
- **Effort:** Low (2-3 hours)
- **Note:** Some parallelization already implemented in Phase 1

### 6. **perf-2.4.2** - Add database indexes
- **Location:** Database migrations
- **Indexes to create:**
  - `idx_search_cache_key` on `search_cache(cache_key, ttl_at)`
  - `idx_ai_decisions_hash` on `ai_decisions(item_hash)`
  - `idx_url_extractions_normalized` on `url_extractions(url_normalized)`
  - `idx_extracted_metadata_url_hash` on `extracted_metadata(url_hash, expires_at)`
- **Impact:** Faster database queries
- **Effort:** Low (1-2 hours)

---

## 🔄 Extraction Optimization (3 tasks)

### 7. **perf-2.2.2** - Implement early termination strategy
- **Location:** `src/lib/optimized-orchestrator.ts`
- **Change:**
  - Stop extraction once 10 high-quality events found
  - Use prioritization scores to extract best URLs first
  - Skip low-priority URLs if time limit approaching
  - **ENHANCED:** Also stop chunk processing once core fields extracted (partially done in Phase 1)
- **Impact:** Faster extraction when enough events found
- **Effort:** Medium (2-3 hours)
- **Note:** Early termination for chunks already implemented in Phase 1 (perf-ext-5)

### 8. **perf-2.2.4** - Implement extraction caching
- **Location:** `src/lib/optimized-orchestrator.ts`
- **Change:**
  - Cache extracted events by URL with 24 hour TTL
  - Skip extraction if URL already cached
  - Background refresh for stale cache entries
  - **ENHANCED:** Cache both metadata and speaker data separately
- **Impact:** Faster extraction for previously processed URLs
- **Effort:** Low (1-2 hours)
- **Note:** Basic caching already implemented in Phase 1 (perf-ext-3), this enhances it

### 9. **perf-ext-6** - Optimize chunk processing parallelism
- **Location:** `src/lib/event-analysis.ts`
- **Current:** Chunks processed in parallel but sequentially per event
- **Change:**
  - Process all chunks from all events in single parallel batch
  - Collect all chunks from all events
  - Process in single Promise.all() batch
  - Distribute results back to events
- **Impact:** Additional 20-30% improvement
- **Effort:** Medium (3-4 hours)
- **Note:** This is different from perf-ext-1/2 which batch within a single event

---

## 💾 Database Writes (1 task)

### 10. **perf-2.4.3** - Make database writes async
- **Location:** `src/app/api/events/search/route.ts`
- **Change:**
  - Don't await database saves in search route
  - Use `.catch()` for error handling
  - Apply to `saveSearchResults()` and `writeSearchCacheDB()`
- **Impact:** Faster response times (non-blocking writes)
- **Effort:** Low (1-2 hours)

---

## 📊 Monitoring (3 tasks)

### 11. **perf-monitoring-1** - Set up performance monitoring
- **Location:** New monitoring service
- **Metrics to track:**
  - Average search time (p50, p95, p99)
  - Cache hit rate
  - API call count per search
  - Database query count per search
  - **NEW:** Extraction time per URL, Gemini API call count
- **Tools:** Vercel Analytics and custom dashboard
- **Impact:** Visibility into performance bottlenecks
- **Effort:** Medium (4-6 hours)

### 12. **perf-monitoring-2** - Set up resource usage monitoring
- **Location:** New monitoring service
- **Metrics to track:**
  - Database connection pool utilization
  - API rate limit usage
  - Cache memory usage
  - Function execution time
  - **NEW:** Gemini API latency, extraction pipeline metrics
- **Alerts:** Set up alerts for thresholds
- **Impact:** Proactive issue detection
- **Effort:** Medium (4-6 hours)

### 13. **perf-monitoring-3** - Set up user experience metrics
- **Location:** New monitoring service
- **Metrics to track:**
  - Time to first result
  - Time to complete results
  - Error rate
  - **NEW:** Time to first extracted event, extraction completion rate
- **Dashboard:** Create user satisfaction score dashboard
- **Impact:** Better understanding of user experience
- **Effort:** Medium (4-6 hours)

---

## 📋 Implementation Priority

### High Priority (Start Here)
1. **perf-2.4.2** - Add database indexes (easiest, high impact)
2. **perf-2.4.1** - Batch database queries (already partially done)
3. **perf-2.4.3** - Make database writes async (quick win)
4. **perf-1.2.1** - Increase connection pool size (foundational)

### Medium Priority
5. **perf-1.2.4** - Configure Supabase pooling
6. **perf-2.2.2** - Early termination strategy
7. **perf-2.2.4** - Enhanced extraction caching
8. **perf-ext-6** - Chunk processing parallelism

### Lower Priority (Can be done in parallel)
9. **perf-1.2.2** - Separate connection pools
10. **perf-1.2.3** - Query queuing
11. **perf-monitoring-1** - Performance monitoring
12. **perf-monitoring-2** - Resource monitoring
13. **perf-monitoring-3** - UX metrics

---

## 🎯 Expected Impact After Phase 2

| Metric | After Phase 1 | After Phase 2 | Additional Improvement |
|--------|---------------|---------------|----------------------|
| **Extraction (Cold)** | 10-15s | **8-12s** | **20-30% faster** |
| **Database Queries** | Baseline | **50% faster** | Better scalability |
| **Response Time** | Baseline | **20-30% faster** | Non-blocking writes |
| **Visibility** | None | **Full monitoring** | Better insights |

---

## 📝 Notes

- **Database tasks** can be done in parallel with monitoring setup
- **Monitoring tasks** can be done in parallel with each other
- **Extraction optimizations** build on Phase 1 work
- Some tasks (like perf-2.4.1) are already partially implemented

---

**Total Estimated Effort:** ~40-60 hours  
**Recommended Timeline:** Week 2-3

