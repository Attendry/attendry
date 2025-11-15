# Firecrawl v2 Optimization - Impact Analysis & To-Do

**Date:** 2025-02-25  
**Status:** Planning - Ready for Prioritization

---

## Executive Summary

This document provides a prioritized breakdown of Firecrawl v2 optimization actions, their impact, dependencies, and actionable to-do items.

---

## Impact Matrix

### High Impact, Low Effort (Quick Wins)

| Action | Impact | Effort | Dependencies | Priority |
|--------|--------|--------|---------------|----------|
| **Increase Batch Sizes** | High | Low | None | 🔥 P0 |
| **Add Image Extraction** | Medium | Low | None | 🔥 P0 |
| **Add Data Attributes** | Medium | Low | None | 🔥 P0 |
| **Enhanced PDF Parsing** | Medium | Low | None | 🔥 P0 |

### High Impact, Medium Effort (Strategic Wins)

| Action | Impact | Effort | Dependencies | Priority |
|--------|--------|--------|---------------|----------|
| **Unified Search + Extract** | Very High | Medium | None (can be done independently) | 🔥 P0 |
| **Natural Language Crawling** | Medium | Low | None | ⚡ P1 |

### Medium Impact, Low Effort (Nice to Have)

| Action | Impact | Effort | Dependencies | Priority |
|--------|--------|--------|---------------|----------|
| **Search Categories** | Low-Medium | Low | None | ⚡ P2 |

---

## Detailed Impact Analysis

### 🔥 P0: Critical High-Impact Actions

#### 1. Unified Search + Extract
**Impact Score: 9/10**

**Benefits:**
- **50% reduction in API calls** (1 call instead of 2)
- **30% lower latency** (no wait between search and extract)
- **Cost efficiency** (single operation vs. two)
- **Better relevance** (can filter based on extracted content)

**Effort:** Medium (2-3 days)
- Update `unified-search-core.ts` interface
- Update response parsing
- Update discovery pipeline
- Testing and validation

**Dependencies:** None
- Can be implemented independently
- Backward compatible with feature flag

**Risk:** Low
- Feature flag enables gradual rollout
- Can rollback if issues

**ROI:** Very High
- Immediate cost savings
- Performance improvement
- Better user experience

---

#### 2. Increase Batch Sizes
**Impact Score: 8/10**

**Benefits:**
- **40% better efficiency** (fewer API calls)
- **Lower latency** (batch processing)
- **Cost savings** (fewer API calls)

**Effort:** Low (1-2 hours)
- Change batch size constant
- Update batch processing logic
- Test with larger batches

**Dependencies:** None
- Simple configuration change
- No breaking changes

**Risk:** Very Low
- Firecrawl v2 supports larger batches
- Easy to revert if needed

**ROI:** Very High
- Minimal effort, significant benefit
- Immediate cost savings

---

#### 3. Add Image Extraction
**Impact Score: 7/10**

**Benefits:**
- **Richer event data** (event images)
- **Better user experience** (visual content)
- **More complete event information**

**Effort:** Low (2-3 hours)
- Add `"images"` to formats array
- Process images in response
- Store images in metadata
- Filter out logos/icons

**Dependencies:** None
- Additive feature
- No breaking changes

**Risk:** Very Low
- Optional feature
- Can disable if issues

**ROI:** High
- Low effort, valuable data
- Improves event quality

---

#### 4. Add Data Attributes Extraction
**Impact Score: 7/10**

**Benefits:**
- **Structured data from HTML** (data-* attributes)
- **Better extraction** (more data sources)
- **Richer event information**

**Effort:** Low (2-3 hours)
- Enable `extractDataAttributes: true`
- Process data attributes in response
- Merge with extracted data

**Dependencies:** None
- Additive feature
- No breaking changes

**Risk:** Very Low
- Optional feature
- Can disable if issues

**ROI:** High
- Low effort, valuable data
- Improves extraction quality

---

#### 5. Enhanced PDF Parsing
**Impact Score: 6/10**

