# Query System Refactoring: Implementation Plan
**Date:** 2025-11-19  
**Goal:** User-centric queries with maintained regional precision  
**Priorities:** Accuracy > Insight > Speed

---

## Dependency Analysis

### Current System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    executeOptimizedSearch()                  │
└───────────────────────────────┬─────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │  buildOptimizedQuery() │
                    └───────────┬───────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
    ┌───────────▼──────────┐      ┌────────────▼─────────────┐
    │ buildWeightedQuery() │      │  buildUnifiedQuery()     │
    │ (Primary Path)       │      │  (Fallback Path)         │
    └───────────┬──────────┘      └────────────┬─────────────┘
                │                               │
    ┌───────────▼──────────┐      ┌────────────▼─────────────┐
    │ WEIGHTED_INDUSTRY_   │      │  Search Config           │
    │ TEMPLATES            │      │  (Database)              │
    │ (Hardcoded)          │      │                          │
    └───────────┬──────────┘      └────────────┬─────────────┘
                │                               │
                └───────────────┬───────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    Query Used By:     │
                    │  - Firecrawl          │
                    │  - CSE                │
                    │  - Database           │
                    └───────────────────────┘
```

### Critical Dependencies

#### 1. **Query Building Dependencies**
- **buildOptimizedQuery()** depends on:
  - User profile (industry_terms, icp_terms, competitors)
  - Search config (industry, baseQuery, excludeTerms)
  - WEIGHTED_INDUSTRY_TEMPLATES (hardcoded)
  - User input (userText, country, dates)

#### 2. **Geographic Precision Dependencies**
- **Country context** from:
  - `getCountryContext(country)` → returns cities, regions, TLDs
  - Template `geographicCoverage` → hardcoded cities/regions
  - User profile location preferences
  
- **Current mechanisms:**
  - Firecrawl: `location` parameter + query text
  - CSE: `gl` (country bias) + `cr` (country restriction) + query text
  - Database: Geographic filters in SQL

#### 3. **Industry Relevance Dependencies**
- **Template baseQuery** (hardcoded 200+ chars)
- **User profile industry_terms** (dynamic)
- **Search config excludeTerms** (hardcoded negative filters)

#### 4. **Search Provider Dependencies**
- **Firecrawl:**
  - Needs narrative query (natural language)
  - Uses `location` parameter for geographic bias
  - Supports 150-250 char queries optimally
  
- **CSE:**
  - Needs simple keyword query
  - Uses `gl` (country) and `cr` (country restriction)
  - Supports 20-100 char queries
  
- **Database:**
  - Needs boolean query (can be complex)
  - Uses SQL geographic filters
  - No length limits

---

## Risk Analysis

### Risks of Removing Hardcoded baseQuery

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Loss of industry specificity** | Medium | Use user profile industry_terms as primary context |
| **Generic queries return irrelevant results** | High | Implement fallback to template terms if user query is too generic (< 3 words) |
| **Regional precision degraded** | High | Maintain geographic filtering via API parameters + minimal location keywords |
| **Cross-industry noise increases** | Medium | Keep negative filters (excludeTerms) as post-processing filter |
| **User queries too simple** | Medium | Add minimal enrichment (event type + location) when needed |

### Risks of Keeping Hardcoded baseQuery

| Risk | Impact | Current State |
|------|--------|---------------|
| **Overly complex queries** | High | ✅ **Happening now** - 250-600 char queries |
| **User intent buried** | High | ✅ **Happening now** - user term appended |
| **API timeouts** | High | ✅ **Happening now** - Firecrawl 15s timeouts |
| **Zero results** | High | ✅ **Happening now** - CSE returning 0 results |
| **Poor search relevance** | High | ✅ **Happening now** - results don't match intent |

**Conclusion:** Risks of keeping hardcoded baseQuery are **HIGHER** and **already manifesting**.

---

## Recommended Path Forward

### Phase 1: Refactor Query Building (Week 1)
**Goal:** Make queries user-centric while maintaining regional precision

#### 1.1: Update buildWeightedQuery() - User-Centric Approach
**File:** `src/lib/services/weighted-query-builder.ts`

**Change:**
```typescript
// OLD (Current)
let query = template.baseQuery;  // Start with 200+ hardcoded chars
if (userText && userText.trim()) {
  query = `(${query}) AND (${userText.trim()})`;  // Append user text
}

