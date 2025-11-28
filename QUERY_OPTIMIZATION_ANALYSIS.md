# Firecrawl & CSE Query Optimization Analysis
**Date:** 2025-11-19  
**Based On:** Search logs from "compliance" query in Germany

---

## Executive Summary

Both Firecrawl and Google CSE queries are **overly complex** and **poorly optimized** for their respective APIs:

- **Firecrawl:** 628-character narrative query with redundant information causing 15s timeouts
- **CSE:** Complex boolean query with 8 quoted phrases + 10 keywords causing 0 results
- **Root Cause:** Queries are **partially hardcoded** using industry templates, then user input is appended, creating "kitchen sink" queries instead of user-centric, API-optimized queries

### Critical Finding: Queries Are Hardcoded, Not Fully Dynamic

**The Problem:**
- Queries start with **hardcoded industry templates** (`WEIGHTED_INDUSTRY_TEMPLATES`)
- User's search term (e.g., "compliance") is **appended** to the hardcoded baseQuery
- This creates queries like: `(hardcoded 200-char template) AND (user search term)`
- Result: User's intent is buried under hardcoded terms

**Example from Code:**
```typescript
// src/lib/data/weighted-templates.ts (line 24)
baseQuery: '(legal OR compliance OR regulatory OR governance OR "risk management" 
  OR audit OR investigation OR "e-discovery" OR "legal tech" OR "legal technology" 
  OR GDPR OR privacy OR "data protection" OR cybersecurity OR whistleblowing 
  OR ESG OR "financial regulation" OR "banking compliance" OR "corporate governance")'

// src/lib/services/weighted-query-builder.ts (line 80-81)
// Add user text if provided
if (userText && userText.trim()) {
  query = `(${query}) AND (${userText.trim()})`;  // User term appended!
}
```

**What Should Happen:**
- Queries should **start with user's search term**
- Industry/profile context should be **secondary enrichment**, not primary
- Templates should provide **suggestions**, not hardcoded base queries

---

## 0. Critical Issue: Hardcoded Queries vs Dynamic Queries

### Current Architecture (Problematic)

**Flow:**
1. System loads hardcoded industry template (`WEIGHTED_INDUSTRY_TEMPLATES['legal-compliance']`)
2. Template contains hardcoded `baseQuery` with 200+ characters of terms
3. User's search term (e.g., "compliance") is **appended** to hardcoded query
4. Result: `(hardcoded terms) AND (user term)` → overly complex query

**Code Evidence:**

**File:** `src/lib/data/weighted-templates.ts` (line 24)
```typescript
baseQuery: '(legal OR compliance OR regulatory OR governance OR "risk management" 
  OR audit OR investigation OR "e-discovery" OR "legal tech" OR "legal technology" 
  OR GDPR OR privacy OR "data protection" OR cybersecurity OR whistleblowing 
  OR ESG OR "financial regulation" OR "banking compliance" OR "corporate governance")'
```

**File:** `src/lib/services/weighted-query-builder.ts` (line 39, 80-81)
```typescript
let query = template.baseQuery;  // Starts with hardcoded template!

// Add user text if provided
if (userText && userText.trim()) {
  query = `(${query}) AND (${userText.trim()})`;  // User term appended!
}
```

**Problem:**
- User searches for "compliance" → gets query with 20+ hardcoded terms + "compliance"
- User's intent is buried under template terms
- Queries become 250-600+ characters unnecessarily

### Recommended Architecture (Dynamic)

**Flow:**
1. **Start with user's search term** (primary)
2. Add minimal event type keywords (secondary)
3. Add location/date context (tertiary)
4. Use templates only for **suggestions**, not base queries

**Example:**
```typescript
// User searches: "compliance"
// Dynamic query: "compliance conference Germany 2025"
// NOT: "(legal OR compliance OR regulatory...) AND (compliance)"
```

### Impact of Hardcoded Queries

1. **Firecrawl:** 628-char queries → 15s timeouts
2. **CSE:** 250-char queries with 8 quoted phrases → 0 results
3. **User Experience:** Search results don't match user intent
4. **Performance:** Unnecessary complexity slows down all APIs

### Solution Required

