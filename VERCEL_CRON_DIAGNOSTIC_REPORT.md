# Vercel Cron Jobs Diagnostic Report
**Date:** 2025-02-22  
**Analyst:** Senior Platform+Backend Engineer  
**Scope:** `/api/cron/collect-events`, `/api/cron/collect-events?type=deep`, `/api/cron/precompute-intelligence`

---

## Executive Summary

Analysis of the Vercel cron job configuration reveals **multiple critical issues** preventing scheduled execution. The primary root cause is a **fundamental misconfiguration in `vercel.json`**: Vercel Cron does not support query strings in cron path definitions. The path `/api/cron/collect-events?type=deep` will never match, causing the weekly deep collection job to fail silently.

Secondary issues include: (1) missing Cache-Control headers that could allow CDN/ISR caching to swallow executions, (2) incomplete structured logging making it difficult to verify execution, (3) potential timeout risks for long-running collection jobs, (4) authentication logic bug in precompute-intelligence handler, and (5) no explicit middleware exclusion for cron routes (though they should pass through).

The handlers themselves are correctly implemented to accept GET requests and return JSON, but the configuration and observability gaps prevent reliable execution and monitoring.

---

## Ranked Root-Cause Hypotheses

| Rank | Hypothesis | Evidence | Test | Expected Fix |
|------|------------|----------|------|--------------|
| **1** | **Query string in cron path invalid** | `vercel.json:9` defines path as `/api/cron/collect-events?type=deep`. Vercel Cron documentation states paths cannot include query strings. | Check Vercel dashboard → Cron Jobs → verify if "deep" job shows as configured. Check logs for any execution attempts at that path. | Split into separate route handler `/api/cron/collect-events-deep` or use header-based routing. |
| **2** | **Missing Cache-Control headers** | Neither handler sets `Cache-Control: no-store` or `no-cache`. `next.config.ts:89-117` sets headers but not for `/api/*`. ISR/CDN could cache 200 responses. | Check Vercel logs for cached responses. Manually curl endpoint and inspect response headers. | Add `Cache-Control: no-store, no-cache, must-revalidate` to all cron responses. |
| **3** | **Missing runtime declaration** | `src/app/api/cron/precompute-intelligence/route.ts` lacks `export const runtime = "nodejs";` (collect-events has it). While Next.js defaults to Node.js, explicit declaration is best practice. | Check handler runtime in Vercel logs. | Add `export const runtime = "nodejs";` after line 8. |
| **4** | **No structured logging at start** | Handlers log only after work begins. If early failure occurs (auth, env vars), no logs appear. `collect-events:40` logs after auth check, but no structured job metadata. | Check Vercel logs for any entries matching cron schedule times. If none exist, handlers aren't being called. | Add structured logging with request ID, job name, timestamp at handler entry point. |
| **5** | **Timeout risk for collect-events** | `collect-events:39-142` runs nested loops: standard (3×4=12 jobs), deep (4×14=56 jobs). Each job calls `SearchService.runEventDiscovery()` which can take 30-60s. Deep collection could exceed 10min (Pro) or 60s (Hobby). | Check Vercel function logs for timeout errors. Review execution duration metrics. | Implement chunking, reduce batch sizes, or split into multiple cron jobs. |
| **6** | **Environment variables not set in Production** | Handlers use `CRON_SECRET`, `FIRECRAWL_KEY`, `GOOGLE_CSE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. If missing, jobs fail silently or return 401. | Verify in Vercel dashboard → Settings → Environment Variables → Production. | Ensure all required env vars are set for Production environment. |
| **7** | **Middleware may interfere** | `src/middleware.ts:100-102` matcher includes `/api/*`. While cron routes aren't in `PROTECTED_PATH_PREFIXES`, middleware still executes and could add latency or fail if Supabase connection issues. | Check middleware logs for cron route requests. Test with middleware temporarily disabled. | Explicitly exclude `/api/cron/*` from middleware matcher or add early return for cron routes. |
| **8** | **Cron targeting wrong environment** | `vercel.json` has no explicit environment targeting. If crons are configured in Preview but not Production, they won't run. | Verify in Vercel dashboard → Cron Jobs → check which environment each job targets. | Ensure crons are configured for Production deployment, not Preview. |

---

## Configuration Analysis

### Vercel Configuration (`vercel.json`)

**Current State:**
```json
{
  "version": 2,
  "crons": [
    {
      "path": "/api/cron/collect-events",
      "schedule": "0 2 * * *"  // Daily at 2 AM UTC
    },
    {
      "path": "/api/cron/collect-events?type=deep",  // ❌ INVALID
      "schedule": "0 3 * * 0"  // Weekly Sunday at 3 AM UTC
    },
    {
      "path": "/api/cron/precompute-intelligence",
      "schedule": "0 */6 * * *"  // Every 6 hours
    }
  ]
}
```

**Issues Identified:**
1. **Line 9:** Query string `?type=deep` in path is invalid. Vercel Cron paths must be URL paths only, not query strings.
2. **Missing fields:** No `environment` field to explicitly target Production.
3. **No regions/runtime:** Not specified (defaults apply, but explicit is better).

**Expected Fix:**
- Remove query string from path
- Create separate route handler OR use header-based routing
- Add explicit environment targeting

---

## Route Handler Analysis

### `/api/cron/collect-events` (`src/app/api/cron/collect-events/route.ts`)

**Status:** ✅ Mostly correct, needs improvements

**Findings:**
- ✅ Accepts GET requests (line 150)
- ✅ Has `export const dynamic = 'force-dynamic'` (line 2)
- ✅ Has `export const runtime = "nodejs"` (line 1)
- ✅ Returns JSON with 200 status on success (line 162)
- ✅ Handles errors and returns 500 with error message (line 166-173)
- ❌ **Missing Cache-Control headers** - No explicit no-cache headers
- ❌ **Basic logging** - Uses `console.log` without structured format
- ❌ **No request ID** - Cannot correlate logs across execution
- ❌ **No timing metrics** - Cannot measure duration
- ⚠️ **Timeout risk** - Nested loops can exceed runtime limits:
  - Standard: 3 industries × 4 countries = 12 jobs × ~45s = ~9 minutes
  - Deep: 4 industries × 14 countries = 56 jobs × ~45s = ~42 minutes (will timeout)

**Query Parameter Handling:**
- Line 158-159: Correctly reads `type` from query params
- This works for manual testing but **won't work for Vercel Cron** (query strings not supported in cron paths)

### `/api/cron/precompute-intelligence` (`src/app/api/cron/precompute-intelligence/route.ts`)

**Status:** ⚠️ Has critical bug, needs improvements

**Findings:**
- ✅ Accepts GET requests (line 46)
- ✅ Has `export const dynamic = 'force-dynamic'` (line 8)
- ❌ **Missing `export const runtime`** - Should specify "nodejs" explicitly
- ✅ Returns JSON with 200 status on success (line 62-68)
- ✅ Handles errors and returns 500 (line 69-77)
- ✅ **Authentication logic is correct** (line 16-38) - Properly handles Vercel header, CRON_SECRET, and development fallback
- ❌ **Missing Cache-Control headers**
- ❌ **Basic logging** - No structured format
- ⚠️ **Timeout risk** - Processes 20 items sequentially, each calling `generateEventIntelligence()` which makes 4 parallel LLM calls. Estimated 5-10 minutes total.

---

## Middleware Analysis

**File:** `src/middleware.ts`

**Current Matcher:**
```typescript
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**Impact on Cron Routes:**
- ✅ Matcher includes `/api/*` routes
- ✅ Cron routes (`/api/cron/*`) are **not** in `PROTECTED_PATH_PREFIXES` or `ADMIN_PATH_PREFIXES`
- ✅ Middleware will execute but should pass through (line 96 returns `res`)
- ⚠️ **Potential issues:**
  - Supabase client creation adds latency (line 23-61)
  - If Supabase connection fails, middleware could throw (line 65 has catch, but still adds overhead)
  - No explicit exclusion for cron routes

