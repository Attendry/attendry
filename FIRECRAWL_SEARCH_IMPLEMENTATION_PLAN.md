# Firecrawl Search Optimization - Implementation Plan

**Branch:** `feature/firecrawl-search-optimization`  
**Status:** Planning - Ready for Implementation  
**Priority:** Accuracy & Trust First

---

## Executive Summary

This implementation plan addresses Firecrawl search optimization while **strictly maintaining accuracy and trust** in search results. All changes preserve existing quality gates, validation, and confidence scoring mechanisms.

### ⚠️ CRITICAL: Country-Agnostic Implementation

**IMPORTANT**: This plan has been revised to be **country-agnostic**. The system must work for **any country** (DE, FR, GB, IT, ES, NL, US, etc.), not just Germany. All location validation, query building, and quality gates have been updated to use the `country` parameter from search requests, not hardcoded Germany assumptions.

**Key Changes:**
- ✅ Narrative queries use country from params (not hardcoded "Germany")
- ✅ Quality gates validate against target country (not just DE)
- ✅ Location validation supports multiple countries (TLD, path, country code)
- ✅ Country name mapping supports 20+ countries
- ✅ All examples and tests updated for multi-country support

### Core Principles

1. **Accuracy First**: User input prioritization must not compromise result quality
2. **Trust Preserved**: All quality gates, validation, and confidence scoring remain intact
3. **Country-Agnostic**: Works for any country, not just Germany
4. **Backward Compatible**: Existing persistent searches continue to work
5. **Gradual Rollout**: Feature flags enable safe testing and rollback

---

## Phase 1: Search Bar Input Integration (CRITICAL - Week 1)

### 1.1 Enhance Narrative Query Builder with User Input Priority

**File:** `src/lib/unified-query-builder.ts`

**Objective:** Prioritize user search bar input while maintaining query quality and context. **CRITICAL: Country-agnostic - works for any country, not just Germany.**

**Implementation:**