**Priority 1: Make Queries User-Centric**
- Start with `userText` as primary query
- Templates provide **enrichment suggestions**, not base queries
- Only add template terms if user query is too generic (< 3 words)

**Priority 2: API-Specific Optimization**
- Firecrawl: 150-200 char narrative starting with user term
- CSE: 20-40 char keywords starting with user term
- Database: Full boolean query (can be complex)

---

## 1. Firecrawl Query Analysis

### Current Query (from logs)
```
Find compliance business events and professional conferences in Germany 
(including Berlin, München, Frankfurt), scheduled between November 19, 2025 
and December 3, 2025, covering compliance, investigations, regtech, ESG, 
for leaders such as general counsel, compliance officer, legal counsel, 
with emphasis on compliance, investigations, audit, serving audiences like 
general counsel, chief compliance officer, prioritise events with clear 
dates and locations.
```

**Length:** 628 characters  
**Timeout:** 45s configured, but timing out at 15s  
**Success Rate:** -33.3% (4 failed, 3 total requests)

### Problems Identified

1. **Redundant Information**
   - "compliance" appears 4 times
   - "general counsel" appears 2 times
   - "compliance officer" appears 2 times
   - "investigations" appears 2 times
   - "audit" appears 1 time but overlaps with investigations

2. **Over-Specification**
   - Lists 3 cities when country is already specified
   - Includes both "leaders" and "audiences" (redundant)
   - Adds "prioritise events with clear dates" (unnecessary instruction)

3. **Query Length**
   - 628 characters is excessive for Firecrawl
   - Optimal length: 150-250 characters
   - Current query is 2.5x too long

4. **Timeout Mismatch**
   - Code sets `timeout: 45000` (45s)
   - But actual timeout occurs at 15s
   - Suggests middleware or fetch timeout is overriding

### Code Location
**File:** `src/lib/unified-query-builder.ts`  
**Function:** `buildNarrativeQuery()` (lines 318-439)

**Also:** `src/lib/services/weighted-query-builder.ts`  
**Function:** `buildNarrativeQuery()` (lines 168-271) - uses hardcoded templates

**Current Logic:**
```typescript
// Builds very verbose narrative with:
// - Full location description with cities
// - Full temporal description with formatted dates
// - User profile context (industry terms, ICP terms)
// - Search term context
// - Event type descriptions
```

### Optimization Recommendations

#### 1. **Simplify Narrative Query Structure**
**Current:** Full sentence with all details  
**Recommended:** Concise, keyword-focused query

**Before (628 chars):**
```
Find compliance business events and professional conferences in Germany 
(including Berlin, München, Frankfurt), scheduled between November 19, 2025 
and December 3, 2025, covering compliance, investigations, regtech, ESG...
```

**After (180 chars):**
```
compliance conferences Germany November 2025 December 2025 
general counsel compliance officer legal events
```

**Benefits:**
- 70% shorter
- Faster processing
- Less likely to timeout
- More focused results

#### 2. **Remove Redundancy**
- Remove duplicate terms (compliance, general counsel, etc.)
- Remove city list when country is specified
- Remove "prioritise" instructions (not actionable by API)

#### 3. **Fix Timeout Configuration**
**File:** `src/lib/search/unified-search-core.ts` (line 359)  
**Current:** `timeout: 45000`  
**Issue:** Actual timeout at 15s suggests fetch timeout override

**Recommendation:**
- Check if there's a global fetch timeout
- Ensure Firecrawl timeout matches actual API limits
- Consider reducing to 30s if 45s is causing issues

#### 4. **Prioritize User Search Term**
**Current:** User term "compliance" is buried in narrative  
**Recommended:** Lead with user's actual search term

**Structure:**
```
[User Search Term] + [Event Types] + [Location] + [Date Range] + [Key Context]
```

**Example:**
```
compliance conferences Germany November December 2025 
legal compliance regulatory events
```

---

## 2. Google CSE Query Analysis

### Current Query (from logs)
```
"risk management" "e-discovery" "legal tech" "legal technology" 
"data protection" "financial regulation" "banking compliance" 
"corporate governance" legal compliance regulatory governance 
audit investigation GDPR privacy cybersecurity whistleblowing
```

