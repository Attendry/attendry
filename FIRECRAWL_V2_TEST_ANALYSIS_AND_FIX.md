# Firecrawl v2 Test Analysis and Fix

## Date: 2025-11-15

## Issue Identified

From the test logs, the unified search + extract feature was **not being used** in the optimized-orchestrator code path. The logs showed:

1. **Missing `scrapeOptions.extract` in request body**: The Firecrawl API request body only included:
   ```json
   {
     "query": "Find legal & compliance business events...",
     "limit": 4,
     "sources": ["web"],
     "timeout": 45000,
     "location": "Germany"
   }
   ```
   It was missing the `scrapeOptions.extract` schema that enables unified search + extract.

2. **All extractions from cache**: All 4 extraction results came from L3 (Database) cache, meaning they were extracted in a previous run, not during the current search.

3. **No evidence of unified search + extract**: The logs didn't show any indication that extraction was happening during the search phase.

## Root Cause

The `optimized-orchestrator.ts` file's `discoverEventCandidates` function was calling `unifiedSearch` **without** the `extractSchema` and `extractPrompt` parameters. This meant:

- The unified search + extract feature was only implemented in `discover.ts` (EventDiscoverer class)
- The optimized-orchestrator (which is the main code path) was not using it
- This resulted in separate search and extract phases, missing the 50% API call reduction benefit

## Fix Applied

### 1. Added Event Schema to `discoverEventCandidates`

Added the same event schema used in `discover.ts` to enable structured extraction during search:

```typescript
// FIRECRAWL-V2: Event schema for unified search + extract
const eventSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    starts_at: { type: ["string","null"] },
    ends_at: { type: ["string","null"] },
    city: { type: ["string","null"] },
    country: { type: ["string","null"] },
    venue: { type: ["string","null"] },
    organizer: { type: ["string","null"] },
    topics: { type: "array", items: { type: "string" } },
    speakers: { 
      type: "array", 
      items: { 
        type: "object", 
        properties: { 
          name: { type: "string" }, 
          org: { type: "string" }, 
          title: { type: "string" }
        }
      }
    }
  },
  required: ["title"]
};
```

### 2. Updated `unifiedSearch` Call

Added `extractSchema`, `extractPrompt`, and `scrapeContent` parameters:

```typescript
const result = await unifiedSearch({
  q: task.data,
  narrativeQuery: narrativeQuery,
  dateFrom: params.dateFrom,
  dateTo: params.dateTo,
  country: params.country || undefined,
  limit: Math.ceil(ORCHESTRATOR_CONFIG.limits.maxCandidates / queryVariations.length),
  scrapeContent: true, // Enable content scraping for better prioritization
  // FIRECRAWL-V2: Enable unified search + extract (50% API call reduction)
  extractSchema: eventSchema,
  extractPrompt: "Extract event details including title, dates, location, and speakers from this page. Use null for missing information.",
  useCache: true,
  userProfile: userProfile
});
```

### 3. Updated Result Processing

Modified the result processing to handle enriched items (objects with `url` and `extracted` data) instead of just string URLs:

```typescript
// FIRECRAWL-V2: Handle both string URLs and enriched items with extracted data
const allUrls: string[] = [];
const extractedDataMap = new Map<string, any>(); // Store extracted data for later use

discoveryResults.forEach(result => {
  if (result.success && result.result && typeof result.result === 'object' && 'items' in result.result) {
    const searchResult = result.result as { items: Array<string | { url: string; extracted?: any }> };
    searchResult.items.forEach((item: any) => {
      // Handle enriched items (objects with url and extracted data)
      if (typeof item === 'object' && item !== null && item.url) {
        const url = item.url;
        if (url && url.startsWith('http')) {
          allUrls.push(url);
          // Store extracted data if available
          if (item.extracted) {
            extractedDataMap.set(url, item.extracted);
          }
        }
      } 
      // Handle string URLs (backward compatibility)
      else if (typeof item === 'string' && item.startsWith('http')) {
        allUrls.push(item);
      }
    });
  }
});
```

### 4. Added Logging

Added logging to track when extracted data is available:

```typescript
// FIRECRAWL-V2: Log if we have extracted data available
if (extractedDataMap.size > 0) {
  console.log(`[optimized-orchestrator] Found ${extractedDataMap.size} URLs with pre-extracted data from unified search+extract`);
}
```

Also added to discovery result logging:

```typescript
hasExtractedData: result.items?.some((item: any) => typeof item === 'object' && item?.extracted)
```

## Expected Results After Fix

1. **Request body will include `scrapeOptions.extract`**:
   ```json
   {
     "query": "...",
     "limit": 4,
     "sources": ["web"],
     "timeout": 45000,
     "location": "Germany",
     "scrapeOptions": {
       "formats": ["markdown", "html"],
       "onlyMainContent": true,
       "blockAds": true,
       "removeBase64Images": true,
       "extract": {
         "schema": { ... },
         "prompt": "Extract event details..."
       }
     }
   }
   ```

2. **Logs will show extraction during search**:
   - `[optimized-orchestrator] Discovery result: { ..., hasExtractedData: true }`
   - `[optimized-orchestrator] Found X URLs with pre-extracted data from unified search+extract`

3. **50% reduction in API calls**: Search and extract will happen in a single Firecrawl API call instead of two separate calls.

4. **30% lower latency**: No wait between search and extract phases.

## Files Modified

- `src/lib/optimized-orchestrator.ts`:
  - Added event schema definition
  - Updated `unifiedSearch` call to include `extractSchema`, `extractPrompt`, and `scrapeContent`
  - Updated result processing to handle enriched items
  - Added logging for extracted data

## Testing Recommendations

1. Run a test search and verify:
   - Request body includes `scrapeOptions.extract`
   - Logs show `hasExtractedData: true` in discovery results
   - Logs show URLs with pre-extracted data
   - Fewer API calls (check Firecrawl API usage)

2. Monitor performance:
   - Compare API call counts before/after
   - Measure latency improvements
   - Verify extraction quality (dates, locations, speakers)

3. Check cache behavior:
   - First run should show extraction during search
   - Subsequent runs should use cached extracted data

## Additional Observations from Logs

1. **Date validation issues**: Dates are being flagged as >30 days from window. This might indicate:
   - Extraction is not working correctly
   - Date parsing needs improvement
   - Quality gate might be too strict

2. **User search term not incorporated**: The narrative query still uses the persistent query instead of incorporating the user's "compliance" search term. This is a separate issue from Firecrawl v2 optimization.

3. **Multiple redundant Firecrawl calls**: The deduplication is working, but there are still many parallel discovery queries being executed. This is expected behavior for the multi-variation discovery strategy.