```typescript
// Add new parameter to track input source
export interface QueryBuilderParams {
  userText?: string;
  isUserInput?: boolean;  // NEW: Explicitly marks user search bar input
  country?: string | null;  // EXISTING: Target country (DE, FR, GB, IT, ES, NL, etc.)
  // ... existing params
}

function buildNarrativeQuery(params: {
  baseQuery: string;
  isUserInput?: boolean;  // NEW
  country?: string | null;  // CRITICAL: Use country from params, not hardcoded
  // ... existing params
}): string {
  const { baseQuery, isUserInput, country, ... } = params;
  
  // ACCURACY SAFEGUARD: Validate user input before prioritizing
  const sanitizedUserInput = isUserInput && baseQuery.trim()
    ? sanitizeUserInput(baseQuery.trim())
    : null;
  
  // CRITICAL: Get country name dynamically from country parameter
  const countryName = getCountryNameFromCode(country);  // Returns "Germany", "France", "United Kingdom", etc.
  const locationDescription = buildLocationDescription(country, countryName, locationTerms);
  
  // If valid user input exists, prioritize it
  if (sanitizedUserInput) {
    // Build query focused on user input with context
    return buildUserFocusedNarrative({
      userInput: sanitizedUserInput,
      locationDescription,  // Now country-agnostic
      temporalDescription,
      eventTypeDescription,
      userProfile,  // Still include profile for context
      language
    });
  }
  
  // Fallback to existing logic (preserves current behavior)
  return buildStandardNarrative({ baseQuery, country, ... });
}

// NEW: Country-agnostic country name mapping
function getCountryNameFromCode(countryCode: string | null | undefined): string {
  if (!countryCode) return 'Europe';  // Default fallback
  
  const countryMap: Record<string, string> = {
    'DE': 'Germany',
    'FR': 'France',
    'GB': 'United Kingdom',
    'UK': 'United Kingdom',
    'IT': 'Italy',
    'ES': 'Spain',
    'NL': 'Netherlands',
    'AT': 'Austria',
    'CH': 'Switzerland',
    'BE': 'Belgium',
    'LU': 'Luxembourg',
    'DK': 'Denmark',
    'SE': 'Sweden',
    'NO': 'Norway',
    'FI': 'Finland',
    'PL': 'Poland',
    'CZ': 'Czech Republic',
    'HU': 'Hungary',
    'PT': 'Portugal',
    'GR': 'Greece',
    'IE': 'Ireland',
    'US': 'United States',
    'CA': 'Canada',
    'AU': 'Australia'
  };
  
  return countryMap[countryCode.toUpperCase()] || countryCode;
}

// NEW: Build location description based on country (not hardcoded to Germany)
function buildLocationDescription(
  country: string | null | undefined,
  countryName: string,
  locationTerms: string[]
): string {
  if (!country) return 'Europe';
  
  // Get key cities for the country from location terms
  const highlightedCities = locationTerms
    .filter(term => term && term.toLowerCase() !== countryName.toLowerCase())
    .slice(0, 3);
  
  return highlightedCities.length > 0
    ? `${countryName} (including ${highlightedCities.join(', ')})`
    : countryName;
}

// NEW: Input sanitization to prevent injection/abuse
function sanitizeUserInput(input: string): string | null {
  // Remove potentially harmful characters
  const cleaned = input
    .replace(/[<>{}[\]\\]/g, '')  // Remove brackets/braces
    .trim();
  
  // Validate length (prevent extremely long queries)
  if (cleaned.length > 200) {
    console.warn('[query-builder] User input too long, truncating');
    return cleaned.substring(0, 200).trim();
  }
  
  // Validate it's not just special characters
  if (!/[a-zA-Z0-9]/.test(cleaned)) {
    return null;
  }
  
  return cleaned;
}

// NEW: Build user-focused narrative while maintaining context (country-agnostic)
function buildUserFocusedNarrative(params: {
  userInput: string;
  locationDescription: string;  // Now country-agnostic (Germany, France, UK, etc.)
  temporalDescription: string;
  eventTypeDescription: string;
  userProfile?: any;
  language: string;
}): string {
  const { userInput, locationDescription, temporalDescription, eventTypeDescription, userProfile, language } = params;
  
  // Primary focus: User's search term
  let query = `Find ${userInput} events and professional conferences`;
  
  // Add location context (maintains geographic relevance - works for any country)
  query += ` in ${locationDescription}`;
  
  // Add temporal context (maintains date relevance)
  query += `, ${temporalDescription}`;
  
  // Add event types for context (maintains event type filtering)
  if (eventTypeDescription) {
    query += `, including ${eventTypeDescription}`;
  }
  
  // Add user profile context as secondary (maintains personalization)
  if (userProfile?.industry_terms?.length > 0) {
    query += `, with emphasis on ${userProfile.industry_terms.slice(0, 2).join(', ')}`;
  }
  
  // Add quality requirements (maintains result quality)
  query += `, prioritise events with clear dates and locations`;
  
  return query + '.';
}
```

**Accuracy Safeguards:**
- ✅ Input sanitization prevents malicious/invalid queries
- ✅ Length limits prevent overly verbose queries
- ✅ Maintains location, temporal, and event type context
- ✅ Preserves user profile context for personalization
- ✅ Quality requirements still included
- ✅ **Country-agnostic: Works for any country (DE, FR, GB, IT, ES, NL, etc.), not just Germany**

**Testing:**
- Unit tests for `sanitizeUserInput()` with various inputs
- Integration tests verifying user input appears in Firecrawl query
- Verify quality gates still function correctly

---

### 1.2 Add Query Mode Parameter with Backward Compatibility

**File:** `src/lib/search/unified-search-core.ts`

**Objective:** Add query mode detection while maintaining full backward compatibility.

**Implementation:**

