# Search Provider Capability Audit

## Firecrawl API (v2)

- **Current integration**: `src/providers/firecrawl.ts`, `src/services/search/firecrawlService.ts`, `src/lib/services/firecrawl-search-service.ts`.
- **Capabilities detected in code**:
  - Accepts `query`, `limit`, optional `sources`, `ignoreInvalidURLs`, `scrapeOptions` payload.
  - `scrapeOptions.location` currently unused in v1 adapter; advanced orchestrator sets `scrapeOptions.location.country/languages` but does not enforce within search request (extraction only).
  - Date parameters are commented as problematic (`tbs`, `cd_min`, `cd_max`). Legacy flag `FIRECRAWL_LEGACY_KNOBS` re-enables them for testing.
  - No active use of `location` or `timeRange` fields; the adapter warns against enabling without validation.
- **Open questions**:
  - Whether Firecrawl v2 accepts `timeRange` (e.g., `past_week`, ISO ranges) without timeouts.
  - Availability of geolocation filters beyond textual query hints (`location: { country }`). Need confirmation from API docs/support before enabling in production.
  - Rate limits/penalties associated with tighter filters.

## Google Custom Search (CSE)

- **Current integration**: `src/providers/cse.ts`, `src/lib/services/search-service.ts`.
- **Capabilities detected in code**:
  - Uses REST query string with `q`, `key`, `cx`, `num=10`, `safe=off`.
  - No `tbs`/`gl`/`lr` parameters currently; simple queries only.
  - Helper methods exist for `cdr:1,cd_min,cd_max` string generation (`search-service.ts`), but they are not fed into the provider adapter.
- **Open questions**:
  - Confirm if the active CSE instance allows `tbs` filtering; some CX configurations disable advanced parameters.
  - Evaluate practical impact of adding `hq`, `gl=DE`, or `lr=lang_de` for German-focused searches.

## Follow-up Actions

1. Contact Firecrawl/CSE documentation or support to verify availability and rate-limit implications of `timeRange`/`tbs` and `location` filters.
2. Implement opt-in feature flags for date/location filters once confirmed.
3. Add integration tests (mocked) to ensure fallbacks trigger when providers reject advanced parameters.



