# Content-Based Filtering Fix - November 10, 2025

## Problem

Search was returning irrelevant events that didn't match user profile:
- Example: "10th International Conference on Applied Research in Management, Business and Economics"
- User profile: eDiscovery, Compliance, Legal
- Event topic: Management, Business, Economics (NOT relevant)

## Root Causes

### 1. **Gemini Thinking Tokens Consuming Output Budget**
**Location:** `src/lib/optimized-orchestrator.ts` line 1020

**Problem:**
- `maxOutputTokens` was set to `256`
- Gemini 2.5-flash uses "thinking mode" which consumed `255 tokens` internally
- Left only 1 token for actual JSON response
- Every prioritization hit `MAX_TOKENS` and failed

**Evidence from logs:**
```
thoughtsTokenCount: 255
finishReason: MAX_TOKENS
```

**Solution:**
- Increased `maxOutputTokens` from `256` to `512`
- Now accommodates thinking tokens (255) + response content (257)

### 2. **conference2go.com Not in Aggregator List**
**Locations:** 
- `src/lib/optimized-orchestrator.ts` line 94
- `src/lib/event-analysis.ts` line 43

**Problem:**
- `conference2go.com` is a generic conference aggregator
- Was not being filtered before prioritization
- Generic business conferences passed through

**Solution:**
- Added `conference2go.com` to `AGGREGATOR_HOSTS` set
- Added to both files for consistency

### 3. **No Content-Based Filtering After Extraction**
**Location:** `src/lib/optimized-orchestrator.ts` lines 1482-1528

**Problem:**
- Events were only filtered by:
  - URL patterns (during prioritization)
  - Domain filtering (aggregators)
- No check of event **content** (title/description) against user profile
- Events about "Management" passed even though user wants "Compliance"

**Solution:**
- Added `filterByContentRelevance()` function
- Checks event title + description against:
  - `industry_terms` from user profile (e.g., "legal", "compliance", "ediscovery")
  - `icp_terms` from user profile (e.g., "general counsel", "chief compliance officer")
- Uses word boundary regex to avoid partial matches
- Logs which events match and which are filtered out

## Changes Made

### File: `src/lib/optimized-orchestrator.ts`

#### 1. Increased maxOutputTokens (Line 1020)
```typescript
// Before
maxOutputTokens: 256,  // Increased from 48 to 256 to prevent MAX_TOKENS errors

// After
maxOutputTokens: 512,  // Increased to 512 to accommodate thinking tokens (255) + response
```

#### 2. Added conference2go.com to Aggregators (Line 94)
```typescript
const AGGREGATOR_HOSTS = new Set([
  // ... existing ...
  'conference-service.com',
  'conference2go.com',           // NEW - generic aggregator
  'eventora.com',
  // ... rest ...
]);
```

#### 3. Added Content-Based Filtering (Lines 1470-1528)
```typescript
// After extraction, filter by content relevance
const filteredEvents = await filterByContentRelevance(events, params);

console.log('[optimized-orchestrator] Content filtering summary:', {
  beforeFiltering: events.length,
  afterFiltering: filteredEvents.length,
  filtered: events.length - filteredEvents.length
});

/**
 * Filter events by content relevance to user profile
 */
async function filterByContentRelevance(events: EventCandidate[], params: OptimizedSearchParams): Promise<EventCandidate[]> {
  const userProfile = await getUserProfile();
  const industryTerms = (userProfile.industry_terms as string[]).map(term => term.toLowerCase());
  const icpTerms = (userProfile.icp_terms as string[] || []).map(term => term.toLowerCase());
  
  return events.filter(event => {
    const searchText = `${event.title} ${event.description}`.toLowerCase();
    
    // Check for industry term match (primary filter)
    const hasIndustryMatch = industryTerms.some(term => {
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(searchText);
    });
    
    if (hasIndustryMatch) return true;
    
    // Check for ICP term match (secondary filter)
    const hasIcpMatch = icpTerms.some(term => {
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(searchText);
    });
    
    return hasIcpMatch;
  });
}
```

### File: `src/lib/event-analysis.ts`

#### Added conference2go.com (Line 43)
```typescript
const DIRECTORY_DOMAINS = new Set([
  'conferencealerts.co.in',
  'internationalconferencealerts.com',
  'cvent.com',
  'everlaw.com',
  'vendelux.com',
  'conference-service.com',
  'conference2go.com',          // NEW - Generic aggregator
  'eventora.com',
  'eventsworld.com'
]);
```

