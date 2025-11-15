# Date Extraction and Quality Gate Analysis

## Date: 2025-11-15

## Issues Identified

### 1. **Date Extraction Producing Wrong Dates**
From the logs:
- Event 1: Date `2025-10-06 to 2025-10-08` (off by ~40 days from window 2025-11-15..2025-11-29)
- Event 2: Date `2026-10-06 to 2026-10-07` (off by ~1 year!)

These dates are being extracted from event pages but are clearly wrong.

### 2. **Quality Gate Too Strict for Short Windows**
The quality gate at `src/lib/quality/eventQuality.ts` line 90-99:
- Allows dates within 30 days of the window
- For a 14-day window (Nov 15-29), this means dates from Oct 16 to Dec 29 are acceptable
- But dates like `2025-10-06` (40 days before) are marked as "extraction-error"

**Problem**: For short windows, we need more lenient date validation OR we need to clear invalid dates.

### 3. **Invalid Dates Being Stored and Displayed**
- Events with extraction-error dates are still passing quality gate (via `trustSearchQuery` rule)
- These invalid dates are being stored in `event.date`
- UI tries to display them, resulting in "invalid date" or malformed dates

### 4. **Date Window Status Not Being Used**
The quality gate sets `dateWindowStatus: 'extraction-error'` but:
- The date is still stored in `event.date`
- The UI doesn't know to ignore it
- No fallback date logic

## Root Causes

1. **Date extraction from HTML is unreliable**: Gemini/LLM extraction is picking up dates from:
   - Past event listings
   - Archive pages
   - Registration deadlines
   - Other unrelated dates on the page

2. **No date validation against search window**: The extraction doesn't validate dates against the search window before storing them.

3. **Quality gate logic flaw**: Even when a date is marked as "extraction-error", it's still stored and displayed.

## Proposed Fixes

### Fix 1: Clear Invalid Dates
When a date is marked as `extraction-error`, clear it from the event object:

```typescript
// In optimized-orchestrator.ts, after quality check:
if (qualityResult.dateWindowStatus === 'extraction-error') {
  // Clear the invalid date - it's unreliable
  event.date = null;
  event.starts_at = null;
  event.ends_at = null;
  event.metadata.dateWindowStatus = 'extraction-error';
  event.metadata.dateCleared = true;
}
```

### Fix 2: More Lenient Date Validation for Short Windows
Adjust the 30-day tolerance based on window size:

```typescript
// In eventQuality.ts
const windowDays = daysBetween(window.from, window.to);
const toleranceDays = Math.max(30, windowDays * 2); // At least 2x window size, minimum 30 days

if (daysFromStart <= toleranceDays || daysFromEnd <= toleranceDays) {
  hasReliableDate = true;
  dateWindowStatus = 'within-month';
}
```

### Fix 3: Improve Date Extraction Validation
Add validation in the extraction phase to reject dates that are clearly wrong:

```typescript
// In extract route or event extractor
function validateExtractedDate(dateStr: string, searchWindow: { from: string; to: string }): boolean {
  if (!dateStr) return false;
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  
  const windowStart = new Date(searchWindow.from);
  const windowEnd = new Date(searchWindow.to);
  
  // Allow dates within 60 days of window (more lenient than quality gate)
  const daysBefore = Math.ceil((windowStart.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  const daysAfter = Math.ceil((date.getTime() - windowEnd.getTime()) / (1000 * 60 * 60 * 24));
  
  // Reject if >60 days before or >60 days after
  if (daysBefore > 60 || daysAfter > 60) {
    return false; // Likely extraction error
  }
  
  return true;
}
```

### Fix 4: Better Date Display in UI
Update UI components to handle missing/invalid dates gracefully:

```typescript
// In EventBoardCard.tsx
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return "Date TBD";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Date TBD"; // Invalid date
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric" 
    });
  } catch {
    return "Date TBD";
  }
};
```

## Implementation Priority

1. **P0 (Critical)**: Fix 1 - Clear invalid dates when marked as extraction-error
2. **P0 (Critical)**: Fix 4 - Better date display in UI
3. **P1 (Important)**: Fix 2 - More lenient date validation for short windows
4. **P2 (Nice to have)**: Fix 3 - Improve date extraction validation

## Expected Impact

### Before:
- Events with wrong dates (2025-10-06, 2026-10-06) pass quality gate
- Invalid dates displayed in UI
- Only 2 results for 14-day window

### After:
- Invalid dates cleared from events
- UI shows "Date TBD" for events without reliable dates
- More events pass quality gate (dates not blocking them)
- Better user experience (no "invalid date" errors)

## Testing

1. Run search with 14-day window (Nov 15-29)
2. Verify events with extraction-error dates have `date: null`
3. Verify UI shows "Date TBD" instead of "invalid date"
4. Verify more events pass quality gate
5. Run search with 30-day window and verify similar behavior

