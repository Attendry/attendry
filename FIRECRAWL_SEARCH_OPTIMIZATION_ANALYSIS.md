# Firecrawl Search Architecture Analysis & Optimization Plan

## Executive Summary

This document provides a comprehensive analysis of the Firecrawl search integration, identifies architectural issues preventing search bar input from affecting queries, and proposes an optimization plan based on Firecrawl API best practices.

## Current Architecture Overview

### Search Flow

```
User Search Bar Input
    ↓
API Endpoint (/api/events/search or /api/events/search-enhanced)
    ↓
SearchService.executeSearch() or Orchestrator
    ↓
unifiedSearch({ q: userInput, ... })
    ↓
unifiedFirecrawlSearch()
    ↓
buildUnifiedQuery({ userText: params.q, ... })
    ↓
buildNarrativeQuery({ baseQuery, ... })
    ↓
Firecrawl API v2 Search
```

### Key Components

1. **Unified Search Core** (`src/lib/search/unified-search-core.ts`)
   - Main entry point: `unifiedSearch()`
   - Firecrawl implementation: `unifiedFirecrawlSearch()`
   - Handles caching, rate limiting, deduplication

2. **Unified Query Builder** (`src/lib/unified-query-builder.ts`)
   - Builds structured queries and narrative queries
   - `buildNarrativeQuery()` creates natural language queries for Firecrawl

3. **Weighted Query Builder** (`src/lib/services/weighted-query-builder.ts`)
   - Template-based query building with user profiles
   - Also has `buildNarrativeQuery()` function

4. **Search Service** (`src/lib/services/search-service.ts`)
   - Legacy search service with multiple query building paths

## Critical Issues Identified

### Issue 1: Search Bar Input Not Prioritized in Narrative Query

**Location:** `src/lib/unified-query-builder.ts:316-437`

**Problem:**
The `buildNarrativeQuery()` function has logic to include user search terms (lines 377-391), but it only includes them as a secondary "related to" clause, not as the primary focus. Additionally, the logic checks if the baseQuery is a "simple term" which may exclude valid user inputs.

**Current Behavior:**
```typescript
// In buildNarrativeQuery()
let searchTermContext = '';
if (baseQuery && baseQuery.trim()) {
  const isSimpleTerm = !baseQuery.includes(' OR ') && 
                       !baseQuery.includes(' AND ') &&
                       !baseQuery.includes('(') &&
                       baseQuery.length < 100 &&
                       baseQuery.trim().split(/\s+/).length <= 5;
  
  if (isSimpleTerm) {
    searchTermContext = ` related to ${cleanTerm}`;  // ← Only added as secondary clause
  }
}
```

**Impact:**
- User search bar input is appended as "related to X" instead of being the primary focus
- Complex search terms (>5 words) are completely ignored
- The narrative query always leads with industry/profile terms, not user input

**Evidence from Logs:**
```
[unified-firecrawl] Using provided narrative query: Find legal & compliance business events and professional conferences in Germany (including Berlin, München, Frankfurt), scheduled through the upcoming 12 months, covering compliance, investigations, regtech, ESG, for leaders such as general counsel, compliance officer, legal counsel, with emphasis on compliance, investigations, audit, serving audiences like general counsel, chief compliance officer, prioritise events with clear dates and locations.
```

Even when user enters different terms, this same query runs.

### Issue 2: Base Query Fallback Overrides User Input

**Location:** `src/lib/unified-query-builder.ts:151-178`

**Problem:**
When `userText` is empty or falls back to `config.baseQuery`, the narrative query is built entirely from configuration, ignoring any search bar input.

```typescript
let baseQuery = userText.trim();
if (!baseQuery && userProfile) {
  // Builds from profile instead of user input
  baseQuery = userProfile.industry_terms.join(', ');
}
if (!baseQuery) {
  baseQuery = config.baseQuery;  // ← Falls back to config
}
```

**Impact:**
- If user clears search bar or it's empty, the persistent config query takes over
- No distinction between "use persistent search" vs "user wants to refine search"

### Issue 3: No Query Refinement/Override Mechanism

**Problem:**
The architecture doesn't distinguish between:
1. **Persistent Search Mode**: Use configured base query (set and forget)
2. **Refinement Mode**: User wants to add/override terms from search bar
3. **New Search Mode**: User wants to completely replace the query