**Recommendation:**
- Add early return for `/api/cron/*` paths to skip middleware entirely
- OR exclude from matcher: `matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron).*)"]`

---

## Runtime Limits & Timeout Analysis

### Vercel Function Timeouts
- **Hobby Plan:** 10 seconds (Serverless Functions)
- **Pro Plan:** 10 seconds (Serverless Functions) or 60 seconds (with configuration)
- **Enterprise:** Up to 300 seconds (5 minutes)

### Job Execution Time Estimates

#### `/api/cron/collect-events` (Standard)
- **Jobs:** 3 industries × 4 countries = 12 jobs
- **Per job:** ~30-60 seconds (SearchService.runEventDiscovery with Firecrawl)
- **Total:** 6-12 minutes ⚠️ **WILL TIMEOUT on Hobby/Pro without config**
- **Sequential execution:** Yes (line 70-120 uses `for` loops)

#### `/api/cron/collect-events?type=deep`
- **Jobs:** 4 industries × 14 countries = 56 jobs
- **Per job:** ~30-60 seconds
- **Total:** 28-56 minutes ⚠️ **WILL DEFINITELY TIMEOUT**

#### `/api/cron/precompute-intelligence`
- **Items:** 20 items per run (line 57)
- **Per item:** ~15-30 seconds (4 parallel LLM calls per item)
- **Total:** 5-10 minutes ⚠️ **WILL TIMEOUT on Hobby/Pro without config**

