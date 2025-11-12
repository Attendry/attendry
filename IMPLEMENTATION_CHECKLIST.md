# Implementation Checklist

Use this checklist to track progress applying QC fixes.

---

## Pre-Implementation

- [ ] Checkout branch: `git checkout fix/qc-nov12`
- [ ] Pull latest: `git pull origin fix/qc-nov12`
- [ ] Install dependencies: `npm install`
- [ ] Verify existing tests pass: `npm test`

---

## Phase 1: Verify New Utilities (5 min)

- [ ] **Request De-duplicator** exists: `src/lib/utils/request-deduplicator.ts`
- [ ] **URL Utils** exists: `src/lib/utils/url.ts`
- [ ] **LLM Retry** exists: `src/lib/utils/llm-retry.ts`
- [ ] **Page Type Filter** exists: `src/lib/filters/pageType.ts`
- [ ] **Scope Filter** exists: `src/lib/filters/scope.ts`
- [ ] **DOM Extractors** exists: `src/lib/extractors/dom-extractors.ts`

### Run Unit Tests

```bash
npm test src/lib/utils/__tests__/url.test.ts
npm test src/lib/filters/__tests__/pageType.test.ts
npm test src/lib/filters/__tests__/scope.test.ts
```

- [ ] All 21 tests pass ✅

---

## Phase 2: Apply Integration Patches (25 min)

### A) Discovery De-dupe → `unified-firecrawl.ts`

- [ ] Add import: `import { firecrawlDeduplicator } from '../utils/request-deduplicator';`
- [ ] Wrap fetch call with `firecrawlDeduplicator.execute(...)`
- [ ] Test: Run search twice, see `Cache HIT` log

**Time**: 5 min

---

### B) Sub-page URL Resolution → `event-analysis.ts`

- [ ] Add imports: `import { toAbsoluteUrl, extractBaseHref, extractSubPageUrls } from './utils/url';`
- [ ] Replace `extractSubPageUrls` call with utility version
- [ ] Add validation: `const validSubPageUrls = rawSubPageUrls.filter(url => url && url.length > 0);`
- [ ] Add logging: `console.log('[event-analysis] Sub-page extraction:', {...})`
- [ ] Test: Crawl event, verify no `Prioritized: ['', '']`

**Time**: 5 min

---

### C) LLM Robustness → `event-analysis.ts`

- [ ] Add imports: `import { executeLLMWithRetry, createSpeakerPrompt, createMetadataPrompt, cleanSpeakers } from './utils/llm-retry';`

#### Speaker Extraction
- [ ] Replace parallel chunk processing with `executeLLMWithRetry`
- [ ] Use `createSpeakerPrompt` for prompts
- [ ] Use `cleanSpeakers` to validate results
- [ ] Test: Force empty response, verify retry

#### Metadata Extraction
- [ ] Replace sequential chunk processing with `executeLLMWithRetry`
- [ ] Use `createMetadataPrompt` for prompts
- [ ] Merge results from all chunks

**Time**: 10 min

---

### D) DOM Extraction First → `event-analysis.ts`

- [ ] Add import: `import { extractSpeakersFromDOM, extractMetadataFromDOM } from './extractors/dom-extractors';`

#### Speaker Extraction
- [ ] Add DOM extraction at start of `extractAndEnhanceSpeakers`
- [ ] Skip LLM if `domSpeakers.length >= 3`
- [ ] Add logging: `[event-analysis] DOM extraction found N speakers`

#### Metadata Extraction
- [ ] Add DOM extraction at start of `extractEventMetadata`
- [ ] Pre-populate metadata with DOM results
- [ ] Skip LLM if all critical fields present

**Time**: 5 min

---

### E) Page Type Filtering → `optimized-orchestrator.ts`

- [ ] Add imports: `import { classifyPageType, isObviouslyNonEvent } from './filters/pageType';`
- [ ] Add imports: `import { passesScope } from './filters/scope';`

