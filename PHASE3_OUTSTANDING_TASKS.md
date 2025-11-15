# Phase 3 Outstanding Tasks

**Date:** 2025-11-15  
**Status:** All tasks pending (0/19 completed)  
**Expected Impact:** Better user experience, reduced costs, improved scalability

---

## 📊 Phase 3 Overview

| Category | Tasks | Status |
|----------|-------|--------|
| **Rate Limiting** | 3 | 0/3 ⏳ |
| **Progressive Results** | 2 | 0/2 ⏳ |
| **Extraction Enhancements** | 2 | 0/2 ⏳ |
| **AI Optimization** | 4 | 0/4 ⏳ |
| **Database Caching** | 1 | 0/1 ⏳ |
| **Scalability** | 5 | 0/5 ⏳ |
| **Cost Optimization** | 2 | 0/2 ⏳ |
| **Total** | **19** | **0/19** ⏳ |

---

## 🚦 Rate Limiting (3 tasks)

### 1. **perf-1.4.1** - Implement centralized rate limit service
- **Location:** New service file
- **Change:**
  - Create `RateLimitService` using Redis
  - Track limits for firecrawl, cse, and gemini services
  - 1-minute windows
- **Impact:** Prevent API quota exhaustion, better cost control
- **Effort:** Medium (4-6 hours)

### 2. **perf-1.4.2** - Implement request queuing with priority
- **Location:** New service file
- **Change:**
  - Queue requests when rate limit hit
  - Priority: user-initiated > background > cron
  - Max queue time: 30 seconds
- **Impact:** Better handling of rate limit scenarios
- **Effort:** Medium (4-6 hours)
- **Note:** Similar to database query queuing (perf-1.2.3) but for API requests

### 3. **perf-1.4.3** - Implement adaptive rate limiting
- **Location:** Rate limit service
- **Change:**
  - Monitor API response times
  - Reduce rate when APIs are slow
  - Increase rate when APIs are fast
- **Impact:** Optimize API usage based on performance
- **Effort:** Medium (3-4 hours)

---

## 📡 Progressive Results (2 tasks)

### 4. **perf-1.3.3** - Implement progressive result streaming
- **Location:** API routes
- **Change:**
  - Use async generators to return partial results
  - Implement Server-Sent Events (SSE) or WebSocket
  - Real-time updates
- **Impact:** Better user experience - see results as they come in
- **Effort:** High (6-8 hours)
- **Note:** Requires frontend changes

### 5. **perf-1.3.4** - Move non-critical operations to background
- **Location:** API routes and background jobs
- **Change:**
  - Move event enhancement and analytics to background jobs
  - Return initial results immediately
  - Update via WebSocket/SSE when enhancement completes
  - **ENHANCED:** Also move prioritization to background
- **Impact:** Faster initial response, better perceived performance
- **Effort:** High (6-8 hours)
- **Note:** Requires background job system (Vercel Cron, Queue, etc.)

---

## 🔄 Extraction Enhancements (2 tasks)

### 6. **perf-2.2.3** - Implement progressive results for extraction
- **Location:** Extraction API route
- **Change:**
  - Return results as they are extracted
  - Use Server-Sent Events (SSE) or WebSocket
  - Show partial results in UI immediately
- **Impact:** Users see events as they're extracted
- **Effort:** Medium (4-6 hours)
- **Note:** Requires frontend changes

### 7. **perf-2.2.5** - Implement batch extraction API
- **Location:** Extraction service
- **Change:**
  - Use Firecrawl batch API if available
  - Extract multiple URLs in single API call
  - Reduce API overhead
- **Impact:** Faster extraction for multiple URLs
- **Effort:** Medium (3-4 hours)
- **Note:** Depends on Firecrawl batch API availability

---

## 🤖 AI Optimization (4 tasks)

### 8. **perf-2.3.1** - Combine AI operations
- **Location:** `GeminiService`
- **Change:**
  - Create single AI call for filter + prioritize
  - Returns both filtered items and priority scores
  - In `GeminiService`
- **Impact:** Reduce AI API calls by 50%
- **Effort:** Medium (3-4 hours)

### 9. **perf-2.3.2** - Cache AI decisions
- **Location:** AI service and cache
- **Change:**
  - Cache AI decisions by URL hash in Redis
  - Key: `ai_decision:{item_hash}`
  - Check cache before making AI calls
  - **ENHANCED:** Also cache prioritization results
- **Impact:** Faster AI decisions, reduced API calls
- **Effort:** Low (2-3 hours)
- **Note:** Some caching already exists, this enhances it

### 10. **perf-2.3.3** - Optimize AI batch processing
- **Location:** AI service
- **Change:**
  - Process multiple items in single AI call
  - Use batch API when available
  - Optimize token usage
  - **ENHANCED:** Already implemented in perf-ext-1 and perf-ext-2
- **Impact:** Already optimized
- **Effort:** ✅ **Already done** (perf-ext-1, perf-ext-2)
- **Status:** Can be marked as complete

### 11. **perf-2.3.4** - Move AI enhancement to background
- **Location:** API routes and background jobs
- **Change:**
  - Return search results immediately
  - Enhance events in background
  - Update UI when enhancement completes
- **Impact:** Faster initial response
- **Effort:** Medium (4-6 hours)

---

## 💾 Database Caching (1 task)

### 12. **perf-2.4.4** - Implement query result caching
- **Location:** Service files
- **Change:**
  - Cache frequently accessed data (config, user profiles) in Redis
  - Invalidate cache on updates
  - TTL: 1 hour for config, 5 minutes for user profiles
- **Impact:** Faster config/profile loading
- **Effort:** Low (2-3 hours)

