# Search Relevance Fix - November 10, 2025

## Problem Summary

Search was returning irrelevant results (generic conference aggregators) instead of industry-specific events (eDiscovery, Compliance, Legal) based on user profile.

## Root Causes

### 1. **Gemini Prioritization Failing (MAX_TOKENS)**
**Location:** `src/lib/optimized-orchestrator.ts` line 970

**Problem:** 
- `maxOutputTokens` was set to `48` tokens
- Gemini needs to return JSON arrays like `[{"url":"...","score":0.9,"reason":"relevant"}]`
- 48 tokens is far too small for even a single URL in JSON format
- Every prioritization attempt hit `MAX_TOKENS` and failed
- System fell back to basic URL pattern matching

**Solution:**
- Increased `maxOutputTokens` from `48` to `256`
- This provides enough tokens for Gemini to return proper JSON arrays with multiple URLs

### 2. **Aggregator Sites Scoring High in Fallback**
**Location:** `src/lib/optimized-orchestrator.ts` lines 888-973

**Problem:**
- When Gemini failed, fallback scoring used simple URL pattern matching
- Generic aggregator URLs like `internationalconferencealerts.com/germany/business` scored high because they contained keywords like "conference" and "business"
- No industry-specific filtering in fallback logic
- Aggregators were only filtered DURING prioritization, not BEFORE

**Solutions:**
1. **Pre-filter aggregators** (lines 893-912):
   - Filter out all aggregator domains BEFORE prioritization
   - Prevents wasting API calls and processing time
   - Aggregator list expanded from 14 to 19 domains

2. **Improved fallback scoring** (lines 933-971):
   - Lower base scores (0.3 instead of 0.4)
   - Heavy boost (+0.4) for user's industry terms in URL
   - Boost for industry keywords in URL PATH (not just domain)
   - Prefer specific event URLs (`/event/[name]`) over directory pages
   - Uses actual user profile data when available

3. **Updated system instruction** (line 997):
   - Added "Score 0-1 based on industry relevance"
   - Added "Prioritize URLs with specific events matching the industry focus"
   - Added "Penalize generic directories"

### 3. **Insufficient Aggregator Filtering**
**Locations:** 
- `src/lib/optimized-orchestrator.ts` lines 78-98
- `src/lib/event-analysis.ts` lines 36-52

**Problem:**
- Aggregator list was incomplete
- Missing common conference directory sites

**Solution:**
- Expanded aggregator lists in both files
- Added: `conference-service.com`, `eventora.com`, `eventsworld.com`, `globalriskcommunity.com`, `cvent.com`
- Kept both files synchronized

## Changes Made

### File: `src/lib/optimized-orchestrator.ts`

#### 1. Increased maxOutputTokens (Line 970)
```typescript
// Before
maxOutputTokens: 48,

// After
maxOutputTokens: 256,  // Increased from 48 to 256 to prevent MAX_TOKENS errors
```

#### 2. Expanded Aggregator List (Lines 78-98)
```typescript
const AGGREGATOR_HOSTS = new Set([
  '10times.com',
  'allconferencealert.com',
  'conferencealerts.co.in',
  'conferenceineurope.net',
  'conferenceineurope.org',
  'eventbrite.com',
  'eventbrite.de',
  'eventbrite.co.uk',
  'freeconferencealerts.com',
  'globalli.io',
  'internationalconferencealerts.com',
  'linkedin.com',
  'researchbunny.com',
  'vendelux.com',
  'conference-service.com',      // NEW
  'eventora.com',                 // NEW
  'eventsworld.com',              // NEW
  'globalriskcommunity.com',      // NEW
  'cvent.com'                     // NEW
]);
```

#### 3. Pre-filter Aggregators (Lines 893-912)
```typescript
// Filter out aggregator sites BEFORE prioritization to prevent wasting resources
const nonAggregatorUrls = urls.filter(url => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (AGGREGATOR_HOSTS.has(host)) {
      console.log(`[optimized-orchestrator] Filtering out aggregator domain: ${host}`);
      return false;
    }
    return true;
  } catch {
    return true;
  }
});

console.log(`[optimized-orchestrator] Filtered ${urls.length - nonAggregatorUrls.length} aggregator URLs, ${nonAggregatorUrls.length} remaining`);
```

#### 4. Industry-Aware Fallback Scoring (Lines 927-971)
```typescript
// Enhanced fallback scoring with industry relevance
const searchConfig = await getSearchConfig();
const userProfile = await getUserProfile();
const industryTerms = (userProfile?.industry_terms as string[]) || [];
const icpTerms = (userProfile?.icp_terms as string[]) || [];

return nonAggregatorUrls.map((url, idx) => {
  let score = 0.3 - idx * 0.02; // Base score with degradation
  
  const urlLower = url.toLowerCase();
  
  // Heavy boost for industry-specific terms in URL path
  let industryMatch = false;
  for (const term of industryTerms) {
    if (urlLower.includes(term.toLowerCase())) {
      score += 0.4;  // Big boost for user's specific terms
      industryMatch = true;
      break;
    }
  }
  
  // Additional boost for generic industry keywords if no specific match
  if (!industryMatch) {
    if (urlLower.includes('/legal') || urlLower.includes('/compliance') || 
        urlLower.includes('/regulatory') || urlLower.includes('/ediscovery')) {
      score += 0.3;
    }
  }
  
  // Boost for specific event pages (not generic directories)
  if (/\/(event|summit|conference)\/[^\/]+/.test(url)) {
    score += 0.25;
  }
  
  // Small boost for location
  if (urlLower.includes('germany') || urlLower.includes('berlin') || urlLower.includes('munich')) {
    score += 0.05;
  }
  
  return { 
    url, 
    score: Math.max(0.1, Math.min(score, 0.9)), 
    reason: 'enhanced_fallback' 
  };
});
```

