# Date Range Auto-Expansion Feature

## Overview
Automatically expands the search date range when few relevant results are found, ensuring users always see valuable events even during sparse periods.

## How It Works

### Expansion Thresholds
- **Trigger**: < 3 events found in original date range
- **First Expansion**: +1 week (total 2 weeks)
- **Second Expansion**: +3 weeks (total 1 month)

### Visual Indicators

#### Original Date Range Events
- Standard white background with gray border
- No special badge

#### 2-Week Expanded Events
- **Background**: Light blue tint (`bg-blue-50/20`)
- **Border**: Blue (`border-blue-200`)
- **Badge**: "Extended 2 weeks" (blue)
- Example: Event on Nov 17 when search was Nov 10-17

#### 1-Month Expanded Events
- **Background**: Light purple tint (`bg-purple-50/20`)
- **Border**: Purple (`border-purple-200`)
- **Badge**: "Extended 1 month" (purple)
- Example: Event on Dec 3 when search was Nov 10-17

## Technical Implementation

### 1. Orchestrator Logic (`src/lib/optimized-orchestrator.ts`)

```typescript
// After initial extraction
if (extracted.length < MIN_RESULTS_THRESHOLD && params.dateFrom && params.dateTo) {
  // Try 2-week expansion
  const twoWeeksTo = new Date(dateTo + 7 days);
  const expandedEvents = await searchWithDateRange(dateFrom, twoWeeksTo);
  expandedEvents.forEach(e => e.dateRangeSource = '2-weeks');
  
  // If still not enough, try 1-month expansion
  if (total < MIN_RESULTS_THRESHOLD) {
    const oneMonthTo = new Date(dateTo + 23 days);
    const monthEvents = await searchWithDateRange(dateFrom, oneMonthTo);
    monthEvents.forEach(e => e.dateRangeSource = '1-month');
  }
}
```

### 2. Event Interface Update

```typescript
export interface EventCandidate {
  // ... existing fields
  dateRangeSource?: 'original' | '2-weeks' | '1-month';
}
```

### 3. Visual Styling (`src/components/EventCard.tsx`)

```typescript
const dateRangeStyles = 
  dateRangeSource === '2-weeks' ? 'border-blue-200 bg-blue-50/20' :
  dateRangeSource === '1-month' ? 'border-purple-200 bg-purple-50/20' :
  'border-slate-200';

const badge = 
  dateRangeSource === '2-weeks' ? { text: 'Extended 2 weeks', color: 'bg-blue-100 text-blue-800' } :
  dateRangeSource === '1-month' ? { text: 'Extended 1 month', color: 'bg-purple-100 text-purple-800' } :
  null;
```

## Monitoring

### Console Logs
```
[optimized-orchestrator] Only 1 events found. Expanding date range...
[optimized-orchestrator] Trying 2-week expansion: 2025-11-10 to 2025-11-24
[optimized-orchestrator] After 2-week expansion: 4 total events (3 new)
```

### API Response Logs
Look for `date_expansion` stage in the logs array:
```json
{
  "stage": "date_expansion",
  "message": "2-week expansion added 3 events",
  "data": {
    "totalEvents": 4,
    "newEvents": 3,
    "expandedTo": "2025-11-24"
  }
}
```

## User Experience

### Before Auto-Expansion
- User searches Nov 10-17
- Only 1 event found
- User sees "No results" or minimal results
- **Problem**: User doesn't know to expand dates manually

### After Auto-Expansion
- User searches Nov 10-17
- System finds 1 event, automatically expands to 2 weeks
- Finds 3 more events (Nov 18-24)
- User sees 4 total events with clear visual indicators
- **Blue-shaded cards** show extended events
- **Badge** explains they're from expanded date range

## Configuration

### Adjusting Threshold
```typescript
// src/lib/optimized-orchestrator.ts
const MIN_RESULTS_THRESHOLD = 3; // Change this value
```

### Adjusting Expansion Periods
```typescript
// 2-week expansion: +7 days
const twoWeeksTo = new Date(dateTo.getTime() + 7 * 24 * 60 * 60 * 1000);

// 1-month expansion: +23 days (total 30 from original)
const oneMonthTo = new Date(dateTo.getTime() + 23 * 24 * 60 * 60 * 1000);
```

## Benefits

1. **Better UX**: Users always see relevant events, even in sparse periods
2. **Transparency**: Clear visual indicators show which events are from expanded ranges
3. **Automatic**: No manual intervention required
4. **Smart**: Only expands when necessary (< 3 results)
5. **Progressive**: Tries 2 weeks first, then 1 month if needed

## Color Coding Summary

| Date Range | Background | Border | Badge Text | Badge Color |
|------------|-----------|--------|-----------|------------|
| Original | White | Gray | None | N/A |
| +2 Weeks | Light Blue | Blue | "Extended 2 weeks" | Blue |
| +1 Month | Light Purple | Purple | "Extended 1 month" | Purple |

## Testing

1. Search for niche industry in short timeframe (e.g., "ediscovery" Nov 10-17)
2. If < 3 results found, check console for expansion logs
3. Verify blue-shaded cards appear with "Extended 2 weeks" badge
4. If still < 3 results, verify purple-shaded cards appear
5. Confirm date on cards is within expanded range

