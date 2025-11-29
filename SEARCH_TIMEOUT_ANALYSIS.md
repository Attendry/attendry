# Search Timeout Analysis & Fixes

## Issues Identified

### 1. **Cache JSON Parsing Error** (Critical)
**Error**: `SyntaxError: "[object Object]" is not valid JSON`

**Root Cause**: 
- Upstash REST API auto-parses JSON responses
- When data is stored as JSON string, Upstash parses it
- When retrieved, it's already an object, not a string
- `String(result)` converts object to `"[object Object]"` string
- Then `JSON.parse("[object Object]")` fails

**Location**: `src/lib/cache/unified-cache-service.ts:111`

**Impact**: Cache misses cause unnecessary API calls and slower performance

---

### 2. **Batch Metadata JSON Parsing Error** (Critical)
**Error**: `SyntaxError: Unterminated string in JSON at position 827`

**Root Cause**:
- Gemini sometimes returns malformed JSON (unterminated strings, unescaped quotes)
- Direct `JSON.parse()` fails on malformed JSON
- Fallback to individual processing is slow and causes timeout

**Location**: `src/lib/event-analysis.ts:1186`

**Impact**: 
- Causes fallback to slower individual processing
- Contributes to 60-second timeout
- Results in no events being returned

---

### 3. **Vercel Runtime Timeout** (Critical)
**Error**: `Vercel Runtime Timeout Error: Task timed out after 60 seconds`

**Root Cause**:
- Multiple issues compound to exceed 60-second limit:
  1. Cache errors cause unnecessary retries
  2. JSON parsing errors trigger slow fallback processing
  3. Individual chunk processing is sequential and slow
  4. No timeout handling for individual operations

**Impact**: Search returns no results despite finding events

---

## Timeline Analysis

From logs:
- **13:48:38** - Search started
- **13:48:54** - First Firecrawl timeout (recovered)
- **13:48:59** - Discovery completed (15 URLs found, 3 after filtering, 2 prioritized)
- **13:49:07** - Deep crawl started for 2 URLs
- **13:49:07** - Cache errors occurred
- **13:49:22** - Metadata extraction started
- **13:49:33** - Batch JSON parsing failed, fallback triggered
- **13:49:38** - Vercel timeout (60 seconds exceeded)

**Total time**: ~60 seconds (exceeded limit)

---

## Fixes Required

### Fix 1: Cache Service - Handle Upstash Auto-Parsing
- Check if Redis result is already an object
- If object, stringify it before parsing
- Use safe JSON parsing utilities

### Fix 2: Batch Metadata Parsing - Use Safe JSON Parser
- Replace direct `JSON.parse()` with `safeParseJson()`
- Add better error handling and logging
- Improve fallback strategy

### Fix 3: Timeout Management
- Add per-operation timeouts
- Implement early termination on errors
- Optimize fallback processing

---

## Recommended Actions

1. **Immediate**: Fix cache parsing to handle Upstash auto-parsing
2. **Immediate**: Use safe JSON parser for batch metadata
3. **Short-term**: Add timeout guards to prevent 60s limit
4. **Long-term**: Optimize fallback processing to be faster