**Length:** ~250 characters  
**Quoted Phrases:** 8  
**Keywords:** 10+  
**Results:** 0 (both attempts)

### Problems Identified

1. **Too Many Quoted Phrases**
   - 8 quoted phrases is excessive
   - CSE treats quoted phrases as exact matches
   - Reduces result set dramatically
   - Best practice: 1-2 quoted phrases max

2. **Complex Boolean Logic**
   - Mix of quoted phrases and keywords
   - No explicit AND/OR operators
   - CSE may interpret ambiguously
   - Geographic filters may conflict

3. **Query Over-Specification**
   - Includes both "legal tech" AND "legal technology" (redundant)
   - Includes both "compliance" AND "regulatory" (overlapping)
   - Includes both "GDPR" AND "privacy" AND "data protection" (redundant)

4. **Geographic Filter Conflict**
   - Query has `gl=de` and `cr=countryDE`
   - Complex query + geographic filters can cause 0 results
   - CSE may be too restrictive

### Code Location
**File:** `src/lib/search/unified-search-core.ts`  
**Function:** `unifiedCseSearch()` (lines 627-767)  
**Helper:** `simplifyQueryForCSE()` (lines 523-560)

**Root Cause:** Query comes from `buildWeightedQuery()` which starts with hardcoded `template.baseQuery` (200+ chars), then appends user text, creating overly complex queries.

**Current Simplification Logic:**
```typescript
// Removes parentheses and boolean operators
// Extracts quoted phrases
// Keeps top 10 words
// But still too complex for CSE
```

### Optimization Recommendations

#### 1. **Dramatically Simplify CSE Query**
**Current Approach:** Complex query with many terms  
**Recommended:** Simple 3-5 keyword query

**Before (250 chars, 8 quotes):**
```
"risk management" "e-discovery" "legal tech" "legal technology" 
"data protection" "financial regulation" "banking compliance" 
"corporate governance" legal compliance regulatory governance...
```

**After (40 chars, 0 quotes):**
```
compliance conference Germany 2025
```

**Benefits:**
- 84% shorter
- No quoted phrases (broader results)
- Geographic filters work better
- Higher chance of results

#### 2. **Use User's Actual Search Term**
**Current:** Builds query from user profile + industry terms  
**Recommended:** Lead with user's search term

**Structure:**
```
[User Search Term] + [Event Type] + [Location] + [Year]
```

**Example for "compliance":**
```
compliance conference Germany 2025
```

#### 3. **Remove Quoted Phrases Entirely**
**Current:** 8 quoted phrases  
**Recommended:** 0 quoted phrases (or max 1 if critical)

**Rationale:**
- Quoted phrases are too restrictive
- CSE works better with keyword matching
- Geographic filters (`gl`, `cr`) already provide context

#### 4. **Simplify Geographic Filtering**
**Current:** Uses both `gl=de` and `cr=countryDE`  
**Issue:** `cr` parameter can cause 400 errors

**Recommendation:**
- Use only `gl=de` (country bias)
- Remove `cr` parameter (country restriction)
- Add location keyword to query instead: "Germany" or "Deutschland"

#### 5. **Implement Fallback Query Strategy**
**Current:** Single query attempt  
**Recommended:** Tiered query approach

**Tier 1 (Primary):**
```
compliance conference Germany 2025
```

**Tier 2 (If Tier 1 returns <3 results):**
```
compliance event Germany
```

**Tier 3 (If Tier 2 returns <3 results):**
```
compliance Germany
```

---

## 3. Query Builder Architecture Issues

### Problem: Single Query Builder for Multiple APIs

**Current Architecture:**
- `buildUnifiedQuery()` creates one query
- Same query used for Firecrawl, CSE, and Database
- Each API has different optimal query formats

**Issue:**
- Firecrawl needs narrative queries (natural language)
- CSE needs simple keyword queries
- Database needs complex boolean queries
- One-size-fits-all doesn't work

### Recommendation: API-Specific Query Builders

**New Architecture:**
```typescript
// API-specific query builders
buildFirecrawlQuery(params) → concise narrative (150-200 chars)
buildCSEQuery(params) → simple keywords (3-5 terms)
buildDatabaseQuery(params) → complex boolean (full query)
```

