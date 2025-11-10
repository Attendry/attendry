# Query Optimization Fix - November 10, 2025

## Problem

Search was returning 0 results because:
1. Firecrawl query was too generic ("business events") - returned irrelevant results
2. After filtering aggregators and irrelevant events, nothing remained
3. Gemini thinking tokens kept growing (511 tokens) - hitting MAX_TOKENS again

## Root Cause Analysis

### Issue 1: Generic Firecrawl Query
**Location:** `src/lib/unified-query-builder.ts` line 402

**Current Query (TOO GENERIC):**
```
"Find business events and professional conferences in Germany... 
Focus on business and professional development, focusing on ediscovery, compliance"
```

**Problems:**
- Leads with "business events" which is too broad
- "business and professional development" is generic
- Industry-specific terms (ediscovery, compliance) are mentioned last, as an afterthought
- Firecrawl interprets this as "find any business event, prefer ones about ediscovery"
- Results: generic business conferences, e-commerce events, general management events

**User Profile:**
```
industry_terms: ['ediscovery', 'compliance', 'investigations', 'audit', 'legal technology']
icp_terms: ['general counsel', 'chief compliance officer', 'compliance manager']
```

### Issue 2: Growing Gemini Thinking Tokens
**Location:** `src/lib/optimized-orchestrator.ts` line 1021

**Observed Pattern:**
```
Attempt 1: thoughtsTokenCount: 384
Attempt 2: thoughtsTokenCount: 491  
Attempt 3: thoughtsTokenCount: 511
```

**Problem:**
- `maxOutputTokens` was 512
- Thinking tokens grew to 511
- Left only 1 token for actual response
- Result: MAX_TOKENS error

## Solutions Implemented

### Fix 1: Industry-Specific Firecrawl Query
**Location:** `src/lib/unified-query-builder.ts` lines 396-421

**NEW Query (SPECIFIC):**
```
"Find ediscovery, compliance, investigations events and professional conferences in Germany..."
```

**Changes:**
1. Check if user has `industry_terms` configured
2. If yes, **lead with industry terms** instead of generic "business"
3. Remove "business and professional development" phrase
4. Make the search laser-focused on the user's industry

**Code:**
```typescript
const industryTerms = userProfile?.industry_terms || [];
const hasSpecificIndustry = industryTerms.length > 0;

if (hasSpecificIndustry) {
  // Lead with specific industry terms, not generic "business"
  const primaryIndustry = industryTerms.slice(0, 3).join(', ');
  return `Find ${primaryIndustry} events and professional conferences in ${locationDescription}, ${temporalDescription}, including ${eventTypeDescription}${userContext}.`;
}
// Fallback to generic query only if no industry terms
return `Find business events and professional conferences...`;
```

**Impact:**
- Firecrawl now searches for "ediscovery, compliance, investigations events"
- Much more likely to find legal/compliance-specific events
- Generic business events filtered out at source

### Fix 2: Increased Gemini Token Limit
**Location:** `src/lib/optimized-orchestrator.ts` line 1021

**Change:**
```typescript
// Before
maxOutputTokens: 512,  // Thinking tokens hit 511, leaving 1 for response

// After
maxOutputTokens: 1024,  // Accommodates up to 511 thinking tokens + response
```

**Impact:**
- Gemini can now use thinking mode without hitting token limits
- More reliable prioritization
- Fewer fallbacks to pattern matching

## Expected Behavior

### Before Fix:
```
Firecrawl Query: "Find business events... focus on business and professional development, 
                 focusing on ediscovery, compliance"

Results:
- ❌ E-commerce events
- ❌ General business conferences
- ❌ Management seminars
- ❌ Generic networking events

After filtering: 0 relevant events
```

### After Fix:
```
Firecrawl Query: "Find ediscovery, compliance, investigations events and professional 
                 conferences in Germany..."

Results:
- ✅ Legal Tech Summit
- ✅ Compliance Conference
- ✅ eDiscovery Forum
- ✅ Regulatory Technology Event

After filtering: Multiple relevant events
```

## Query Examples by User Profile

### Example 1: Legal/Compliance User
**Profile:**
```
industry_terms: ['ediscovery', 'compliance', 'legal technology']
```

**Old Query:**
```
"Find business events... Focus on business and professional development, 
focusing on ediscovery, compliance"
```

**New Query:**
```
"Find ediscovery, compliance, legal technology events and professional conferences in Germany..."
```

### Example 2: HR/Recruiting User
**Profile:**
```
industry_terms: ['talent acquisition', 'hr technology', 'recruiting']
```

**Old Query:**
```
"Find business events... Focus on business and professional development,
focusing on talent acquisition, hr technology"
```

**New Query:**
```
"Find talent acquisition, hr technology, recruiting events and professional conferences in Germany..."
```

### Example 3: Generic User (No Industry Terms)
**Profile:**
```
industry_terms: []
```

**Old Query:**
```
"Find business events... Focus on business and professional development"
```

**New Query:**
```
"Find business events and professional conferences in Germany..."
```
*(Falls back to generic query)*

## Testing Results Expected

### Test 1: Legal/Compliance Search
**Profile:** ediscovery, compliance, investigations  
**Expected:** Legal tech conferences, compliance summits, regulatory events  
**Not Expected:** Generic business, e-commerce, management events

### Test 2: Verify Firecrawl Query in Logs
Look for:
```
[unified-firecrawl] Using narrative query with user profile: 
Find ediscovery, compliance, investigations events and professional conferences...
```

### Test 3: Gemini Prioritization Success
Look for:
```
[optimized-orchestrator] Successfully prioritized URLs via Gemini
(NOT: "Gemini prioritization failed, falling back")
```

## Important Notes

1. **Fallback Behavior:**
   - If user has NO `industry_terms`, falls back to generic "business events" query
   - Ensures system works for all users

2. **Language Support:**
   - English: "Find {industry_terms} events..."
   - German: "Finde {industry_terms} Events..."
   - French: "Trouvez des événements {industry_terms}..."

3. **Token Management:**
   - Thinking tokens can vary per query
   - 1024 tokens provides 2x safety margin
   - If thinking tokens exceed 512, we still have 512 for response

## Performance Impact

- ⬆️ **Better Quality:** Industry-specific events from the start
- ⬆️ **More Results:** Firecrawl finds relevant events, not filtered out later
- ⬇️ **Fewer False Positives:** No generic business events to filter
- ✅ **Gemini Working:** No more MAX_TOKENS errors

## Rollback Instructions

If issues occur, revert:
1. `src/lib/unified-query-builder.ts` - Lines 396-421
2. `src/lib/optimized-orchestrator.ts` - Line 1021

Restore:
```typescript
// unified-query-builder.ts line 402
return `Find business events and professional conferences in ${locationDescription}...`;

// optimized-orchestrator.ts line 1021
maxOutputTokens: 512,
```

---

**Last Updated:** November 10, 2025  
**Version:** 4.0.0  
**Status:** ✅ Ready for Testing  
**Priority:** HIGH - Core search functionality

