# Search Performance Analysis Report
**Date:** 2025-11-19  
**Query:** "compliance" in Germany (DE), Nov 19 - Dec 3, 2025  
**Total Duration:** ~55 seconds

---

## Executive Summary

The search pipeline completed successfully but with **significant performance and quality issues**:
- ⚠️ **Only 2 events returned** (below minimum threshold of 3)
- ⚠️ **55-second total latency** (target: <10s for good UX)
- ⚠️ **Multiple Firecrawl timeouts** (success rate: -33.3%)
- ⚠️ **Google CSE returning 0 results** (both attempts)
- ✅ **Database fallback working** (10 items found)
- ✅ **Caching effective** after initial miss

---

## Performance Breakdown

### Phase 1: Discovery (40.2 seconds)
- **Duration:** 40,190ms
- **Tasks:** 13 parallel queries
- **Concurrency:** Started at 12, increased to 5
- **Results:** 14 unique URLs discovered
- **Bottleneck:** Firecrawl timeouts causing fallbacks

### Phase 2: Prioritization (13.4 seconds)
- **Duration:** 13,466ms (Gemini API call)
- **Model:** gemini-2.5-flash
- **Input:** 4 URLs
- **Output:** 3 prioritized URLs
- **Issue:** Very slow for 4 URLs (should be <3s)

### Phase 3: Extraction (0.5 seconds)
- **Duration:** 510ms
- **URLs:** 3 events
- **Cache hits:** 3/3 (100% cache hit rate)
- **Speakers extracted:** 7, 8, 3 speakers per event
- **Status:** ✅ Excellent performance

### Phase 4: Filtering & Quality Gate
- **Before filtering:** 3 events
- **After content filter:** 2 events (1 filtered out)
- **After quality gate:** 2 events (dates cleared but kept)
- **Final result:** 2 events (below minimum of 3)

---

## Critical Issues

### 1. 🔴 Firecrawl Reliability (HIGH PRIORITY)
**Problem:**
- Multiple 15-second timeouts
- Success rate: **-33.3%** (4 failed, 3 total requests)
- Causing fallback to database every time

**Evidence:**
```
[error] [unified-firecrawl] Request failed: Error: Operation timeout after 15000ms
[info] [optimized-orchestrator] Performance metrics: {
  firecrawl: {
    requests_total: 3,
    requests_failed: 4,
    success_rate: '-33.3%'
  }
}
```

**Impact:**
- Slows down discovery phase significantly
- Forces reliance on database fallback (less fresh data)
- Reduces result quality

**Recommendations:**
1. **Increase timeout** from 15s to 30s for Firecrawl (they allow 45s in config)
2. **Implement exponential backoff** for retries (currently retrying immediately)
3. **Add circuit breaker** to skip Firecrawl after 3 consecutive failures
4. **Monitor Firecrawl API status** - may be experiencing outages

---

### 2. 🔴 Google CSE Returning Zero Results (MEDIUM PRIORITY)
**Problem:**
- Both CSE requests returned 0 URLs
- Query may be too complex or CSE quota/configuration issue

**Evidence:**
```
[info] [unified-cse] Response status: 200 OK
[info] [unified-cse] Extracted URLs: 0 []
```

**Query sent:**
```
"risk management" "e-discovery" "legal tech" "legal technology" "data protection" 
"financial regulation" "banking compliance" "corporate governance" legal compliance 
regulatory governance audit investigation GDPR privacy cybersecurity whistleblowing
```

**Recommendations:**
1. **Simplify CSE query** - remove quoted phrases, use simpler keywords
2. **Check CSE quota** - may have hit daily limit
3. **Verify CSE configuration** - ensure custom search engine is properly configured
4. **Add fallback query** - if complex query fails, try simpler version

---

### 3. 🟡 Overly Aggressive Content Filtering (MEDIUM PRIORITY)
**Problem:**
- "GC Summit Germany 2025" filtered out for not matching keyword "compliance"
- This is clearly a legal/compliance event (GC = General Counsel)

**Evidence:**
```
[info] [optimized-orchestrator] ✗ Event filtered out (no user keyword match): "GC Summit Germany 2025"
```

**Impact:**
- Lost a relevant event (had 7 speakers, good quality)
- Reduced final result count below minimum threshold

**Recommendations:**
1. **Expand keyword matching** - recognize abbreviations (GC = General Counsel)
2. **Context-aware filtering** - use industry taxonomy to match related terms
3. **Fuzzy matching** - "GC Summit" in legal context should match "compliance"
4. **Lower filtering threshold** - if results are low, be less aggressive

