# End-to-End Application Audit Report

**Date:** February 26, 2025  
**Scope:** Complete application architecture, Firecrawl usage, performance, and optimization opportunities  
**Status:** Comprehensive Analysis Complete

---

## Executive Summary

This audit provides a comprehensive analysis of the Attendry application, with particular focus on Firecrawl integration and optimization opportunities. The application is a sophisticated event intelligence platform with strong technical foundations, but several areas require attention to improve performance, maintainability, and cost efficiency.

### Key Findings

**Strengths:**
- ✅ Well-structured codebase with clear separation of concerns
- ✅ Comprehensive error handling and retry mechanisms
- ✅ Multi-level caching strategy (L1/L2/L3)
- ✅ Circuit breaker patterns for resilience
- ✅ Strong database schema with proper indexing
- ✅ Unified search architecture consolidating multiple providers

**Critical Issues:**
- 🔴 **Firecrawl Usage:** Multiple implementations, inefficient API usage, missing v2 features
- 🔴 **Performance:** Sequential processing, N+1 queries, inefficient caching
- 🟡 **Code Duplication:** Multiple query builders, redundant search implementations
- 🟡 **Cost Optimization:** Unnecessary API calls, missing batch operations
- 🟡 **Maintainability:** Complex code paths, inconsistent patterns

**Priority Recommendations:**
1. **Consolidate Firecrawl implementations** and leverage v2 unified search+extract
2. **Optimize query building** to reduce verbosity and improve relevance
3. **Implement batch operations** for Firecrawl extraction
4. **Fix N+1 query patterns** in frontend components
5. **Improve caching strategy** for better hit rates

---

## 1. Firecrawl Usage Analysis

### 1.1 Current Implementation Overview

The application has **multiple Firecrawl implementations** across different files:

1. **`src/lib/services/firecrawl-search-service.ts`** (857 lines)
   - Main service class with comprehensive search logic
   - Uses Firecrawl v2 Search API
   - Implements adaptive retry with exponential backoff
   - Has rate limiting and circuit breaker integration

2. **`src/services/search/firecrawlService.ts`** (135 lines)
   - Wrapper service with backoff retry logic
   - Calls `FirecrawlSearchService` internally
   - Adds additional timeout handling

3. **`src/providers/firecrawl.ts`** (165 lines)
   - Alternative provider implementation
   - Basic search with fallback queries
   - Minimal error handling

4. **`src/lib/search/unified-search-core.ts`**
   - Unified search core that calls Firecrawl
   - Handles caching and deduplication
   - Integrates with other search providers

### 1.2 Critical Issues with Firecrawl Usage

#### Issue 1: Multiple Redundant Implementations

**Problem:**
- Three separate Firecrawl implementations with overlapping functionality
- Inconsistent error handling and retry logic
- Difficult to maintain and optimize

**Impact:**
- Code duplication increases maintenance burden
- Bug fixes must be applied in multiple places
- Inconsistent behavior across different code paths

**Recommendation:**
- **Consolidate to single implementation** (`FirecrawlSearchService`)
- Deprecate `firecrawlService.ts` and `providers/firecrawl.ts`
- Create adapter layer for backward compatibility if needed

#### Issue 2: Not Leveraging Firecrawl v2 Unified Search+Extract

**Current State:**
```typescript
// Current: Two separate API calls
1. POST /v2/search → Get URLs
2. POST /v2/extract → Extract structured data
```

**Problem:**
- Making 2 API calls when 1 would suffice
- Higher latency (sequential operations)
- Higher costs (2 operations vs 1)
- Missing opportunity to filter results based on extracted content

**Firecrawl v2 Capability:**
```typescript
// Unified: Single API call with extraction
POST /v2/search
{
  "query": "...",
  "scrapeOptions": {
    "formats": ["markdown", "html"],
    "extract": {
      "schema": EVENT_SCHEMA,
      "prompt": "Extract event details..."
    }
  }
}
```

**Impact:**
- **50% reduction in API calls** (1 instead of 2)
- **30% lower latency** (single operation)
- **Better relevance** (can filter based on extracted data)

**Recommendation:**
- **Priority: HIGH** - Implement unified search+extract
- Update `unifiedFirecrawlSearch()` to support `extractSchema` parameter
- Modify discovery pipeline to use unified approach
- Expected savings: 30-50% reduction in Firecrawl costs

