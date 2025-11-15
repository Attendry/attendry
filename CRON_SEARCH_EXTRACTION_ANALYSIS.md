# Cron Job Search & Extraction Issues Analysis

**Date:** 2025-01-15  
**Based on:** Cron job logs from 2025-11-15 02:00:28 - 02:05:28  
**Status:** Analysis Complete - Recommendations Provided

---

## Executive Summary

Analysis of cron job logs reveals three critical issues affecting event collection:

1. **Google CSE 400 Errors**: API calls failing due to missing `cx` parameter, query length issues, and incompatible parameter combinations
2. **Firecrawl Returning 0 Results**: Overly complex query construction and overly strict filtering causing zero results despite successful API calls
3. **Slow Extraction (3.5 minutes for 0 results)**: Extraction jobs running even when no URLs are found, with inefficient polling and no early exit logic

---

## Issue 1: Google CSE 400 Errors

### Problem Statement

Google Custom Search Engine API is returning `400 Bad Request` errors, preventing fallback search when Firecrawl returns 0 results.

**Log Evidence:**
```
2025-11-15 02:00:47.185 [info] {"at":"search_service","real":"cse_result","status":400,"items":0}
2025-11-15 02:04:39.154 [info] {"at":"search_service","real":"cse_result","status":400,"items":0}
```

### Root Cause Analysis

#### 1.1 Missing `cx` Parameter

**Location:** `src/lib/services/search-service.ts:848-956`

**Issue:** The `executeGoogleCSESearch` method builds the URL but **does not include the `cx` (Custom Search Engine ID) parameter**.

**Current Code:**
```typescript
const searchParams = new URLSearchParams({
  q: enhancedQuery,
  key,  // ✅ Present
  num: num.toString(),
  safe: "off",
  hl: "en"
});
// ❌ Missing: cx parameter
```

**Impact:** Google CSE API requires both `key` and `cx` parameters. Without `cx`, the API returns 400 errors.

**Evidence:** The code checks for `GOOGLE_CSE_KEY` but never uses `GOOGLE_CSE_CX` in the URL construction.

#### 1.2 Query Length Issues

**Location:** Multiple files with inconsistent handling

**Issue:** Query length limits are handled inconsistently:
- `src/services/search/cseService.ts:35` - Trims to 256 chars ✅
- `src/lib/services/search-service.ts:909` - No trimming ❌
- `src/lib/search/unified-search-core.ts:531` - No trimming ❌

**Impact:** Long queries (>2048 chars) cause 400 errors. The cron job logs show queries with 518+ characters that aren't trimmed.

**Evidence from Logs:**
```
"effectiveQ":"(business OR professional OR networking...)","query_length":518
```

#### 1.3 Incompatible Parameter Combinations

**Location:** `src/lib/services/search-service.ts:916-929`

**Issue:** The code sets `cr`, `gl`, and `lr` parameters together, which can cause 400 errors when combined with certain query formats.

**Current Code:**
```typescript
if (country === "de") {
  searchParams.set("cr", "countryDE");
  searchParams.set("gl", "de");
  searchParams.set("lr", "lang_de|lang_en");  // ⚠️ Can cause 400s
}
```

**Impact:** Google CSE API can reject requests when `lr` (language restriction) is combined with `cr` (country restriction) and complex queries.

**Note:** `src/services/search/cseService.ts:60` correctly avoids `lr/cr` combinations, but this implementation is not used by the cron jobs.

#### 1.4 Missing Error Handling

**Location:** `src/lib/services/search-service.ts:943-956`

**Issue:** The code uses circuit breakers and retries, but doesn't handle 400 errors specifically. It treats all errors the same.

**Current Code:**
```typescript
const res = await executeWithFallback("google_cse", async () => {
  return await deduplicateRequest(fingerprint, () =>
    executeWithCircuitBreaker("google_cse", () =>
      RetryService.fetchWithRetry(...)
    )
  );
});
```