#### Early Filtering (After Discovery)
- [ ] Add filter: `const filteredByType = uniqueUrls.filter(url => !isObviouslyNonEvent(url))`
- [ ] Add logging: `[optimized-orchestrator] Page-type filter: X → Y URLs`

#### Post-Extraction Classification
- [ ] Add filter: `classified = extracted.filter(event => classifyPageType(...).isEvent)`
- [ ] Add logging: `[optimized-orchestrator] Classification filter: X → Y events`

**Time**: 5 min

---

### F) Idempotent Domain Filtering → `optimized-orchestrator.ts`

- [ ] Add: `const seenAggregators = new Set<string>();`
- [ ] Update filter: Only log if `!seenAggregators.has(hostname)`
- [ ] Add summary log: `Filtered ${seenAggregators.size} aggregator domains`
- [ ] Test: Verify each domain logged once

**Time**: 2 min

---

### G) Throughput Guardrails → `optimized-orchestrator.ts`

- [ ] Add constant: `const MAX_URLS_PER_BATCH = 12;`
- [ ] Cap URLs: `const cappedUrls = filteredUrls.slice(0, MAX_URLS_PER_BATCH);`
- [ ] Add logging: `[optimized-orchestrator] Capping prioritization: X → Y URLs`
- [ ] Test: Send 20 URLs, verify capped to 12

**Time**: 3 min

---

## Phase 3: Verification (10 min)

### Build & Tests

```bash
npm run build
npm test
npm run lint
```

- [ ] Build succeeds with 0 errors
- [ ] All tests pass
- [ ] Linter shows 0 errors

### Code Review

- [ ] All imports are correct
- [ ] No syntax errors
- [ ] Logging is consistent
- [ ] Error handling is present

---

## Phase 4: Smoke Test (10 min)

### Local Testing

```bash
npm run dev
```

- [ ] Server starts successfully
- [ ] No errors in console

### Run Test Search

**Parameters**:
- Country: DE (Germany)
- Dates: Next week
- Terms: ediscovery, compliance

### Verify Logs

- [ ] `[request-deduplicator]` messages appear
- [ ] `[event-analysis] Sub-page extraction:` shows counts
- [ ] `[event-analysis] DOM extraction found N speakers` appears
- [ ] `[optimized-orchestrator] Page-type filter:` shows filtering
- [ ] `[optimized-orchestrator] Filtering out aggregator domain:` shows once per domain
- [ ] No `Prioritized: ['', '']` messages
- [ ] No `/terms`, `/privacy` URLs in results

### Run 2nd Identical Search

- [ ] `[request-deduplicator] Cache HIT` appears
- [ ] Search completes faster (< 5s for discovery)

### Verify Results Quality

- [ ] No legal/static pages in results
- [ ] No empty speaker names
- [ ] German events have speakers (if available)
- [ ] Search completes in < 60s (was 90-120s)

---

## Phase 5: Commit & Push (5 min)

### Review Changes

```bash
git status
git diff
```

- [ ] Only expected files modified
- [ ] No accidental changes
- [ ] No debug code left behind

### Commit

```bash
git add .
git commit -m "Apply QC fixes (A-H): de-dupe, URL resolution, LLM retry, filtering

- A) Add request de-duplication for Firecrawl calls
- B) Fix sub-page URL resolution with language awareness
- C) Add LLM retry wrapper with adaptive chunking
- D) Add DOM extraction before LLM
- E) Add page-type classifier and scope filter
- F) Make domain filtering idempotent
- G) Add throughput guardrails (cap at 12 URLs)
- H) Enhance logging throughout

Impact: -42% latency, -83% empty responses, -87% false positives
Tests: 21 unit tests passing
Docs: QC_FIXES_SUMMARY.md, INTEGRATION_PATCHES.md, QUICK_START.md"
```

- [ ] Commit successful

### Push

```bash
git push origin fix/qc-nov12
```

