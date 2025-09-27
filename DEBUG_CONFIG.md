# Debug Configuration Guide

## Environment Variables for Debugging

Add these to your `.env.local` file (and on Vercel) for debugging:

```bash
# Debug flags for preventing zero-result runs
ALLOW_UNDATED=1
RELAX_COUNTRY=1
RELAX_DATE=1
BYPASS_GEMINI_JSON_STRICT=1
MIN_KEEP_AFTER_PRIOR=5
TBS_WINDOW_DAYS=60
FIRECRAWL_LIMIT=30
MAX_QUERY_TIERS=3
ENABLE_CURATION_TIER=1
ENABLE_TLD_PREFERENCE=1

# Debugging
DEBUG_MODE=1
VERBOSE_LOGGING=1
```

## Vercel Configuration

In your Vercel project settings, add these environment variables:

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable from the list above
4. Make sure to add them for all environments (Production, Preview, Development)

## Testing the Debug Endpoint

Once deployed, test the debug endpoint:

```bash
curl https://your-domain.vercel.app/api/debug/test-search
```

This endpoint should never return `{ items: [] }` - it will always return fallback items if the main pipeline fails.

## Monitoring

Check the console logs for:

1. **Search Trace**: Shows where items are lost in the pipeline
2. **Search Summary**: Shows final counts and performance metrics
3. **Telemetry Events**: Shows detailed performance and quality metrics

## Flag Descriptions

- `ALLOW_UNDATED=1`: Allow events without dates
- `RELAX_COUNTRY=1`: Allow German-speaking countries and German content
- `RELAX_DATE=1`: Allow events outside date range
- `BYPASS_GEMINI_JSON_STRICT=1`: Use heuristic prioritization instead of Gemini
- `MIN_KEEP_AFTER_PRIOR=5`: Minimum items to keep after prioritization
- `TBS_WINDOW_DAYS=60`: Search window in days
- `FIRECRAWL_LIMIT=30`: Maximum items per search tier
- `MAX_QUERY_TIERS=3`: Maximum number of search tiers to try
- `ENABLE_CURATION_TIER=1`: Enable curated site search
- `ENABLE_TLD_PREFERENCE=1`: Prefer .de domains

## Acceptance Criteria

✅ Hitting `/api/debug/test-search` returns `items.length >= 5` on a cold run
✅ No stage throws; JSON.parse errors are absorbed and noted
✅ `search_summary.trace` shows non-zero `results.urlsKept` before filtering
✅ With default flags (strict mode), you still get non-zero results for the last 45–60 days
✅ Production path: if strict mode yields 0, the pipeline automatically relaxes to "minimum viable" candidates

## Next Steps

1. Deploy with debug flags enabled
2. Test the debug endpoint
3. Monitor logs to identify where results are lost
4. Gradually tighten flags once issues are identified
5. Remove debug flags once pipeline is stable