**Current Behavior:**
- All searches use the same path
- Search bar input is always treated as secondary to config/profile
- No way to signal "override" vs "refine" vs "add to"

### Issue 4: Narrative Query Verbosity

**Problem:**
The current narrative queries are extremely verbose (200+ characters) and may not be optimal for Firecrawl's search API.

**Example:**
```
Find legal & compliance business events and professional conferences in Germany (including Berlin, München, Frankfurt), scheduled through the upcoming 12 months, covering compliance, investigations, regtech, ESG, for leaders such as general counsel, compliance officer, legal counsel, with emphasis on compliance, investigations, audit, serving audiences like general counsel, chief compliance officer, prioritise events with clear dates and locations.
```

**Firecrawl API Considerations:**
- Firecrawl Search API v2 works best with concise, focused queries
- Overly verbose queries may dilute search intent
- Location, date, and other filters should use API parameters, not query text

### Issue 5: Multiple Query Builders Causing Inconsistency

**Problem:**
There are multiple places building queries:
1. `unified-query-builder.ts` - Main builder
2. `weighted-query-builder.ts` - Template-based builder
3. `search-service.ts` - Legacy builder with `buildEnhancedQuery()`
4. `enhanced-orchestrator.ts` - Another query builder

**Impact:**
- Inconsistent query formats across the codebase
- Narrative queries built differently in different places
- Hard to maintain and optimize

### Issue 6: Narrative Query Not Passed Through Pipeline

**Location:** `src/lib/search/unified-search-core.ts:328-349`

**Problem:**
Even when a narrative query is built upstream (e.g., in `weighted-query-builder`), it's not passed through to `unifiedFirecrawlSearch()`. Instead, the function rebuilds the narrative query, potentially losing context.

```typescript
// unifiedFirecrawlSearch() always rebuilds narrative query
if (!params.narrativeQuery) {
  const queryResult = await buildUnifiedQuery({
    userText: params.q,  // ← May be structured query, not user input
    // ...
  });
  firecrawlQuery = queryResult.narrativeQuery;
}
```

## Firecrawl API Best Practices Analysis

### Firecrawl Search API v2 Structure

Based on Firecrawl documentation and current implementation:

**Optimal Query Structure:**
```json
{
  "query": "concise, focused search query",
  "limit": 20,
  "sources": ["web"],
  "location": "Germany",  // Use API parameter, not query text
  "country": "DE",         // Use API parameter
  "scrapeOptions": {       // Optional, for content scraping
    "formats": ["markdown"],
    "onlyMainContent": true
  }
}
```

### Recommendations

1. **Keep Query Text Concise**
   - Primary search terms only
   - Avoid redundant location/date information (use API params)
   - Target: 50-100 characters for query text

2. **Use API Parameters for Filters**
   - Location: Use `location` and `country` parameters
   - Dates: Use `dateFrom`/`dateTo` if supported, or keep minimal in query
   - Language: Use `scrapeOptions.location.languages`

3. **Prioritize User Intent**
   - If user provides search terms, make them the primary focus
   - Profile/config terms should be secondary context

4. **Query Variations**
   - Firecrawl supports multiple query "ships" (variations)
   - Can send primary query + fallback queries
   - Current implementation doesn't leverage this

## Optimization Plan

### Phase 1: Fix Search Bar Input Integration (High Priority)

#### 1.1 Enhance Narrative Query Builder to Prioritize User Input

**File:** `src/lib/unified-query-builder.ts`

**Changes:**
- Modify `buildNarrativeQuery()` to check if `baseQuery` is user input vs config
- If user input exists, make it the primary focus of the narrative query
- Only use profile/config terms as secondary context when user input is present

**Logic:**
```typescript
function buildNarrativeQuery(params: {
  baseQuery: string;
  isUserInput?: boolean;  // NEW: Flag to indicate if baseQuery is from user
  // ...
}): string {
  const { baseQuery, isUserInput, ... } = params;
  
  // If baseQuery is user input, prioritize it
  if (isUserInput && baseQuery.trim()) {
    // Build query focused on user input
    return `Find ${baseQuery.trim()} events and professional conferences in ${locationDescription}, ${temporalDescription}...`;
  }
  
  // Otherwise, use existing logic with profile/config terms
  // ...
}
```

