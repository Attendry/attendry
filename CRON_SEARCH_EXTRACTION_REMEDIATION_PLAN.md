# Cron Job Search & Extraction Remediation Plan

**Date:** 2025-01-15  
**Based on:** CRON_SEARCH_EXTRACTION_ANALYSIS.md  
**Status:** Implementation Plan - Ready for Execution

---

## Executive Summary

This plan provides a phased approach to fix three critical issues affecting cron job event collection:
1. **Google CSE 400 Errors** - Missing `cx` parameter and query issues
2. **Firecrawl 0 Results** - Empty queries and overly strict filtering
3. **Slow Extraction** - Running on empty results with inefficient polling

**Total Estimated Effort:** 18-26 hours  
**Expected Completion:** 3-5 days  
**Priority:** High (blocks event collection)

---

## Phase 1: Critical Fixes (4-6 hours)

**Goal:** Restore basic functionality - fix Google CSE errors and prevent extraction on empty results

### 1.1 Fix Google CSE Missing `cx` Parameter

**Priority:** P0 (Critical)  
**Effort:** 1 hour  
**Files to Modify:**
- `src/lib/services/search-service.ts`

**Implementation Steps:**

1. **Add `cx` parameter check and usage**
   ```typescript
   // Line ~876: After key check
   const key = process.env.GOOGLE_CSE_KEY;
   const cx = process.env.GOOGLE_CSE_CX;
   
   if (!key || !cx) {
     console.warn('[CSE] Missing GOOGLE_CSE_KEY or GOOGLE_CSE_CX, returning empty results');
     return {
       provider: "cse",
       items: [],
       cached: false
     };
   }
   ```

2. **Add `cx` to URL parameters**
   ```typescript
   // Line ~908: In searchParams construction
   const searchParams = new URLSearchParams({
     q: enhancedQuery,
     key,
     cx,  // ✅ Add this
     num: num.toString(),
     safe: "off",
     hl: "en"
   });
   ```

3. **Test:**
   - Verify CSE calls include `cx` parameter
   - Check logs for 400 errors (should be eliminated)
   - Confirm fallback works when `cx` is missing

**Acceptance Criteria:**
- ✅ No 400 errors in logs
- ✅ CSE returns results when properly configured
- ✅ Graceful fallback when `cx` is missing

---

### 1.2 Fix Extraction Running on Empty URLs

**Priority:** P0 (Critical)  
**Effort:** 30 minutes  
**Files to Modify:**
- `src/lib/services/search-service.ts`

**Implementation Steps:**

1. **Add early exit for empty URLs**
   ```typescript
   // Line ~1269: At start of extractEvents()
   static async extractEvents(urls: string[]): Promise<{...}> {
     // ✅ Early exit for empty URLs
     if (!urls || urls.length === 0) {
       console.log('[extract] ⚠️ No URLs provided, skipping extraction');
       return {
         events: [],
         version: "extract_v5",
         trace: []
       };
     }
     
     // Continue with existing logic...
   }
   ```

2. **Add logging for extraction start**
   ```typescript
   // After empty check
   console.log(`[extract] Starting extraction for ${urls.length} URLs`);
   ```

3. **Test:**
   - Call `extractEvents([])` - should return immediately
   - Verify no Firecrawl API calls are made
   - Check logs show early exit message

**Acceptance Criteria:**
- ✅ Extraction skipped when URLs array is empty
- ✅ No Firecrawl API calls for empty arrays
- ✅ Returns in <100ms for empty arrays

---

### 1.3 Add Absolute Timeout to Extraction Polling

**Priority:** P0 (Critical)  
**Effort:** 1 hour  
**Files to Modify:**
- `src/lib/services/search-service.ts`

**Implementation Steps:**

1. **Add absolute timeout check**
   ```typescript
   // Line ~1386: In pollExtractResults()
   private static async pollExtractResults(jobId: string, firecrawlKey: string): Promise<any> {
     const maxAttempts = 20;
     const pollInterval = 1000;
     const absoluteTimeout = 60000; // 60 seconds absolute timeout
     const startTime = Date.now();
     
     for (let attempt = 0; attempt < maxAttempts; attempt++) {
       // ✅ Check absolute timeout
       const elapsed = Date.now() - startTime;
       if (elapsed > absoluteTimeout) {
         console.warn(`[extract] Job ${jobId} exceeded absolute timeout of ${absoluteTimeout}ms`);
         return null;
       }
       
       // Existing polling logic...
     }
   }
   ```

