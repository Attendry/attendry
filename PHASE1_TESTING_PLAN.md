# Phase 1: Firecrawl Optimization - Testing Plan

**Date:** February 26, 2025  
**Status:** Ready for Testing  
**Phase:** Phase 1 - Firecrawl Optimization

---

## Testing Overview

This document outlines the testing strategy for Phase 1 improvements:
1. Unified search+extract functionality
2. Simplified narrative queries
3. Search categories
4. Consolidated Firecrawl implementations

---

## Test Categories

### 1. Functional Testing

#### 1.1 Unified Search+Extract

**Test Cases:**
- [ ] **TC-1.1.1:** Verify unified search+extract returns extracted data
  - **Steps:**
    1. Call `unifiedSearch()` with `extractSchema` parameter
    2. Verify response includes `extracted` field in items
    3. Verify extracted data matches schema structure
  - **Expected:** Items contain extracted event data
  - **Files:** `src/lib/search/unified-search-core.ts`, `src/lib/services/firecrawl-search-service.ts`

- [ ] **TC-1.1.2:** Verify single API call instead of two
  - **Steps:**
    1. Monitor Firecrawl API calls during search
    2. Verify only one API call is made when `extractSchema` is provided
    3. Compare with old behavior (2 calls)
  - **Expected:** 50% reduction in API calls
  - **Monitoring:** Check API call logs

- [ ] **TC-1.1.3:** Verify discovery pipeline uses unified search+extract
  - **Steps:**
    1. Run discovery pipeline
    2. Verify candidates include extracted data in metadata
    3. Verify `skipExtraction` flag is set when extraction already done
  - **Expected:** Discovery pipeline uses unified search+extract
  - **Files:** `src/lib/event-pipeline/discover.ts`

#### 1.2 Simplified Narrative Queries

**Test Cases:**
- [ ] **TC-1.2.1:** Verify narrative queries are 80-120 characters
  - **Steps:**
    1. Build narrative query with various inputs
    2. Check query length
    3. Verify location/dates are NOT in query text
  - **Expected:** Query length between 20-120 characters
  - **Files:** `src/lib/unified-query-builder.ts`

- [ ] **TC-1.2.2:** Verify user search term is prioritized
  - **Steps:**
    1. Provide user search term: "legal compliance"
    2. Build narrative query
    3. Verify query starts with user term
  - **Expected:** Query format: "legal compliance conference"
  - **Files:** `src/lib/unified-query-builder.ts`

- [ ] **TC-1.2.3:** Verify location/dates use API parameters
  - **Steps:**
    1. Build query with country and dates
    2. Verify query text doesn't contain location/dates
    3. Verify API call includes location/country parameters
  - **Expected:** Location/dates in API params, not query text
  - **Files:** `src/lib/services/firecrawl-search-service.ts`

#### 1.3 Search Categories

**Test Cases:**
- [ ] **TC-1.3.1:** Verify search categories are applied
  - **Steps:**
    1. Call search with `categories: ['research']`
    2. Verify API request includes categories parameter
    3. Verify results are more event-focused
  - **Expected:** API request includes categories, better targeting
  - **Files:** `src/lib/services/firecrawl-search-service.ts`

- [ ] **TC-1.3.2:** Verify default category for events
  - **Steps:**
    1. Call discovery pipeline
    2. Verify default category is 'research'
    3. Verify results quality improved
  - **Expected:** Default category applied, better results
  - **Files:** `src/lib/event-pipeline/discover.ts`

#### 1.4 Backward Compatibility

**Test Cases:**
- [ ] **TC-1.4.1:** Verify deprecated services still work
  - **Steps:**
    1. Use `firecrawlSearch()` from deprecated service
    2. Verify it still works
    3. Verify it calls FirecrawlSearchService internally
  - **Expected:** Deprecated services work but show deprecation warnings
  - **Files:** `src/services/search/firecrawlService.ts`