---

## 📈 Scalability (5 tasks)

### 13. **perf-3.1.1** - Implement per-user rate limiting
- **Location:** New service file
- **Change:**
  - Add per-user quotas for API calls
  - Track usage per user ID
  - Implement usage quotas per user
- **Impact:** Fair resource allocation, prevent abuse
- **Effort:** Medium (4-6 hours)

### 14. **perf-3.1.2** - Add request priority queue
- **Location:** New service file
- **Change:**
  - Priority queue for requests
  - user-initiated > background > cron
  - Use Redis for queue management
- **Impact:** Better handling of concurrent requests
- **Effort:** Medium (4-6 hours)
- **Note:** Similar to perf-1.4.2 but for all requests, not just rate-limited

### 15. **perf-3.2.1** - Keep functions warm
- **Location:** Cron jobs / Vercel config
- **Change:**
  - Scheduled pings to keep serverless functions warm
  - Use Vercel cron or external service
- **Impact:** Eliminate cold starts
- **Effort:** Low (1-2 hours)

### 16. **perf-3.2.2** - Pre-warm cache
- **Location:** Background jobs
- **Change:**
  - Background job to pre-warm cache with common queries
  - Run during off-peak hours
- **Impact:** Better cache hit rates
- **Effort:** Medium (3-4 hours)
- **Note:** Some cache warming already exists, this enhances it

### 17. **perf-3.2.3** - Implement edge caching
- **Location:** Vercel/Cloudflare config
- **Change:**
  - Use Vercel Edge Cache or Cloudflare
  - Cache search configs and user profiles at edge
- **Impact:** Faster global response times
- **Effort:** Low (2-3 hours)

---

## 💰 Cost Optimization (2 tasks)

### 18. **perf-3.3.1** - Implement cost monitoring
- **Location:** New monitoring service
- **Change:**
  - Metrics tracking for API costs per user
  - Create dashboard for cost analysis
  - Set up alerts for cost thresholds
- **Impact:** Better cost visibility and control
- **Effort:** Medium (4-6 hours)

### 19. **perf-3.3.2** - Deduplicate extractions globally
- **Location:** Extraction service
- **Change:**
  - Check global cache before extracting
  - Share extraction results across all users
  - Use URL hash as cache key
- **Impact:** Reduced API costs, faster extraction
- **Effort:** Low (2-3 hours)
- **Note:** Partially implemented (perf-ext-3), this makes it global

---

## 📋 Implementation Priority

### High Impact, Low Effort (Start Here)
1. **perf-3.2.1** - Keep functions warm (1-2 hours)
2. **perf-3.2.3** - Edge caching (2-3 hours)
3. **perf-2.4.4** - Query result caching (2-3 hours)
4. **perf-3.3.2** - Global deduplication (2-3 hours)
5. **perf-2.3.2** - Cache AI decisions (2-3 hours)

### High Impact, Medium Effort
6. **perf-1.4.1** - Centralized rate limiting (4-6 hours)
7. **perf-2.3.1** - Combine AI operations (3-4 hours)
8. **perf-3.2.2** - Pre-warm cache (3-4 hours)
9. **perf-1.4.3** - Adaptive rate limiting (3-4 hours)

### High Impact, High Effort (Requires Frontend)
10. **perf-1.3.3** - Progressive result streaming (6-8 hours)
11. **perf-1.3.4** - Background operations (6-8 hours)
12. **perf-2.2.3** - Progressive extraction (4-6 hours)

### Medium Priority
13. **perf-1.4.2** - Request queuing (4-6 hours)
14. **perf-2.2.5** - Batch extraction API (3-4 hours)
15. **perf-2.3.4** - Background AI enhancement (4-6 hours)
16. **perf-3.1.1** - Per-user rate limiting (4-6 hours)
17. **perf-3.1.2** - Request priority queue (4-6 hours)
18. **perf-3.3.1** - Cost monitoring (4-6 hours)

---

## 🎯 Expected Impact After Phase 3

| Metric | After Phase 2 | After Phase 3 | Additional Improvement |
|--------|---------------|---------------|----------------------|
| **User Experience** | Good | **Excellent** | Progressive results, faster perceived performance |
| **API Costs** | Baseline | **30-50% reduction** | Rate limiting, caching, deduplication |
| **Scalability** | Good | **Excellent** | Per-user limits, priority queues |
| **Cold Starts** | Present | **Eliminated** | Function warming |
| **Global Performance** | Baseline | **20-30% faster** | Edge caching |

---

## 📝 Notes

- **perf-2.3.3** can be marked as complete (already done in Phase 1)
- **Progressive results** tasks require frontend changes
- **Background jobs** require infrastructure (Vercel Cron, Queue, etc.)
- **Rate limiting** builds on existing request queue infrastructure
- **Edge caching** is infrastructure-level, minimal code changes

---

## 🚀 Recommended Implementation Order

### Week 1: Quick Wins
1. Keep functions warm
2. Edge caching
3. Query result caching
4. Global deduplication
5. Cache AI decisions

### Week 2: Rate Limiting & Caching
6. Centralized rate limiting
7. Combine AI operations
8. Pre-warm cache
9. Adaptive rate limiting

### Week 3: Progressive Results (if frontend ready)
10. Progressive result streaming
11. Background operations
12. Progressive extraction

### Week 4: Scalability & Monitoring
13. Per-user rate limiting
14. Request priority queue
15. Cost monitoring
16. Batch extraction API
17. Background AI enhancement

---

**Total Estimated Effort:** ~80-120 hours  
**Recommended Timeline:** Week 4-6 (4-6 weeks)