// NEW (User-Centric)
function buildWeightedQuery(template, userProfile, country, userText, dateFrom, dateTo) {
  // 1. START WITH USER TERM (PRIMARY)
  const userTerm = userText?.trim() || '';
  
  // 2. Determine if enrichment is needed
  const isGenericQuery = !userTerm || userTerm.split(/\s+/).length < 3;
  
  // 3. Build query starting with user term
  let query = userTerm;
  
  // 4. Add minimal enrichment if needed
  if (isGenericQuery) {
    // If user query is too generic, add context from profile or template
    const contextTerms = [];
    
    // Priority 1: User profile industry terms
    if (userProfile?.industry_terms?.length > 0) {
      contextTerms.push(...userProfile.industry_terms.slice(0, 2));
    } 
    // Priority 2: Template industry terms (as fallback)
    else if (template.industryTerms?.length > 0) {
      contextTerms.push(...template.industryTerms.slice(0, 2));
    }
    
    if (contextTerms.length > 0) {
      query = query ? `${query} ${contextTerms.join(' ')}` : contextTerms.join(' ');
    }
  }
  
  // 5. Add event type if not present
  if (!containsEventType(query)) {
    query += ' conference event';
  }
  
  // 6. Geographic precision maintained via API parameters (not query text)
  // See buildNarrativeQuery() and API-specific builders
  
  return query;
}
```

**Benefits:**
- User term is primary (not buried)
- Only adds context when needed
- Query length: 50-150 chars vs 250-600 chars
- Maintains industry relevance via user profile

**Geographic Precision Strategy:**
- Keep location OUT of the main query text
- Use API-specific parameters for geographic filtering:
  - Firecrawl: `location` parameter + country in narrative
  - CSE: `gl` and `cr` parameters
  - Database: SQL WHERE clauses

#### 1.2: Update buildNarrativeQuery() - Concise & User-Focused
**File:** `src/lib/services/weighted-query-builder.ts` (line 168-271)

**Change:**
```typescript
// NEW: Concise narrative query for Firecrawl
function buildNarrativeQuery(template, userProfile, country, userText, dateFrom, dateTo) {
  const countryName = getCountryName(country);
  
  // 1. Start with user's search term (PRIMARY)
  const userKeyword = userText?.trim() || '';
  
  // 2. Get context (SECONDARY)
  const contextTerms = userProfile?.industry_terms?.slice(0, 2) || 
                       template.industryTerms.slice(0, 2);
  
  // 3. Build concise date range (TERTIARY)
  const dateRange = formatDateRange(dateFrom, dateTo); // "November - December 2025"
  
  // 4. Build narrative (TARGET: 150-200 chars)
  const parts = [];
  
  if (userKeyword) {
    // User provided search term - make it the focus
    parts.push(`Find ${userKeyword} events`);
    
    // Add context if generic
    if (contextTerms.length > 0 && userKeyword.split(/\s+/).length < 3) {
      parts.push(`related to ${contextTerms.join(', ')}`);
    }
  } else {
    // No user term - use context
    parts.push(`Find ${contextTerms.join(' ')} events`);
  }
  
  // Add location and date
  parts.push(`in ${countryName}`);
  if (dateRange) {
    parts.push(dateRange);
  }
  
  return parts.join(' ') + '.';
}
```

**Example Outputs:**
- User: "compliance" → "Find compliance events in Germany November - December 2025."
- User: "Kartellrecht" → "Find Kartellrecht events related to legal, compliance in Germany November - December 2025."
- User: "" → "Find compliance regulatory events in Germany November - December 2025."

**Benefits:**
- 80-150 characters vs 628 characters
- User term is prominent
- Clear, natural language
- Faster processing

#### 1.3: Implement API-Specific Query Builders
**File:** `src/lib/search/api-query-builders.ts` (NEW)

```typescript
/**
 * API-Specific Query Builders
 * Each search provider needs different query formats
 */