```typescript
export interface UnifiedSearchParams {
  q: string;
  narrativeQuery?: string;
  queryMode?: 'persistent' | 'refine' | 'override';  // NEW
  userSearchInput?: string;  // NEW: Explicit user input from search bar
  // ... existing params
}

async function unifiedFirecrawlSearch(params: UnifiedSearchParams): Promise<UnifiedSearchResult> {
  // ... existing cache/rate limit checks ...
  
  try {
    // ACCURACY SAFEGUARD: Determine query mode with validation
    const queryMode = params.queryMode || 'persistent';
    const userInput = params.userSearchInput?.trim() || '';
    
    // Validate query mode
    if (!['persistent', 'refine', 'override'].includes(queryMode)) {
      console.warn('[unified-firecrawl] Invalid query mode, defaulting to persistent');
      queryMode = 'persistent';
    }
    
    let firecrawlQuery: string;
    
    // Mode: Override - User wants to completely replace query
    if (queryMode === 'override' && userInput) {
      // ACCURACY SAFEGUARD: Still build with context for quality
      const { buildUnifiedQuery } = await import('../unified-query-builder');
      const queryResult = await buildUnifiedQuery({
        userText: userInput,
        isUserInput: true,  // Mark as user input
        country: params.country,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        language: 'en',
        userProfile: params.userProfile
      });
      
      firecrawlQuery = queryResult.narrativeQuery || userInput;
      console.log('[unified-firecrawl] Override mode: Using user-focused query');
    }
    // Mode: Refine - User wants to add/refine existing query
    else if (queryMode === 'refine' && userInput && params.narrativeQuery) {
      // ACCURACY SAFEGUARD: Intelligently merge queries
      firecrawlQuery = refineQueryWithUserInput(params.narrativeQuery, userInput, params);
      console.log('[unified-firecrawl] Refine mode: Merged user input with existing query');
    }
    // Mode: Persistent - Use existing query (backward compatible)
    else {
      // Use provided narrative query if available
      firecrawlQuery = params.narrativeQuery || params.q;
      
      // Only build narrative query if not provided (existing behavior)
      if (!params.narrativeQuery) {
        try {
          const { buildUnifiedQuery } = await import('../unified-query-builder');
          const queryResult = await buildUnifiedQuery({
            userText: params.q,
            country: params.country,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
            language: 'en',
            userProfile: params.userProfile
          });
          
          if (queryResult.narrativeQuery) {
            firecrawlQuery = queryResult.narrativeQuery;
          }
        } catch (error) {
          console.warn('[unified-firecrawl] Failed to get narrative query, using original:', error);
        }
      }
      
      console.log('[unified-firecrawl] Persistent mode: Using existing query logic');
    }
    
    // ... rest of existing implementation ...
  }
}

// NEW: Intelligently refine query with user input
function refineQueryWithUserInput(
  baseQuery: string,
  userInput: string,
  params: UnifiedSearchParams
): string {
  // ACCURACY SAFEGUARD: Sanitize user input
  const sanitized = sanitizeUserInput(userInput);
  if (!sanitized) {
    return baseQuery;  // Fallback to base query if input invalid
  }
  
  // Simple refinement: Add user input as additional context
  // More sophisticated merging can be added later
  return `${baseQuery}, related to ${sanitized}`;
}
```

**Accuracy Safeguards:**
- ✅ Backward compatible: Defaults to 'persistent' mode
- ✅ Input validation and sanitization
- ✅ Fallback to existing query if refinement fails
- ✅ Maintains all context (location, dates, profile)
- ✅ **Country-agnostic: Uses country parameter, not hardcoded Germany**

**Testing:**
- Test all three query modes
- Verify backward compatibility (no mode specified)
- Test invalid inputs and fallbacks

---

### 1.3 Update API Endpoints with Mode Detection

**Files:**
- `src/app/api/events/search/route.ts`
- `src/app/api/events/search-enhanced/route.ts`

**Objective:** Detect user input and set appropriate query mode.

**Implementation:**