---

### 4. 🟡 Date Validation Too Strict (LOW PRIORITY)
**Problem:**
- Events with dates >30 days from search window are rejected
- Some events might be valid future events worth showing

**Evidence:**
```
[info] [quality-gate] Date 2025-10-06 to 2025-10-08 is >30 days from window 2025-11-19..2025-12-03
[info] [quality-gate] Date 2026-10-06 to 2026-10-07 is >30 days from window 2025-11-19..2025-12-03
```

**Recommendations:**
1. **Show future events with warning badge** - "Outside search window"
2. **Increase tolerance** - allow events up to 60 days out
3. **Separate validation** - mark as "extraction error" but don't reject entirely

---

### 5. 🟡 Gemini Prioritization Too Slow (LOW PRIORITY)
**Problem:**
- 13.4 seconds to prioritize 4 URLs
- Should be <3 seconds for this volume

**Evidence:**
```
[info] [optimized-orchestrator] Gemini prioritization finish reason: STOP
[info] [optimized-orchestrator] Successfully prioritized URLs via Gemini: {
  responseTime: '13466ms',
  promptLength: 628
}
```

**Recommendations:**
1. **Use faster model** - gemini-2.5-flash-exp or gemini-1.5-flash
2. **Reduce prompt size** - 628 tokens is large for 4 URLs
3. **Skip prioritization for small sets** - if <5 URLs, just use Voyage scores
4. **Parallel processing** - prioritize in parallel if multiple batches

---

## Positive Observations

### ✅ Database Fallback Working
- Successfully returned 10 items when Firecrawl/CSE failed
- Ensures search always returns results

### ✅ Caching Effective
- 100% cache hit rate for extraction (3/3 events)
- Cache hits for discovery queries after initial miss
- Significantly speeds up subsequent searches

### ✅ Voyage Reranking Working
- Successfully ranked 14 URLs → 12 results
- Average score: 0.628 (reasonable quality)
- De-biased 7 aggregator results

### ✅ URL Filtering Working
- Successfully removed 8 non-event pages (roundup pages)
- Filtered 12 → 4 actual event URLs

### ✅ Speaker Extraction from Cache
- All 3 events had cached speaker data
- Fast extraction (510ms total)
- Good speaker counts (7, 8, 3 speakers)

---

## Recommendations Priority

### Immediate (This Week)
1. **Fix Firecrawl timeouts**
   - Increase timeout to 30s
   - Add circuit breaker
   - Implement exponential backoff

2. **Fix Google CSE zero results**
   - Simplify queries
   - Check quota/configuration
   - Add fallback queries

3. **Improve content filtering**
   - Add abbreviation recognition (GC = General Counsel)
   - Use industry taxonomy for context-aware matching
   - Lower threshold when results are low

### Short-term (This Sprint)
4. **Optimize Gemini prioritization**
   - Use faster model for small batches
   - Skip prioritization for <5 URLs
   - Reduce prompt size

5. **Improve date validation**
   - Show future events with warning
   - Increase tolerance window
   - Better error handling

### Long-term (Next Sprint)
6. **Add result quality monitoring**
   - Alert when results < minimum threshold
   - Track success rates per provider
   - Monitor average search latency

7. **Implement adaptive search strategy**
   - If Firecrawl fails, increase database weight
   - If results low, relax filtering
   - If latency high, skip non-critical phases

---

## Metrics Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total Duration | 55s | <10s | 🔴 Poor |
| Events Returned | 2 | ≥3 | 🔴 Below Minimum |
| Firecrawl Success Rate | -33.3% | >80% | 🔴 Critical |
| CSE Results | 0 | >0 | 🔴 Failed |
| Extraction Cache Hit | 100% | >70% | ✅ Excellent |
| Discovery Duration | 40s | <15s | 🔴 Poor |
| Prioritization Duration | 13s | <3s | 🟡 Slow |
| Extraction Duration | 0.5s | <2s | ✅ Excellent |

---

## Next Steps

1. **Immediate:** Investigate Firecrawl API status and timeout configuration
2. **Immediate:** Check Google CSE quota and query complexity
3. **This Week:** Implement content filtering improvements
4. **This Sprint:** Optimize Gemini prioritization
5. **Monitor:** Set up alerts for low result counts and high latency

---

**Report Generated:** 2025-11-19  
**Analysis Based On:** Single search query log  
**Recommendation:** Focus on Firecrawl reliability and CSE configuration as highest priority