**Mitigation Required:**
- Implement chunking/batching
- Reduce batch sizes
- Add progress tracking and resume capability
- Consider splitting into multiple cron jobs

---

## Environment Variables

**Required Variables:**
- `CRON_SECRET` - Used for manual testing auth (optional if relying on Vercel header)
- `FIRECRAWL_KEY` - Required for event extraction
- `GOOGLE_CSE_KEY` - Required for search (fallback)
- `GOOGLE_CSE_CX` - Required for search
- `NEXT_PUBLIC_SUPABASE_URL` - Required for database
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Required for database
- `SUPABASE_SERVICE_ROLE_KEY` - Required for admin operations

**Verification:**
- Check Vercel Dashboard → Settings → Environment Variables → Production
- Ensure all variables are set (not just Preview/Development)

---

## Observability Gaps

### Current Logging
- **Format:** Unstructured `console.log` statements
- **Location:** Scattered throughout handlers
- **Metadata:** No request ID, no job name, no timing, no structured error context

### Missing Observability
1. **Request ID:** No UUID generated per execution
2. **Job metadata:** No structured job name/type in logs
3. **Timing:** No `ts_start`, `ts_end`, `duration_ms`
4. **Result metrics:** No structured `result_meta` (counts, items processed)
5. **Error context:** No structured `error_meta` (error class, stack trace, context)

### Recommended Logging Schema
```typescript
{
  job: "collect-events" | "collect-events-deep" | "precompute-intelligence",
  request_id: "uuid-v4",
  ts_start: "ISO-8601",
  ts_end: "ISO-8601",
  duration_ms: number,
  result_meta: {
    processed: number,
    failed: number,
    total: number,
    // job-specific metrics
  },
  error_meta?: {
    error_class: string,
    error_message: string,
    stack?: string,
    context?: object
  }
}
```

---

## Safety & Idempotency

### Current State

#### `/api/cron/collect-events`
- **Idempotency:** ✅ Uses `upsert` with `onConflict: 'source_url'` (line 248)
- **Deduplication:** ✅ Prevents duplicate events by URL
- **Lock mechanism:** ❌ No job-level lock (multiple concurrent runs possible)
- **Watermark:** ❌ No "last successful run" tracking

#### `/api/cron/precompute-intelligence`
- **Idempotency:** ✅ Queue-based (line 68-74) - only processes `pending` items
- **Status tracking:** ✅ Updates status to `processing` → `completed` (line 83-109)
- **Retry logic:** ✅ Max 3 attempts (line 114-137)
- **Lock mechanism:** ✅ Status-based (prevents concurrent processing of same item)