```typescript
export async function POST(req: NextRequest) {
  try {
    const { q = "", country = "", from, to, ... } = await req.json();
    
    // ACCURACY SAFEGUARD: Detect if this is user search bar input
    // vs. persistent search configuration
    const isUserSearchInput = q.trim().length > 0 && 
                              q !== searchConfig.baseQuery &&
                              !q.includes(' OR ') &&  // Not a structured query
                              !q.includes(' AND ');
    
    // Determine query mode
    let queryMode: 'persistent' | 'refine' | 'override' = 'persistent';
    let userSearchInput: string | undefined = undefined;
    
    if (isUserSearchInput) {
      // Default to override mode for explicit user input
      // Can be made configurable later
      queryMode = 'override';
      userSearchInput = q.trim();
    }
    
    // Call unified search with mode
    const unifiedSearchResult = await unifiedSearch({
      q: q || searchConfig.baseQuery,  // Fallback to baseQuery if empty
      queryMode,
      userSearchInput,
      country: country || undefined,
      dateFrom: from || undefined,
      dateTo: to || undefined,
      limit: 20,
      useCache: true
    });
    
    // ... rest of existing implementation ...
  }
}
```

**Accuracy Safeguards:**
- ✅ Only treats input as user search if it's clearly different from base query
- ✅ Structured queries (with OR/AND) are not treated as user input
- ✅ Falls back to baseQuery if user input is empty
- ✅ Maintains all existing search logic

**Testing:**
- Test with empty query (should use persistent mode)
- Test with user input (should use override mode)
- Test with structured queries (should not be treated as user input)

---

## Phase 2: Query Optimization (HIGH PRIORITY - Week 2)

### 2.1 Simplify Narrative Queries While Maintaining Intent

**File:** `src/lib/unified-query-builder.ts`

**Objective:** Reduce query verbosity while preserving search accuracy and context.

**Implementation:**

```typescript
function buildUserFocusedNarrative(params: {
  userInput: string;
  locationDescription: string;
  temporalDescription: string;
  eventTypeDescription: string;
  userProfile?: any;
  language: string;
}): string {
  const { userInput, locationDescription, temporalDescription, eventTypeDescription, userProfile, language } = params;
  
  // ACCURACY SAFEGUARD: Keep essential context, remove redundancy
  // Target: 80-120 characters (vs current 200+)
  
  // Core: User input + location (most important)
  let query = `Find ${userInput} events in ${locationDescription}`;
  
  // Add temporal context (condensed)
  // Instead of: "scheduled through the upcoming 12 months"
  // Use: "upcoming" or specific date range if available
  const temporalShort = temporalDescription.includes('12 months')
    ? 'upcoming'
    : temporalDescription.split(',')[0];  // Take first part
  query += `, ${temporalShort}`;
  
  // Add event types (condensed - only if different from user input)
  if (eventTypeDescription && !userInput.toLowerCase().includes('conference')) {
    const eventTypesShort = eventTypeDescription.split(',').slice(0, 2).join(', ');
    query += `, ${eventTypesShort}`;
  }
  
  // Add user profile context (condensed - only top terms)
  if (userProfile?.industry_terms?.length > 0) {
    const topTerms = userProfile.industry_terms.slice(0, 2).join(', ');
    query += `, ${topTerms}`;
  }
  
  // Quality requirement (condensed)
  query += `, with clear dates and locations`;
  
  return query + '.';
}
```

**Accuracy Safeguards:**
- ✅ Maintains user input as primary focus
- ✅ Preserves location context (critical for geographic filtering)
- ✅ Preserves temporal context (critical for date filtering)
- ✅ Keeps essential event type and profile context
- ✅ Quality requirements still included

**Testing:**
- Verify query length is 80-120 characters
- Verify all essential context is preserved
- Test with various user inputs
- Compare search results before/after optimization

---

### 2.2 Use Firecrawl API Parameters Effectively

**File:** `src/lib/search/unified-search-core.ts`

**Objective:** Move location/date filtering to API parameters instead of query text.

**Implementation:**