**Benefits:**
- Each API gets optimized query format
- Better success rates
- Faster processing
- More relevant results

---

## 4. Specific Code Changes Needed

### Firecrawl Query Builder

**File:** `src/lib/unified-query-builder.ts`  
**Function:** `buildNarrativeQuery()`

**CRITICAL CHANGE: Start with User Term, Not Template**

**Current (Wrong):**
```typescript
// Starts with template.baseQuery (200+ chars)
let query = template.baseQuery;
if (userText) {
  query = `(${query}) AND (${userText})`;  // User term appended!
}
```

**New (Correct):**
```typescript
// Start with user's search term
const userTerm = userText.trim() || 'events';
let query = userTerm;  // User term is PRIMARY

// Add minimal enrichment only if needed
if (needsEnrichment(userTerm)) {
  query += ` ${getMinimalEventTypes()}`;
}
```

**Changes:**
1. **Start with user search term** (not template)
2. **Reduce length to 150-200 characters**
3. **Remove redundant terms** (deduplicate)
4. **Remove city list** (country is sufficient)
5. **Remove "prioritise" instructions**
6. **Use templates for suggestions only**, not base queries

**New Structure:**
```typescript
function buildNarrativeQuery(params) {
  const { baseQuery, country, dateFrom, dateTo, userProfile } = params;
  
  // Lead with user's search term
  const searchTerm = baseQuery.trim() || 'events';
  
  // Get country name
  const countryName = getCountryName(country);
  
  // Build concise date range
  const dateRange = formatDateRange(dateFrom, dateTo); // "November 2025"
  
  // Get 2-3 key industry terms (not all)
  const industryTerms = (userProfile?.industry_terms || []).slice(0, 2);
  
  // Build concise query
  return `${searchTerm} ${industryTerms.join(' ')} ${countryName} ${dateRange} conference event`.trim();
}
```

**Example Output:**
```
compliance legal regulatory Germany November December 2025 conference event
```
(120 characters vs 628 characters)

### CSE Query Builder

**File:** `src/lib/search/unified-search-core.ts`  
**Function:** `simplifyQueryForCSE()`

**CRITICAL CHANGE: Start with User Term, Not Complex Query**

**Current (Wrong):**
```typescript
// Receives 250-char query with hardcoded terms
function simplifyQueryForCSE(query: string) {
  // Tries to simplify already-complex query
  // But query started with hardcoded template!
}
```

**New (Correct):**
```typescript
// Receive user term directly, build simple query
function buildCSEQuery(userText: string, country?: string) {
  const userTerm = userText.trim() || 'conference';
  const parts = [userTerm, 'conference'];
  if (country === 'DE') parts.push('Germany');
  parts.push('2025');
  return parts.join(' ');  // "compliance conference Germany 2025"
}
```

**Changes:**
1. **Start with user search term** (not simplified complex query)
2. **Extract only user search term + 2-3 keywords**
3. **Remove ALL quoted phrases**
4. **Remove boolean operators**
5. **Add event type keyword**
6. **Add location keyword**

**New Logic:**
```typescript
function simplifyQueryForCSE(query: string, userText?: string, country?: string): string {
  // If user provided simple search term, use it
  if (userText && userText.length < 50 && !userText.includes(' OR ')) {
    const terms = [userText.trim()];
    
    // Add event type
    terms.push('conference');
    
    // Add location if country specified
    if (country === 'DE') {
      terms.push('Germany');
    }
    
    // Add year
    terms.push('2025');
    
    return terms.join(' ');
  }
  
  // Fallback: extract 3-5 key terms from complex query
  const words = query
    .replace(/"([^"]+)"/g, '')  // Remove quoted phrases
    .replace(/\([^)]*\)/g, '')   // Remove parentheses
    .replace(/\s+(OR|AND)\s+/gi, ' ')  // Remove boolean
    .split(/\s+/)
    .filter(w => w.length > 3)   // Filter short words
    .slice(0, 5);                 // Take top 5
    
  return words.join(' ');
}
```

**Example Output:**
```
compliance conference Germany 2025
```
(32 characters vs 250 characters)

---