// Firecrawl: Natural language narrative (150-200 chars)
export function buildFirecrawlQuery(params: {
  userText: string;
  country: string;
  dateFrom?: string;
  dateTo?: string;
  userProfile?: any;
}): string {
  const { userText, country, dateFrom, dateTo, userProfile } = params;
  
  const userTerm = userText.trim() || 'events';
  const countryName = getCountryName(country);
  const dateRange = formatDateRange(dateFrom, dateTo);
  
  // Check if user query needs enrichment
  const isGeneric = userTerm.split(/\s+/).length < 3;
  const contextTerms = isGeneric && userProfile?.industry_terms 
    ? userProfile.industry_terms.slice(0, 1)
    : [];
  
  const parts = [userTerm];
  if (contextTerms.length > 0) {
    parts.push(...contextTerms);
  }
  parts.push(countryName);
  if (dateRange) parts.push(dateRange);
  parts.push('conference event');
  
  return parts.join(' ').slice(0, 200);
}

// CSE: Simple keywords (20-40 chars)
export function buildCSEQuery(params: {
  userText: string;
  country: string;
}): string {
  const { userText, country } = params;
  
  const userTerm = userText.trim() || 'conference';
  const parts = [userTerm];
  
  // Add event type if not present
  if (!userTerm.toLowerCase().match(/conference|event|summit/)) {
    parts.push('conference');
  }
  
  // Add location if not present
  const countryName = getCountryName(country);
  if (!userTerm.toLowerCase().includes(countryName.toLowerCase())) {
    parts.push(countryName);
  }
  
  // Add year if not present
  if (!userTerm.match(/\b20\d{2}\b/)) {
    parts.push('2025');
  }
  
  return parts.join(' ');
}

// Database: Full boolean query (can be complex)
export function buildDatabaseQuery(params: {
  userText: string;
  country: string;
  dateFrom?: string;
  dateTo?: string;
  userProfile?: any;
  searchConfig?: any;
}): string {
  const { userText, country, userProfile, searchConfig } = params;
  
  // Database can handle complex queries
  const userTerm = userText.trim();
  const industryTerms = userProfile?.industry_terms || [];
  const eventTypes = ['conference', 'event', 'summit', 'workshop', 'seminar'];
  
  const parts = [];
  
  // User term
  if (userTerm) {
    parts.push(`(${userTerm})`);
  }
  
  // Industry terms
  if (industryTerms.length > 0) {
    parts.push(`(${industryTerms.slice(0, 3).join(' OR ')})`);
  }
  
  // Event types
  parts.push(`(${eventTypes.join(' OR ')})`);
  
  return parts.join(' AND ');
}
```

#### 1.4: Update unifiedSearch() to Use API-Specific Builders
**File:** `src/lib/search/unified-search-core.ts`

```typescript
// Update Firecrawl search
async function unifiedFirecrawlSearch(params: UnifiedSearchParams): Promise<UnifiedSearchResult> {
  // Use Firecrawl-specific query
  const firecrawlQuery = buildFirecrawlQuery({
    userText: params.q,
    country: params.country || 'DE',
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    userProfile: params.userProfile
  });
  
  const body = {
    query: firecrawlQuery,  // 150-200 char narrative
    limit: params.limit || 20,
    sources: ['web'],
    timeout: 30000,  // Reduced from 45000
    location: getCountryName(params.country || 'DE'),  // Geographic precision
  };
  
  // ... rest of implementation
}