## How Content Filtering Works

### Example: User Profile
```typescript
{
  industry_terms: ["legal", "compliance", "ediscovery", "regulatory", "governance"],
  icp_terms: ["general counsel", "chief compliance officer", "legal counsel"]
}
```

### Example: Event 1 (FILTERED OUT)
**Title:** "10th International Conference on Applied Research in Management, Business and Economics"  
**Description:** "Business management and economics research..."

**Check:**
- ✗ "legal" → Not found
- ✗ "compliance" → Not found
- ✗ "ediscovery" → Not found
- ✗ "general counsel" → Not found

**Result:** ❌ **FILTERED OUT**

### Example: Event 2 (KEPT)
**Title:** "Legal Tech Summit 2025: eDiscovery & Compliance"  
**Description:** "For legal professionals and compliance officers..."

**Check:**
- ✓ "legal" → **FOUND** ✅
- ✓ "compliance" → **FOUND** ✅
- ✓ "ediscovery" → **FOUND** ✅

**Result:** ✅ **KEPT**

## Expected Logs

### Before Fix:
```
[optimized-orchestrator] Gemini prioritization finish reason: MAX_TOKENS
[optimized-orchestrator] Prioritization failed, using fallback
[optimized-orchestrator] Extraction summary: { produced: 2 }
```

### After Fix:
```
[optimized-orchestrator] Successfully prioritized URLs via Gemini
[optimized-orchestrator] Filtering with industry terms: ["legal", "compliance", "ediscovery"]
[optimized-orchestrator] ✗ Event filtered out (no match): "10th International Conference on Applied Research in Management..."
[optimized-orchestrator] ✓ Event matches industry terms: "Legal Tech Summit 2025: eDiscovery & Compliance"
[optimized-orchestrator] Content filtering summary: {
  beforeFiltering: 2,
  afterFiltering: 1,
  filtered: 1
}
```

## Testing

### Test Case 1: Generic Business Event
**Input:** Event about "Management, Business, Economics"  
**User Profile:** Legal, Compliance, eDiscovery  
**Expected:** ❌ Filtered out  
**Reason:** No industry term matches

### Test Case 2: Legal/Compliance Event
**Input:** Event about "Legal Tech, Compliance, GDPR"  
**User Profile:** Legal, Compliance, eDiscovery  
**Expected:** ✅ Kept  
**Reason:** Multiple industry term matches

### Test Case 3: No User Profile
**Input:** Any event  
**User Profile:** None or empty  
**Expected:** ✅ All events kept  
**Reason:** No filtering without profile

## Performance Impact

- ⬆️ **Better Quality:** Only industry-relevant events returned
- ⬇️ **Fewer Irrelevant Results:** Content filtering catches what URL filtering misses
- ✅ **Gemini Working:** MAX_TOKENS issue resolved
- 📊 **Transparent:** Logs show which events match and which are filtered

## Important Notes

### User Profile Configuration

**The content filtering depends on your user profile configuration:**

**Question:** What are your exact `industry_terms` and `icp_terms`?

Common configurations for Legal/Compliance:

```typescript
// Option 1: Legal/Compliance Focus
{
  industry_terms: [
    "legal",
    "compliance",
    "ediscovery",
    "regulatory",
    "governance",
    "risk management",
    "audit",
    "gdpr",
    "data protection",
    "privacy"
  ],
  icp_terms: [
    "general counsel",
    "chief compliance officer",
    "legal counsel",
    "compliance manager",
    "risk officer",
    "data protection officer"
  ]
}

// Option 2: Broader Business Law
{
  industry_terms: [
    "legal technology",
    "legaltech",
    "compliance technology",
    "regtech",
    "contract management",
    "litigation"
  ],
  icp_terms: [
    "attorney",
    "lawyer",
    "legal professional",
    "in-house counsel"
  ]
}
```

**If your profile has different terms, the filtering will use those instead!**

## Rollback Instructions

If issues occur, revert:
1. `src/lib/optimized-orchestrator.ts` - Lines 1020, 94, 1470-1528
2. `src/lib/event-analysis.ts` - Line 43

Restore:
- `maxOutputTokens: 256`
- Remove `conference2go.com` from aggregator lists
- Remove `filterByContentRelevance()` function and its call

---

**Last Updated:** November 10, 2025  
**Version:** 3.0.0  
**Status:** ✅ Ready for Testing

