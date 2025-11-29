# Upstash Redis + BullMQ Setup Guide

**Date:** 2025-02-26  
**Status:** Configuration Guide

---

## Current Situation

You have:
- ✅ `UPSTASH_REDIS_REST_URL` - For REST API operations
- ✅ `UPSTASH_REDIS_REST_TOKEN` - For REST API authentication

**But BullMQ needs:**
- ✅ TCP connection (not REST API)
- ✅ TCP password (different from REST token)

---

## Why BullMQ Needs TCP

BullMQ uses `ioredis` which requires a **TCP connection** to Redis. The REST API is HTTP-based and won't work with BullMQ.

**Good news:** Upstash provides **both** REST and TCP endpoints for the same database!

---

## How to Get TCP Credentials

### Step 1: Go to Upstash Dashboard

1. Log in to https://console.upstash.com
2. Select your Redis database
3. Go to the **"Details"** tab

### Step 2: Find TCP Connection Details

You'll see two sections:
- **REST API** (what you already have)
- **Redis CLI** or **TCP** (what you need)

### Step 3: Copy TCP Credentials

Look for:
- **Endpoint** (hostname, e.g., `xxx-xxx.upstash.io`)
- **Port** (usually `6379` or `6380`)
- **Password** (this is different from REST token!)

**Example:**
```
Endpoint: xxx-xxx.upstash.io
Port: 6379
Password: AXXXaXXXbXXXcXXXdXXXeXXXfXXXgXXXhXXX
```

---

## Add Environment Variables

Add these to **Vercel Environment Variables**:

```bash
# You already have these:
UPSTASH_REDIS_REST_URL=https://xxx-xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-rest-token

# Add these new ones for BullMQ:
UPSTASH_REDIS_TCP_PASSWORD=your-tcp-password
UPSTASH_REDIS_TCP_PORT=6379  # Optional, defaults to 6379
```

---

## Alternative: Use REDIS_URL ✅ (You're using this!)

Instead of separate variables, you can use a single `REDIS_URL`:

```bash
REDIS_URL=rediss://default:your-tcp-password@xxx-xxx.upstash.io:6379
```

**Important:** 
- ✅ Use `rediss://` (with double 's') for TLS/SSL
- ✅ Upstash requires TLS for TCP connections
- ✅ The code now automatically detects TLS from the URL protocol

**Your setup:**
- ✅ `REDIS_URL` is set with TCP connection
- ✅ Code will automatically detect `rediss://` and enable TLS
- ✅ BullMQ queue should work now!

---

## Quick Setup Steps

1. **Get TCP password from Upstash dashboard**
2. **Add to Vercel:**
   - Go to Vercel Dashboard → Project → Settings → Environment Variables
   - Add `UPSTASH_REDIS_TCP_PASSWORD=your-password`
   - (Optional) Add `UPSTASH_REDIS_TCP_PORT=6379` if different
3. **Redeploy** your application
4. **Verify** in logs:
   ```
   [Job Queue] Using Upstash TCP connection for BullMQ
   [Job Queue] Queued task abc123 for agent xyz
   ```

---

## How It Works

### Current Code Behavior

1. **Checks for Upstash REST URL** ✅
2. **Extracts hostname** from REST URL
3. **Uses TCP password** from `UPSTASH_REDIS_TCP_PASSWORD`
4. **Connects via TCP** with TLS

### Connection Flow

```
1. Detect UPSTASH_REDIS_REST_URL
   ↓
2. Extract hostname (xxx-xxx.upstash.io)
   ↓
3. Use UPSTASH_REDIS_TCP_PASSWORD
   ↓
4. Connect via TCP with TLS
   ↓
5. BullMQ queue works! ✅
```

---

## Verification

### After Adding TCP Password

**Check logs for:**
```
[Job Queue] Using Upstash TCP connection for BullMQ
[Job Queue] Queued task abc123 for agent xyz with priority medium
```

**Should NOT see:**
- ❌ `ECONNREFUSED` errors
- ❌ `Redis not configured` messages
- ❌ Connection errors

---

## Troubleshooting

### Still Getting Connection Errors?

1. **Verify TCP password:**
   - Make sure it's the TCP password, not REST token
   - Check for extra spaces or quotes

2. **Check TLS:**
   - Upstash requires TLS
   - Code automatically enables TLS

3. **Verify Port:**
   - Default is 6379
   - Some Upstash instances use 6380
   - Add `UPSTASH_REDIS_TCP_PORT=6380` if needed

4. **Test Connection:**
   - Try connecting with Redis CLI:
   ```bash
   redis-cli -h xxx-xxx.upstash.io -p 6379 -a your-tcp-password --tls
   ```

---

## Summary

**What you need:**
- ✅ `UPSTASH_REDIS_REST_URL` (already have)
- ✅ `UPSTASH_REDIS_REST_TOKEN` (already have)
- ⚠️ `UPSTASH_REDIS_TCP_PASSWORD` (need to add)

**Where to get it:**
- Upstash Dashboard → Your Database → Details → TCP section

**After adding:**
- BullMQ queue will work
- Tasks will use queue (retry, priority, etc.)
- No more connection errors

---

**Once you add the TCP password, the job queue will automatically use it!** 🚀

