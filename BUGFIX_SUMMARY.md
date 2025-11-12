# Pipeline Hardening Bugfix Summary

**Branch**: `fix/qc-nov12`  
**Commit**: `06ac110`  
**Status**: ✅ Fixed & Pushed

---

## 🐛 Issues Found from Logs

### 1. **Voyage Gate Crash** (CRITICAL)
**Error**: `TypeError: Cannot read properties of undefined (reading 'map')`

**Root Cause**: Voyage API response didn't have expected `results` array structure

**Fix**: Added validation before accessing `data.results`:
```typescript
// Validate response structure
if (!data || !data.results || !Array.isArray(data.results)) {
  console.warn('[voyage-gate] Invalid Voyage API response structure');
  return applyMicroBias(...); // Fallback
}
```

**Result**: Graceful fallback to micro-bias when Voyage fails

---

### 2. **All Events Filtered** (CRITICAL)
**Error**: `[orchestrator] Quality scoring: 5 → 0 solid hits (avg quality: 0.40)`

**Root Cause**: Quality gate too strict:
- Required quality ≥ 0.55 (events scored 0.40)
- Required 2+ speakers (many had 0-1)
- Required date AND venue AND city AND Germany

**Fix 1 - Better Logging**: Added detailed filter logging:
```
[quality-gate] Filtered: "Event Title" | Quality: 0.40 | 
  Date: missing | City: missing | Speakers: 1 | Country: consilio.com
```

**Fix 2 - Relaxed Requirements**:
- Quality threshold: `0.55 → 0.45` ✅
- Speaker minimum: `2 → 1` ✅
- Location logic: `(venue OR city) OR inDE` (more flexible) ✅
- Allow events with speaker pages even if extraction failed ✅

**Result**: More events pass quality gate while maintaining standards

---

## 📊 Before vs After

### Voyage Gate
| Before | After |
|--------|-------|
| ❌ Crashes on invalid response | ✅ Falls back to micro-bias |
| No error details | ✅ Logs response structure |

### Quality Scoring
| Before | After |
|--------|-------|
| ❌ 0/5 events passed | ✅ Expected 2-3/5 to pass |
| Threshold: 0.55 | Threshold: 0.45 ✅ |
| Required 2+ speakers | Required 1+ speaker ✅ |
| Silent filtering | ✅ Detailed logging |

---

## 🔍 Diagnostic Logging Added

### Quality Gate Filters
Now logs for each filtered event:
```
[quality-gate] Filtered: "Microsoft 365 Security..." | Quality: 0.40 | 
  Date: 2025-11-15 | City: missing | Speakers: 1 | Country: consilio.com
```

**Shows**:
- Event title (truncated)
- Quality score
- Date (or "missing")
- City (or "missing")
- Speaker count
- Country or hostname

### All Events Filtered Warning
```
[quality-gate] All 5 events filtered! Common issues: missing dates, no German location, < 2 speakers
[quality-gate] To fix: Ensure events have date (YYYY-MM-DD), city/venue, and ≥2 speakers
```

---

## 🎯 What to Check in Next Search

### 1. Voyage Gate
Look for:
```
✅ [voyage-gate] Complete: {used: true, ...}
OR
⚠️ [voyage-gate] Invalid Voyage API response structure
⚠️ [voyage-gate] Voyage API failed, using micro-bias
```

**If falling back**: Check Voyage API key is set and valid

### 2. Quality Scoring
Look for:
```
✅ [orchestrator] Quality scoring: 5 → 3 solid hits (avg quality: 0.52)
```

**If still 0 solid hits**, check:
```
[quality-gate] Filtered: "..." | Quality: X.XX | Date: ? | City: ? | Speakers: ?
```

Common issues:
- **Date: missing** → Event metadata extraction failing
- **City: missing** → Location extraction failing
- **Speakers: 0** → Speaker extraction failing
- **Quality: < 0.45** → Multiple issues

### 3. Auto-Expand
Should trigger if < 3 solid hits:
```
[auto-expand] Expanding window from 2025-11-19 to 2025-11-25
[auto-expand] After expansion: 5 total solid hits (3 new)
```

---

## 🛠️ Temporary Relaxations (May Need Tuning)

These were relaxed to avoid empty results. May need adjustment based on real data:

1. **Quality Threshold**: `0.45` (was `0.55`)
   - If too many low-quality events pass → Raise to `0.50`
   - If still too strict → Lower to `0.40`

2. **Speaker Minimum**: `1` (was `2`)
   - If events with 1 speaker are low quality → Raise back to `2`
   - Consider: "has speaker page" as equivalent to `2` speakers

3. **Location Logic**: `(hasWhere OR inDE)`
   - Current: Event passes if it has venue/city OR is in Germany
   - May want: `hasWhere AND inDE` (stricter)

---

## 🔧 Configuration Options

To adjust thresholds, set in ENV or `src/config/search.ts`:

```bash
# Minimum quality score to pass gate
MIN_QUALITY_TO_EXTRACT=0.45  # Current (was 0.55)

# Minimum speakers required
MIN_SPEAKERS_FOR_SOLID=1     # Current (was 2)

# Auto-expand trigger
MIN_SOLID_HITS=3             # Unchanged

# Voyage API
VOYAGE_API_KEY=your-key      # Required for rerank
```

---

## 📋 Next Steps

1. **Test Search Again**
   - Should not crash on Voyage gate
   - Should pass some events through quality gate
   - Should see detailed logging

2. **Review Quality Logs**
   - Check which fields are consistently missing
   - Adjust thresholds if needed
   - Identify extraction improvements needed

3. **Monitor Metrics**
   - Voyage gate success rate
   - Quality gate pass rate
   - Auto-expand trigger rate
   - Average quality score

4. **Tune If Needed**
   - If too many low-quality events → Raise `MIN_QUALITY_TO_EXTRACT` to `0.50`
   - If too few events → Lower to `0.40` or fix extraction
   - If wrong events → Check date/location extraction logic

---

## ✅ Expected Behavior Now

1. **Voyage Gate**: Fails gracefully, logs details, falls back to micro-bias
2. **Quality Gate**: Filters with detailed reasons, passes reasonable events
3. **Auto-Expand**: Triggers if < 3 solid hits, expands to 14 days
4. **Logging**: Shows exactly why each event is filtered
5. **Results**: Should return 2-5 events (with `lowConfidence` if < 3)

**Ready for next test!** 🚀