2. **Add timeout logging**
   ```typescript
   // In timeout check
   console.warn(`[extract] Job ${jobId} exceeded absolute timeout: ${elapsed}ms > ${absoluteTimeout}ms`);
   ```

3. **Test:**
   - Simulate slow extraction job
   - Verify timeout triggers at 60 seconds
   - Check logs show timeout message

**Acceptance Criteria:**
- ✅ Polling stops after 60 seconds maximum
- ✅ Timeout logged clearly
- ✅ No infinite polling loops

---

### 1.4 Trim Google CSE Query Length

**Priority:** P1 (High)  
**Effort:** 30 minutes  
**Files to Modify:**
- `src/lib/services/search-service.ts`

**Implementation Steps:**

1. **Trim query to 256 characters**
   ```typescript
   // Line ~904: After buildSimpleQuery()
   const enhancedQuery = this.buildSimpleQuery(q, searchConfig, userProfile, country);
   
   // ✅ Trim to prevent 400 errors
   const trimmedQuery = enhancedQuery.slice(0, 256);
   
   const searchParams = new URLSearchParams({
     q: trimmedQuery,  // Use trimmed query
     // ...
   });
   ```

2. **Add logging for trimmed queries**
   ```typescript
   if (enhancedQuery.length > 256) {
     console.log(`[CSE] Query trimmed from ${enhancedQuery.length} to 256 chars`);
   }
   ```

3. **Test:**
   - Test with long queries (>256 chars)
   - Verify trimming works
   - Check no 400 errors from long queries

**Acceptance Criteria:**
- ✅ Queries >256 chars are trimmed
- ✅ No 400 errors from query length
- ✅ Trimming logged when it occurs

---

### 1.5 Remove Problematic CSE Parameter Combinations

**Priority:** P1 (High)  
**Effort:** 30 minutes  
**Files to Modify:**
- `src/lib/services/search-service.ts`

**Implementation Steps:**

1. **Simplify country restrictions**
   ```typescript
   // Line ~916: Replace complex country logic
   // ❌ Remove: cr and lr parameters
   // ✅ Keep only: gl parameter
   
   if (country === "de") {
     searchParams.set("gl", "de");
   } else if (country === "fr") {
     searchParams.set("gl", "fr");
   } else if (country === "uk") {
     searchParams.set("gl", "gb");
   } else if (country === "us") {
     searchParams.set("gl", "us");
   }
   // Remove: cr and lr parameters
   ```

2. **Test:**
   - Test CSE calls for each country
   - Verify no 400 errors
   - Confirm results are still country-specific

**Acceptance Criteria:**
- ✅ No `cr` or `lr` parameters in CSE calls
- ✅ Only `gl` parameter used for country
- ✅ No 400 errors from parameter combinations

---

## Phase 2: Performance Improvements (6-8 hours)

**Goal:** Improve result rates and reduce processing time

### 2.1 Pass Meaningful Queries from Cron Jobs

**Priority:** P1 (High)  
**Effort:** 1 hour  
**Files to Modify:**
- `src/app/api/cron/collect-events/route.ts`
- `src/app/api/cron/collect-events-deep/route.ts`

**Implementation Steps:**

1. **Create industry query map**
   ```typescript
   // Line ~110: Before SearchService.runEventDiscovery()
   const industryQueries: Record<string, string> = {
     'legal-compliance': 'legal compliance conference event',
     'fintech': 'fintech financial technology conference',
     'healthcare': 'healthcare medical conference event',
     'general': 'business professional conference event'
   };
   
   const searchQuery = industryQueries[industry] || 'conference event';
   ```

2. **Pass query to SearchService**
   ```typescript
   // Line ~136: Update runEventDiscovery call
   const searchData = await SearchService.runEventDiscovery({
     q: searchQuery,  // ✅ Meaningful query instead of ""
     country,
     from,
     to,
     provider: "firecrawl"
   });
   ```

3. **Apply to both standard and deep collection**
   - Update `collect-events/route.ts`
   - Update `collect-events-deep/route.ts`

4. **Test:**
   - Run cron job manually
   - Verify queries are meaningful
   - Check Firecrawl receives proper queries
   - Compare result rates before/after

**Acceptance Criteria:**
- ✅ Cron jobs pass meaningful queries
- ✅ Queries are industry-specific
- ✅ Firecrawl receives non-empty queries
- ✅ Result rate improves (target: 30-50% from 0%)

---

### 2.2 Relax Filtering for Cron Jobs

**Priority:** P1 (High)  
**Effort:** 2 hours  
**Files to Modify:**
- `src/lib/services/firecrawl-search-service.ts`

**Implementation Steps:**