**Impact:** 400 errors are retried unnecessarily, wasting time and API quota.

### Recommendations

#### Priority 1: Add Missing `cx` Parameter

**File:** `src/lib/services/search-service.ts:908-914`

**Change:**
```typescript
// Get API credentials
const key = process.env.GOOGLE_CSE_KEY;
const cx = process.env.GOOGLE_CSE_CX;

if (!key || !cx) {
  console.warn('Google CSE not fully configured (missing key or cx)');
  return { provider: "demo", items: [], cached: false };
}

// Build search parameters
const searchParams = new URLSearchParams({
  q: enhancedQuery,
  key,
  cx,  // ✅ Add this
  num: num.toString(),
  safe: "off",
  hl: "en"
});
```

#### Priority 2: Trim Query Length

**File:** `src/lib/services/search-service.ts:904-909`

**Change:**
```typescript
// Build simplified query for Google CSE to avoid 400 errors
const enhancedQuery = this.buildSimpleQuery(q, searchConfig, userProfile, country);

// Trim query to 256 chars to prevent 400 errors
const trimmedQuery = enhancedQuery.slice(0, 256);

const searchParams = new URLSearchParams({
  q: trimmedQuery,  // ✅ Use trimmed query
  // ...
});
```

#### Priority 3: Remove Problematic Parameter Combinations

**File:** `src/lib/services/search-service.ts:916-929`

**Change:**
```typescript
// Add country restriction (avoid lr/cr combinations that cause 400s)
if (country === "de") {
  searchParams.set("gl", "de");  // ✅ Keep only gl
  // ❌ Remove: cr and lr parameters
} else if (country === "fr") {
  searchParams.set("gl", "fr");
} else if (country === "uk") {
  searchParams.set("gl", "gb");
}
```

#### Priority 4: Add Specific 400 Error Handling

**File:** `src/lib/services/search-service.ts:943-956`

**Change:**
```typescript
const res = await executeWithFallback("google_cse", async () => {
  return await deduplicateRequest(fingerprint, async () => {
    const response = await fetch(url);
    
    if (response.status === 400) {
      // Don't retry 400 errors - they're configuration issues
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

#### Priority 5: Use Existing Robust Implementation

**Consideration:** The codebase already has a robust CSE implementation in `src/services/search/cseService.ts` that handles these issues. Consider refactoring to use this implementation consistently.

---

## Issue 2: Firecrawl Returning 0 Results

### Problem Statement

Firecrawl API calls are succeeding (status 200) but returning 0 results, despite valid queries and date ranges.

**Log Evidence:**
```
2025-11-15 02:00:38.943 [info] {"at":"firecrawl_call_result","label":"shard","status":200,"success":true,"webResults":0}
2025-11-15 02:00:46.657 [info] {"at":"firecrawl_call_result","label":"full","status":200,"success":true,"webResults":0}
```

### Root Cause Analysis

#### 2.1 Empty Query from Cron Jobs

**Location:** `src/app/api/cron/collect-events/route.ts:136`

**Issue:** Cron jobs pass an empty query string (`q: ""`) to `SearchService.runEventDiscovery()`.

**Current Code:**
```typescript
const searchData = await SearchService.runEventDiscovery({
  q: "",  // ❌ Empty query
  country,
  from,
  to,
  provider: "firecrawl"
});
```

**Impact:** Empty queries force the system to build queries from scratch, which may not match actual event pages.

#### 2.2 Overly Complex Query Construction

**Location:** `src/lib/services/firecrawl-search-service.ts:185-378`

**Issue:** Query construction involves multiple layers:
1. `buildUnifiedQuery()` - Creates narrative queries
2. `buildShardQuery()` - Creates simplified queries
3. `buildSearchQueryInternal()` - Fallback query building
4. Multiple token extraction and filtering steps

**Current Flow:**
```typescript
// Step 1: Extract tokens
const { tokens: positiveTokens, topicalTokens } = this.extractPositiveTokens(query, industry, locationTokenSet);
const baseTokens = topicalTokens.length ? topicalTokens : positiveTokens;

