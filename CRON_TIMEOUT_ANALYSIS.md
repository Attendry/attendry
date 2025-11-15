# Cron Job Timeout Analysis

## Executive Summary

The cron job is **timing out after 300 seconds (5 minutes)** - Vercel's function timeout limit. The job processes 12 industry/country combinations sequentially, and each combination can take 3-5 minutes, causing the timeout.

## Root Cause Analysis

### Timeline from Logs

1. **02:00:28** - Cron job started
2. **02:00:30** - Started collecting `legal-compliance` in `de`
3. **02:00:52** - Started extraction job (polling)
4. **02:04:21** - Extraction completed (took ~3.5 minutes)
5. **02:04:21** - Found 0 events, moved to next combination
6. **02:04:22** - Started collecting `legal-compliance` in `fr`
7. **02:05:28** - **TIMEOUT** (exactly 300 seconds after start)

### Key Issues Identified

1. **Sequential Processing**: 3 industries × 4 countries = 12 combinations processed one-by-one
2. **Slow Extraction**: Single extraction took 3.5 minutes even though it found 0 events
3. **No Results**: Both Firecrawl and Google CSE returned 0 results, but extraction still ran
4. **No Timeout Protection**: Job doesn't check remaining time before starting new combinations
5. **Inefficient Extraction**: Extraction runs even when search returns 0 URLs

### Performance Breakdown

- **Standard collection**: 3 industries × 4 countries = 12 combinations
- **Estimated time per combination**: 3-5 minutes (based on logs)
- **Total estimated time**: 36-60 minutes
- **Vercel timeout**: 300 seconds (5 minutes)
- **Result**: Job times out after processing only 1-2 combinations

## Specific Problems

### 1. Extraction Runs on Empty Results

**Log Evidence:**
```
2025-11-15 02:00:46.657 [info] {"at":"search_service","providerUsed":"firecrawl","total_results":0,"sample_urls":[]}
2025-11-15 02:00:52.161 [info] Polling extract job 4ad440b9-6573-4d4f-98a7-c38695ced1fd, attempt 1/20
```

The search returned 0 results, but the extraction job still started and took 3.5 minutes to complete.

### 2. Google CSE Returning 400 Errors

**Log Evidence:**
```
2025-11-15 02:00:47.185 [info] {"at":"search_service","real":"cse_result","status":400,"items":0}
```

Google CSE is returning 400 status codes, indicating API configuration issues.

### 3. Firecrawl Returning 0 Results

**Log Evidence:**
```
2025-11-15 02:00:38.943 [info] {"at":"firecrawl_call_result","label":"shard","status":200,"success":true,"webResults":0}
2025-11-15 02:00:46.657 [info] {"at":"firecrawl_call_result","label":"full","status":200,"success":true,"webResults":0}
```

Firecrawl is succeeding but returning 0 results, possibly due to:
- Query too generic/broad
- Date range issues
- Country/location filtering too strict

### 4. No Early Exit Logic

The job continues processing all combinations even when:
- Time is running out
- No results are being found
- Extraction is taking too long

## Recommended Fixes

### Priority 1: Add Timeout Protection

1. **Check remaining time before each combination**
2. **Skip extraction if search returns 0 results**
3. **Add early exit when < 60 seconds remaining**

### Priority 2: Reduce Combinations Per Run

1. **Process fewer combinations per cron run**
2. **Spread combinations across multiple runs**
3. **Use a rotation strategy** (e.g., process 2-3 combinations per run)

### Priority 3: Optimize Extraction

1. **Skip extraction when search returns 0 URLs**
2. **Add timeout to extraction polling**
3. **Reduce extraction timeout for cron jobs**

### Priority 4: Fix Search Issues

1. **Investigate Google CSE 400 errors**
2. **Review Firecrawl query construction**
3. **Add better logging for search failures**

## Implementation Plan

### Phase 1: Immediate Fixes (Prevent Timeout)

1. Add timeout check before each combination
2. Skip extraction when search returns 0 results
3. Add early exit when < 60 seconds remaining
4. Process only 2-3 combinations per run

### Phase 2: Optimization (Improve Efficiency)

1. Implement rotation strategy for combinations
2. Add extraction timeout (max 60 seconds per URL)
3. Parallel processing where safe
4. Better error handling for search failures

### Phase 3: Monitoring (Track Performance)

1. Add timing metrics for each combination
2. Log remaining time before each operation
3. Track success/failure rates per combination
4. Alert on timeout risk

## Expected Impact

- **Before**: Job times out after 1-2 combinations, 0 events collected
- **After**: Job completes 2-3 combinations successfully, collects events, no timeouts

## Acceptance Criteria

1. ✅ Cron job completes without timeout
2. ✅ At least 2-3 combinations processed per run
3. ✅ Extraction skipped when search returns 0 results
4. ✅ Early exit when time is running out
5. ✅ Events successfully stored in database

