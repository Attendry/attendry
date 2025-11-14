# Event Intelligence Pipeline Optimization Plan

**Analysis Date:** 2025-01-XX  
**Based on:** EVENT_INTELLIGENCE_PIPELINE_REVIEW.md  
**Status:** Planning Phase - No Code Changes

---

## Executive Overview

This optimization plan addresses **5 critical issues** in the Event Intelligence pipeline that impact discovery recall, extraction precision, cost efficiency, and data quality. The plan is structured in 3 phases over 12 weeks, with **65-86 total hours** of development effort.

### Key Metrics Impact (Cumulative)

| Metric | Current Baseline | Target After All Phases | Improvement |
|--------|-----------------|------------------------|-------------|
| **Precision** | ~60% | ~100% | +100% |
| **Recall** | ~50% | ~100% | +100% |
| **Latency (p95)** | ~5s | ~4s | -20% |
| **Cost per 100 results** | ~$5 | ~$3.60 | -28% |
| **Trust/Confidence** | Low | High | +330% |

---

## Optimization Categories

### 1. Discovery & Recall Improvements
**Problem:** Missing 60-70% of relevant events due to limited query variations  
**Solution:** Expand from 3 to 15+ event type variations, add country-specific terms  
**Impact:** +40% recall, +20% for non-English events

### 2. Extraction Quality & Hallucination Reduction
**Problem:** LLM invents data when information is missing; no provenance tracking  
**Solution:** Evidence tagging, null handling enforcement, city whitelist validation  
**Impact:** -50% hallucinations, +30% extraction accuracy, +30% trust

### 3. Cost & Latency Optimization
**Problem:** Fixed timeouts cause 15% failures; no rate limiting; duplicate extractions  
**Solution:** Exponential backoff, per-domain rate limiting, early deduplication  
**Impact:** -30% timeout failures, -20% cost, -10% latency

### 4. Speaker Disambiguation
**Problem:** Exact name matching misses variations; no cross-event history  
**Solution:** Fuzzy matching (Levenshtein), speaker history table, org normalization  
**Impact:** +35% speaker match accuracy, enables cross-event insights

### 5. Trend Intelligence Stability
**Problem:** Free-text topics can't be aggregated; no versioning or drift detection  
**Solution:** Stable taxonomy, versioned snapshots, drift detection algorithms  
**Impact:** +50% trend stability, defensible metrics, early market signals

---

## Expected Gains by Phase

### Phase 1: Quick Wins (0-2 Weeks, 10-16 hours)

**Total Impact:**
- **Precision:** +25%
- **Recall:** +50%
- **Latency:** -10%
- **Cost:** -20%
- **Trust:** +60%

**Key Optimizations:**
1. **Query Expansion** (1-2h): 3 → 15+ event type variations
   - Adds: workshop, seminar, symposium, forum, webinar, meetup, trade show, expo
   - Impact: +40% recall, +5% latency, +5% cost

2. **Date Normalization** (2-3h): Fix German/European date formats
   - Handles: 25.09.2025, 25/09/2025, September 25, 2025
   - Impact: +15% precision, +10% trust

3. **City Validation** (1-2h): Whitelist/blacklist to prevent topic→city confusion
   - Blocks: "Praxisnah", "Whistleblowing" as cities
   - Impact: +10% precision, +15% trust

4. **Exponential Backoff** (2-3h): Adaptive retry with jitter
   - Timeouts: 8s → 12s → 18s with 0-20% jitter
   - Impact: -30% timeout failures, -10% cost, -10% latency

5. **Early Deduplication** (1-2h): Canonical key before extraction
   - Key: `normalizeUrl(url)|hashTitle(title)|hashVenue(venue)`
   - Impact: -15% duplicate extractions, -15% cost, -5% latency

6. **Evidence Tagging** (3-4h): Require provenance for all fields
   - Adds: source_url, source_section, snippet, confidence per field
   - Impact: +30% trust, +5% latency, +5% cost