```typescript
// Build optimized search body based on Firecrawl v2 API
const body: any = {
  query: firecrawlQuery,  // Now contains only search terms, no location/dates
  limit: params.limit || 20,
  sources: ['web'],
  timeout: 45000
};

// ACCURACY SAFEGUARD: Use API parameters for location filtering
// This ensures Firecrawl applies geographic filtering correctly
if (params.country) {
  const countryMap: Record<string, string> = {
    'DE': 'Germany',
    'FR': 'France', 
    'IT': 'Italy',
    'ES': 'Spain',
    'NL': 'Netherlands',
    'GB': 'United Kingdom',
    'US': 'United States'
  };
  
  const location = countryMap[params.country] || params.country;
  
  // Use location parameter (Firecrawl applies this as a filter)
  body.location = location;
  body.country = params.country;  // ISO code for additional precision
}

// ACCURACY SAFEGUARD: Add content scraping if requested
// This maintains extraction quality
if (params.scrapeContent) {
  body.scrapeOptions = {
    formats: ['markdown'],
    onlyMainContent: true
  };
}
```

**Accuracy Safeguards:**
- ✅ Location filtering via API parameters (more reliable than query text)
- ✅ Country code for additional precision
- ✅ Maintains content scraping for extraction quality
- ✅ Query text focuses on search terms only

**Testing:**
- Verify location parameter is set correctly
- Compare results with/without location parameter
- Verify geographic filtering accuracy

---

## Phase 3: Quality Gate Integration (CRITICAL - Week 1)

### 3.1 Ensure Quality Gates Remain Intact (Country-Agnostic)

**Files:**
- `src/lib/quality/eventQuality.ts` (REQUIRES UPDATE - Make country-agnostic)
- `src/lib/optimized-orchestrator.ts` (REQUIRES UPDATE - Pass country to quality gate)

**Objective:** Verify that query optimization doesn't affect quality gate functionality. **CRITICAL: Make quality gates country-agnostic, not hardcoded to Germany.**

**Current Issue:**
The quality gate in `eventQuality.ts` is hardcoded to check for Germany only:
```typescript
// CURRENT (WRONG - Germany only):
const deHost = DE_HOST_PATTERN.test(m.host);
const deCountry = m.country === "DE" || m.country === "Germany";
const inDE = deCountry || deHost || deUrl;
```

**Required Changes:**

**File:** `src/lib/quality/eventQuality.ts`