### Recommendations
1. **Add job-level locks** for collect-events (prevent concurrent runs)
2. **Add watermark tracking** (last successful run timestamp)
3. **Add execution tracking table** (log each cron run with status)

---

## Reproduction Checklist

### Manual Trigger Test

**1. Test `/api/cron/collect-events` (Standard)**
```bash
# With Vercel header (simulated)
curl -X GET https://YOUR_DOMAIN.vercel.app/api/cron/collect-events \
  -H "x-vercel-cron: 1" \
  -v

# With CRON_SECRET (if set)
curl -X GET https://YOUR_DOMAIN.vercel.app/api/cron/collect-events \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -v
```

**Expected Response:**
- Status: 200
- Body: JSON with `success: true`, `collectionType: "standard"`, `results: [...]`
- Headers: Should include `Cache-Control: no-store` (currently missing)

**2. Test `/api/cron/collect-events?type=deep`**
```bash
curl -X GET "https://YOUR_DOMAIN.vercel.app/api/cron/collect-events?type=deep" \
  -H "x-vercel-cron: 1" \
  -v
```

**Expected Response:**
- Status: 200
- Body: JSON with `collectionType: "deep"`
- **Note:** This will work for manual testing but **won't work for Vercel Cron** (query string issue)

**3. Test `/api/cron/precompute-intelligence`**
```bash
curl -X GET https://YOUR_DOMAIN.vercel.app/api/cron/precompute-intelligence \
  -H "x-vercel-cron: 1" \
  -v
```

**Expected Response:**
- Status: 200
- Body: JSON with `success: true`, `processed: N`, `stats: {...}`

### Vercel Logs Verification

**Where to Check:**
1. Vercel Dashboard → Project → Functions → Logs
2. Filter by: Function name matching `/api/cron/*`
3. Filter by: Time matching cron schedule (UTC)

**What to Look For:**
- Log entries at scheduled times (2 AM UTC daily, 3 AM UTC Sunday, every 6 hours)
- Structured log lines with job metadata
- Error messages if execution fails
- Duration metrics

**If No Logs Appear:**
- Cron jobs are not being triggered (configuration issue)
- Check Vercel Dashboard → Cron Jobs → verify jobs are configured
- Verify jobs target Production environment

---

## Step-by-Step Remediation Plan

### Phase 1: Critical Configuration Fixes (Immediate)

#### 1.1 Fix Query String Issue in `vercel.json`
**File:** `vercel.json`  
**Change:** Remove query string from cron path, create separate route

**Option A (Recommended):** Create separate route handler
- Create `src/app/api/cron/collect-events-deep/route.ts`
- Move deep collection logic there
- Update `vercel.json` to use `/api/cron/collect-events-deep`

**Option B:** Use header-based routing
- Keep single handler, check for custom header `x-collection-type: deep`
- Update `vercel.json` to set header (if supported)

**Lines to Change:**
- `vercel.json:9` - Change path from `/api/cron/collect-events?type=deep` to `/api/cron/collect-events-deep`

#### 1.2 Add Explicit Runtime Declaration
**File:** `src/app/api/cron/precompute-intelligence/route.ts`  
**Line:** Add after line 8  
**Change:** Add `export const runtime = "nodejs";` to match collect-events handler

```typescript
export const dynamic = 'force-dynamic';
export const runtime = "nodejs";  // Add this line
import { NextRequest, NextResponse } from 'next/server';
```

#### 1.3 Add Cache-Control Headers
**Files:**
- `src/app/api/cron/collect-events/route.ts`
- `src/app/api/cron/precompute-intelligence/route.ts`

**Change:** Add headers to all responses:
```typescript
return NextResponse.json(result, {
  headers: {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
});
```

**Lines to Change:**
- `collect-events/route.ts:162` - Add headers to success response
- `collect-events/route.ts:172` - Add headers to error response
- `precompute-intelligence/route.ts:62` - Add headers to success response
- `precompute-intelligence/route.ts:76` - Add headers to error response