- [ ] **TC-1.4.2:** Verify existing API endpoints work
  - **Steps:**
    1. Test `/api/events/search`
    2. Test `/api/events/search-enhanced`
    3. Test discovery pipeline
  - **Expected:** All endpoints work without breaking changes
  - **Files:** Various API routes

---

## Performance Testing

### 2.1 API Call Reduction

**Metrics to Track:**
- [ ] **PT-2.1.1:** Count API calls before/after
  - **Before:** 2 calls per search (search + extract)
  - **After:** 1 call per search (unified)
  - **Target:** 50% reduction
  - **Monitoring:** Log API call counts

- [ ] **PT-2.1.2:** Measure latency improvement
  - **Before:** Sequential operations (search time + extract time)
  - **After:** Single operation
  - **Target:** 30% reduction in latency
  - **Monitoring:** Track response times

### 2.2 Cost Savings

**Metrics to Track:**
- [ ] **PT-2.2.1:** Monitor Firecrawl API usage
  - Track API calls per day
  - Compare before/after usage
  - **Target:** 30-50% reduction in API calls

- [ ] **PT-2.2.2:** Calculate cost per event
  - Track cost per event discovered
  - Compare before/after
  - **Target:** 30-50% reduction in cost per event

---

## Quality Testing

### 3.1 Search Relevance

**Test Cases:**
- [ ] **QT-3.1.1:** Compare search results quality
  - **Steps:**
    1. Run same query before/after changes
    2. Compare result relevance
    3. Verify results are still relevant
  - **Expected:** Results quality maintained or improved
  - **Method:** Manual review of results

- [ ] **QT-3.1.2:** Verify search categories improve targeting
  - **Steps:**
    1. Compare results with/without categories
    2. Verify event-focused results with categories
  - **Expected:** Better event targeting with categories
  - **Method:** Compare result sets

### 3.2 Extraction Quality

**Test Cases:**
- [ ] **QT-3.2.1:** Verify extracted data quality
  - **Steps:**
    1. Run unified search+extract
    2. Verify extracted data matches schema
    3. Verify data completeness
  - **Expected:** High-quality extracted data
  - **Method:** Validate extracted data structure

- [ ] **QT-3.2.2:** Compare extraction before/after
  - **Steps:**
    1. Compare extraction quality
    2. Verify unified extraction is as good or better
  - **Expected:** Extraction quality maintained or improved
  - **Method:** Compare extracted data

---

## Integration Testing

### 4.1 End-to-End Flows

**Test Cases:**
- [ ] **IT-4.1.1:** Test complete discovery pipeline
  - **Steps:**
    1. Run discovery with unified search+extract
    2. Verify candidates are created
    3. Verify extracted data is in metadata
  - **Expected:** Complete pipeline works with new features
  - **Files:** `src/lib/event-pipeline/discover.ts`

- [ ] **IT-4.1.2:** Test search → extract → save flow
  - **Steps:**
    1. Run search with unified search+extract
    2. Verify events are extracted
    3. Verify events are saved to database
  - **Expected:** Complete flow works end-to-end
  - **Files:** Various pipeline files

### 4.2 API Integration

**Test Cases:**
- [ ] **IT-4.2.1:** Test `/api/events/search` endpoint
  - **Steps:**
    1. Call endpoint with various parameters
    2. Verify response format
    3. Verify unified search+extract is used
  - **Expected:** Endpoint works with new features
  - **Files:** `src/app/api/events/search/route.ts`

- [ ] **IT-4.2.2:** Test `/api/events/run` endpoint
  - **Steps:**
    1. Run event collection
    2. Verify unified search+extract is used
    3. Verify results are correct
  - **Expected:** Event collection works with new features
  - **Files:** `src/app/api/events/run/route.ts`

---

## Manual Testing Checklist

### 5.1 User-Facing Features

- [ ] **MT-5.1.1:** Test search in UI
  - Enter search query
  - Verify results appear
  - Verify results are relevant
  - Check browser console for errors