1. **Add cron job detection**
   ```typescript
   // Line ~186: In searchEvents() method signature
   static async searchEvents(params: FirecrawlSearchParams): Promise<FirecrawlSearchResult> {
     const { query, country = "", from, to, industry = "legal-compliance", 
             maxResults = this.MAX_RESULTS, countryContext, locale, location,
             source } = params;  // ✅ Add source parameter
     
     const isCronJob = source === 'cron_firecrawl' || source === 'cron_firecrawl_deep';
   ```

2. **Pass source through call chain**
   ```typescript
   // In SearchService.runEventDiscovery()
   // Need to pass source through to FirecrawlSearchService
   ```

3. **Relax filters for cron jobs**
   ```typescript
   // Line ~254: In filtering logic
   // Filter 1: Social domains (always apply)
   if (SOCIAL_DOMAINS.includes(hostname)) continue;
   
   // Filter 2: Event-related (relax for cron)
   if (!isCronJob) {
     const isEventRelated = this.isEventRelated(content);
     if (!isEventRelated) continue;
   }
   
   // Filter 3: Token matching (relax for cron)
   if (!isCronJob) {
     const hasPositiveMatch = !matchTokens.length || matchTokens.some(...);
     if (!hasPositiveMatch) continue;
   }
   
   // Filter 4: Date filtering (keep for cron, but less strict)
   // Filter 5: Country matching (keep for cron)
   ```

4. **Test:**
   - Run cron job with relaxed filters
   - Compare result counts before/after
   - Verify quality is still acceptable
   - Check false positive rate

**Acceptance Criteria:**
- ✅ Cron jobs use relaxed filtering
   - ✅ Social domains still filtered
   - ✅ Event-related check relaxed
   - ✅ Token matching relaxed
   - ✅ Date/country filters kept
- ✅ Result rate improves (target: +30-50%)
- ✅ Quality remains acceptable (<10% false positives)

---

### 2.3 Reduce Polling Attempts for Cron Jobs

**Priority:** P1 (High)  
**Effort:** 1 hour  
**Files to Modify:**
- `src/lib/services/search-service.ts`

**Implementation Steps:**

1. **Add cron job flag to polling**
   ```typescript
   // Line ~1386: Update method signature
   private static async pollExtractResults(
     jobId: string, 
     firecrawlKey: string,
     isCronJob: boolean = false  // ✅ Add flag
   ): Promise<any> {
     // ✅ Adjust based on context
     const maxAttempts = isCronJob ? 10 : 20;
     const pollInterval = isCronJob ? 2000 : 1000;
     const absoluteTimeout = isCronJob ? 30000 : 60000;
   ```

2. **Pass flag from extractEvents**
   ```typescript
   // Line ~1269: In extractEvents()
   // Need to detect if called from cron job
   // Pass flag to pollExtractResults()
   ```

3. **Detect cron context**
   ```typescript
   // Check call stack or add parameter
   // Or check if urls come from cron source
   const isCronJob = /* detect cron context */;
   ```

4. **Test:**
   - Run extraction from cron job
   - Verify reduced polling attempts
   - Check timeout is 30 seconds
   - Confirm results still accurate

**Acceptance Criteria:**
- ✅ Cron jobs use 10 attempts instead of 20
- ✅ Cron jobs use 30-second timeout instead of 60
- ✅ Polling interval is 2 seconds for cron
- ✅ Results still accurate

---

### 2.4 Add Specific 400 Error Handling for CSE

**Priority:** P2 (Medium)  
**Effort:** 1 hour  
**Files to Modify:**
- `src/lib/services/search-service.ts`

**Implementation Steps:**

1. **Add 400-specific handling**
   ```typescript
   // Line ~943: In executeGoogleCSESearch()
   const res = await executeWithFallback("google_cse", async () => {
     return await deduplicateRequest(fingerprint, async () => {
       const response = await fetch(url);
       
       // ✅ Don't retry 400 errors
       if (response.status === 400) {
         const errorText = await response.text();
         console.error('[CSE] 400 error (configuration issue):', errorText);
         throw new Error(`CSE 400: ${errorText}`);
       }
       
       if (!response.ok) {
         throw new Error(`CSE ${response.status}: ${response.statusText}`);
       }
       
       return await response.json();
     });
   });
   ```

2. **Update circuit breaker config**
   ```typescript
   // Don't count 400 errors as circuit breaker failures
   // They're configuration issues, not service failures
   ```

3. **Test:**
   - Simulate 400 error (missing cx)
   - Verify no retries
   - Check error logged clearly
   - Confirm fallback works

