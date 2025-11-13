# Search Term Bug Analysis: "Kartellrecht" Not Filtering Through

## Problem Summary

**User Input:** `userText: 'Kartellrecht'`  
**Actual Firecrawl Query:** `"Find ediscovery, compliance, investigations events and professional conferences in Germany..."`  
**Result:** 0 events returned (all filtered out by quality gate)

## Root Cause Analysis

### Issue 1: Narrative Query Ignores User Search Term

**Location:** `src/lib/unified-query-builder.ts:316-421`

The `buildNarrativeQuery` function **completely ignores** the `baseQuery` parameter (which contains the user's search text):

```typescript
function buildNarrativeQuery(params: {
  baseQuery: string;  // ← This contains "Kartellrecht" but is NEVER USED
  // ...
}): string {
  // ... builds narrative from:
  // - eventTypes
  // - locationTerms  
  // - temporalTerms
  // - userProfile.industry_terms  ← Uses profile terms instead!
  // - BUT NOT baseQuery!
  
  return `Find ${primaryIndustry} events...`;  // ← Missing user search term!
}
```

**Evidence from Logs:**
```
[unified-firecrawl] Using narrative query with user profile: 
"Find ediscovery, compliance, investigations events and professional conferences in Germany..."
```

The query should be: `"Find Kartellrecht events and professional conferences in Germany..."`

### Issue 2: Weighted Query Builder Narrative Not Used

**Location:** `src/lib/optimized-orchestrator.ts:1142-1157`

The `buildWeightedQuery` function returns both `query` and `narrativeQuery`, but only `query` is returned:

```typescript
const weightedResult = buildWeightedQuery(
  template,
  userProfile,
  params.country || 'DE',
  params.userText  // ← "Kartellrecht" is passed here
);

// weightedResult.narrativeQuery exists but is IGNORED
return weightedResult.query;  // ← Only returns structured query, not narrative
```

Then `unified-search-core.ts` rebuilds the narrative query using `buildUnifiedQuery`, which doesn't have access to the weighted template's narrative query.

### Issue 3: User Text Not Prioritized Over Profile Terms

**Location:** `src/lib/unified-query-builder.ts:152-178`

When `userText` is provided, it should be prioritized, but the narrative query builder uses profile terms instead:

```typescript
let baseQuery = userText.trim();  // ← "Kartellrecht"
if (!baseQuery && userProfile) {
  // Only uses profile if baseQuery is empty
  baseQuery = userProfile.industry_terms.join(', ');  // ← "ediscovery, compliance"
}

// But buildNarrativeQuery doesn't use baseQuery!
const narrativeQuery = buildNarrativeQuery({
  baseQuery,  // ← Passed but ignored
  // ...
});
```

## Code Flow

```
1. User searches: "Kartellrecht"
   ↓
2. buildOptimizedQuery(params.userText = "Kartellrecht")
   ↓
3. buildWeightedQuery(template, userProfile, "DE", "Kartellrecht")
   - Returns: { query: "...", narrativeQuery: "Find Kartellrecht events..." }
   ↓
4. buildOptimizedQuery returns weightedResult.query (NOT narrativeQuery)
   ↓
5. unifiedSearch({ q: weightedResult.query, ... })
   ↓
6. unifiedFirecrawlSearch calls buildUnifiedQuery AGAIN
   - buildUnifiedQuery({ userText: weightedResult.query, ... })
   - This rebuilds narrative query, but baseQuery is now the structured query, not "Kartellrecht"
   ↓
7. buildNarrativeQuery ignores baseQuery, uses userProfile.industry_terms
   ↓
8. Firecrawl receives: "Find ediscovery, compliance, investigations events..."
```

## Fixes Required

### Fix 1: Include User Search Term in Narrative Query

**File:** `src/lib/unified-query-builder.ts:316-421`

**Change:**
```typescript
function buildNarrativeQuery(params: {
  baseQuery: string;
  // ...
}): string {
  // ... existing code ...
  
  // ADD: Include user search term if provided
  let searchTermContext = '';
  if (params.baseQuery && params.baseQuery.trim()) {
    // Only add if baseQuery is a simple search term (not a complex structured query)
    const isSimpleTerm = !params.baseQuery.includes(' OR ') && 
                         !params.baseQuery.includes(' AND ') &&
                         params.baseQuery.length < 100;
    
    if (isSimpleTerm) {
      searchTermContext = ` related to ${params.baseQuery.trim()}`;
    }
  }
  
  // Include in narrative
  if (language === 'de') {
    if (hasSpecificIndustry) {
      const primaryIndustry = industryTerms.slice(0, 3).join(', ');
      return `Finde ${primaryIndustry} Events und Konferenzen in ${locationDescription}, ${temporalDescription}, einschließlich ${eventTypeDescription}${searchTermContext}${userContext}.`;
    }
    // ...
  } else {
    if (hasSpecificIndustry) {
      const primaryIndustry = industryTerms.slice(0, 3).join(', ');
      return `Find ${primaryIndustry} events and professional conferences in ${locationDescription}, ${temporalDescription}, including ${eventTypeDescription}${searchTermContext}${userContext}.`;
    }
    // ...
  }
}
```

### Fix 2: Pass Narrative Query from Weighted Builder

**File:** `src/lib/optimized-orchestrator.ts:1140-1157`

**Change:**
```typescript
if (template) {
  const weightedResult = buildWeightedQuery(
    template,
    userProfile,
    params.country || 'DE',
    params.userText
  );
  
  // Store narrative query for use in unifiedSearch
  // Return both query and narrativeQuery
  return {
    query: weightedResult.query,
    narrativeQuery: weightedResult.narrativeQuery
  };
}
```

**Then update `discoverEventCandidates` to pass narrative query:**
```typescript
async function discoverEventCandidates(
  query: string | { query: string; narrativeQuery: string }, 
  params: OptimizedSearchParams, 
  userProfile?: any
): Promise<string[]> {
  const queryObj = typeof query === 'string' 
    ? { query, narrativeQuery: undefined }
    : query;
    
  const result = await unifiedSearch({
    q: queryObj.query,
    narrativeQuery: queryObj.narrativeQuery,  // ← Pass narrative query
    // ...
  });
}
```

### Fix 3: Use Narrative Query in Unified Search

**File:** `src/lib/search/unified-search-core.ts:278-300`

**Change:**
```typescript
export interface UnifiedSearchParams {
  q: string;
  narrativeQuery?: string;  // ← Add optional narrative query
  // ...
}

async function unifiedFirecrawlSearch(params: UnifiedSearchParams): Promise<UnifiedSearchResult> {
  // ...
  
  // Use provided narrative query if available, otherwise build one
  let firecrawlQuery = params.narrativeQuery || params.q;
  
  if (!params.narrativeQuery) {
    // Only build narrative query if not provided
    try {
      const { buildUnifiedQuery } = await import('../unified-query-builder');
      const queryResult = await buildUnifiedQuery({
        userText: params.q,
        // ...
      });
      
      if (queryResult.narrativeQuery) {
        firecrawlQuery = queryResult.narrativeQuery;
      }
    } catch (error) {
      // ...
    }
  }
  
  // Use firecrawlQuery (either provided narrative or built one)
  const body: any = {
    query: firecrawlQuery,
    // ...
  };
}
```

## Expected Behavior After Fix

**User Input:** `userText: 'Kartellrecht'`

**Firecrawl Query Should Be:**
```
"Find legal-compliance events and professional conferences in Germany (including Berlin, München, Frankfurt), taking place between November 13, 2025 and November 27, 2025, including conference, event, summit, workshop, seminar, meeting, related to Kartellrecht, focusing on ediscovery, compliance, targeting general counsel, chief compliance officer."
```

**Current (Broken) Query:**
```
"Find ediscovery, compliance, investigations events and professional conferences in Germany..., focusing on ediscovery, compliance, targeting general counsel, chief compliance officer."
```

## Additional Issue: Quality Gate Too Strict

From logs:
```
[quality-gate] Filtered: "eDiscovery Day 2025" | Quality: 0.35 | Date: 2025-12-04 | City: missing | Speakers: 2 | Country: haystackid.com
[quality-gate] All 3 events filtered! Common issues: missing dates, no German location, < 2 speakers
```

Even if the search term is fixed, events are being filtered out because:
1. Missing city/venue (required for German location)
2. Date outside window (2025-12-04 vs 2025-11-13 to 2025-11-27)
3. < 2 speakers requirement

**Recommendation:** Review quality gate thresholds for German events, especially for specialized legal topics like "Kartellrecht" where events may be smaller.

## Priority

**Critical:** Fix 1 (Include user search term in narrative query)  
**High:** Fix 2 & 3 (Pass narrative query through pipeline)  
**Medium:** Review quality gate thresholds