```typescript
// UPDATE: Add target country parameter
export function isSolidHit(
  m: CandidateMeta, 
  window: QualityWindow,
  targetCountry?: string | null  // NEW: Target country from search params
): { 
  quality: number; 
  ok: boolean;
  dateWindowStatus?: 'in-window' | 'within-month' | 'extraction-error' | 'no-date';
} {
  const q = computeQuality(m, window, targetCountry);  // Pass country
  
  // ... existing date validation ...
  
  // UPDATE: Country-agnostic location validation
  const inTargetCountry = validateCountryMatch(m, targetCountry);
  
  // ... rest of validation ...
  
  const ok = (meetsQuality && hasWhen && inTargetCountry && enoughSpeakers) || trustSearchQuery;
  
  return { quality: q, ok, dateWindowStatus };
}

// NEW: Country-agnostic country validation
function validateCountryMatch(
  meta: CandidateMeta,
  targetCountry?: string | null
): boolean {
  if (!targetCountry) {
    // If no target country specified, accept any country
    return true;
  }
  
  const targetCode = targetCountry.toUpperCase();
  
  // Check country code match
  if (meta.country) {
    const eventCountry = meta.country.toUpperCase();
    if (eventCountry === targetCode) return true;
    
    // Handle country name variations
    const countryNameMap: Record<string, string[]> = {
      'DE': ['DE', 'GERMANY', 'DEUTSCHLAND'],
      'FR': ['FR', 'FRANCE'],
      'GB': ['GB', 'UK', 'UNITED KINGDOM', 'ENGLAND', 'SCOTLAND', 'WALES'],
      'IT': ['IT', 'ITALY', 'ITALIEN'],
      'ES': ['ES', 'SPAIN', 'ESPANA', 'ESPAGNE'],
      'NL': ['NL', 'NETHERLANDS', 'HOLLAND'],
      // Add more as needed
    };
    
    const validNames = countryNameMap[targetCode] || [targetCode];
    if (validNames.includes(eventCountry)) return true;
  }
  
  // Check TLD match (e.g., .de for Germany, .fr for France, .co.uk for UK)
  const tldPatterns: Record<string, RegExp> = {
    'DE': /\.de$/i,
    'FR': /\.fr$/i,
    'GB': /\.(co\.uk|uk)$/i,
    'UK': /\.(co\.uk|uk)$/i,
    'IT': /\.it$/i,
    'ES': /\.es$/i,
    'NL': /\.nl$/i,
    // Add more as needed
  };
  
  const tldPattern = tldPatterns[targetCode];
  if (tldPattern && tldPattern.test(meta.host)) return true;
  
  // Check URL path for country code (e.g., /de/, /fr/, /en-gb/)
  const pathPatterns: Record<string, RegExp> = {
    'DE': /\/de\//i,
    'FR': /\/fr\//i,
    'GB': /\/en-gb\//i,
    'UK': /\/en-gb\//i,
    'IT': /\/it\//i,
    'ES': /\/es\//i,
    'NL': /\/nl\//i,
  };
  
  const pathPattern = pathPatterns[targetCode];
  if (pathPattern && pathPattern.test(meta.url)) return true;
  
  // If no match found and we have a target country, reject
  // (unless trust override applies)
  return false;
}

// UPDATE: computeQuality to accept target country
export function computeQuality(
  m: CandidateMeta, 
  window: QualityWindow,
  targetCountry?: string | null  // NEW
): number {
  let q = 0;
  const w = SearchCfg.w;
  
  // Date in range
  if (m.dateISO && m.dateISO >= window.from && m.dateISO <= window.to) {
    q += w.dateInRange;
  }
  
  // UPDATE: Country targeting (country-agnostic)
  if (targetCountry && validateCountryMatch(m, targetCountry)) {
    q += w.deHostOrLang;  // Rename this weight to "countryMatch" in future
  }
  
  // Venue/city presence
  if ((m.venue && m.venue.length > 2) || (m.city && m.city.length > 2)) {
    q += w.hasVenueOrCity;
  }
  
  // Speaker page
  if (m.hasSpeakerPage) {
    q += w.hasSpeakerPage;
  }
  
  // Speakers count
  if ((m.speakersCount ?? 0) >= SearchCfg.minSpeakersForSolid) {
    q += w.speakersCount;
  }
  
  return Math.min(1, q);
}
```

**File:** `src/lib/optimized-orchestrator.ts`

```typescript
// UPDATE: Pass country parameter to quality gate
const qualityResult = isSolidHit(meta, window, params.country);  // Pass country
```

**Verification Checklist:**
- ✅ Quality scoring still runs after extraction
- ✅ Date validation still works (in-window, within-month, extraction-error)
- ✅ **Location validation now works for any country (DE, FR, GB, IT, ES, NL, etc.)**
- ✅ Speaker count validation still works (≥2 speakers)
- ✅ Quality threshold still enforced (≥0.25)
- ✅ Trust override still works (5+ speakers)
- ✅ Confidence scoring still calculated

**Action Items:**
- Update `isSolidHit()` to accept target country parameter
- Update `computeQuality()` to accept target country parameter
- Create `validateCountryMatch()` function (country-agnostic)
- Update orchestrator to pass country to quality gate
- Add integration tests for multiple countries
- Monitor quality metrics in logs
- Compare quality scores before/after optimization

---

### 3.2 Add Query Quality Logging

**File:** `src/lib/search/unified-search-core.ts`

**Objective:** Log query details for monitoring and debugging.

**Implementation:**

```typescript
async function unifiedFirecrawlSearch(params: UnifiedSearchParams): Promise<UnifiedSearchResult> {
  // ... existing code ...
  
  // ACCURACY SAFEGUARD: Log query details for monitoring
  console.log('[unified-firecrawl] Query details:', {
    mode: params.queryMode || 'persistent',
    hasUserInput: !!params.userSearchInput,
    queryLength: firecrawlQuery.length,
    queryPreview: firecrawlQuery.substring(0, 100),
    country: params.country,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo
  });
  
  // ... rest of implementation ...
}
```