// Step 2: Build queries
const primaryQuery = this.buildShardQuery(positiveTokens, locationTokenSet, timeframeTokens, country, from, to);
const fallbackQuery = await this.buildSearchQueryInternal(query, industry, country, from, to);

// Step 3: Try both queries
for (const ship of ships) {
  // Try primaryQuery, then fallbackQuery
}
```

**Impact:** Complex queries may not match how event pages are actually structured or indexed.

**Evidence from Logs:**
```
"finalQuery": "(business OR professional OR networking OR development OR technology OR innovation) (conference OR event OR summit...) (2025 OR 2026 OR 2027 OR upcoming OR \"next year\") -reddit -Mumsnet -forum"
```

This query is very long and may be too specific, excluding valid results.

#### 2.3 Overly Strict Filtering

**Location:** `src/lib/services/firecrawl-search-service.ts:254-305`

**Issue:** Multiple filtering layers that may be too strict:
1. Social domain filtering
2. Event-related content filtering
3. Token matching (requires positive matches)
4. Date range filtering
5. Country matching

**Current Code:**
```typescript
// Filter 1: Social domains
if (SOCIAL_DOMAINS.includes(hostname)) continue;

// Filter 2: Event-related content
const isEventRelated = this.isEventRelated(content);
if (!isEventRelated) continue;

// Filter 3: Token matching
const hasPositiveMatch = !matchTokens.length || matchTokens.some((token) => token.length > 2 && content.includes(token));
if (!hasPositiveMatch) continue;

// Filter 4: Date filtering
if (from || to) {
  if (parsedDate.startISO && !withinRange) continue;
} else if (!hasSomeDate && !timeframeHint) continue;

// Filter 5: Country matching
const countryMismatch = targetCountry && extractedLocation && !this.matchesCountry(hostname, extractedLocation, targetCountry);
```

**Impact:** Each filter reduces the result set. With multiple strict filters, valid events may be excluded.

#### 2.4 Date Range Issues

**Location:** `src/lib/services/firecrawl-search-service.ts:212`

**Issue:** The `tbs` (time-based search) parameter may be too restrictive.

**Current Code:**
```typescript
const baseParams = {
  limit: Math.min(maxResults, 20),
  sources: ["web"],
  location: location || resolvedCountryContext?.countryNames?.[0] || this.mapCountryToLocation(country),
  country: resolvedCountryContext?.iso2 || country?.toUpperCase() || undefined,
  tbs: this.buildTimeBasedSearch(from, to),  // ⚠️ May be too restrictive
  ignoreInvalidURLs: true,
};
```

**Impact:** If `buildTimeBasedSearch()` creates a very narrow date range, Firecrawl may return 0 results even when events exist.

#### 2.5 Industry Context Mismatch

**Location:** `src/lib/services/search-service.ts:622`

**Issue:** Cron jobs pass `industry: "legal-compliance"` but the query building uses generic terms.

**Evidence from Logs:**
```
"industryContext": "general",  // ❌ Should be "legal-compliance"
"allIndustryTerms": ["business", "professional", "networking", "development", "technology", "innovation"]
```

**Impact:** Generic terms may not match legal/compliance event pages, which often use specific terminology.

### Recommendations

#### Priority 1: Pass Meaningful Query to Cron Jobs

**File:** `src/app/api/cron/collect-events/route.ts:136`

**Change:**
```typescript
// Build industry-specific query instead of empty string
const industryQueries: Record<string, string> = {
  'legal-compliance': 'legal compliance conference event',
  'fintech': 'fintech conference event',
  'healthcare': 'healthcare conference event',
  'general': 'business conference event'
};

