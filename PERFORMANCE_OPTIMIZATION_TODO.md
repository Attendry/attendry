# Performance Optimization TODO List

**Generated from:** PERFORMANCE_ARCHITECTURE_REVIEW.md  
**Date:** 2025-01-27  
**Total Items:** 37 tasks

---

## Phase 1: Critical Fixes (Week 1)
**Expected Impact:** 50-70% reduction in search time

### Caching (3 tasks)
- [ ] **perf-1.1.1** - Implement Redis/Distributed Cache
  - Replace in-memory Map in `src/app/api/events/search/route.ts` with Redis (Upstash/Vercel KV)
  - Cache key: `search:{query_hash}:{country}:{date_range}`
  - TTL: 6 hours for search results, 24 hours for extracted events

- [ ] **perf-1.1.2** - Implement multi-level caching
  - L1: In-memory (5 min TTL)
  - L2: Redis (6 hour TTL)
  - L3: Database (24 hour TTL)
  - Update cache service to check all three levels

- [ ] **perf-1.1.3** - Implement cache warming strategy (Phase 3)
  - Background job to pre-populate cache with common queries
  - Cache-aside pattern with database fallback

### Parallelization (4 tasks)
- [ ] **perf-1.3.1** - Parallelize independent database operations
  - In `src/lib/services/search-service.ts runEventDiscovery()`
  - Use `Promise.all()` to load searchConfig and userProfile in parallel

- [ ] **perf-1.3.2** - Parallelize search execution and database cache check
  - In `SearchService.executeSearch()`
  - Run `executeSearch()` and `checkDatabaseForEvents()` in parallel

- [ ] **perf-2.1.1** - Parallelize search provider attempts
  - In `src/lib/search/unified-search-core.ts unifiedSearch()`
  - Use `Promise.allSettled()` to try Firecrawl, CSE, and database in parallel
  - Use first successful result

- [ ] **perf-2.1.2** - Implement smart timeout strategy
  - Firecrawl: 8s timeout
  - CSE: 5s timeout
  - Database: 2s timeout
  - Total max: 8s instead of 60s

### Cache Optimization (2 tasks)
- [ ] **perf-2.1.3** - Implement unified cache check
  - Check cache once before trying any provider
  - Cache key includes provider preference
  - Return cached result immediately

- [ ] **perf-2.2.1** - Increase extraction concurrency
  - In `src/app/api/events/extract/route.ts`
  - Increase limit from 4 to 12 concurrent extractions
  - Increase targets from 15 to 20 URLs

---

## Phase 2: High Priority (Week 2-3)
**Expected Impact:** 30-40% additional improvement, better scalability

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

### Extraction Optimization (2 tasks)
- [ ] **perf-2.2.2** - Implement early termination strategy
  - Stop extraction once 10 high-quality events found
  - Use prioritization scores to extract best URLs first
  - Skip low-priority URLs if time limit approaching

- [ ] **perf-2.2.4** - Implement extraction caching
  - Cache extracted events by URL with 24 hour TTL
  - Skip extraction if URL already cached
  - Background refresh for stale cache entries

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
  - Use Vercel Analytics and custom dashboard

- [ ] **perf-monitoring-2** - Set up resource usage monitoring
  - Database connection pool utilization
  - API rate limit usage
  - Cache memory usage
  - Function execution time
  - Set up alerts for thresholds

- [ ] **perf-monitoring-3** - Set up user experience metrics
  - Time to first result
  - Time to complete results
  - Error rate
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

- [ ] **perf-2.3.3** - Optimize AI batch processing
  - Process multiple items in single AI call
  - Use batch API when available
  - Optimize token usage

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

### 🔴 CRITICAL (9 tasks) - Week 1
- Caching: 2 tasks
- Parallelization: 4 tasks
- Cache optimization: 2 tasks
- Extraction concurrency: 1 task

### 🟠 HIGH (10 tasks) - Week 2-3
- Database optimization: 6 tasks
- Extraction optimization: 2 tasks
- Database writes: 1 task
- Monitoring: 3 tasks (can start in parallel)

### 🟡 MEDIUM (18 tasks) - Week 4-6
- Rate limiting: 3 tasks
- Progressive results: 2 tasks
- Extraction enhancements: 2 tasks
- AI optimization: 4 tasks
- Database caching: 1 task
- Scalability: 5 tasks
- Cost optimization: 2 tasks

---

## Quick Start Guide

### Immediate Actions (Day 1)
1. Set up Redis/Upstash account
2. Implement distributed cache (perf-1.1.1)
3. Parallelize search providers (perf-2.1.1)
4. Increase extraction concurrency (perf-2.2.1)

### Week 1 Focus
- All Phase 1 critical tasks
- Expected: 50-70% performance improvement

### Week 2-3 Focus
- Database optimization
- Monitoring setup
- Expected: 30-40% additional improvement

### Week 4-6 Focus
- User experience enhancements
- Cost optimization
- Advanced features

---

## Notes

- **No code changes should be made without approval**
- Each task should be tested independently
- Monitor performance metrics after each phase
- Roll back if performance degrades
- Document all changes in code comments

---

**Last Updated:** 2025-01-27

