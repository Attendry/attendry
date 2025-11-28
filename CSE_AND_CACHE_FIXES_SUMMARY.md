# CSE Geographic Filtering and Cache Optimization Fixes

## Summary

Fixed two critical issues identified in the log analysis:
1. **CSE Geographic Filtering Failure**: CSE was returning US results for German queries
2. **Low Cache Hit Rate**: Cache misses due to query variations generating different cache keys

## Changes Made

### 1. CSE Geographic Filtering Fix

**File**: `src/lib/search/unified-search-core.ts`

**Changes**:
- Added `gl` (geolocation) parameter to CSE requests based on country code
- Added `cr` (country restriction) parameter with error handling
- Added `hl` (interface language) parameter
- Implemented query simplification for CSE (`simplifyQueryForCSE`) to extract core terms from complex queries
- Implemented post-filtering (`filterResultsByCountry`) to remove non-country matches

**Key Functions Added**:
- `simplifyQueryForCSE(query: string)`: Simplifies complex queries to improve CSE's geographic filtering
- `filterResultsByCountry(urls: string[], targetCountry: string)`: Post-filters results to ensure geographic accuracy

**Country Support**:
- DE, FR, GB/UK, US, AT, CH, IT, ES, NL, BE, PL, SE, NO, DK

**Exclusion Patterns**:
- For DE/FR/GB queries, excludes obvious US government/education sites (`.gov/`, `.edu/`, `hhs.gov`, `tdi.texas`, etc.)

### 2. Cache Key Normalization Fix

**Files**: 
- `src/lib/search/unified-search-core.ts`
- `src/lib/advanced-cache.ts`

**Changes**:
- Implemented query normalization for cache key generation
- Normalizes queries to treat semantically similar queries as the same
- Removes trailing event type suffixes (conference, event, summit, etc.)
- Normalizes boolean operators (OR/AND)
- Normalizes whitespace and parentheses
- Normalizes country codes to uppercase

**Key Functions Added**:
- `normalizeQueryForCache(query: string)`: Normalizes queries for cache key generation
- Updated `generateUnifiedCacheKey()` to use normalized queries
- Updated `generateSearchCacheKey()` to use normalized queries

**Benefits**:
- Queries like "compliance conference" and "compliance event" will now share the same cache key
- Queries with different boolean operators but same core terms will share cache
- Increased cache hit rate expected from < 70% to > 80%

## Expected Impact

### CSE Geographic Filtering
- **Before**: 0% accuracy (returning US results for DE queries)
- **After**: Expected 70-90% accuracy (with post-filtering)
- **Improvement**: Eliminates irrelevant US government/education results for non-US queries

### Cache Performance
- **Before**: < 70% cache hit rate (triggering alerts)
- **After**: Expected > 80% cache hit rate
- **Improvement**: Reduced API calls, faster responses, lower costs

## Testing Recommendations

1. **CSE Geographic Filtering**:
   - Test with DE query: "compliance" should return German results only
   - Verify US government sites are filtered out for non-US queries
   - Check that `gl` and `cr` parameters are set correctly in logs

2. **Cache Performance**:
   - Run multiple similar queries (e.g., "compliance conference", "compliance event")
   - Verify cache hits occur for normalized queries
   - Monitor cache hit rate metrics

## Implementation Details

### Query Simplification Logic
- For queries > 200 chars, extracts core terms
- Removes complex boolean logic
- Keeps quoted phrases and important keywords
- Limits to 256 characters (CSE max)

### Country Filtering Logic
- Uses domain patterns (`.de`, `.fr`, etc.)
- Uses city names (Berlin, Paris, etc.)
- Excludes patterns for non-target countries
- For DE/FR/GB: excludes US `.gov/` and `.edu/` sites

### Cache Normalization Logic
- Removes trailing event type terms
- Normalizes boolean operators
- Normalizes whitespace
- Removes excessive parentheses
- Converts to lowercase for consistency

## Files Modified

1. `src/lib/search/unified-search-core.ts`
   - Added `simplifyQueryForCSE()`
   - Added `filterResultsByCountry()`
   - Updated `unifiedCseSearch()` to use geographic parameters
   - Added `normalizeQueryForCache()`
   - Updated `generateUnifiedCacheKey()` to use normalization

2. `src/lib/advanced-cache.ts`
   - Added `normalizeQueryForCache()`
   - Updated `generateSearchCacheKey()` to use normalization

## Next Steps

1. Monitor logs for CSE geographic filtering improvements
2. Monitor cache hit rate metrics
3. Adjust exclusion patterns if needed based on results
4. Consider adding more country-specific domain patterns
5. Fine-tune query simplification if CSE still returns irrelevant results

## Notes

- The `cr` parameter is wrapped in try-catch as it can sometimes cause 400 errors
- Query simplification is conservative - only simplifies queries > 200 chars
- Post-filtering is permissive - only excludes clearly non-country matches
- Cache normalization is designed to be safe - only removes clearly redundant variations