const searchData = await SearchService.runEventDiscovery({
  q: industryQueries[industry] || 'conference event',  // ✅ Meaningful query
  country,
  from,
  to,
  provider: "firecrawl"
});
```

#### Priority 2: Simplify Query Construction

**File:** `src/lib/services/firecrawl-search-service.ts:204-219`

**Change:**
```typescript
// Use simpler, more direct queries for cron jobs
const primaryQuery = query.trim() || `${industry} conference ${country}`;
const fallbackQuery = `${industry} event ${country} ${from || ''} ${to || ''}`.trim();

// Remove complex token extraction for cron jobs
// Keep complex logic only for user-initiated searches
```

#### Priority 3: Relax Filtering for Cron Jobs

**File:** `src/lib/services/firecrawl-search-service.ts:254-305`

**Change:**
```typescript
// Add a flag to indicate cron job context
const isCronJob = params.source === 'cron_firecrawl' || params.source === 'cron_firecrawl_deep';

// Relax filters for cron jobs
if (!isCronJob) {
  // Apply strict filtering for user searches
  if (!isEventRelated) continue;
  if (!hasPositiveMatch) continue;
} else {
  // For cron jobs, only filter out obvious non-events
  if (SOCIAL_DOMAINS.includes(hostname)) continue;
  // Allow results without strict token matching
}
```

#### Priority 4: Remove or Relax Date Range Filtering

**File:** `src/lib/services/firecrawl-search-service.ts:212`

**Change:**
```typescript
const baseParams = {
  limit: Math.min(maxResults, 20),
  sources: ["web"],
  location: location || resolvedCountryContext?.countryNames?.[0] || this.mapCountryToLocation(country),
  country: resolvedCountryContext?.iso2 || country?.toUpperCase() || undefined,
  // ❌ Remove tbs for cron jobs - filter dates after retrieval
  // tbs: this.buildTimeBasedSearch(from, to),
  ignoreInvalidURLs: true,
};
```

#### Priority 5: Use Industry-Specific Terms

**File:** `src/lib/services/firecrawl-search-service.ts:370-377`

**Change:**
```typescript
private static getIndustryTerms(industry: string): string {
  const industryMap: Record<string, string> = {
    'legal-compliance': 'legal compliance regulatory technology',
    'fintech': 'fintech financial technology banking',
    'healthcare': 'healthcare medical technology pharma',
    'general': 'business professional networking'
  };
  return industryMap[industry] || 'business conference';
}
```

---

## Issue 3: Slow Extraction (3.5 Minutes for 0 Results)

### Problem Statement

Extraction jobs are taking 3.5 minutes to complete even when no URLs are found, wasting time and causing cron job timeouts.

**Log Evidence:**
```
2025-11-15 02:00:46.657 [info] {"at":"search_service","providerUsed":"firecrawl","total_results":0,"sample_urls":[]}
2025-11-15 02:00:52.161 [info] Polling extract job 4ad440b9-6573-4d4f-98a7-c38695ced1fd, attempt 1/20
2025-11-15 02:04:21.056 [info] Extract job 4ad440b9-6573-4d4f-98a7-c38695ced1fd status: completed (attempt 11)
2025-11-15 02:04:21.057 [info] Final events count: 0
```

**Timeline:**
- 02:00:46 - Search returned 0 results
- 02:00:52 - Extraction job started (6 seconds later)
- 02:04:21 - Extraction completed (3.5 minutes later)
- Result: 0 events found

### Root Cause Analysis

#### 3.1 Extraction Runs on Empty Results

**Location:** `src/lib/services/search-service.ts:1269-1380`

**Issue:** The `extractEvents()` method is called even when `urls.length === 0`.

**Current Code:**
```typescript
static async extractEvents(urls: string[]): Promise<{...}> {
  // No early exit check for empty URLs
  if (!firecrawlKey) {
    return { events: [], version: "extract_v5", trace: [] };
  }
  
  // Proceeds to create extraction job even with empty URLs
  const response = await fetch('https://api.firecrawl.dev/v2/extract', {
    method: 'POST',
    body: JSON.stringify({ urls: urls })  // ❌ Empty array
  });
}
```

**Impact:** Firecrawl API accepts empty URL arrays and creates a job that processes nothing, but still takes time to complete.

#### 3.2 Inefficient Polling Logic

**Location:** `src/lib/services/search-service.ts:1386-1432`

**Issue:** Polling uses 20 attempts with 1-second intervals, but the actual timeout is much longer.

**Current Code:**
```typescript
private static async pollExtractResults(jobId: string, firecrawlKey: string): Promise<any> {
  const maxAttempts = 20;  // 20 seconds max
  const pollInterval = 1000;  // 1 second intervals
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Poll logic
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
}
```

**Impact:** 
- Expected max time: 20 seconds
- Actual time from logs: 3.5 minutes (210 seconds)
- This suggests the polling is not working as expected, or there are retries/timeouts happening elsewhere.

#### 3.3 No Early Exit for Empty URLs

**Location:** `src/lib/services/search-service.ts:1269-1380`

**Issue:** No check to skip extraction when URLs array is empty.

**Current Code:**
```typescript
static async extractEvents(urls: string[]): Promise<{...}> {
  // ❌ Missing: if (urls.length === 0) return { events: [], ... };
  
  // Proceeds with extraction even for empty arrays
}
```

**Impact:** Wastes 3.5 minutes processing nothing.

#### 3.4 Multiple Fallback Attempts

**Location:** `src/lib/services/search-service.ts:1437-1591`

**Issue:** When extraction returns empty results, the code tries multiple fallback methods:
1. Structured data extraction
2. Markdown extraction
3. Direct content fetching
4. Minimal event creation from URLs

**Current Code:**
```typescript
// Try structured data
if (extractData.data?.events) { ... }