**Acceptance Criteria:**
- ✅ 400 errors not retried
- ✅ Error logged with details
- ✅ Fallback to other providers works
- ✅ Circuit breaker not triggered by 400s

---

## Phase 3: Optimization (8-12 hours)

**Goal:** Further improve query quality and reduce processing overhead

### 3.1 Simplify Query Construction for Cron Jobs

**Priority:** P2 (Medium)  
**Effort:** 2 hours  
**Files to Modify:**
- `src/lib/services/firecrawl-search-service.ts`

**Implementation Steps:**

1. **Add simplified query path for cron**
   ```typescript
   // Line ~204: In searchEvents()
   const isCronJob = source === 'cron_firecrawl' || source === 'cron_firecrawl_deep';
   
   let primaryQuery: string;
   let fallbackQuery: string;
   
   if (isCronJob) {
     // ✅ Simplified queries for cron
     primaryQuery = `${industry} conference ${country}`.trim();
     fallbackQuery = `${industry} event ${country}`.trim();
   } else {
     // Complex queries for user searches
     primaryQuery = this.buildShardQuery(...);
     fallbackQuery = await this.buildSearchQueryInternal(...);
   }
   ```

2. **Test:**
   - Compare query complexity
   - Measure result rates
   - Check processing time

**Acceptance Criteria:**
- ✅ Cron queries are simpler
- ✅ Result rate maintained or improved
- ✅ Processing time reduced

---

### 3.2 Remove or Relax Date Range Filtering in Firecrawl Queries

**Priority:** P2 (Medium)  
**Effort:** 2 hours  
**Files to Modify:**
- `src/lib/services/firecrawl-search-service.ts`

**Implementation Steps:**

1. **Conditionally apply tbs parameter**
   ```typescript
   // Line ~207: In baseParams
   const baseParams: any = {
     limit: Math.min(maxResults, 20),
     sources: ["web"],
     location: location || ...,
     country: ...,
     ignoreInvalidURLs: true,
   };
   
   // ✅ Only add tbs for non-cron jobs
   if (!isCronJob) {
     baseParams.tbs = this.buildTimeBasedSearch(from, to);
   }
   // Filter dates after retrieval for cron jobs
   ```

2. **Add post-retrieval date filtering for cron**
   ```typescript
   // After getting results, filter by date if needed
   if (isCronJob && (from || to)) {
     items = items.filter(item => {
       const date = item.extractedData?.eventDate;
       return this.isWithinRange(date, from, to);
     });
   }
   ```

3. **Test:**
   - Compare result counts
   - Verify date filtering still works
   - Check performance impact

**Acceptance Criteria:**
- ✅ Cron jobs don't use tbs parameter
- ✅ Date filtering applied post-retrieval
- ✅ More results retrieved
- ✅ Date accuracy maintained

---

### 3.3 Use Industry-Specific Terms

**Priority:** P2 (Medium)  
**Effort:** 1 hour  
**Files to Modify:**
- `src/lib/services/firecrawl-search-service.ts`

**Implementation Steps:**

1. **Enhance getIndustryTerms method**
   ```typescript
   // Line ~370: Update getIndustryTerms()
   private static getIndustryTerms(industry: string): string {
     const industryMap: Record<string, string> = {
       'legal-compliance': 'legal compliance regulatory technology e-discovery',
       'fintech': 'fintech financial technology banking payments',
       'healthcare': 'healthcare medical technology pharma biotech',
       'general': 'business professional networking'
     };
     return industryMap[industry] || 'business conference';
   }
   ```

2. **Use in query construction**
   ```typescript
   // Use industry terms in simplified cron queries
   const industryTerms = this.getIndustryTerms(industry);
   primaryQuery = `${industryTerms} conference ${country}`.trim();
   ```

3. **Test:**
   - Compare queries across industries
   - Measure result rates
   - Verify relevance

**Acceptance Criteria:**
- ✅ Industry-specific terms used
- ✅ Queries are more relevant
- ✅ Result quality improves

---

### 3.4 Skip Fallbacks for Empty Results

**Priority:** P3 (Low)  
**Effort:** 1 hour  
**Files to Modify:**
- `src/lib/services/search-service.ts`

**Implementation Steps:**

1. **Early exit in processExtractResults**
   ```typescript
   // Line ~1437: In processExtractResults()
   private static async processExtractResults(extractData: any, urls: string[]): Promise<{...}> {
     // ✅ Early exit if no URLs
     if (!urls || urls.length === 0) {
       return { events: [], version: "extract_v5", trace: [] };
     }
     
     // Only try fallbacks if we have URLs but no events
     if (!extractData.data?.events && urls.length > 0) {
       // Try fallbacks...
     }
   }
   ```

