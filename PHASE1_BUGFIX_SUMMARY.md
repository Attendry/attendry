# Phase 1 Bug Fixes - Search Issues

**Date:** February 26, 2025  
**Issue:** Firecrawl returning 0 results, duplicate "conference conference" query

---

## Issues Identified from Logs

### Issue 1: Duplicate "conference conference" Query

**Problem:**
- Log shows: `"conference conference"` as narrative query
- This happens when baseQuery is "conference" and eventTypes[0] is also "conference"
- The simplified query builder appends event type even when it's already in the query

**Root Cause:**
- `buildNarrativeQuery()` always appends `primaryEventType` even if it's already in `userSearchTerm`
- When user searches for "conference", it becomes "conference conference"

**Fix Applied:**
- Added check to detect if event type is already in the search term
- If event type is found in term, return term as-is without appending
- Prevents duplicate event types in query

**File:** `src/lib/unified-query-builder.ts`

---

### Issue 2: Firecrawl Returning 0 Results

**Problem:**
- Firecrawl API returns `success: true` but `webResults: 0`
- Query being sent: `"conference germany deutschland 2025 after 2025 before 2025 de"`
- This is the shard query, not the simplified narrative query

**Root Cause:**
- `FirecrawlSearchService.searchEvents()` rebuilds queries even when a simplified narrative query is provided
- The shard query builder adds location tokens and date tokens, creating verbose queries
- The simplified narrative query ("conference") is being ignored

**Fix Applied:**
- Added detection for simplified queries (short, focused, no complex operators)
- If query is simplified (< 100 chars, <= 5 words, no OR/AND), use it directly
- Skip shard query building for simplified queries
- This preserves the optimized narrative query

**File:** `src/lib/services/firecrawl-search-service.ts`

---

### Issue 3: Overly Strict Date Filtering

**Problem:**
- Filtering logic requires dates even when no date range is specified
- Code: `else if (!hasSomeDate && !timeframeHint) { continue; }`
- This filters out valid results that don't have explicit dates

**Root Cause:**
- Date filtering was too strict for general searches
- When no date range is specified, results without dates are still filtered out

**Fix Applied:**
- Relaxed date filtering when no date range is specified
- Don't require dates if user didn't specify a date range
- Still filter by date range if user specified one
- This allows more results through for general searches

**File:** `src/lib/services/firecrawl-search-service.ts`

---

## Changes Made

### 1. `src/lib/unified-query-builder.ts`

**Change:** Prevent duplicate event types in narrative query

```typescript
// Before
return `${userSearchTerm} ${primaryEventType}`;

// After
const eventTypeInTerm = eventTypes.some(et => userSearchTerm.includes(et.toLowerCase()));
if (eventTypeInTerm) {
  return userSearchTerm; // Don't duplicate
}
return `${userSearchTerm} ${primaryEventType}`;
```

### 2. `src/lib/services/firecrawl-search-service.ts`

**Change 1:** Use simplified queries directly

```typescript
// Detect simplified queries
const isSimplifiedQuery = query.length < 100 && 
                          query.split(/\s+/).length <= 5 && 
                          !query.includes(' OR ') && 
                          !query.includes(' AND ') &&
                          !query.includes('(');

if (isSimplifiedQuery) {
  primaryQuery = query; // Use directly
  fallbackQuery = query;
} else {
  // Build from tokens (original logic)
  primaryQuery = this.buildShardQuery(...);
  fallbackQuery = await this.buildSearchQueryInternal(...);
}
```

**Change 2:** Relaxed date filtering

```typescript
// Before
} else if (!hasSomeDate && !timeframeHint) {
  continue; // Too strict
}

// After
} else {
  // No date range specified - don't require dates
  // Allow results through even without explicit dates
}
```

---

## Expected Results

### Query Quality
- ✅ No more "conference conference" duplicates
- ✅ Simplified queries used directly
- ✅ Better query relevance

### Result Count
- ✅ More results returned (less strict filtering)
- ✅ Results without dates allowed through
- ✅ Better coverage for general searches

### Performance
- ✅ Faster queries (simplified queries skip token extraction)
- ✅ Less processing overhead

---

## Testing Recommendations

1. **Test Simple Query:**
   - Search: "conference"
   - Expected: Query should be "conference" (not "conference conference")
   - Expected: Should return results

2. **Test Query with Event Type:**
   - Search: "summit"
   - Expected: Query should be "summit" (not "summit conference")
   - Expected: Should return results

3. **Test General Search:**
   - Search: "legal compliance"
   - Expected: Query should be "legal compliance conference"
   - Expected: Should return results

4. **Test Date Range:**
   - Search with date range: Nov 30 - Dec 30, 2025
   - Expected: Results filtered by date range
   - Expected: Results without dates still allowed if in range

---

## Next Steps

1. **Commit fixes** - Apply bug fixes
2. **Test** - Verify fixes resolve issues
3. **Monitor** - Track result counts and query quality
4. **Iterate** - Adjust if needed based on results

---

**Status:** Fixes Applied  
**Ready for:** Testing & Validation