// Update CSE search
async function unifiedCseSearch(params: UnifiedSearchParams): Promise<UnifiedSearchResult> {
  // Use CSE-specific query
  const cseQuery = buildCSEQuery({
    userText: params.q,
    country: params.country || 'DE'
  });
  
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('q', cseQuery);  // 20-40 char keywords
  url.searchParams.set('gl', params.country?.toLowerCase() || 'de');  // Geographic precision
  url.searchParams.set('num', '10');
  
  // Remove 'cr' parameter (causes issues)
  
  // ... rest of implementation
}
```

---

### Phase 2: Maintain Geographic Precision (Week 1-2)

#### 2.1: Geographic Precision Mechanisms

**Strategy:** Use API-native geographic filtering, not query text bloat

| Provider | Primary Mechanism | Secondary Mechanism |
|----------|-------------------|---------------------|
| **Firecrawl** | `location` parameter | Country name in query (minimal) |
| **CSE** | `gl` parameter (country bias) | Remove `cr` (causes 400 errors) |
| **Database** | SQL WHERE clauses | Country/city columns |

#### 2.2: Update Geographic Filtering

**File:** `src/lib/search/unified-search-core.ts`

```typescript
// Firecrawl: Use location parameter
const body = {
  query: firecrawlQuery,  // User-centric, no city list
  location: getCountryName(country) || 'Germany',  // API-level filtering
  scrapeOptions: {
    location: {
      country: country || 'DE',
      languages: [locale || 'de']
    }
  }
};

// CSE: Use gl parameter only
url.searchParams.set('gl', country?.toLowerCase() || 'de');  // API-level filtering
// Remove: url.searchParams.set('cr', `country${country.toUpperCase()}`);  // Causes issues
```

**Benefits:**
- Geographic precision maintained via API parameters
- Queries remain concise (no city lists in query text)
- Better API compatibility
- Faster responses

#### 2.3: Post-Processing Geographic Filters

**File:** `src/lib/optimized-orchestrator.ts`

```typescript
// After URL discovery, filter by geographic relevance
function filterByGeographicRelevance(urls: string[], country: string): string[] {
  return urls.filter(url => {
    // Check TLD
    const tld = getTLD(url);
    if (country === 'DE' && tld === 'de') return true;
    if (country === 'FR' && tld === 'fr') return true;
    // ... etc
    
    // Check URL path for country/city names
    const urlLower = url.toLowerCase();
    const countryContext = getCountryContext(country);
    const hasCountryInUrl = countryContext.countryNames.some(name => 
      urlLower.includes(name.toLowerCase())
    );
    const hasCityInUrl = countryContext.cities.some(city => 
      urlLower.includes(city.toLowerCase())
    );
    
    return hasCountryInUrl || hasCityInUrl || tld === country.toLowerCase();
  });
}
```

---

### Phase 3: Optimize User Profile Usage (Week 2)

#### 3.1: User Profile as Primary Context Source

**Current:** Templates provide hardcoded industry terms  
**New:** User profiles provide dynamic industry terms

**File:** `src/lib/optimized-orchestrator.ts`

```typescript
async function buildOptimizedQuery(params, userProfile) {
  const userTerm = params.userText?.trim() || '';
  
  // Priority 1: User's search term
  if (userTerm && userTerm.length >= 3) {
    // User provided specific term - use it directly
    return buildUserCentricQuery(userTerm, params.country, params.dateFrom, params.dateTo);
  }
  
  // Priority 2: User profile (if available)
  if (userProfile?.industry_terms?.length > 0) {
    return buildProfileBasedQuery(userProfile, params.country, params.dateFrom, params.dateTo);
  }
  
  // Priority 3: Template (fallback only)
  const industry = (await getSearchConfig())?.industry || 'legal-compliance';
  const template = WEIGHTED_INDUSTRY_TEMPLATES[industry];
  return buildTemplateBasedQuery(template, params.country, params.dateFrom, params.dateTo);
}
```

#### 3.2: Template Restructuring

**File:** `src/lib/data/weighted-templates.ts`

**Change templates from hardcoded baseQuery to suggestion sets:**

```typescript
// OLD
export const WEIGHTED_INDUSTRY_TEMPLATES = {
  'legal-compliance': {
    baseQuery: '(legal OR compliance OR regulatory...)',  // Hardcoded 200+ chars
    // ...
  }
};