## 5. Timeout Configuration Fix

### Firecrawl Timeout Issue

**Problem:** Code sets 45s timeout but actual timeout is 15s

**Files to Check:**
1. `src/lib/search/unified-search-core.ts` (line 359) - sets `timeout: 45000`
2. `src/providers/firecrawl.ts` (line 27) - sets `timeout: 60000`
3. Check for global fetch timeout middleware
4. Check Firecrawl API actual limits

**Recommendation:**
- Reduce configured timeout to 30s (matches actual behavior)
- Or fix the 15s timeout override
- Add timeout logging to identify source

### CSE Timeout

**Current:** No explicit timeout (relies on fetch default)  
**Recommendation:** Add 10s timeout for CSE (should be fast)

---

## 6. Query Building Flow Optimization

### Current Flow
```
User Input: "compliance"
  ↓
buildUnifiedQuery() → Complex query with all terms
  ↓
Same query used for Firecrawl, CSE, Database
  ↓
Firecrawl: 628-char narrative (too long)
CSE: 250-char boolean (too complex)
Database: Works (but could be better)
```

### Recommended Flow
```
User Input: "compliance"
  ↓
buildUnifiedQuery() → Base query object
  ↓
API-Specific Builders:
  ↓
Firecrawl: buildFirecrawlQuery() → 150-char narrative
CSE: buildCSEQuery() → 30-char keywords
Database: buildDatabaseQuery() → Full boolean query
```

---

## 7. Priority Recommendations

### Immediate (This Week)

1. **Make Queries User-Centric** (CRITICAL - HIGH IMPACT)
   - **Change:** Start queries with `userText`, not hardcoded templates
   - **Files:** `src/lib/services/weighted-query-builder.ts`, `src/lib/data/weighted-templates.ts`
   - **Action:** Reverse query building: `userText` → minimal enrichment → location/date
   - **Expected:** 70% shorter queries, better relevance, faster responses

2. **Simplify CSE Query** (HIGH IMPACT)
   - Remove quoted phrases
   - Use only user search term + "conference" + location
   - **Dependency:** Must fix #1 first (remove hardcoded baseQuery)
   - Expected: 0 results → 5-10 results

3. **Shorten Firecrawl Query** (HIGH IMPACT)
   - Reduce from 628 to 150-200 characters
   - Remove redundancy
   - **Dependency:** Must fix #1 first (start with user term)
   - Expected: 15s timeouts → <5s responses

4. **Fix Timeout Configuration** (MEDIUM IMPACT)
   - Identify source of 15s timeout
   - Align configured vs actual timeout
   - Expected: Better reliability

### Short-term (This Sprint)

4. **Implement API-Specific Query Builders** (HIGH IMPACT)
   - Separate builders for Firecrawl, CSE, Database
   - Optimize each for its API
   - Expected: Better success rates across all providers

5. **Add Fallback Query Strategy** (MEDIUM IMPACT)
   - Tiered queries for CSE (simple → simpler → simplest)
   - Expected: Higher result counts

### Long-term (Next Sprint)

6. **Query Performance Monitoring** (LOW IMPACT)
   - Track query length vs success rate
   - Track timeout rates by query complexity
   - A/B test query formats

---

## 8. Expected Impact

### Firecrawl
- **Current:** 15s timeouts, -33.3% success rate
- **After:** <5s responses, >80% success rate
- **Improvement:** 3x faster, 4x more reliable

### CSE
- **Current:** 0 results
- **After:** 5-10 results per query
- **Improvement:** From unusable to functional

### Overall Search
- **Current:** 55s total, 2 events returned
- **After:** 15-20s total, 5-8 events returned
- **Improvement:** 3x faster, 2.5x more results

---

## 9. Implementation Checklist

### Firecrawl Query Optimization
- [ ] **CRITICAL:** Change query building to start with `userText`, not `template.baseQuery`
- [ ] **CRITICAL:** Update `buildWeightedQuery()` to use user term as primary
- [ ] Reduce `buildNarrativeQuery()` to 150-200 chars
- [ ] Remove redundant terms (deduplicate)
- [ ] Remove city list when country specified
- [ ] Remove "prioritise" instructions
- [ ] Lead with user search term (already covered above, but emphasize)
- [ ] Fix timeout configuration (15s → 30s)