**Purpose:**
- Monitor query quality
- Debug issues with user input
- Track query mode usage
- Verify optimization effectiveness

---

## Phase 4: Testing & Validation (CRITICAL - Week 1-2)

### 4.1 Unit Tests

**New File:** `src/lib/search/__tests__/query-builder.test.ts`

**Test Cases:**
1. `sanitizeUserInput()` with various inputs
2. `buildUserFocusedNarrative()` with user input
3. Query mode detection logic
4. Query refinement logic
5. Backward compatibility (no mode specified)

### 4.2 Integration Tests

**New File:** `src/lib/search/__tests__/unified-search-integration.test.ts`

**Test Cases:**
1. User input appears in Firecrawl query
2. Quality gates still function correctly
3. Query mode switching works
4. Backward compatibility maintained

### 4.3 Manual Testing Checklist

**Search Bar Input:**
- [ ] Enter search term → Verify it appears in Firecrawl query
- [ ] Enter different terms → Verify query changes
- [ ] Clear search bar → Verify persistent search still works
- [ ] Enter complex query → Verify it's handled correctly

**Quality Gates:**
- [ ] Verify events still pass quality scoring
- [ ] Verify date validation still works
- [ ] Verify location validation still works
- [ ] Verify speaker count validation still works

**Query Optimization:**
- [ ] Verify query length is 80-120 characters
- [ ] Verify location/date info uses API parameters
- [ ] Verify search results are still relevant

---

## Phase 5: Feature Flags & Rollout (Week 2)

### 5.1 Add Feature Flags

