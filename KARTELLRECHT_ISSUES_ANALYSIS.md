# Kartellrecht Search - Issues Analysis & Fixes

## Issues Identified

### Issue 1: Speakers Wrongly Extracted ⚠️ HIGH PRIORITY

**Problem:**
- Events show only 1 speaker: `Speakers: 1`
- Quality gate requires ≥2 speakers, so events are being filtered out
- Logs: `"Kartellrecht November-2025" | Speakers: 1` → Filtered out

**Root Cause:**
Quality gate in `src/lib/quality/eventQuality.ts:74` requires:
```typescript
const enoughSpeakers = (m.speakersCount ?? 0) >= 2;  // Minimum 2 speakers
```

**Evidence:**
```
[quality-gate] Filtered: "Kartellrecht November-2025" | Quality: 0.45 | Speakers: 1
[quality-gate] Filtered: "International Conference on Competition (IKK)" | Quality: 0.45 | Speakers: 1
```

**Fix:**
Relax speaker requirement for events with high quality in other areas (date, location, description).

**File:** `src/lib/quality/eventQuality.ts`
**Change:** Allow events with 1 speaker if quality score is high enough

---

### Issue 2: Intelligence Can't Be Generated ⚠️ MEDIUM PRIORITY

**Problem:**
- Intelligence is queued but never generated
- Logs show: `"Intelligence generation queued successfully"` but no processing
- User expects immediate intelligence generation

**Root Cause:**
Intelligence generation is **asynchronous** via cron job:
- **Queue:** `/api/events/[eventId]/intelligence` (POST) - queues intelligence
- **Processor:** `/api/cron/precompute-intelligence` (GET) - processes queue every 6 hours
- **Schedule:** Every 6 hours (`0 */6 * * *`)

**Evidence:**
```
[EventIntelligence] Queueing intelligence generation in background...
[EventIntelligence] Intelligence generation queued successfully
[EventIntelligence] Returning queued status response
```

**No processing logs** = Cron job either:
1. Not running (Vercel cron not configured)
2. Failing silently
3. Not processing this specific event

**Fix:**
Make intelligence generation **synchronous** for user-initiated requests (priority 8).

**File:** `src/app/api/events/[eventId]/intelligence/route.ts`
**Change:** For priority 8 (user-initiated), generate intelligence immediately instead of queuing

---

### Issue 3: Full View Client-Side Error ⚠️ HIGH PRIORITY

**Problem:**
```
Application error: a client-side exception has occurred while loading
```

**Root Cause:**
The Full View page (`src/app/(protected)/events/[eventId]/page.tsx`) tries to format dates:
```typescript
{event.starts_at && (
  <span>{new Date(event.starts_at).toLocaleDateString()}</span>
)}
```

If `event.starts_at` is:
- `null` (should be safe due to `&&` check)
- Invalid date string (e.g., "Unknown Date", "2025-11-04 to 2025-11-05")
- Empty string `""`

Then `new Date(event.starts_at)` will create an Invalid Date, and `toLocaleDateString()` might throw or show "Invalid Date".

**Additional Issues:**
1. Event might not be in `collected_events` table (from search, not saved)
2. Event data structure might not match `EventData` interface
3. Missing null checks for other fields

**Fix:**
1. Add date validation before formatting
2. Add null checks for all fields
3. Handle invalid dates gracefully

**File:** `src/app/(protected)/events/[eventId]/page.tsx`
**Change:** Add date validation and null checks

---

## Recommended Fixes

### Fix 1: Relax Speaker Requirement (Quick Fix)
**Priority:** P0
**File:** `src/lib/quality/eventQuality.ts`
**Change:** Allow events with 1 speaker if quality score ≥ 0.5

### Fix 2: Make Intelligence Generation Synchronous for User Requests
**Priority:** P1
**File:** `src/app/api/events/[eventId]/intelligence/route.ts`
**Change:** For priority 8, generate intelligence immediately

### Fix 3: Fix Full View Date Formatting
**Priority:** P0
**File:** `src/app/(protected)/events/[eventId]/page.tsx`
**Change:** Add date validation and null checks