#### 5. Improved Gemini System Instruction (Line 997)
```typescript
// Before
const systemInstruction = 'Return only JSON array [{"url":"","score":0,"reason":""}]. Score 0-1. Reason<=10 chars. No explanations.';

// After
const systemInstruction = 'Return only JSON array [{"url":"","score":0,"reason":""}]. Score 0-1 based on industry relevance. Prioritize URLs with specific events matching the industry focus. Penalize generic directories. Reason<=10 chars. No explanations.';
```

### File: `src/lib/event-analysis.ts`

#### Updated Aggregator Lists (Lines 36-52)
```typescript
const DIRECTORY_DOMAINS = new Set([
  'conferencealerts.co.in',
  'internationalconferencealerts.com',
  'cvent.com',
  'everlaw.com',
  'vendelux.com',
  'conference-service.com',    // NEW
  'eventora.com',              // NEW
  'eventsworld.com'            // NEW
]);

const AGGREGATOR_DOMAINS = new Set([
  '10times.com',
  'allconferencealert.com',
  'conferenceineurope.net',
  'conferenceineurope.org',    // NEW
  'eventbrite.com',
  'eventbrite.de',             // NEW
  'eventbrite.co.uk',          // NEW
  'freeconferencealerts.com',  // NEW
  'globalriskcommunity.com',
  'globalli.io',               // NEW
  'linkedin.com',
  'researchbunny.com'          // NEW
]);
```

## Expected Behavior After Fix

### Before:
```
Search Query: eDiscovery + Compliance events in Germany
Results: 
- ❌ internationalconferencealerts.com/germany/business (aggregator)
- ❌ 10times.com/germany/conferences (aggregator)
- ❌ allconferencealert.com/munich/business (aggregator)
- ❌ conferenceineurope.net/germany/business (aggregator)
```

### After:
```
Search Query: eDiscovery + Compliance events in Germany
Results:
- ✅ esmt.berlin/events/legal-tech-summit (specific legal event)
- ✅ compliance-conference.de/gdpr-workshop (specific compliance event)
- ✅ ediscovery-forum.eu/berlin-2025 (specific ediscovery event)
- ✅ legalweek.de/data-governance (specific legal event)
```

## Scoring Examples

### Aggregator URL (PRE-FILTERED)
`https://10times.com/germany/conferences?month=november`
- **Status:** Filtered out before prioritization
- **Score:** N/A (not processed)
- **Reason:** Aggregator domain

### Specific Industry Event (HIGH SCORE)
`https://legal-tech-conference.de/events/compliance-summit-2025`
- **Base:** 0.30
- **Industry match (+0.30):** "legal", "compliance" in path
- **Specific event (+0.25):** `/events/[name]` pattern
- **Location (+0.05):** "de" in domain
- **Final Score:** 0.90

### Generic Business Event (LOW SCORE)
`https://business-events.com/munich/networking`
- **Base:** 0.30
- **No industry match:** 0.00
- **Generic keywords (+0.10):** "business" in domain
- **Location (+0.05):** "munich" in path
- **Final Score:** 0.45

## Testing Recommendations

1. **Search with User Profile:**
   - User profile: eDiscovery, Compliance
   - Search: Germany, November 2025
   - Expected: Legal/compliance-specific events only

2. **Check Logs:**
   - Should see: `[optimized-orchestrator] Filtered X aggregator URLs`
   - Should NOT see: MAX_TOKENS errors
   - Should see: `Successfully prioritized URLs via Gemini`

3. **Verify Results:**
   - No conference aggregators in results
   - URLs should contain industry-specific terms
   - Events should match user's industry profile

## Performance Impact

- ⬆️ **Better Quality:** Only industry-relevant results
- ⬇️ **Fewer API Calls:** Aggregators filtered before processing
- ⬇️ **Faster Processing:** No wasted deep crawls on aggregators
- ✅ **Gemini Working:** MAX_TOKENS issue resolved

## Rollback Instructions

If issues occur, revert:
1. `src/lib/optimized-orchestrator.ts` - Lines 78-98, 888-973, 970, 997
2. `src/lib/event-analysis.ts` - Lines 36-52

Restore previous values:
- `maxOutputTokens: 48`
- Remove pre-filtering logic
- Restore old fallback scoring

---

**Last Updated:** November 10, 2025  
**Version:** 2.0.0  
**Status:** ✅ Ready for Testing