2. **Test:**
   - Test with empty URLs
   - Test with URLs but no events
   - Verify fallbacks still work when needed

**Acceptance Criteria:**
- ✅ Fallbacks skipped for empty URLs
- ✅ Fallbacks still work when URLs exist
- ✅ Processing time reduced

---

## Testing Strategy

### Unit Tests

1. **Google CSE Tests**
   - Test URL construction with/without `cx`
   - Test query trimming
   - Test parameter combinations
   - Test 400 error handling

2. **Extraction Tests**
   - Test early exit for empty URLs
   - Test polling timeout
   - Test cron job polling limits

3. **Query Construction Tests**
   - Test industry query mapping
   - Test simplified queries for cron
   - Test filtering logic

### Integration Tests

1. **End-to-End Cron Job Test**
   - Run full cron job with fixes
   - Verify no timeouts
   - Check result rates
   - Verify data quality

2. **Search Service Test**
   - Test Firecrawl → CSE fallback
   - Test query passing
   - Test result filtering

### Manual Testing

1. **Cron Job Execution**
   - Run cron job manually
   - Monitor logs
   - Check database for results
   - Verify timing

2. **Error Scenarios**
   - Test with missing `cx`
   - Test with empty queries
   - Test with long queries
   - Test timeout scenarios

---

## Deployment Plan

### Pre-Deployment Checklist

- [ ] All Phase 1 fixes implemented
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing complete
- [ ] Code review completed
- [ ] Documentation updated

### Deployment Steps

1. **Deploy Phase 1 (Critical Fixes)**
   - Deploy to staging
   - Run cron job manually
   - Verify fixes work
   - Monitor for 24 hours
   - Deploy to production

2. **Deploy Phase 2 (Performance)**
   - Deploy to staging
   - Run cron job manually
   - Compare result rates
   - Monitor for 48 hours
   - Deploy to production

3. **Deploy Phase 3 (Optimization)**
   - Deploy to staging
   - Run cron job manually
   - Measure improvements
   - Monitor for 48 hours
   - Deploy to production

### Rollback Plan

- Keep previous version tagged
- Monitor error rates
- Rollback if error rate >5%
- Rollback if result rate drops significantly

---

## Success Metrics

### Before Fixes
- Google CSE: 100% failure rate (400 errors)
- Firecrawl: 0% result rate
- Extraction: 3.5 minutes for empty results
- Cron Job: Times out after 1-2 combinations

### Target After Fixes
- Google CSE: <5% failure rate
- Firecrawl: 30-50% result rate
- Extraction: <1 second for empty results
- Cron Job: Completes 2-3 combinations successfully

### Monitoring

1. **Error Rates**
   - CSE 400 errors: Target <5%
   - Firecrawl errors: Target <10%
   - Extraction timeouts: Target <5%

2. **Performance**
   - Extraction time for empty: Target <1s
   - Extraction time for results: Target <30s
   - Cron job completion: Target 100%

3. **Quality**
   - Result rate: Target 30-50%
   - False positive rate: Target <10%
   - Data completeness: Target >70%

---

## Risk Assessment

### Low Risk
- Phase 1 fixes (critical, well-understood)
- Early exit for empty URLs
- Query trimming

### Medium Risk
- Relaxed filtering (may increase false positives)
- Simplified queries (may reduce relevance)
- Reduced polling (may miss some results)

### Mitigation
- Gradual rollout
- A/B testing for filtering changes
- Monitoring and alerting
- Quick rollback capability

---

## Timeline

### Week 1
- **Day 1-2:** Phase 1 implementation and testing
- **Day 3:** Phase 1 deployment
- **Day 4-5:** Phase 2 implementation

### Week 2
- **Day 1:** Phase 2 testing
- **Day 2:** Phase 2 deployment
- **Day 3-4:** Phase 3 implementation
- **Day 5:** Phase 3 testing and deployment

---

## Dependencies

1. **Environment Variables**
   - `GOOGLE_CSE_CX` must be set (for Phase 1.1)
   - `GOOGLE_CSE_KEY` must be set
   - `FIRECRAWL_KEY` must be set

2. **Code Dependencies**
   - No breaking changes to existing APIs
   - Backward compatible changes only

3. **Testing Dependencies**
   - Test environment with all API keys
   - Ability to run cron jobs manually
   - Database access for verification

---

## Notes

- All changes are backward compatible
- No breaking changes to existing functionality
- Can be deployed incrementally
- Each phase can be tested independently
- Rollback is straightforward for all changes