**File:** `src/config/features.ts` (or create if doesn't exist)

**Implementation:**

```typescript
export const FEATURES = {
  // Firecrawl search optimization
  FIRECRAWL_QUERY_OPTIMIZATION: process.env.NEXT_PUBLIC_ENABLE_QUERY_OPTIMIZATION === 'true',
  FIRECRAWL_USER_INPUT_PRIORITY: process.env.NEXT_PUBLIC_ENABLE_USER_INPUT_PRIORITY === 'true',
} as const;
```

**Usage:**

```typescript
if (FEATURES.FIRECRAWL_USER_INPUT_PRIORITY) {
  // Use new user input priority logic
} else {
  // Use existing logic
}
```

### 5.2 Gradual Rollout Plan

1. **Week 1**: Implement with feature flags disabled
2. **Week 2**: Enable for internal testing
3. **Week 3**: Enable for 10% of users (A/B test)
4. **Week 4**: Enable for 50% of users
5. **Week 5**: Enable for 100% of users

**Monitoring:**
- Query quality metrics
- Quality gate pass rates
- User satisfaction (if available)
- Error rates

---

## Risk Mitigation

### High Risk: Breaking Existing Searches

**Mitigation:**
- ✅ Backward compatible by default (persistent mode)
- ✅ Feature flags enable gradual rollout
- ✅ Comprehensive testing before deployment
- ✅ Monitor quality metrics closely

### Medium Risk: Reduced Search Quality

**Mitigation:**
- ✅ All quality gates remain intact
- ✅ Input sanitization prevents invalid queries
- ✅ Context (location, dates, profile) still included
- ✅ A/B testing to compare results

### Low Risk: Query Optimization Issues

**Mitigation:**
- ✅ Can revert query optimization independently
- ✅ Feature flags allow disabling
- ✅ Logging for debugging

---

## Success Metrics

### Accuracy Metrics
- ✅ Quality gate pass rate: Maintain ≥80% (current baseline)
- ✅ Date validation accuracy: Maintain ≥90%
- ✅ **Location validation accuracy: Maintain ≥95% for all countries (DE, FR, GB, IT, ES, NL, etc.)**
- ✅ Speaker extraction accuracy: Maintain ≥85%

### Trust Metrics
- ✅ Confidence scores: Maintain average ≥0.6
- ✅ Evidence tagging: Maintain ≥70% of fields
- ✅ Hallucination rate: Maintain ≤5%

### Query Optimization Metrics
- ✅ Query length: Target 80-120 characters (vs 200+)
- ✅ User input in query: 100% when provided
- ✅ Query mode detection: ≥95% accuracy

### User Experience Metrics
- ✅ Search relevance: Maintain or improve
- ✅ Result quality: Maintain or improve
- ✅ Search bar responsiveness: No degradation

---

## Implementation Timeline

### Week 1: Core Implementation
- Day 1-2: Phase 1.1 (Narrative Query Builder)
- Day 3-4: Phase 1.2 (Query Mode Parameter)
- Day 5: Phase 1.3 (API Endpoints)

### Week 2: Optimization & Testing
- Day 1-2: Phase 2 (Query Optimization)
- Day 3-4: Phase 4 (Testing)
- Day 5: Phase 5 (Feature Flags)

### Week 3: Rollout
- Day 1-2: Internal testing
- Day 3-4: 10% rollout
- Day 5: Monitor and adjust

---

## Files to Modify

### Core Changes
1. `src/lib/unified-query-builder.ts` - Add user input priority, make country-agnostic
2. `src/lib/search/unified-search-core.ts` - Add query mode
3. `src/app/api/events/search/route.ts` - Add mode detection
4. `src/app/api/events/search-enhanced/route.ts` - Add mode detection
5. `src/lib/quality/eventQuality.ts` - **UPDATE: Make country validation country-agnostic**
6. `src/lib/optimized-orchestrator.ts` - **UPDATE: Pass country to quality gate**

### New Files
1. `src/lib/search/query-refinement.ts` - Query refinement utilities
2. `src/lib/search/__tests__/query-builder.test.ts` - Unit tests
3. `src/lib/search/__tests__/unified-search-integration.test.ts` - Integration tests

### Configuration
1. `src/config/features.ts` - Feature flags (if doesn't exist)

### Changes Required for Country-Agnostic Support
- `src/lib/quality/eventQuality.ts` - **UPDATE: Make country validation country-agnostic**
- `src/lib/optimized-orchestrator.ts` - **UPDATE: Pass country parameter to quality gate**
- `src/lib/validation/evidence-validator.ts` - Validation unchanged

---

## Accuracy & Trust Guarantees

### ✅ Quality Gates Preserved (Country-Agnostic)
- All quality scoring logic remains intact
- Date validation unchanged
- **Location validation updated to be country-agnostic (works for any country)**
- Speaker count validation unchanged
- Quality thresholds unchanged

### ✅ Validation Preserved
- Schema validation unchanged
- Evidence tagging unchanged
- Confidence scoring unchanged
- Hallucination guards unchanged

### ✅ Trust Mechanisms Preserved
- "Trust but Verify" approach maintained
- Trust override for high-quality events maintained
- Pragmatic quality gates maintained

### ✅ Input Safety
- User input sanitization prevents abuse
- Length limits prevent overly verbose queries
- Validation prevents invalid queries
- Fallback to safe defaults on errors

---

## Next Steps

1. **Review this plan** with team
2. **Create feature branch**: `feature/firecrawl-search-optimization`
3. **Set up feature flags** in environment variables
4. **Begin Phase 1 implementation**
5. **Set up monitoring** for quality metrics
6. **Plan A/B testing** strategy

---

## Appendix: Code Review Checklist

Before merging, verify:

- [ ] All quality gates still function
- [ ] **Country validation works for multiple countries (DE, FR, GB, IT, ES, NL)**
- [ ] Input sanitization is in place
- [ ] Backward compatibility maintained
- [ ] Feature flags implemented
- [ ] Unit tests pass (including multi-country tests)
- [ ] Integration tests pass
- [ ] Manual testing completed (test with different countries)
- [ ] Logging added for monitoring
- [ ] Documentation updated
- [ ] No breaking changes to existing APIs
- [ ] **No hardcoded Germany assumptions remain**