- [ ] **MT-5.1.2:** Test event discovery
  - Run discovery
  - Verify events are found
  - Verify event details are correct
  - Check for any UI issues

### 5.2 Developer Experience

- [ ] **MT-5.2.1:** Verify deprecation warnings
  - Use deprecated services
  - Verify warnings appear in console
  - Verify services still work

- [ ] **MT-5.2.2:** Test code migration
  - Migrate code from deprecated to new service
  - Verify migration works
  - Verify no breaking changes

---

## Monitoring & Validation

### 6.1 Metrics to Monitor

**API Usage:**
- Firecrawl API calls per day
- API call reduction percentage
- Cost per event discovered

**Performance:**
- Search response time
- Extraction time
- Total pipeline time

**Quality:**
- Search result relevance
- Extraction success rate
- User satisfaction (if available)

### 6.2 Validation Criteria

**Success Criteria:**
- ✅ 50% reduction in API calls
- ✅ 30% reduction in latency
- ✅ 30-50% cost savings
- ✅ Search quality maintained or improved
- ✅ No breaking changes
- ✅ All tests pass

**Rollback Criteria:**
- ❌ API call reduction < 30%
- ❌ Latency increase > 10%
- ❌ Search quality degradation
- ❌ Breaking changes detected
- ❌ Critical bugs found

---

## Test Execution Plan

### Phase 1: Unit Testing (Day 1)
- Test individual functions
- Test query building
- Test response parsing
- **Owner:** Development team

### Phase 2: Integration Testing (Day 2)
- Test API endpoints
- Test discovery pipeline
- Test end-to-end flows
- **Owner:** Development team

### Phase 3: Performance Testing (Day 3)
- Monitor API calls
- Measure latency
- Calculate cost savings
- **Owner:** Development team

### Phase 4: Quality Testing (Day 4)
- Compare search results
- Validate extraction quality
- User acceptance testing
- **Owner:** QA team / Product team

### Phase 5: Production Monitoring (Week 1)
- Monitor metrics in production
- Track cost savings
- Monitor for issues
- **Owner:** DevOps / Development team

---

## Test Data

### Sample Queries

**Simple Query:**
- Input: "legal compliance"
- Expected: "legal compliance conference"
- Country: "DE"
- Dates: None

**Complex Query:**
- Input: "data privacy regulations"
- Expected: "data privacy regulations conference"
- Country: "DE"
- Dates: "2025-03-01" to "2025-12-31"

**Profile-Based Query:**
- Input: "" (empty)
- Expected: Uses industry terms from profile
- Country: "DE"
- Dates: None

### Sample Schemas

**EVENT_SCHEMA:**
```json
{
  "type": "object",
  "properties": {
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "url": { "type": "string" },
          "snippet": { "type": "string" },
          "eventDate": { "type": "string" },
          "location": { "type": "string" },
          "organizer": { "type": "string" }
        }
      }
    }
  }
}
```

---

## Reporting

### Test Results Template

**Test Run:** [Date]
**Tester:** [Name]
**Environment:** [Dev/Staging/Production]

**Results:**
- Functional Tests: [X/Y passed]
- Performance Tests: [X/Y passed]
- Quality Tests: [X/Y passed]
- Integration Tests: [X/Y passed]

**Metrics:**
- API Call Reduction: [X%]
- Latency Improvement: [X%]
- Cost Savings: [X%]

**Issues Found:**
- [List any issues]

**Recommendations:**
- [List recommendations]

---

## Next Steps

1. **Execute Test Plan** - Run all test cases
2. **Monitor Metrics** - Track performance improvements
3. **Validate Results** - Confirm success criteria met
4. **Document Findings** - Record test results
5. **Address Issues** - Fix any problems found
6. **Deploy to Production** - Roll out changes

---

**Test Plan Created:** February 26, 2025  
**Status:** Ready for Execution  
**Estimated Duration:** 1 week (testing + monitoring)