**Benefits:**
- **Better PDF handling** (titles, metadata)
- **More complete extraction** (PDF content)
- **Improved data quality**

**Effort:** Low (1-2 hours)
- Add PDF options to scrapeOptions
- Process PDF titles/metadata
- Merge with extracted data

**Dependencies:** None
- Additive feature
- No breaking changes

**Risk:** Very Low
- Optional feature
- Can disable if issues

**ROI:** Medium-High
- Low effort, better PDF handling
- Improves extraction quality

---

### ⚡ P1: Important Medium-Impact Actions

#### 6. Natural Language Crawling
**Impact Score: 6/10**

**Benefits:**
- **Simpler configuration** (no regex patterns)
- **Better coverage** (AI finds relevant pages)
- **Less maintenance** (no pattern updates)
- **Language-agnostic** (works for any language)

**Effort:** Low (2-3 hours)
- Replace regex patterns with prompts
- Test with natural language prompts
- Validate crawl behavior

**Dependencies:** None
- Can replace existing patterns
- Backward compatible

**Risk:** Low
- Can keep old patterns as fallback
- Easy to revert

**ROI:** Medium
- Reduces maintenance burden
- Improves crawl coverage

---

### ⚡ P2: Nice to Have Low-Impact Actions

#### 7. Search Categories
**Impact Score: 4/10**

**Benefits:**
- **Better targeting** (filter by category)
- **Reduced noise** (focus on relevant sources)
- **Higher quality** (authoritative sources)

**Effort:** Low (1-2 hours)
- Add categories parameter
- Test with different categories
- Validate result quality

**Dependencies:** None
- Optional parameter
- No breaking changes

**Risk:** Very Low
- Optional feature
- Can disable if issues

**ROI:** Low-Medium
- Small improvement in targeting
- May not be necessary for all searches

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│                    START                                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  Increase Batch Sizes  │  (No dependencies)
        │      Impact: 8/10       │
        │      Effort: Low       │
        └────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  Add Image Extraction  │  (No dependencies)
        │      Impact: 7/10       │
        │      Effort: Low       │
        └────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ Add Data Attributes   │  (No dependencies)
        │      Impact: 7/10     │
        │      Effort: Low      │
        └────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ Enhanced PDF Parsing  │  (No dependencies)
        │      Impact: 6/10     │
        │      Effort: Low      │
        └────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ Unified Search+Extract │  (No dependencies)
        │      Impact: 9/10     │
        │      Effort: Medium   │
        └────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ Natural Language Crawl │  (No dependencies)
        │      Impact: 6/10     │
        │      Effort: Low      │
        └────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  Search Categories     │  (No dependencies)
        │      Impact: 4/10     │
        │      Effort: Low      │
        └────────────────────────┘