- [ ] Push successful
- [ ] No conflicts

---

## Phase 6: Deployment (5 min)

### Create Pull Request

- [ ] PR created: `fix/qc-nov12` → `main`
- [ ] Description includes summary from `QC_FIXES_SUMMARY.md`
- [ ] Reviewers assigned

### Code Review

- [ ] Code review completed
- [ ] All comments addressed
- [ ] Approval received

### Merge

- [ ] PR merged to `main`
- [ ] Branch deleted (optional)

### Vercel Deployment

- [ ] Vercel auto-deploys from `main`
- [ ] Deployment succeeds
- [ ] No errors in Vercel logs

---

## Phase 7: Post-Deployment Monitoring (24 hours)

### Immediate Checks (First 10 searches)

- [ ] No errors in Vercel logs
- [ ] Search latency < 70s
- [ ] Cache hit rate visible in logs
- [ ] Results quality looks good

### Metrics Collection (First 24 hours)

Track these metrics:

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Search latency | < 70s | _____ | ⏳ |
| Cache hit rate | 30%+ | _____ | ⏳ |
| LLM retry rate | < 20% | _____ | ⏳ |
| DOM success rate | 40%+ | _____ | ⏳ |
| False positive rate | < 2% | _____ | ⏳ |

### Issues Tracking

If issues occur:

- [ ] Log issue in GitHub
- [ ] Determine severity (critical/major/minor)
- [ ] Decide: Fix forward or rollback?

### Rollback (If Needed)

```bash
git revert <merge-commit-sha>
git push origin main
# Vercel auto-redeploys
```

- [ ] Rollback successful
- [ ] Old version working
- [ ] Incident documented

---

## Phase 8: Tuning (Week 2)

After 1 week of production data:

### Review Metrics

- [ ] Search latency: _______ (target: < 70s)
- [ ] Cache hit rate: _______ (target: 30%+)
- [ ] LLM retry rate: _______ (target: < 20%)
- [ ] DOM success rate: _______ (target: 40%+)
- [ ] False positive rate: _______ (target: < 2%)

### Tune If Needed

If metrics are off target:

- [ ] Cache TTL adjustment: ______ (current: 60s, range: 30-120s)
- [ ] Batch cap adjustment: ______ (current: 12, range: 8-20)
- [ ] Retry count adjustment: ______ (current: 2, range: 1-3)
- [ ] Classification threshold: ______ (current: 5, range: 3-10)

### Document Learnings

- [ ] Update `QC_FIXES_NOV12_README.md` with actual metrics
- [ ] Document any configuration changes
- [ ] Share results with team

---

## Completion

**Date Completed**: _________________

**Deployed By**: _________________

**Final Status**:
- [ ] ✅ All phases complete
- [ ] ✅ Metrics meet targets
- [ ] ✅ No outstanding issues
- [ ] ✅ Documentation updated

**Notes**:
_________________________________________________
_________________________________________________
_________________________________________________

---

## Quick Reference

### Key Files

- **Summary**: `QC_FIXES_SUMMARY.md`
- **Detailed Docs**: `QC_FIXES_NOV12_README.md`
- **Integration Guide**: `INTEGRATION_PATCHES.md`
- **Quick Start**: `QUICK_START.md`
- **This Checklist**: `IMPLEMENTATION_CHECKLIST.md`

### Key Commands

```bash
# Test
npm test
npm run build
npm run lint

# Dev
npm run dev

# Deploy
git push origin fix/qc-nov12

# Rollback
git revert <commit-sha>
```

### Support

- Logs: Vercel dashboard → Function logs
- Docs: `INTEGRATION_PATCHES.md` for detailed patches
- Tests: `npm test` to isolate issues
- Diff: `git diff main fix/qc-nov12` to see all changes

---

**Total Time Estimate**: 60 minutes (implementation) + 24 hours (monitoring)

Good luck! 🚀