// NEW
export const WEIGHTED_INDUSTRY_TEMPLATES = {
  'legal-compliance': {
    // Remove baseQuery entirely
    // Provide suggestion sets instead
    coreConcepts: ['compliance', 'legal', 'regulatory', 'governance'],
    enrichmentTerms: ['risk management', 'audit', 'investigation'],
    eventTypes: ['conference', 'summit', 'forum', 'symposium'],
    // ...
  }
};
```

**Usage:**
```typescript
// Use template for suggestions, not as base query
if (needsEnrichment(userTerm)) {
  const suggestions = template.coreConcepts.slice(0, 2);
  query = `${userTerm} ${suggestions.join(' ')}`;
}
```

---

### Phase 4: Testing & Validation (Week 2-3)

#### 4.1: Test Cases

| Test Case | User Input | Expected Query (Firecrawl) | Expected Query (CSE) |
|-----------|------------|----------------------------|---------------------|
| Specific term | "compliance" | "compliance Germany November 2025 conference" (60 chars) | "compliance conference Germany 2025" (35 chars) |
| Generic term | "" (blank) | "legal compliance Germany November 2025 conference" (profile-based, 65 chars) | "compliance conference Germany 2025" (35 chars) |
| Specific German term | "Kartellrecht" | "Kartellrecht Germany November 2025 conference" (55 chars) | "Kartellrecht conference Germany 2025" (37 chars) |
| Detailed query | "GDPR compliance summit" | "GDPR compliance summit Germany November 2025" (55 chars) | "GDPR compliance summit Germany 2025" (35 chars) |

#### 4.2: Validation Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| **Firecrawl query length** | 628 chars | 150 chars | Log query length |
| **Firecrawl timeout rate** | -33% success | >80% success | Log timeouts |
| **CSE results count** | 0 results | 5-10 results | Count results |
| **CSE query length** | 250 chars | 35 chars | Log query length |
| **Search duration** | 55s | 15-20s | Log total time |
| **Events returned** | 2 events | 5-8 events | Count final events |
| **Geographic precision** | Unknown | >90% in-region | Manual validation |
| **User intent match** | Unknown | >85% relevant | Manual validation |

#### 4.3: A/B Testing Strategy

**Week 2-3: Run parallel queries**
- 50% traffic: New user-centric queries
- 50% traffic: Old template-based queries
- Compare metrics above
- If new queries perform better → full rollout

---

## Implementation Priority

### Critical Path (Must Do First)

```
1. Phase 1.1: Update buildWeightedQuery() → User-centric
   └─ Dependency: None
   └─ Impact: Reduces query length, maintains user intent
   └─ Risk: Low (fallback to templates if user query too generic)

2. Phase 1.3: Implement API-specific builders
   └─ Dependency: Phase 1.1
   └─ Impact: Optimizes queries for each API
   └─ Risk: Low (can test in parallel with existing system)

3. Phase 2.1-2.2: Update geographic filtering
   └─ Dependency: Phase 1.3
   └─ Impact: Maintains regional precision
   └─ Risk: Medium (need to validate TLD/URL filtering works)

4. Phase 1.4: Update unifiedSearch() to use new builders
   └─ Dependency: Phases 1.3, 2.2
   └─ Impact: Applies all changes to live searches
   └─ Risk: Medium (this is the switchover point)
```

### Secondary Path (Can Do in Parallel)

```
5. Phase 3.1: Optimize user profile usage
   └─ Dependency: None (independent)
   └─ Impact: Better personalization
   └─ Risk: Low

6. Phase 3.2: Template restructuring
   └─ Dependency: Phase 1.1 (to ensure templates not used as base)
   └─ Impact: Cleaner architecture
   └─ Risk: Low (templates become suggestions)
```

### Validation Path (After Implementation)

```
7. Phase 4.1-4.2: Testing & validation
   └─ Dependency: Phases 1-3 complete
   └─ Impact: Confirms improvements
   └─ Risk: Low