#### 1.2 Add Query Mode Parameter

**File:** `src/lib/search/unified-search-core.ts`

**Add to `UnifiedSearchParams`:**
```typescript
export interface UnifiedSearchParams {
  q: string;
  narrativeQuery?: string;
  queryMode?: 'persistent' | 'refine' | 'override';  // NEW
  userSearchInput?: string;  // NEW: Explicit user input from search bar
  // ...
}
```

**Logic in `unifiedFirecrawlSearch()`:**
```typescript
// Determine query mode
const queryMode = params.queryMode || 'persistent';
const userInput = params.userSearchInput || (queryMode !== 'persistent' ? params.q : '');

if (queryMode === 'override' && userInput) {
  // User wants to completely replace query
  firecrawlQuery = buildUserFocusedQuery(userInput, params);
} else if (queryMode === 'refine' && userInput) {
  // User wants to refine/add to existing query
  firecrawlQuery = buildRefinedQuery(params.narrativeQuery, userInput, params);
} else {
  // Persistent mode: use existing logic
  firecrawlQuery = params.narrativeQuery || buildNarrativeQuery(...);
}
```

#### 1.3 Update API Endpoints to Pass Query Mode

**Files:** 
- `src/app/api/events/search/route.ts`
- `src/app/api/events/search-enhanced/route.ts`

**Changes:**
- Detect if search bar has input
- Set `queryMode` based on whether user input exists
- Pass `userSearchInput` separately from `q`

### Phase 2: Optimize Narrative Query Structure (Medium Priority)

#### 2.1 Simplify Narrative Queries

**Goal:** Reduce verbosity while maintaining search intent

**Current (200+ chars):**
```
Find legal & compliance business events and professional conferences in Germany (including Berlin, München, Frankfurt), scheduled through the upcoming 12 months, covering compliance, investigations, regtech, ESG, for leaders such as general counsel, compliance officer, legal counsel, with emphasis on compliance, investigations, audit, serving audiences like general counsel, chief compliance officer, prioritise events with clear dates and locations.
```

**Optimized (80-120 chars):**
```
Find legal compliance conferences in Germany covering compliance, investigations, regtech, ESG for general counsel and compliance officers
```

**Changes:**
- Remove redundant location details (use API `location` param)
- Remove redundant temporal details (use API date params if available)
- Focus on core search terms
- Keep only essential qualifiers

#### 2.2 Use Firecrawl API Parameters Effectively

**File:** `src/lib/search/unified-search-core.ts:351-382`

**Current:**
```typescript
const body: any = {
  query: firecrawlQuery,  // Contains location, dates, etc.
  limit: params.limit || 20,
  sources: ['web'],
  timeout: 45000
};
```

**Optimized:**
```typescript
const body: any = {
  query: conciseQuery,  // Only search terms, no location/dates
  limit: params.limit || 20,
  sources: ['web'],
  location: params.country ? getCountryName(params.country) : undefined,
  country: params.country,
  // Add date filtering if Firecrawl API supports it
  timeout: 45000
};
```

### Phase 3: Implement Query Refinement Logic (Medium Priority)

#### 3.1 Create Query Refinement Functions

**New File:** `src/lib/search/query-refinement.ts`

**Functions:**
- `refineQuery(baseQuery: string, userInput: string): string`
  - Intelligently adds user input to existing query
  - Handles synonyms, related terms
  - Maintains query coherence

- `overrideQuery(userInput: string, context: SearchContext): string`
  - Builds new query focused on user input
  - Uses context (country, dates) but prioritizes user terms

- `mergeQueries(query1: string, query2: string, mode: 'add' | 'replace' | 'intersect'): string`
  - Combines queries based on mode

#### 3.2 Add UI Controls for Query Mode

**Files:**
- `src/components/AdvancedSearch.tsx`
- `src/components/NaturalLanguageSearch.tsx`

**Features:**
- Toggle between "Persistent Search" and "Refine Search" modes
- Visual indicator showing active query
- Option to clear/reset persistent query
- Option to save current query as persistent

### Phase 4: Consolidate Query Builders (Low Priority)

