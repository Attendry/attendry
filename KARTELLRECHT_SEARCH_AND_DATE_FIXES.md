# Kartellrecht Search Relevance and Date Extraction Fixes

## Date: 2025-11-15

## Issues Identified

### Issue 1: Search Keyword "Kartellrecht" Not Prioritized

**Problem:**
- User searches for "Kartellrecht" (antitrust/competition law)
- Narrative query includes it only at the end: "related to Kartellrecht"
- Firecrawl returns generic compliance events, not Kartellrecht-specific events
- The keyword is buried in a long query that starts with generic terms

**Root Cause:**
- In `weighted-query-builder.ts` line 244-245, user keyword is only appended as "related to {keyword}"
- The narrative query structure prioritizes profile terms over user input
- User keyword should be in the primary position, not appended at the end

**Current Query Structure:**
```
"Find legal & compliance business events... covering compliance, investigations, regtech, ESG... related to Kartellrecht"
```

**Should Be:**
```
"Find Kartellrecht (antitrust law, competition law) events and professional conferences in Germany..."
```

### Issue 2: Wrong Dates Being Extracted

**Problem:**
- Events from May 2025 showing today's date (November 15, 2025)
- Date extraction is picking up wrong dates from pages
- Quality gate correctly identifies dates >60 days out, but dates are still wrong

**Root Causes:**
1. **Extraction prompt doesn't exclude non-event dates**: The prompt doesn't explicitly tell LLM to ignore:
   - "Last updated" dates
   - "Published" dates
   - Archive dates
   - Registration deadline dates
   - Other metadata dates

2. **Date parsing defaults to current year**: In `parseDates()` function (line 517), when a date without year is found (e.g., "25. Mai"), it defaults to current year:
   ```typescript
   const currentYear = new Date().getFullYear();
   return { starts_at: `${currentYear}-${month}-${day}`, ends_at: null };
   ```
   If extraction finds "25. Mai" (May 25) from a past event page, it becomes "2025-05-25" which is in the past.

3. **No validation against search window during extraction**: Dates are extracted without checking if they're in the search window.

## Proposed Fixes

### Fix 1: Prioritize User Keyword in Narrative Query

**File:** `src/lib/services/weighted-query-builder.ts`

**Change:** Make user keyword the primary focus when provided:

```typescript
function buildNarrativeQuery(...) {
  // If user keyword provided, make it the primary focus
  if (userText && userText.trim()) {
    // Add keyword synonyms/translations for better matching
    const keywordFocus = userText.trim();
    const keywordContext = getKeywordContext(keywordFocus); // e.g., "Kartellrecht" → "antitrust law, competition law"
    
    narrativeParts.unshift(
      `Find ${keywordFocus}${keywordContext ? ` (${keywordContext})` : ''} business events and professional conferences in ${locationPhrase}`
    );
    
    // Still include industry terms but as secondary context
    if (template.industryTerms.length > 0) {
      narrativeParts.push(`covering ${template.industryTerms.slice(0, 3).join(', ')}`);
    }
  } else {
    // Fallback to existing logic
    narrativeParts.push(`Find ${template.name.toLowerCase()} business events...`);
  }
}
```

### Fix 2: Improve Date Extraction Prompt

**File:** `src/app/api/events/extract/route.ts`

**Change:** Add explicit instructions to ignore non-event dates:

```typescript
const enhancedPrompt = `...existing prompt...

CRITICAL DATE EXTRACTION RULES:
1. Extract ONLY the event start/end dates (when the event actually takes place)
2. IGNORE these dates (do NOT extract them):
   - "Last updated" or "Last modified" dates
   - "Published" or "Posted" dates
   - Archive dates
   - Registration deadline dates (unless they're the event date)
   - Copyright dates
   - "As of" dates
   - Any date in the past that's clearly not the event date
3. If you find a date without a year (e.g., "25. Mai"), only use it if:
   - It's clearly in the future relative to today
   - It's explicitly stated as the event date
   - Otherwise, use null
4. Validate dates against the search window: ${dateFrom ? `Events should be between ${dateFrom} and ${dateTo}` : 'Focus on upcoming events'}
5. If a date is clearly wrong (e.g., past event date, archive date), use null instead

...rest of prompt...`;
```

### Fix 3: Add Date Validation During Extraction

**File:** `src/app/api/events/extract/route.ts`

**Change:** Validate extracted dates against search window before storing:

```typescript
// After extraction, validate dates
if (extractedData.starts_at) {
  const eventDate = new Date(extractedData.starts_at);
  const windowStart = dateFrom ? new Date(dateFrom) : new Date();
  const windowEnd = dateTo ? new Date(dateTo) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  
  // If date is clearly outside window (more than 30 days), treat as extraction error
  const daysBefore = Math.ceil((windowStart.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysAfter = Math.ceil((eventDate.getTime() - windowEnd.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysBefore > 30 || daysAfter > 30) {
    // Likely extraction error - clear the date
    extractedData.starts_at = null;
    extractedData.ends_at = null;
    console.log(`[extract] Cleared date ${extractedData.starts_at} - outside search window`);
  }
}
```

## Implementation Priority

1. **P0 (Critical)**: Fix 2 - Improve date extraction prompt (prevents wrong dates)
2. **P0 (Critical)**: Fix 1 - Prioritize user keyword (improves search relevance)
3. **P1 (Important)**: Fix 3 - Add date validation during extraction (additional safety)

## Expected Impact

### Before:
- "Kartellrecht" search returns generic compliance events
- Events show wrong dates (today's date for past events)
- Low relevance for specific keyword searches

### After:
- "Kartellrecht" search returns Kartellrecht/antitrust-specific events
- Dates are more accurate (non-event dates ignored)
- Better relevance for keyword searches