8. Phase 4.3: A/B testing
   └─ Dependency: Phase 4.1-4.2
   └─ Impact: Production validation
   └─ Risk: Medium (requires traffic split)
```

---

## Code Changes Summary

### Files to Modify

| File | Changes | Lines | Priority | Risk |
|------|---------|-------|----------|------|
| `src/lib/services/weighted-query-builder.ts` | Refactor to user-centric | ~100 | P0 | Low |
| `src/lib/search/api-query-builders.ts` | NEW - API-specific builders | ~150 | P0 | Low |
| `src/lib/search/unified-search-core.ts` | Use new builders | ~50 | P0 | Medium |
| `src/lib/optimized-orchestrator.ts` | Update buildOptimizedQuery() | ~50 | P0 | Medium |
| `src/lib/data/weighted-templates.ts` | Restructure templates | ~200 | P1 | Low |
| `src/lib/unified-query-builder.ts` | Update buildNarrativeQuery() | ~50 | P1 | Low |

**Total LOC:** ~600 lines changed/added

---

## Expected Impact

### Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Firecrawl query length | 628 chars | 150 chars | **76% shorter** |
| Firecrawl response time | 15s timeout | <5s | **3x faster** |
| CSE query length | 250 chars | 35 chars | **86% shorter** |
| CSE results | 0 | 5-10 | **From broken to working** |
| Total search time | 55s | 15-20s | **3x faster** |
| Events returned | 2 | 5-8 | **2.5x more** |

### Quality Improvements

| Metric | Impact |
|--------|--------|
| **User intent match** | High - user term is primary, not buried |
| **Geographic precision** | Maintained - via API parameters + post-filtering |
| **Industry relevance** | Maintained - via user profile or fallback templates |
| **Search relevance** | High - queries match what user is looking for |

---

## Risk Mitigation

### Mitigation Strategies

1. **Fallback to templates:** If user query is too generic (< 3 words), use profile or template terms
2. **Post-processing filters:** Apply geographic and industry filters after discovery
3. **A/B testing:** Run parallel queries to validate improvements before full rollout
4. **Monitoring:** Log query lengths, response times, result counts to track metrics
5. **Rollback plan:** Keep old query builders for 2 weeks in case rollback needed

### Success Criteria

✅ **Must Have:**
- Firecrawl queries < 200 characters
- CSE returns > 0 results
- Geographic precision > 85% (events in target region)
- Search time < 25 seconds

✅ **Should Have:**
- User intent match > 80% (manual validation)
- Event relevance > 75% (manual validation)
- No increase in cross-industry noise

✅ **Nice to Have:**
- Search time < 15 seconds
- Events returned > 8
- User satisfaction improvement (surveys)

---

## Timeline

### Week 1
- **Day 1-2:** Phase 1.1 (buildWeightedQuery refactor)
- **Day 3-4:** Phase 1.3 (API-specific builders)
- **Day 5:** Phase 2.1-2.2 (Geographic filtering)

### Week 2
- **Day 1-2:** Phase 1.4 (Update unifiedSearch)
- **Day 3:** Phase 3.1-3.2 (User profile optimization)
- **Day 4-5:** Phase 4.1 (Testing & validation)

### Week 3
- **Day 1-3:** Phase 4.2-4.3 (A/B testing)
- **Day 4-5:** Monitoring, adjustments, documentation

**Total Time:** 3 weeks to full rollout

---

## Conclusion

**Recommendation:** Proceed with refactoring to user-centric queries

**Rationale:**
1. Current hardcoded approach is causing measurable problems (timeouts, zero results)
2. User-centric approach reduces query complexity while maintaining precision
3. Geographic precision is maintained via API parameters, not query bloat
4. Risk is low with proper fallbacks and testing
5. Expected improvements are significant (3x faster, 2.5x more results)

**Next Steps:**
1. Get approval to proceed
2. Start Phase 1.1 (buildWeightedQuery refactor)
3. Implement with incremental testing
4. Validate with A/B testing before full rollout

---

**End of Implementation Plan**