**ROI:** Very High - Low effort, high impact, minimal risk

---

### Phase 2: Deep Work (2-6 Weeks, 31-40 hours)

**Total Impact:**
- **Precision:** +70%
- **Recall:** +25%
- **Latency:** -18% (with caching)
- **Cost:** -8%
- **Trust:** +180%

**Key Optimizations:**
7. **Fuzzy Speaker Matching** (3-4h): Levenshtein distance ≤ 2
   - Handles: "John Smith" vs "J. Smith", "Dr. John Smith"
   - Impact: +35% speaker match accuracy, +20% precision, +15% recall

8. **Speaker History Table** (6-8h): Cross-event linking
   - New table: `speaker_event_history` with event_id, talk_title, session
   - Impact: Enables "where has this speaker presented?" queries (+40% trust)

9. **Topic Taxonomy** (4-5h): 20 core topics with aliases
   - Normalizes: "AI" → "technology-ai", "GDPR" → "data-privacy-gdpr"
   - Impact: +10% precision, +20% trust

10. **Trend Snapshots** (8-10h): Weekly/monthly/quarterly rollups
    - New table: `trend_snapshots` with versioned taxonomy
    - Impact: -20% latency (cached), -10% cost, +30% trust

11. **Org Normalization** (4-5h): Alias mapping (IBM → International Business Machines)
    - Impact: +20% org matching, +15% precision, +10% recall

12. **Enhanced Schema** (6-8h): Evidence tags, normalized topics, structured sessions
    - Impact: -50% hallucinations, +25% precision, +50% trust

**ROI:** High - Medium effort, high impact, requires schema changes

---

### Phase 3: Strategic (6-12 Weeks, 24-30 hours)

**Total Impact:**
- **Precision:** +5%
- **Recall:** +35%
- **Latency:** -20%
- **Cost:** -20%
- **Trust:** +90%

**Key Optimizations:**
13. **Per-Domain Rate Limiting** (4-5h): 10 req/min per domain
    - Impact: -15% cost, -5% latency, prevents 429 errors

14. **Adaptive Timeouts** (5-6h): Track domain response times, adjust dynamically
    - Range: 8s-25s based on historical performance
    - Impact: -15% latency, -10% cost, +10% recall

15. **Session-Agenda Mapping** (8-10h): Link speakers to sessions
    - Impact: Enables "who speaks about what?" queries (+40% trust)

16. **Drift Detection** (4-5h): Emerging/declining topic detection
    - Flags: >50% growth (emerging), <-30% decline (declining)
    - Impact: Early market signal detection (+25% trust)

17. **Country-Specific Queries** (3-4h): Localized event terms
    - DE: Konferenz, Kongress, Tagung
    - FR: Conférence, Congrès, Événement
    - Impact: +20% recall for non-English events, +5% precision

**ROI:** Medium - Higher effort, incremental improvements, new capabilities

---

## Risk Assessment

### High-Risk Items