#### 4.1 Create Single Source of Truth

**Strategy:**
- Keep `unified-query-builder.ts` as primary builder
- Deprecate other builders gradually
- Create adapter functions for legacy code

#### 4.2 Standardize Narrative Query Format

**Create:** `src/lib/search/narrative-query-spec.ts`

**Define:**
- Standard structure for narrative queries
- Required vs optional components
- Length limits and optimization rules

## Implementation Priority

### Critical (Immediate)
1. ✅ Fix search bar input not affecting narrative query
2. ✅ Add query mode detection (persistent vs refine vs override)
3. ✅ Pass user search input explicitly through pipeline

### High (Next Sprint)
4. Simplify narrative query structure
5. Use Firecrawl API parameters for location/dates
6. Implement query refinement logic

### Medium (Future)
7. Add UI controls for query mode
8. Consolidate query builders
9. Add query analytics/metrics

## Testing Strategy

### Unit Tests
- Test narrative query builder with various user inputs
- Test query mode detection logic
- Test query refinement functions

### Integration Tests
- Test search flow with search bar input
- Test persistent search mode
- Test refine/override modes
- Verify Firecrawl API calls use optimized queries

### Manual Testing
- Enter different terms in search bar
- Verify query changes in logs
- Check Firecrawl API request body
- Verify search results relevance

## Success Metrics

1. **Query Relevance**
   - Search bar input appears in Firecrawl query
   - Results match user's search intent

2. **Query Optimization**
   - Narrative queries reduced to 80-120 characters
   - Location/dates use API parameters, not query text

3. **User Experience**
   - Users can refine persistent searches
   - Clear distinction between modes
   - Search results improve with user input

## Firecrawl API Documentation References

Based on Firecrawl Search API v2:

- **Query Parameter**: Should be concise, focused search terms
- **Location Parameter**: Use for geographic filtering (country, city)
- **Sources**: `['web']` for web search
- **Limit**: Max 20 results per request
- **Scrape Options**: Optional, for content extraction
- **Timeout**: 45s recommended (current implementation)

## Risk Assessment

### Low Risk
- Simplifying narrative queries (can A/B test)
- Using API parameters for location/dates

### Medium Risk
- Changing query builder logic (may affect existing searches)
- Adding query mode parameter (requires UI changes)

### High Risk
- Breaking existing persistent search functionality
- Changing query format may affect cached results

### Mitigation
- Feature flags for new query modes
- Gradual rollout with monitoring
- Maintain backward compatibility
- Clear migration path for existing searches

## Next Steps

1. **Review this analysis** with team
2. **Prioritize phases** based on business needs
3. **Create detailed implementation tickets** for Phase 1
4. **Set up monitoring** for query performance
5. **Plan UI changes** for query mode controls

## Appendix: Current Query Flow Diagram

```
┌─────────────────┐
│  User Search    │
│  Bar Input      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Endpoint   │
│  /api/events/   │
│  search         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ SearchService   │─────▶│ buildUnifiedQuery │
│ or Orchestrator │      │ (userText: q)     │
└────────┬────────┘      └────────┬─────────┘
         │                        │
         │                        ▼
         │              ┌──────────────────┐
         │              │ buildNarrative  │
         │              │ Query            │
         │              │ (ignores user    │
         │              │  input priority) │
         │              └────────┬─────────┘
         │                       │
         ▼                       │
┌─────────────────┐              │
│ unifiedSearch() │◀─────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ unifiedFirecrawl│
│ Search()        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Firecrawl API   │
│ (verbose query) │
└─────────────────┘
```

## Appendix: Proposed Query Flow Diagram

```
┌─────────────────┐
│  User Search    │
│  Bar Input      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Endpoint   │
│  (detects mode) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ unifiedSearch() │─────▶│ buildNarrative   │
│ (queryMode,     │      │ Query            │
│  userInput)     │      │ (prioritizes     │
└────────┬────────┘      │  user input)     │
         │               └──────────────────┘
         │
         ▼
┌─────────────────┐
│ unifiedFirecrawl│
│ Search()        │
│ (optimized      │
│  query + API    │
│  params)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Firecrawl API   │
│ (concise query  │
│  + location/    │
│  date params)   │
└─────────────────┘
```