### CSE Query Optimization
- [ ] **CRITICAL:** Change to build query from `userText` directly, not simplify complex query
- [ ] **CRITICAL:** Update `buildWeightedQuery()` to use user term as primary (shared with Firecrawl)
- [ ] Simplify `simplifyQueryForCSE()` to 3-5 keywords (or replace with `buildCSEQuery()`)
- [ ] Remove all quoted phrases (or max 1)
- [ ] Use user search term as primary (already covered above, but emphasize)
- [ ] Remove `cr` parameter (keep only `gl`)
- [ ] Add fallback query strategy
- [ ] Add 10s timeout

### Architecture Improvements
- [ ] **CRITICAL:** Refactor `buildWeightedQuery()` to start with `userText`, not `template.baseQuery`
- [ ] **CRITICAL:** Update `WEIGHTED_INDUSTRY_TEMPLATES` to provide suggestions, not base queries
- [ ] Create `buildFirecrawlQuery()` function (user-centric)
- [ ] Create `buildCSEQuery()` function (user-centric)
- [ ] Create `buildDatabaseQuery()` function (can be complex)
- [ ] Update `unifiedSearch()` to use API-specific builders
- [ ] Add query performance logging

---

## 10. Code Examples

### Optimized Firecrawl Query Builder

```typescript
function buildFirecrawlQuery(params: {
  userText: string;
  country?: string;
  dateFrom?: string;
  dateTo?: string;
  userProfile?: any;
}): string {
  const { userText, country, dateFrom, dateTo, userProfile } = params;
  
  // CRITICAL: Start with user's search term (not template!)
  const searchTerm = userText.trim() || 'events';
  
  // Get 1-2 key industry terms ONLY if user query is too generic
  // Don't add if user already provided specific terms
  const isGeneric = searchTerm.split(/\s+/).length < 3;
  const industryTerms = isGeneric 
    ? (userProfile?.industry_terms || []).slice(0, 1)  // Max 1 term
    : [];
  
  // Get country name
  const countryName = country ? getCountryName(country) : '';
  
  // Build concise date range (month + year only)
  const dateRange = dateFrom && dateTo 
    ? formatMonthYear(dateFrom) + ' ' + formatMonthYear(dateTo)
    : '';
  
  // Build query (target: 150-200 chars)
  // Structure: [user term] + [minimal enrichment] + [location] + [date] + [event type]
  const parts = [
    searchTerm,           // PRIMARY: User's search term
    ...industryTerms,     // SECONDARY: Only if needed
    countryName,          // TERTIARY: Location
    dateRange,            // TERTIARY: Date
    'conference event'    // TERTIARY: Event type
  ].filter(Boolean);
  
  return parts.join(' ').slice(0, 200);
}
```

### Optimized CSE Query Builder

```typescript
function buildCSEQuery(params: {
  userText: string;
  country?: string;
}): string {
  const { userText, country } = params;
  
  // CRITICAL: Start with user's search term (not simplified complex query!)
  const searchTerm = userText.trim() || 'conference';
  
  // Build simple query: [search term] + [event type] + [location] + [year]
  // Structure: User term is PRIMARY, everything else is minimal enrichment
  const parts = [searchTerm];  // PRIMARY: User's search term
  
  // Add event type (only if not already in user term)
  if (!searchTerm.toLowerCase().includes('conference') && 
      !searchTerm.toLowerCase().includes('event')) {
    parts.push('conference');
  }
  
  // Add location if country specified (only if not already in user term)
  if (country === 'DE' && !searchTerm.toLowerCase().includes('germany') &&
      !searchTerm.toLowerCase().includes('deutschland')) {
    parts.push('Germany');
  }
  
  // Add current year (only if not already in user term)
  if (!searchTerm.match(/\b20\d{2}\b/)) {
    parts.push('2025');
  }
  
  return parts.join(' '); // Target: 20-40 characters
}
```

---

**Report Generated:** 2025-11-19  
**Next Steps:** Review recommendations and prioritize implementation  
**Estimated Impact:** 3x faster searches, 4x better reliability, 2.5x more results