#### Issue 3: Verbose Narrative Queries

**Current Query Example:**
```
Find legal & compliance business events and professional conferences in Germany (including Berlin, München, Frankfurt), scheduled through the upcoming 12 months, covering compliance, investigations, regtech, ESG, for leaders such as general counsel, compliance officer, legal counsel, with emphasis on compliance, investigations, audit, serving audiences like general counsel, chief compliance officer, prioritise events with clear dates and locations.
```

**Problems:**
- **200+ character queries** are too verbose
- Location details in query text (should use API `location` parameter)
- Date information in query (should use API date parameters)
- Dilutes search intent with redundant information

**Optimized Query:**
```
Find legal compliance conferences in Germany covering compliance, investigations, regtech, ESG for general counsel and compliance officers
```

**Recommendation:**
- **Priority: MEDIUM** - Simplify narrative queries to 80-120 characters
- Use Firecrawl API parameters for location, dates, country
- Focus query text on core search terms only
- Expected improvement: Better search relevance, faster processing

#### Issue 4: Missing Firecrawl v2 Features

**Not Currently Used:**
1. **Search Categories** - Filter by `["research"]` for event-focused results
2. **Image Extraction** - Get event images with `formats: ["images"]`
3. **Data Attributes** - Extract structured data from `data-*` attributes
4. **Natural Language Crawling** - Use prompts instead of regex patterns
5. **Enhanced PDF Parsing** - Better PDF title and metadata extraction

**Recommendation:**
- **Priority: MEDIUM** - Implement search categories for better targeting
- **Priority: LOW** - Add image extraction for richer event data
- **Priority: LOW** - Use natural language crawling prompts

#### Issue 5: Inefficient Batch Operations

**Current State:**
```typescript
// Current: Batch size of 3
if (targets.length >= 3) {
  // Use batch extraction
}
```

**Problem:**
- Firecrawl v2 supports larger batches (up to 10-20 URLs)
- Current batch size is too small
- More API calls than necessary

**Recommendation:**
- **Priority: HIGH** - Increase batch size to 10 URLs
- Process in parallel batches for large sets
- Expected improvement: 30-40% reduction in API calls for extraction

#### Issue 6: Query Building Inconsistency

**Multiple Query Builders:**
1. `src/lib/unified-query-builder.ts` - Main builder
2. `src/lib/services/weighted-query-builder.ts` - Template-based
3. `src/lib/services/search-service.ts` - Legacy builder
4. `src/lib/optimized-orchestrator.ts` - Another builder

**Problem:**
- Inconsistent query formats
- Narrative queries built differently in different places
- Hard to maintain and optimize

**Recommendation:**
- **Priority: MEDIUM** - Consolidate to single query builder
- Create adapter functions for legacy code
- Standardize narrative query format

### 1.3 Firecrawl Optimization Roadmap

#### Phase 1: Immediate (Week 1)
1. ✅ Consolidate Firecrawl implementations
2. ✅ Implement unified search+extract
3. ✅ Increase batch sizes to 10

**Expected Impact:**
- 50% reduction in API calls
- 30% lower latency
- 30-40% cost savings

#### Phase 2: Short-term (Week 2-3)
1. Simplify narrative queries (80-120 chars)
2. Use API parameters for location/dates
3. Add search categories for better targeting

**Expected Impact:**
- Better search relevance
- Faster query processing
- Improved result quality

#### Phase 3: Medium-term (Week 4+)
1. Add image extraction
2. Implement natural language crawling
3. Enhanced PDF parsing

**Expected Impact:**
- Richer event data
- Better extraction coverage
- Reduced maintenance burden

---

## 2. Performance Analysis

### 2.1 Critical Performance Bottlenecks

#### Bottleneck 1: Sequential Processing in Search Pipeline

**Current State:**
- Search providers called sequentially in some paths
- Event extraction done one-by-one instead of batches
- Prioritization blocks pipeline

**Impact:**
- Total pipeline time: 30-60 seconds
- User waits for entire pipeline to complete
- Poor perceived performance

**Recommendation:**
- **Priority: HIGH** - Parallelize provider calls (already done in unified-search-core)
- **Priority: HIGH** - Increase extraction concurrency (currently 2, should be 12)
- **Priority: MEDIUM** - Move prioritization to background job

#### Bottleneck 2: Frontend N+1 Query Problem

**Location:** `src/components/EventCard.tsx`