// Try markdown fallback
if (!events.length) {
  // Try markdown extraction
}

// Try direct content
if (!events.length) {
  // Try direct content fetching
}

// Create minimal events
if (!events.length) {
  // Create from URLs
}
```

**Impact:** Each fallback attempt adds time, even when there are no URLs to process.

#### 3.5 No Timeout for Individual Extractions

**Location:** `src/lib/services/search-service.ts:1386-1432`

**Issue:** Polling has a max attempts limit, but no absolute timeout.

**Current Code:**
```typescript
const maxAttempts = 20;  // 20 attempts
const pollInterval = 1000;  // 1 second

// But if each attempt takes longer than 1 second (network delays, etc.),
// the total time can exceed 20 seconds significantly
```

**Impact:** Network delays or slow Firecrawl responses can cause polling to take much longer than expected.

### Recommendations

#### Priority 1: Skip Extraction for Empty URLs

**File:** `src/lib/services/search-service.ts:1269-1280`

**Change:**
```typescript
static async extractEvents(urls: string[]): Promise<{...}> {
  // ✅ Early exit for empty URLs
  if (!urls || urls.length === 0) {
    console.log('[extract] No URLs provided, skipping extraction');
    return {
      events: [],
      version: "extract_v5",
      trace: []
    };
  }
  
  // Continue with extraction...
}
```

#### Priority 2: Add Absolute Timeout to Polling

**File:** `src/lib/services/search-service.ts:1386-1432`

**Change:**
```typescript
private static async pollExtractResults(jobId: string, firecrawlKey: string): Promise<any> {
  const maxAttempts = 20;
  const pollInterval = 1000;
  const absoluteTimeout = 60000; // 60 seconds absolute timeout
  const startTime = Date.now();
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // ✅ Check absolute timeout
    if (Date.now() - startTime > absoluteTimeout) {
      console.warn(`Extract job ${jobId} exceeded absolute timeout of ${absoluteTimeout}ms`);
      return null;
    }
    
    // Poll logic...
  }
}
```

#### Priority 3: Reduce Polling Attempts for Cron Jobs

**File:** `src/lib/services/search-service.ts:1386-1432`

**Change:**
```typescript
private static async pollExtractResults(
  jobId: string, 
  firecrawlKey: string,
  isCronJob: boolean = false  // ✅ Add flag
): Promise<any> {
  // ✅ Reduce attempts for cron jobs
  const maxAttempts = isCronJob ? 10 : 20;
  const pollInterval = isCronJob ? 2000 : 1000;  // Longer intervals for cron
  const absoluteTimeout = isCronJob ? 30000 : 60000;  // Shorter timeout for cron
  
  // ...
}
```

#### Priority 4: Skip Fallbacks for Empty Results

**File:** `src/lib/services/search-service.ts:1437-1591`

**Change:**
```typescript
private static async processExtractResults(extractData: any, urls: string[]): Promise<{...}> {
  // ✅ Early exit if no URLs
  if (!urls || urls.length === 0) {
    return { events: [], version: "extract_v5", trace: [] };
  }
  
  // Only try fallbacks if we have URLs but no events
  if (extractData.data?.events?.length === 0 && urls.length > 0) {
    // Try fallbacks...
  }
}
```

#### Priority 5: Add Logging for Extraction Start

**File:** `src/lib/services/search-service.ts:1269-1280`

**Change:**
```typescript
static async extractEvents(urls: string[]): Promise<{...}> {
  console.log(`[extract] Starting extraction for ${urls.length} URLs`);
  
  if (!urls || urls.length === 0) {
    console.log('[extract] ⚠️ No URLs provided, skipping extraction');
    return { events: [], version: "extract_v5", trace: [] };
  }
  
  // Continue...
}
```

---

## Summary of Recommendations

### High Priority (Immediate Fixes)

1. **Google CSE**: Add missing `cx` parameter to all CSE API calls
2. **Google CSE**: Trim queries to 256 characters
3. **Extraction**: Skip extraction when URLs array is empty
4. **Extraction**: Add absolute timeout to polling (60 seconds)

### Medium Priority (Performance Improvements)

5. **Firecrawl**: Pass meaningful queries from cron jobs instead of empty strings
6. **Firecrawl**: Relax filtering for cron jobs
7. **Google CSE**: Remove problematic `lr/cr` parameter combinations
8. **Extraction**: Reduce polling attempts for cron jobs (10 instead of 20)

### Low Priority (Optimization)

9. **Firecrawl**: Simplify query construction for cron jobs
10. **Firecrawl**: Remove or relax date range filtering in Firecrawl queries
11. **Firecrawl**: Use industry-specific terms in queries
12. **Google CSE**: Add specific 400 error handling (don't retry)

---

## Expected Impact

### Before Fixes
- **Google CSE**: 100% failure rate (400 errors)
- **Firecrawl**: 0% result rate (0 results despite successful API calls)
- **Extraction**: 3.5 minutes wasted per empty result set
- **Cron Job**: Times out after 1-2 combinations

### After Fixes
- **Google CSE**: <5% failure rate (only genuine API issues)
- **Firecrawl**: 30-50% result rate (meaningful queries + relaxed filtering)
- **Extraction**: <1 second for empty results (early exit)
- **Cron Job**: Completes 2-3 combinations successfully within timeout

---

## Implementation Effort Estimate

- **High Priority Fixes**: 4-6 hours
- **Medium Priority Fixes**: 6-8 hours
- **Low Priority Fixes**: 8-12 hours
- **Total**: 18-26 hours

---

## Testing Recommendations

1. **Unit Tests**: Test CSE URL construction with/without `cx` parameter
2. **Integration Tests**: Test Firecrawl queries with empty vs. meaningful queries
3. **E2E Tests**: Test cron job with all fixes applied
4. **Monitoring**: Add metrics for CSE 400 errors, Firecrawl 0-result rate, extraction times

---

## Notes

- All recommendations are non-breaking changes
- Fixes can be implemented incrementally
- Priority 1 fixes should be implemented immediately to restore basic functionality
- Consider A/B testing for Firecrawl query simplification to measure impact