```

**Key Insight:** All actions are independent with no dependencies. Can be implemented in any order, but recommended order prioritizes high-impact, low-effort items first.

---

## Recommended Implementation Order

### Week 1: Quick Wins (High Impact, Low Effort)

**Day 1-2: Batch Optimization & Enhanced Features**
1. ✅ Increase batch sizes (1-2 hours)
2. ✅ Add image extraction (2-3 hours)
3. ✅ Add data attributes (2-3 hours)
4. ✅ Enhanced PDF parsing (1-2 hours)

**Total Effort:** 6-10 hours  
**Total Impact:** Very High  
**Risk:** Very Low

**Expected Results:**
- 40% better batch efficiency
- Richer event data (images, attributes, PDF metadata)
- Immediate cost savings

---

### Week 2: Strategic Win (High Impact, Medium Effort)

**Day 3-5: Unified Search + Extract**
1. ✅ Update unified search interface (2-3 hours)
2. ✅ Update response parsing (2-3 hours)
3. ✅ Update discovery pipeline (2-3 hours)
4. ✅ Testing and validation (4-6 hours)

**Total Effort:** 10-15 hours  
**Total Impact:** Very High  
**Risk:** Low (with feature flag)

**Expected Results:**
- 50% reduction in API calls
- 30% lower latency
- Significant cost savings

---

### Week 3: Optimization (Medium Impact, Low Effort)

**Day 6-7: Natural Language & Categories**
1. ✅ Natural language crawling (2-3 hours)
2. ✅ Search categories (1-2 hours)
3. ✅ Testing and validation (2-3 hours)

**Total Effort:** 5-8 hours  
**Total Impact:** Medium  
**Risk:** Very Low

**Expected Results:**
- Simpler configuration
- Better crawl coverage
- Improved targeting

---

## To-Do List

### 🔥 P0: Critical (Do First)

#### Batch Optimization
- [ ] **TASK-1.1**: Update batch size constant from 3 to 10
  - **File:** `src/app/api/events/extract/route.ts`
  - **Line:** ~1243
  - **Change:** `const BATCH_SIZE = 10;`
  - **Effort:** 5 minutes
  - **Impact:** High

- [ ] **TASK-1.2**: Update batch processing logic to handle larger batches
  - **File:** `src/app/api/events/extract/route.ts`
  - **Line:** ~1245-1250
  - **Change:** Update batch chunking logic
  - **Effort:** 15 minutes
  - **Impact:** High

- [ ] **TASK-1.3**: Test batch extraction with 10 URLs
  - **Effort:** 30 minutes
  - **Impact:** High (validation)

---

#### Image Extraction
- [ ] **TASK-2.1**: Add "images" to formats array in extract endpoint
  - **File:** `src/app/api/events/extract/route.ts`
  - **Line:** ~820
  - **Change:** `formats: ["markdown", "html", "images"]`
  - **Effort:** 5 minutes
  - **Impact:** Medium

- [ ] **TASK-2.2**: Process images in extraction response
  - **File:** `src/app/api/events/extract/route.ts`
  - **Line:** After extraction result
  - **Change:** Filter and store event images
  - **Effort:** 30 minutes
  - **Impact:** Medium

- [ ] **TASK-2.3**: Filter out logos/icons from images
  - **File:** `src/app/api/events/extract/route.ts`
  - **Change:** Filter logic for relevant images
  - **Effort:** 30 minutes
  - **Impact:** Medium

- [ ] **TASK-2.4**: Store images in event metadata
  - **File:** `src/app/api/events/extract/route.ts`
  - **Change:** Add images to metadata
  - **Effort:** 15 minutes
  - **Impact:** Medium

---

#### Data Attributes Extraction
- [ ] **TASK-3.1**: Enable extractDataAttributes in scrapeOptions
  - **File:** `src/app/api/events/extract/route.ts`
  - **Line:** ~818
  - **Change:** `extractDataAttributes: true`
  - **Effort:** 5 minutes
  - **Impact:** Medium

- [ ] **TASK-3.2**: Process data attributes in extraction response
  - **File:** `src/app/api/events/extract/route.ts`
  - **Change:** Extract and merge data attributes
  - **Effort:** 1 hour
  - **Impact:** Medium

- [ ] **TASK-3.3**: Merge data attributes with extracted event data
  - **File:** `src/app/api/events/extract/route.ts`
  - **Change:** Merge logic
  - **Effort:** 30 minutes
  - **Impact:** Medium

---

#### Enhanced PDF Parsing
- [ ] **TASK-4.1**: Add PDF options to scrapeOptions
  - **File:** `src/app/api/events/extract/route.ts`
  - **Line:** ~821
  - **Change:** Add `pdfOptions: { extractTitle: true, extractMetadata: true }`
  - **Effort:** 5 minutes
  - **Impact:** Medium

- [ ] **TASK-4.2**: Process PDF titles and metadata in response
  - **File:** `src/app/api/events/extract/route.ts`
  - **Change:** Extract PDF metadata
  - **Effort:** 30 minutes
  - **Impact:** Medium

- [ ] **TASK-4.3**: Merge PDF metadata with extracted data
  - **File:** `src/app/api/events/extract/route.ts`
  - **Change:** Merge logic
  - **Effort:** 15 minutes
  - **Impact:** Medium

---

#### Unified Search + Extract
- [ ] **TASK-5.1**: Update UnifiedSearchParams interface
  - **File:** `src/lib/search/unified-search-core.ts`
  - **Line:** ~162
  - **Change:** Add `extractSchema`, `extractPrompt`, `categories` parameters
  - **Effort:** 15 minutes
  - **Impact:** Very High

- [ ] **TASK-5.2**: Add extract options to search body
  - **File:** `src/lib/search/unified-search-core.ts`
  - **Line:** ~360
  - **Change:** Add extract configuration to scrapeOptions
  - **Effort:** 30 minutes
  - **Impact:** Very High

- [ ] **TASK-5.3**: Update response parsing to handle extracted data
  - **File:** `src/lib/search/unified-search-core.ts`
  - **Line:** ~420
  - **Change:** Parse extracted data from response
  - **Effort:** 1 hour
  - **Impact:** Very High

- [ ] **TASK-5.4**: Update discovery to use unified search+extract
  - **File:** `src/lib/event-pipeline/discover.ts`
  - **Line:** ~184
  - **Change:** Add extractSchema and extractPrompt to unifiedSearch call
  - **Effort:** 30 minutes
  - **Impact:** Very High

- [ ] **TASK-5.5**: Process extracted data in discovery candidates
  - **File:** `src/lib/event-pipeline/discover.ts`
  - **Line:** ~204
  - **Change:** Include extracted data in candidate metadata
  - **Effort:** 30 minutes
  - **Impact:** Very High

- [ ] **TASK-5.6**: Skip separate extraction if data already extracted
  - **File:** `src/lib/event-pipeline/extract.ts` or orchestrator
  - **Change:** Check if extraction already done, skip if so
  - **Effort:** 1 hour
  - **Impact:** Very High

- [ ] **TASK-5.7**: Add feature flag for unified search+extract
  - **File:** `src/config/features.ts` or environment
  - **Change:** `ENABLE_UNIFIED_SEARCH_EXTRACT`
  - **Effort:** 15 minutes
  - **Impact:** High (safety)

- [ ] **TASK-5.8**: Test unified search+extract end-to-end
  - **Effort:** 2 hours
  - **Impact:** Very High (validation)

---

### ⚡ P1: Important (Do Second)

#### Natural Language Crawling
- [ ] **TASK-6.1**: Create natural language prompt for event crawling
  - **File:** `src/app/api/events/extract/route.ts`
  - **Line:** ~833
  - **Change:** Replace includePatterns with prompt
  - **Effort:** 30 minutes
  - **Impact:** Medium

- [ ] **TASK-6.2**: Update crawlerOptions to use prompt
  - **File:** `src/app/api/events/extract/route.ts`
  - **Line:** ~829
  - **Change:** Add prompt, remove includePatterns
  - **Effort:** 15 minutes
  - **Impact:** Medium

- [ ] **TASK-6.3**: Test natural language crawling
  - **Effort:** 1 hour
  - **Impact:** Medium (validation)

- [ ] **TASK-6.4**: Compare crawl results (old vs. new)
  - **Effort:** 1 hour
  - **Impact:** Medium (validation)

---

### ⚡ P2: Nice to Have (Do Third)

#### Search Categories
- [ ] **TASK-7.1**: Add categories parameter to UnifiedSearchParams
  - **File:** `src/lib/search/unified-search-core.ts`
  - **Line:** ~162
  - **Change:** Add `categories?: string[]`
  - **Effort:** 5 minutes
  - **Impact:** Low

- [ ] **TASK-7.2**: Add categories to search body
  - **File:** `src/lib/search/unified-search-core.ts`
  - **Line:** ~352
  - **Change:** Add categories to body if provided
  - **Effort:** 10 minutes
  - **Impact:** Low

- [ ] **TASK-7.3**: Test search with categories
  - **Effort:** 30 minutes
  - **Impact:** Low (validation)

---

## Testing Checklist

### Unit Tests
- [ ] Test batch extraction with 10 URLs
- [ ] Test image extraction and filtering
- [ ] Test data attributes extraction
- [ ] Test PDF metadata extraction
- [ ] Test unified search+extract response parsing
- [ ] Test natural language crawl prompts
- [ ] Test search categories

### Integration Tests
- [ ] Test full pipeline with unified search+extract
- [ ] Test extraction quality with new features
- [ ] Test batch operations with larger batches
- [ ] Test error handling for all new features

### Performance Tests
- [ ] Compare API call counts (before/after)
- [ ] Compare latency (before/after)
- [ ] Compare extraction quality (before/after)
- [ ] Compare costs (before/after)

---

## Monitoring & Metrics

### Key Metrics to Track

1. **API Call Count**
   - Before: X calls per event
   - After: Y calls per event
   - Target: 50% reduction

2. **Latency**
   - Before: X ms average
   - After: Y ms average
   - Target: 30% reduction

3. **Extraction Quality**
   - Before: X% completeness
   - After: Y% completeness
   - Target: 20% improvement

4. **Cost per Event**
   - Before: $X per event
   - After: $Y per event
   - Target: 30% reduction

5. **Batch Efficiency**
   - Before: X URLs per batch
   - After: Y URLs per batch
   - Target: 40% improvement

### Monitoring Setup

- [ ] Set up API call tracking
- [ ] Set up latency monitoring
- [ ] Set up extraction quality metrics
- [ ] Set up cost tracking
- [ ] Set up alerts for anomalies

---

## Risk Mitigation

### Feature Flags
- [ ] Create feature flag for unified search+extract
- [ ] Create feature flag for enhanced extraction
- [ ] Create feature flag for natural language crawling
- [ ] Create feature flag for search categories

### Rollback Plan
- [ ] Document rollback procedure for each feature
- [ ] Test rollback procedure
- [ ] Set up monitoring for quick detection of issues

### Gradual Rollout
- [ ] Plan 10% rollout for unified search+extract
- [ ] Plan 50% rollout after validation
- [ ] Plan 100% rollout after full validation

---

## Success Criteria

### Must Have (P0)
- ✅ Batch sizes increased to 10
- ✅ Image extraction working
- ✅ Data attributes extraction working
- ✅ PDF metadata extraction working
- ✅ Unified search+extract implemented
- ✅ 50% reduction in API calls
- ✅ 30% reduction in latency

### Should Have (P1)
- ✅ Natural language crawling implemented
- ✅ Simpler configuration
- ✅ Better crawl coverage

### Nice to Have (P2)
- ✅ Search categories implemented
- ✅ Better targeting

---

## Estimated Timeline

### Week 1: Quick Wins
- **Days 1-2**: Batch optimization + Enhanced features (6-10 hours)
- **Expected Results**: 40% better efficiency, richer data

### Week 2: Strategic Win
- **Days 3-5**: Unified search+extract (10-15 hours)
- **Expected Results**: 50% fewer API calls, 30% lower latency

### Week 3: Optimization
- **Days 6-7**: Natural language + Categories (5-8 hours)
- **Expected Results**: Simpler config, better coverage

**Total Effort:** 21-33 hours  
**Total Impact:** Very High  
**Total Risk:** Low

---

## Summary

### Highest Impact Actions (Do First)
1. **Unified Search + Extract** (Impact: 9/10, Effort: Medium)
2. **Increase Batch Sizes** (Impact: 8/10, Effort: Low)
3. **Add Image Extraction** (Impact: 7/10, Effort: Low)
4. **Add Data Attributes** (Impact: 7/10, Effort: Low)

### Dependencies
- **None** - All actions are independent
- Can be implemented in any order
- Recommended order prioritizes high-impact, low-effort items

### Total To-Do Items
- **P0 (Critical):** 23 tasks
- **P1 (Important):** 4 tasks
- **P2 (Nice to Have):** 3 tasks
- **Total:** 30 tasks

### Expected Outcomes
- **50% reduction in API calls**
- **30% reduction in latency**
- **40% better batch efficiency**
- **20% improvement in extraction quality**
- **30% reduction in cost per event**