#### 1.4 Add Explicit Runtime Declaration
**File:** `src/app/api/cron/precompute-intelligence/route.ts`  
**Line:** Add after line 8  
**Change:** Add `export const runtime = "nodejs";`

### Phase 2: Observability Improvements

#### 2.1 Implement Structured Logging
**Files:** Both cron route handlers

**Changes:**
1. Generate request ID at handler entry (UUID v4)
2. Log structured entry log with job name, request ID, timestamp
3. Log structured exit log with duration, result counts
4. Log structured error log on exceptions

**Implementation:**
```typescript
import { randomUUID } from 'crypto';

const requestId = randomUUID();
const tsStart = Date.now();

console.log(JSON.stringify({
  job: 'collect-events',
  request_id: requestId,
  ts_start: new Date().toISOString(),
  action: 'start'
}));

// ... execution ...

const durationMs = Date.now() - tsStart;
console.log(JSON.stringify({
  job: 'collect-events',
  request_id: requestId,
  ts_end: new Date().toISOString(),
  duration_ms: durationMs,
  result_meta: {
    totalJobs: results.length,
    successfulJobs: successCount,
    totalEventsCollected: totalEvents
  },
  action: 'complete'
}));
```

#### 2.2 Add Error Context Logging
**Files:** Both cron route handlers

**Change:** Wrap errors in structured format:
```typescript
catch (error: any) {
  const errorMeta = {
    error_class: error.constructor.name,
    error_message: error.message,
    stack: error.stack,
    context: { /* relevant context */ }
  };
  
  console.error(JSON.stringify({
    job: 'collect-events',
    request_id: requestId,
    ts_end: new Date().toISOString(),
    duration_ms: Date.now() - tsStart,
    error_meta: errorMeta,
    action: 'error'
  }));
  
  // ... return error response ...
}
```

### Phase 3: Timeout Mitigation

#### 3.1 Implement Chunking for collect-events
**File:** `src/app/api/cron/collect-events/route.ts`

**Strategy:**
- Process industries/countries in smaller batches
- Return early if approaching timeout
- Track progress for resume capability

**Changes:**
- Add timeout check before each iteration (line 70-120)
- Reduce batch sizes (e.g., process 4 jobs at a time)
- Add progress tracking in database

#### 3.2 Reduce Batch Size for precompute-intelligence
**File:** `src/app/api/cron/precompute-intelligence/route.ts`

**Change:** Reduce limit from 20 to 10 items per run (line 57)
- Reduces execution time from 5-10 min to 2.5-5 min
- Still processes queue, just in smaller chunks

#### 3.3 Add Timeout Wrapper
**Files:** Both handlers

**Change:** Wrap execution in timeout promise:
```typescript
const TIMEOUT_MS = 50 * 1000; // 50 seconds (under 60s Pro limit)

const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Job timeout')), TIMEOUT_MS);
});

try {
  const result = await Promise.race([
    runEventCollection(collectionType),
    timeoutPromise
  ]);
  // ... handle result ...
} catch (error) {
  // ... handle timeout ...
}
```

### Phase 4: Safety & Idempotency

#### 4.1 Add Job-Level Lock for collect-events
**Strategy:** Use database table to track running jobs

**Implementation:**
- Create `cron_executions` table with columns: `job_name`, `status`, `started_at`, `completed_at`
- Check for running job before starting
- Update status on start/complete

#### 4.2 Add Watermark Tracking
**Strategy:** Store last successful run timestamp

**Implementation:**
- Add `last_successful_run` column to `cron_executions` table
- Update on successful completion
- Log in response for monitoring

### Phase 5: Middleware Optimization

#### 5.1 Exclude Cron Routes from Middleware
**File:** `src/middleware.ts`

**Change:** Add early return for cron routes:
```typescript
const pathname = req.nextUrl.pathname;

// Early return for cron routes (skip auth checks)
if (pathname.startsWith('/api/cron/')) {
  return res;
}

// ... rest of middleware ...
```

**OR** update matcher:
```typescript
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron).*)"],
};
```

---

## Post-Fix Verification Runbook

### Immediate Verification (Within 1 Hour)