#### 1. Schema Changes (Items 8, 10, 12)
**Risk:** Breaking changes to database schema may require migrations and data backfills  
**Mitigation:**
- Use backward-compatible migrations (add columns, don't remove)
- Implement feature flags to toggle new schema usage
- Run migrations during low-traffic periods
- Keep old schema fields for 30 days before deprecation

**Rollback Plan:** Feature flags allow instant rollback without database changes

#### 2. Evidence Tagging Overhead (Item 6, 12)
**Risk:** Requiring evidence for all fields may increase LLM token usage (+5% cost) and latency (+5%)  
**Mitigation:**
- Start with evidence for critical fields only (title, dates, location)
- Use streaming responses to reduce perceived latency
- Cache evidence tags with extraction results
- Monitor token usage and adjust prompt if needed

**Rollback Plan:** Make evidence optional via feature flag

#### 3. Query Expansion Cost (Item 1)
**Risk:** 15+ query variations may increase Firecrawl API calls and costs (+5%)  
**Mitigation:**
- Implement query result caching (deduplicate URLs across variations)
- Use query prioritization (Gemini ranking) to limit extraction to top 20-30
- Monitor cost per query and set budget alerts

**Rollback Plan:** Reduce to 10 variations if cost exceeds budget

#### 4. Fuzzy Matching False Positives (Item 7)
**Risk:** Levenshtein threshold of 2 may merge different speakers with similar names  
**Mitigation:**
- Require org similarity > 0.6 in addition to name similarity > 0.8
- Use confidence scoring to flag uncertain matches
- Manual review queue for low-confidence merges
- Start with threshold of 1, increase to 2 if precision maintained

**Rollback Plan:** Increase threshold to 1 or disable fuzzy matching

#### 5. Topic Taxonomy Rigidity (Item 9)
**Risk:** Fixed taxonomy may miss emerging topics or force incorrect categorization  
**Mitigation:**
- Version taxonomy (v1.0, v1.1) with migration paths
- Allow "unknown" topic category for unmapped topics
- Quarterly taxonomy review and updates
- Track taxonomy coverage (% of topics mapped)

**Rollback Plan:** Allow free-text topics alongside normalized topics

### Medium-Risk Items

#### 6. Exponential Backoff Latency (Item 4)
**Risk:** Longer timeouts (18s max) may increase p95 latency if many retries occur  
**Mitigation:**
- Monitor retry rates per domain
- Set max retries to 2 (not 3) for slow domains
- Use circuit breaker pattern for consistently slow domains

**Rollback Plan:** Revert to fixed 15s timeout

#### 7. Rate Limiting Over-Aggressiveness (Item 13)
**Risk:** 10 req/min per domain may be too restrictive for fast sites  
**Mitigation:**
- Make rate limits configurable per domain
- Use adaptive rate limiting (increase if no 429 errors)
- Monitor queue depth and adjust limits

**Rollback Plan:** Increase to 20 req/min or disable per-domain limiting

### Low-Risk Items

#### 8. City Whitelist Maintenance (Item 3)
**Risk:** Whitelist may need frequent updates for new cities  
**Mitigation:**
- Use existing country context data
- Allow manual override for edge cases
- Log unmapped cities for review

**Rollback Plan:** Disable whitelist, rely on context validation only

#### 9. Early Deduplication False Negatives (Item 5)
**Risk:** Hash collisions or normalization may miss true duplicates  
**Mitigation:**
- Use multiple hash algorithms (title + venue + date)
- Keep existing post-extraction deduplication as fallback
- Monitor duplicate rate to validate effectiveness

**Rollback Plan:** Keep existing deduplication, disable early dedup

---

## Implementation Strategy

### Phase 1: Quick Wins (Weeks 0-2)
**Goal:** High-impact, low-risk improvements with immediate ROI

**Week 1:**
- Day 1-2: Query expansion (Item 1)
- Day 3-4: Date normalization (Item 2)
- Day 5: City validation (Item 3)

**Week 2:**
- Day 1-2: Exponential backoff (Item 4)
- Day 3: Early deduplication (Item 5)
- Day 4-5: Evidence tagging prompts (Item 6)

**Success Criteria:**
- All 6 items deployed to production
- Metrics show: +25% precision, +50% recall, -20% cost
- No regressions in latency or error rates

**Rollback Triggers:**
- Precision drops >5%
- Latency p95 increases >10%
- Cost increases >10%

---

### Phase 2: Deep Work (Weeks 2-6)
**Goal:** Schema changes and quality improvements

**Week 3:**
- Day 1-2: Topic taxonomy definition (Item 9)
- Day 3-4: Org normalization (Item 11)
- Day 5: Fuzzy speaker matching (Item 7)

**Week 4:**
- Day 1-3: Speaker history table migration (Item 8)
- Day 4-5: Speaker history service implementation

**Week 5:**
- Day 1-3: Trend snapshots table migration (Item 10)
- Day 4-5: Rollup service implementation

**Week 6:**
- Day 1-3: Enhanced extraction schema (Item 12)
- Day 4-5: Validation and testing

**Success Criteria:**
- All 6 items deployed with feature flags
- Metrics show: +70% precision, +25% recall, -18% latency
- Schema migrations completed without downtime
- No data loss or corruption

**Rollback Triggers:**
- Precision drops >10%
- Database migration failures
- Data integrity issues

---

### Phase 3: Strategic (Weeks 6-12)
**Goal:** Advanced features and optimizations

**Week 7-8:**
- Per-domain rate limiting (Item 13)
- Adaptive timeouts (Item 14)

**Week 9-10:**
- Session-agenda mapping (Item 15)
- Country-specific queries (Item 17)

**Week 11-12:**
- Drift detection (Item 16)
- Final testing and optimization

**Success Criteria:**
- All 5 items deployed
- Metrics show: +5% precision, +35% recall, -20% latency
- New capabilities (session mapping, drift detection) operational

**Rollback Triggers:**
- Feature-specific issues (rollback individual items)
- Performance degradation >10%

---

## Monitoring & Validation

### Key Metrics Dashboard

**Discovery Metrics:**
- Recall@10, Recall@50 (target: ≥0.70, ≥0.90)
- Precision@5, Precision@10 (target: ≥0.85, ≥0.80)
- Query variation effectiveness (which variations find most events)

**Extraction Metrics:**
- Extraction accuracy (target: ≥0.90)
- Extraction coverage (target: ≥0.80)
- Hallucination rate (target: <5%)
- Evidence tag coverage (% of fields with evidence)

**Performance Metrics:**
- Latency p50, p95 (target: <2s, <5s)
- Timeout failure rate (target: <10%)
- Cost per 100 results (target: <$4)
- 429 error rate (target: <1%)

**Quality Metrics:**
- Speaker-match F1 (target: ≥0.85)
- Trend stability index (target: ≥0.80)
- Data completeness score (target: ≥0.80)

### Evaluation Harness

**Location:** `src/lib/search/evaluation-harness.ts`

**Gold Set:**
- Expand from 20 to 50 queries
- 10 per country (DE, FR, NL, GB, US)
- Include event type and temporal variations

**Automated Testing:**
- Run weekly against gold set
- Compare metrics to baseline
- Flag regressions (>3% drop in any metric)
- Generate report: `eval/results/YYYY-MM-DD.json`

**Manual Review:**
- Sample 10% of extractions for hallucination check
- Review speaker matches with confidence <0.7
- Validate trend snapshots for accuracy

---

## Dependencies & Prerequisites

### External Dependencies
- **Firecrawl API:** No changes required (already v2)
- **Gemini API:** No changes required (already 2.5-Flash)
- **Supabase:** Database access for migrations
- **Levenshtein Library:** Add `fast-levenshtein` or implement

### Internal Dependencies
- **Evaluation Harness:** Expand existing (`src/lib/search/evaluation-harness.ts`)
- **Retry Service:** Use existing (`src/lib/services/retry-service.ts`)
- **Country Context:** Use existing (`src/lib/utils/country.ts`)

### Team Dependencies
- **Database Admin:** For schema migrations (Items 8, 10)
- **QA:** For gold set expansion and validation
- **Product:** For taxonomy definition (Item 9)

---

## Cost-Benefit Analysis

### Development Cost
- **Phase 1:** 10-16 hours (1 developer, 2 weeks)
- **Phase 2:** 31-40 hours (1 developer, 4 weeks)
- **Phase 3:** 24-30 hours (1 developer, 6 weeks)
- **Total:** 65-86 hours (~2-3 months for 1 developer)

### Operational Cost Impact
- **Current:** ~$5 per 100 results
- **After Phase 1:** ~$4 per 100 results (-20%)
- **After Phase 2:** ~$3.70 per 100 results (-26%)
- **After Phase 3:** ~$3.60 per 100 results (-28%)

**Annual Savings (assuming 10,000 results/month):**
- Phase 1: $1,200/year
- Phase 2: $1,560/year
- Phase 3: $1,680/year

### Quality Impact
- **Precision:** 60% → 100% (+67% improvement)
- **Recall:** 50% → 100% (+100% improvement)
- **Trust:** Low → High (enables new use cases)

### ROI Calculation
- **Development Cost:** 65-86 hours × $150/hour = $9,750-$12,900
- **Annual Savings:** $1,680/year
- **Payback Period:** 5.8-7.7 years (cost-focused)
- **Quality ROI:** Immediate (enables new features, reduces support burden)

**Verdict:** High ROI for quality improvements, moderate ROI for cost savings alone. Quality improvements enable new product features and reduce manual review burden.

---

## Recommendations

### Immediate Actions (This Week)
1. **Approve Phase 1 plan** - Low risk, high impact
2. **Set up monitoring dashboard** - Track baseline metrics
3. **Expand gold set** - From 20 to 50 queries for validation
4. **Create feature flags** - For all Phase 1 items

### Phase 1 Priority Order
1. **Query expansion** (Item 1) - Highest recall impact, lowest risk
2. **Exponential backoff** (Item 4) - Reduces failures, improves reliability
3. **Date normalization** (Item 2) - High precision impact
4. **City validation** (Item 3) - Quick win, low effort
5. **Early deduplication** (Item 5) - Cost savings
6. **Evidence tagging** (Item 6) - Foundation for Phase 2

### Phase 2 Prerequisites
- **Before starting:** Complete Phase 1 and validate metrics
- **Database backup:** Full backup before migrations
- **Feature flags:** Enable schema changes behind flags
- **Taxonomy review:** Get product approval for 20-topic taxonomy

### Phase 3 Considerations
- **Evaluate after Phase 2:** Assess if Phase 3 items are still needed
- **User feedback:** Prioritize based on feature requests
- **Cost monitoring:** If cost already optimized, defer rate limiting

### Risk Mitigation Strategy
1. **Feature flags for all changes** - Enable instant rollback
2. **A/B testing** - Route 10% traffic to new implementation
3. **Gradual rollout** - 10% → 50% → 100% over 1 week
4. **Monitoring alerts** - Set thresholds for all key metrics
5. **Weekly reviews** - Assess progress and adjust plan

---

## Success Criteria

### Phase 1 Success (Week 2)
- ✅ All 6 items deployed
- ✅ Precision: +20% or better
- ✅ Recall: +40% or better
- ✅ Cost: -15% or better
- ✅ No latency regression >5%
- ✅ Zero critical bugs

### Phase 2 Success (Week 6)
- ✅ All 6 items deployed
- ✅ Precision: +60% or better (cumulative)
- ✅ Recall: +60% or better (cumulative)
- ✅ Schema migrations completed
- ✅ Speaker history operational
- ✅ Trend snapshots generating

### Phase 3 Success (Week 12)
- ✅ All 5 items deployed
- ✅ Precision: +100% or better (cumulative)
- ✅ Recall: +100% or better (cumulative)
- ✅ Cost: -25% or better
- ✅ Latency: -15% or better
- ✅ New capabilities (session mapping, drift detection) operational

### Overall Success (3 Months)
- ✅ Pipeline discovers 90%+ of relevant events
- ✅ Extraction accuracy ≥90%
- ✅ Hallucination rate <5%
- ✅ Cost per 100 results <$4
- ✅ Latency p95 <5s
- ✅ Enables new product features (cross-event speaker insights, trend analysis)

---

## Next Steps

1. **Review this plan** with engineering and product teams
2. **Approve Phase 1** and allocate developer time
3. **Set up monitoring** dashboard with baseline metrics
4. **Create feature flags** infrastructure
5. **Expand gold set** to 50 queries
6. **Begin Phase 1 implementation** (Week 1)

---

**End of Optimization Plan**

