# Redis Auto-Connect Fix

**Date:** 2025-01-20  
**Issue:** Redis was showing as "not available" even after Upstash credentials were configured  
**Status:** ✅ Fixed

---

## Problem

The Redis client was configured with `lazyConnect: true`, meaning it would only connect when explicitly told to. However, the connection was never being initiated, so `isAvailable()` always returned `false`, even when Upstash credentials were properly configured.

**Evidence from logs:**
```
[rate-limit] Redis not available for rate_limit:firecrawl:minute:29394130
[rate-limit] Redis not available for rate_limit:firecrawl:hour:489902
```

---

## Solution

Implemented **lazy auto-connection** on first use:

1. **Added `ensureConnected()` method** to Redis client
   - Automatically attempts connection when credentials are available
   - Only connects once (uses connection promise to prevent duplicate connections)
   - Non-blocking if connection fails

2. **Updated all Redis operations** to auto-connect:
   - `get()`, `set()`, `del()`, `exists()`, `mget()`, `mset()`, `keys()`, `ttl()`, `incr()`, `expire()`
   - Each operation now calls `ensureConnected()` before checking availability

3. **Updated RateLimitService** to use auto-connect:
   - Removed early `isAvailable()` checks that prevented connection attempts
   - Operations now attempt connection first, then check if successful
   - Graceful fallback if connection fails

---

## Changes Made

### `src/lib/cache/redis-client.ts`
- Added `ensureConnected()` private method
- Updated all async operations to call `ensureConnected()` first
- Connection now happens automatically on first Redis operation

### `src/lib/services/rate-limit-service.ts`
- Removed early `isAvailable()` checks that blocked connection attempts
- Operations now attempt to use Redis (which triggers auto-connect)
- Check availability after operation attempt for better error handling

---

## How It Works Now

1. **First Redis operation** (e.g., `redis.get(key)`)
   - Calls `ensureConnected()`
   - Checks if credentials are available (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`)
   - Attempts connection via Upstash REST API
   - Falls back to Redis TCP if Upstash fails
   - Logs connection status

2. **Subsequent operations**
   - Skip connection attempt (already connected)
   - Use existing connection

3. **If connection fails**
   - Operations return `null` or `false`
   - System gracefully falls back to in-memory rate limiting
   - No errors thrown, system continues to work

---

## Expected Behavior After Fix

### ✅ Success Case
```
[Redis] ✅ Connected via Upstash REST API
[rate-limit] Using Redis for distributed rate limiting
```

### ⚠️ Fallback Case (if credentials missing/invalid)
```
[Redis] ⚠️ Redis configuration not found, caching will use fallback
[rate-limit] Redis not available, using in-memory fallback
```

---

## Testing

After deployment, check logs for:
1. **Connection success:**
   - `[Redis] ✅ Connected via Upstash REST API`
   - No more `Redis not available` warnings

2. **Rate limiting working:**
   - Rate limit keys being created in Redis
   - Distributed rate limiting across instances

3. **If still seeing warnings:**
   - Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set in Vercel
   - Check that values are correct (no extra spaces, correct format)
   - Redeploy after setting environment variables

---

## Environment Variables Required

```bash
UPSTASH_REDIS_REST_URL=https://your-upstash-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

**Note:** These should be set in Vercel Dashboard → Project → Settings → Environment Variables

---

## Benefits

1. **Automatic connection** - No manual initialization needed
2. **Serverless-friendly** - Works with Vercel's cold starts
3. **Graceful degradation** - Falls back if Redis unavailable
4. **Better error handling** - Attempts connection before giving up
5. **No breaking changes** - Existing code continues to work

---

**Status:** Ready for deployment. Redis will auto-connect on first use when credentials are available.