**Problem:**
```typescript
// Each EventCard makes individual API call
useEffect(() => {
  fetch(`/api/events/board/check?eventId=${eventId}`)
}, [eventId]);
```

**Impact:**
- Rendering 50 events = 50 simultaneous API calls
- Browser request queue flooding
- Server overload
- Delayed image/content loading

**Recommendation:**
- **Priority: HIGH** - Batch board status checks
- Fetch all event IDs in single API call
- Pass status as props to EventCard

#### Bottleneck 3: Inefficient Database Queries

**Location:** `src/app/api/events/search-enhanced/route.ts`

**Problem:**
```typescript
// Heavy OR condition without proper indexes
query.or('title.ilike.%term%,topics.cs.{term}')
```

**Impact:**
- Full table scans for complex queries
- Slow response times (500ms-2s)
- Database CPU spikes

**Recommendation:**
- **Priority: HIGH** - Add full-text search indexes
- Use PostgreSQL `tsvector` for better performance
- Implement query result pagination

#### Bottleneck 4: Cache Hit Rate Issues

**Current State:**
- Multi-level cache (L1/L2/L3) implemented
- Cache hit rate appears low in logs
- Cache keys may not be normalized properly

**Impact:**
- Unnecessary API calls
- Higher costs
- Slower responses

**Recommendation:**
- **Priority: MEDIUM** - Normalize cache keys
- Implement cache warming for popular queries
- Monitor cache hit rates and optimize TTLs

### 2.2 Performance Optimization Opportunities

#### Opportunity 1: Request Deduplication

**Current:** In-flight request deduplication exists but may not be comprehensive

**Recommendation:**
- Expand deduplication to cover more query variations
- Add request queuing for identical queries
- Expected improvement: 20-30% reduction in duplicate API calls

#### Opportunity 2: Progressive Loading

**Current:** Users wait for entire pipeline to complete

**Recommendation:**
- Stream results as they become available
- Show partial results immediately
- Expected improvement: 50% reduction in perceived latency

#### Opportunity 3: Background Processing

**Current:** Prioritization and enrichment block user requests

**Recommendation:**
- Move heavy operations to background jobs
- Use job queue (BullMQ) for async processing
- Expected improvement: 70% reduction in API response time

---

## 3. Architecture & Code Quality

### 3.1 Architecture Strengths

✅ **Unified Search Architecture**
- Clean abstraction over multiple providers
- Consistent error handling
- Good separation of concerns

✅ **Error Handling & Resilience**
- Circuit breaker patterns
- Retry mechanisms with exponential backoff
- Graceful degradation

✅ **Caching Strategy**
- Multi-level caching (L1/L2/L3)
- Redis integration
- Database fallback

✅ **Database Design**
- Well-indexed tables
- Proper RLS policies
- Good normalization

### 3.2 Architecture Issues

#### Issue 1: Code Duplication

**Examples:**
- Multiple query builders (4 different implementations)
- Redundant Firecrawl services (3 implementations)
- Duplicate retry logic in multiple files

**Impact:**
- Maintenance burden
- Inconsistent behavior
- Bug fixes must be applied multiple times

**Recommendation:**
- **Priority: MEDIUM** - Consolidate duplicate code
- Create shared utilities
- Deprecate legacy implementations

#### Issue 2: Complex Code Paths

**Problem:**
- Multiple ways to achieve same result
- Unclear which path is "canonical"
- Difficult to trace execution flow

**Example:**
```
Search can go through:
1. /api/events/search → SearchService
2. /api/events/search-enhanced → Enhanced orchestrator
3. /api/events/run → Optimized orchestrator
4. unifiedSearch() → Unified search core
```

**Recommendation:**
- **Priority: MEDIUM** - Document canonical paths
- Create routing guide
- Deprecate alternative paths

#### Issue 3: Inconsistent Error Handling

**Problem:**
- Different error formats across services
- Inconsistent retry logic
- Some services swallow errors, others throw

**Recommendation:**
- **Priority: LOW** - Standardize error handling
- Create error handling utilities
- Consistent error response format

### 3.3 Code Quality Metrics

**Positive Indicators:**
- TypeScript usage throughout
- Good type definitions
- Comprehensive test coverage in some areas
- Clear function documentation

**Areas for Improvement:**
- Some files are very large (800+ lines)
- Complex functions with multiple responsibilities
- Limited integration tests
- Inconsistent naming conventions