1. **Manual Trigger Test**
   - Execute all three endpoints via curl with `x-vercel-cron: 1` header
   - Verify 200 responses with JSON bodies
   - Check response headers include `Cache-Control: no-store`
   - Verify logs show structured entries

2. **Vercel Dashboard Check**
   - Navigate to Vercel → Project → Cron Jobs
   - Verify all 3 jobs show as "Active"
   - Verify schedules match `vercel.json`
   - Verify environment is "Production"

3. **Environment Variables Check**
   - Navigate to Vercel → Settings → Environment Variables
   - Verify all required variables are set for Production
   - Test with `vercel env pull` locally to verify

### Short-Term Monitoring (24-48 Hours)

1. **Scheduled Execution Verification**
   - Monitor Vercel logs at scheduled times:
     - 2 AM UTC daily (collect-events)
     - 3 AM UTC Sunday (collect-events-deep)
     - Every 6 hours (precompute-intelligence)
   - Verify structured log entries appear
   - Verify no timeout errors

2. **Data Verification**
   - Check `collected_events` table for new rows after collect-events runs
   - Check `intelligence_queue` table for status updates after precompute-intelligence runs
   - Verify `event_intelligence` table has new entries

3. **Performance Metrics**
   - Review execution duration from logs
   - Verify all jobs complete under timeout limits
   - Check for any error rates

### Success Criteria

✅ **Cron jobs are "working" when:**
1. Scheduled runs appear in Vercel logs at expected UTC schedule times
2. Logs include structured entries with:
   - `job` name
   - `request_id` (UUID)
   - `ts_start` and `ts_end`
   - `duration_ms`
   - `result_meta` with counts
3. Errors (if any) trigger structured log lines with `error_meta`
4. Manual curl runs reproduce the same behavior
5. Data is persisted (new rows in database tables)
6. No timeout errors in logs
7. Execution duration is under runtime limits

### Failure Indicators

❌ **If cron jobs are still not working:**
1. No logs at scheduled times → Configuration issue (re-check vercel.json, Vercel dashboard)
2. 401 errors → Authentication issue (check CRON_SECRET, x-vercel-cron header)
3. Timeout errors → Runtime limit issue (reduce batch sizes, implement chunking)
4. 500 errors → Code/logic issue (check error logs, verify env vars)
5. Logs appear but no data → Database/permission issue (check Supabase connection, RLS policies)

---

## File Reference Summary

### Files Requiring Changes

1. **`vercel.json`** (Line 9)
   - Remove query string from cron path
   - Add separate route or use header-based routing

2. **`src/app/api/cron/collect-events/route.ts`**
   - Line 162: Add Cache-Control headers
   - Line 172: Add Cache-Control headers
   - Line 40: Add structured logging
   - Line 126: Add structured logging
   - Line 70-120: Add timeout checks, chunking

3. **`src/app/api/cron/precompute-intelligence/route.ts`**
   - After line 8: Add `export const runtime = "nodejs";`
   - Line 62: Add Cache-Control headers
   - Line 76: Add Cache-Control headers
   - Line 46: Add structured logging
   - Line 57: Reduce batch size from 20 to 10

4. **`src/middleware.ts`** (Optional)
   - Line 67: Add early return for `/api/cron/*` paths
   - OR Line 101: Update matcher to exclude cron routes

5. **New File: `src/app/api/cron/collect-events-deep/route.ts`** (If using Option A)
   - Create new route handler for deep collection
   - Copy logic from collect-events, hardcode `collectionType = 'deep'`

---

## Additional Recommendations

1. **Consider Vercel Pro Plan** if on Hobby (increases timeout from 10s to 60s)
2. **Implement job queue system** (e.g., BullMQ, Inngest) for long-running tasks
3. **Add monitoring/alerting** (e.g., Sentry, Datadog) for cron job failures
4. **Create admin dashboard** to view cron execution history and status
5. **Add health check endpoint** (`/api/cron/health`) to verify cron system status
6. **Document cron schedules** in README for team visibility

---

**End of Report**