---

## 4. Database Design

### 4.1 Database Strengths

✅ **Well-Designed Schema**
- Proper normalization
- Good use of JSONB for flexible data
- Appropriate indexes on key columns

✅ **Security**
- Row Level Security (RLS) policies
- Proper foreign key constraints
- User isolation

✅ **Performance**
- Indexes on frequently queried columns
- Composite indexes for common query patterns

### 4.2 Database Optimization Opportunities

#### Opportunity 1: Full-Text Search

**Current:** Using `ilike` for text search

**Recommendation:**
- **Priority: HIGH** - Implement PostgreSQL full-text search
- Create `tsvector` columns for searchable text
- Add GIN indexes for fast full-text queries
- Expected improvement: 10x faster text searches

#### Opportunity 2: Query Optimization

**Current:** Some queries use inefficient patterns

**Examples:**
- Multiple OR conditions without indexes
- In-memory filtering of large result sets
- Missing composite indexes

**Recommendation:**
- **Priority: MEDIUM** - Analyze slow queries
- Add missing indexes
- Optimize query patterns
- Use EXPLAIN ANALYZE to identify bottlenecks

#### Opportunity 3: Connection Pooling

**Current:** Connection pool configuration may be suboptimal

**Recommendation:**
- **Priority: LOW** - Review pool settings
- Monitor connection usage
- Adjust pool size based on load

---

## 5. API Design

### 5.1 API Strengths

✅ **RESTful Design**
- Clear endpoint structure
- Consistent naming conventions
- Good use of HTTP methods

✅ **Error Handling**
- Consistent error responses
- Proper use of HTTP status codes

✅ **Documentation**
- Some endpoints have good documentation
- Type definitions help with API understanding

### 5.2 API Issues

#### Issue 1: Too Many Endpoints

**Problem:**
- 158 API route files
- Some endpoints overlap in functionality
- Unclear which endpoint to use

**Examples:**
- `/api/events/search`
- `/api/events/search-enhanced`
- `/api/events/run`
- `/api/events/run-progressive`

**Recommendation:**
- **Priority: LOW** - Consolidate overlapping endpoints
- Document canonical endpoints
- Deprecate alternative routes

#### Issue 2: Internal API Calls

**Problem:**
- Some endpoints call other internal endpoints
- Adds unnecessary network overhead

**Example:**
```typescript
// /api/events/search calls /api/config/search
const config = await fetch('/api/config/search')
```

**Recommendation:**
- **Priority: MEDIUM** - Direct function calls instead of HTTP
- Share code through imports
- Expected improvement: 50-100ms faster responses

#### Issue 3: Response Size

**Problem:**
- Some endpoints return very large responses
- No pagination in some cases
- Unnecessary data included

**Recommendation:**
- **Priority: MEDIUM** - Implement pagination
- Add response filtering options
- Use field selection for large objects

---

## 6. Caching Strategy

### 6.1 Current Caching Implementation

**Multi-Level Cache:**
1. **L1:** In-memory cache (5 min TTL)
2. **L2:** Redis cache (configurable TTL)
3. **L3:** Database cache (fallback)

**Features:**
- Request deduplication
- Cache key normalization
- Automatic cleanup

### 6.2 Caching Issues

#### Issue 1: Low Cache Hit Rate

**Problem:**
- Cache keys may not be normalized properly
- Query variations create different cache keys
- Cache TTLs may be too short

**Recommendation:**
- **Priority: MEDIUM** - Normalize cache keys more aggressively
- Increase TTLs for stable queries
- Implement cache warming

#### Issue 2: Cache Invalidation

**Problem:**
- Unclear when caches are invalidated
- May serve stale data
- No cache versioning

**Recommendation:**
- **Priority: LOW** - Implement cache versioning
- Clear cache on data updates
- Add cache invalidation strategy

---

## 7. Security Considerations

### 7.1 Security Strengths

✅ **Authentication & Authorization**
- Supabase Auth integration
- RLS policies for data isolation
- Proper session management

✅ **API Security**
- Environment variable protection
- API key validation
- Rate limiting

### 7.2 Security Recommendations

#### Recommendation 1: API Key Rotation

**Current:** API keys stored in environment variables

**Recommendation:**
- **Priority: LOW** - Implement key rotation strategy
- Use secrets management service
- Monitor key usage

#### Recommendation 2: Input Validation

**Current:** Some endpoints may not validate input thoroughly

**Recommendation:**
- **Priority: MEDIUM** - Add input validation schemas
- Use Zod for runtime validation
- Sanitize user inputs

---

## 8. Prioritized Recommendations

### Priority 1: Critical (Immediate Action Required)

1. **Consolidate Firecrawl Implementations**
   - **Effort:** 2-3 days
   - **Impact:** High - Reduces maintenance burden, improves consistency
   - **Files:** `src/lib/services/firecrawl-search-service.ts`, `src/services/search/firecrawlService.ts`, `src/providers/firecrawl.ts`

2. **Implement Unified Search+Extract**
   - **Effort:** 3-5 days
   - **Impact:** High - 50% reduction in API calls, 30% cost savings
   - **Files:** `src/lib/search/unified-search-core.ts`, `src/lib/event-pipeline/discover.ts`

3. **Fix Frontend N+1 Query Problem**
   - **Effort:** 1-2 days
   - **Impact:** High - Eliminates 50+ simultaneous API calls
   - **Files:** `src/components/EventCard.tsx`, parent list components

4. **Increase Extraction Batch Size**
   - **Effort:** 1 day
   - **Impact:** High - 30-40% reduction in extraction API calls
   - **Files:** `src/app/api/events/extract/route.ts`

### Priority 2: High (Next Sprint)

5. **Simplify Narrative Queries**
   - **Effort:** 2-3 days
   - **Impact:** Medium - Better search relevance
   - **Files:** `src/lib/unified-query-builder.ts`

6. **Add Full-Text Search Indexes**
   - **Effort:** 2-3 days
   - **Impact:** High - 10x faster text searches
   - **Files:** Database migrations, `src/app/api/events/search-enhanced/route.ts`

7. **Optimize Database Queries**
   - **Effort:** 3-5 days
   - **Impact:** High - Faster response times
   - **Files:** Various API routes

8. **Implement Request Batching**
   - **Effort:** 2-3 days
   - **Impact:** Medium - Better resource utilization
   - **Files:** Frontend components, API routes

### Priority 3: Medium (Future Sprints)

9. **Consolidate Query Builders**
   - **Effort:** 5-7 days
   - **Impact:** Medium - Easier maintenance
   - **Files:** Multiple query builder files

10. **Add Search Categories**
    - **Effort:** 1-2 days
    - **Impact:** Medium - Better result targeting
    - **Files:** `src/lib/search/unified-search-core.ts`

11. **Improve Cache Hit Rates**
    - **Effort:** 3-5 days
    - **Impact:** Medium - Lower costs, faster responses
    - **Files:** Cache service files

12. **Move Heavy Operations to Background**
    - **Effort:** 5-7 days
    - **Impact:** High - Better user experience
    - **Files:** Job queue setup, API routes

### Priority 4: Low (Nice to Have)

13. **Add Image Extraction**
    - **Effort:** 2-3 days
    - **Impact:** Low - Richer event data
    - **Files:** `src/app/api/events/extract/route.ts`

14. **Implement Natural Language Crawling**
    - **Effort:** 3-5 days
    - **Impact:** Low - Better coverage, less maintenance
    - **Files:** `src/app/api/events/extract/route.ts`

15. **Standardize Error Handling**
    - **Effort:** 5-7 days
    - **Impact:** Low - Better developer experience
    - **Files:** Multiple service files

---

## 9. Implementation Roadmap

### Phase 1: Firecrawl Optimization (Weeks 1-2)

**Week 1:**
- Consolidate Firecrawl implementations
- Implement unified search+extract
- Increase batch sizes

**Week 2:**
- Simplify narrative queries
- Add search categories
- Optimize query building

**Expected Outcomes:**
- 50% reduction in Firecrawl API calls
- 30% cost savings
- Better search relevance

### Phase 2: Performance Optimization (Weeks 3-4)

**Week 3:**
- Fix N+1 query problems
- Add full-text search indexes
- Optimize database queries

**Week 4:**
- Implement request batching
- Improve cache hit rates
- Add progressive loading

**Expected Outcomes:**
- 50% reduction in API response times
- Better user experience
- Improved scalability

### Phase 3: Code Quality (Weeks 5-6)

**Week 5:**
- Consolidate query builders
- Standardize error handling
- Document canonical paths

**Week 6:**
- Code review and refactoring
- Add missing tests
- Performance testing

**Expected Outcomes:**
- Easier maintenance
- Better code quality
- Reduced technical debt

---

## 10. Success Metrics

### Firecrawl Optimization Metrics

- **API Call Reduction:** Target 50% reduction
- **Cost Savings:** Target 30% reduction
- **Latency Improvement:** Target 30% reduction
- **Search Relevance:** Measure with user feedback

### Performance Metrics

- **API Response Time:** Target <500ms for search
- **Cache Hit Rate:** Target >60% hit rate
- **Database Query Time:** Target <100ms for common queries
- **Frontend Load Time:** Target <2s for initial render

### Code Quality Metrics

- **Code Duplication:** Target <5% duplication
- **Test Coverage:** Target >80% coverage
- **Documentation:** All public APIs documented
- **Technical Debt:** Reduce by 30%

---

## 11. Risk Assessment

### Low Risk Changes
- Adding search categories (optional parameter)
- Increasing batch sizes (backward compatible)
- Cache optimizations (additive)

### Medium Risk Changes
- Unified search+extract (requires response parsing changes)
- Query builder consolidation (may affect existing queries)
- Database query optimization (requires testing)

### High Risk Changes
- Consolidating Firecrawl implementations (breaking changes)
- Moving operations to background (architectural change)
- Full-text search migration (data migration required)

### Mitigation Strategies
- Feature flags for gradual rollout
- Comprehensive testing before deployment
- Monitoring and rollback capability
- Backward compatibility where possible

---

## 12. Conclusion

The Attendry application has a solid technical foundation with good architecture patterns, comprehensive error handling, and a well-designed database schema. However, there are significant opportunities for optimization, particularly in Firecrawl usage and performance.

**Key Takeaways:**

1. **Firecrawl optimization is the highest priority** - Can achieve 50% reduction in API calls and 30% cost savings
2. **Performance improvements are critical** - N+1 queries and sequential processing are major bottlenecks
3. **Code consolidation is needed** - Multiple implementations create maintenance burden
4. **Database optimization will improve scalability** - Full-text search and query optimization are essential

**Recommended Next Steps:**

1. **Immediate:** Start Phase 1 Firecrawl optimization (highest ROI)
2. **Short-term:** Address performance bottlenecks (better UX)
3. **Medium-term:** Consolidate code and improve quality (easier maintenance)

With focused effort on these priorities, the application can achieve significant improvements in performance, cost efficiency, and maintainability.

---

## Appendix A: Firecrawl v2 API Reference

### Unified Search+Extract
```typescript
POST https://api.firecrawl.dev/v2/search
{
  "query": "concise search query",
  "limit": 20,
  "sources": ["web"],
  "categories": ["research"],  // Optional
  "scrapeOptions": {
    "formats": ["markdown", "html", "images"],
    "onlyMainContent": true,
    "extract": {
      "schema": {...},
      "prompt": "..."
    }
  }
}
```

### Batch Extraction
```typescript
POST https://api.firecrawl.dev/v2/extract
{
  "urls": ["url1", "url2", ...],  // Up to 10-20 URLs
  "schema": {...},
  "prompt": "...",
  "scrapeOptions": {...}
}
```

---

## Appendix B: File Inventory

### Firecrawl-Related Files
- `src/lib/services/firecrawl-search-service.ts` (857 lines) - Main service
- `src/services/search/firecrawlService.ts` (135 lines) - Wrapper
- `src/providers/firecrawl.ts` (165 lines) - Alternative provider
- `src/lib/search/unified-search-core.ts` - Unified search core
- `src/app/api/events/extract/route.ts` - Extraction endpoint

### Query Builder Files
- `src/lib/unified-query-builder.ts` - Main builder
- `src/lib/services/weighted-query-builder.ts` - Template-based
- `src/lib/services/search-service.ts` - Legacy builder
- `src/lib/optimized-orchestrator.ts` - Orchestrator builder

### Performance-Critical Files
- `src/components/EventCard.tsx` - N+1 query issue
- `src/app/api/events/search-enhanced/route.ts` - Database queries
- `src/lib/search/unified-search-core.ts` - Search performance
- `src/lib/cache/unified-cache-service.ts` - Caching

---

**Report Generated:** February 26, 2025  
**Next Review:** After Phase 1 implementation (2 weeks)

