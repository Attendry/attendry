# Merge Analysis: fix/qc-nov12 → feat-cc-search-update-ZdaCs

## 📊 Branch Comparison Summary

### Current Branch: `fix/qc-nov12`
**Focus**: Search quality fixes, pipeline hardening, speaker validation  
**Commits**: 10 commits since divergence  
**Key Changes**:
- Voyage API integration & reranking
- Quality scoring system (`eventQuality.ts`)
- Auto date-range expansion (`autoExpand.ts`)
- Enhanced speaker validation (`speakers.ts`)
- Pragmatic quality gate (trust strong signals)
- URL filtering improvements
- Content-based filtering

### Target Branch: `feat-cc-search-update-ZdaCs`
**Focus**: Command Centre UI enhancements  
**Commits**: 10 commits since divergence  
**Key Changes**:
- Command Centre quick search refinements
- Event prioritization improvements
- Gemini prompt optimization
- Firecrawl narrative improvements
- UI/UX enhancements

### Common Ancestor
Commit: `557a65a` - "Normalize Gemini prioritization context formatting"

---

## ⚠️ Identified Conflicts

### 1. **CONFLICT in `src/lib/optimized-orchestrator.ts`** ❗

**Why**: Both branches modified the core search orchestration logic:
- **fix/qc-nov12**: Added Voyage gate, quality scoring, auto-expand
- **feat-cc**: Modified Gemini prioritization, prompt shortening

**Impact**: HIGH - This is the core search engine

**Resolution Strategy**: Manual merge required
- Keep QC fixes (Voyage, quality gate, auto-expand)
- Integrate CC prompt optimizations
- Ensure both sets of changes work together

---

## 📁 Modified Files Analysis

### Backend/Core Files (Both Branches)

| File | fix/qc-nov12 | feat-cc | Conflict Risk |
|------|--------------|---------|---------------|
| `optimized-orchestrator.ts` | ✅ Major | ✅ Major | **HIGH** ✓ |
| `unified-query-builder.ts` | ✅ Minor | ✅ Minor | Medium |
| `event-analysis.ts` | ✅ Major | ❌ | Low |
| `parallel-processor.ts` | ✅ Minor | ❌ | Low |
| `unified-search-core.ts` | ✅ Minor | ❌ | Low |

### Frontend Files (Both Branches)

| File | fix/qc-nov12 | feat-cc | Conflict Risk |
|------|--------------|---------|---------------|
| `EventsClient.tsx` | ✅ Minor | ✅ Major | **Medium** |
| `CommandCentre.tsx` | ✅ Minor | ✅ Major | Medium |
| `EventCard.tsx` | ✅ Minor | ✅ Minor | Low |
| `useSavedProfiles.ts` | ✅ Minor | ✅ Minor | Low |

### New Files (fix/qc-nov12 Only)

**Config**:
- `src/config/search.ts` - Quality thresholds, Voyage settings
- `src/config/rerank.ts` - Rerank configuration

**Quality & Scoring**:
- `src/lib/quality/eventQuality.ts` - Quality scoring system
- `src/lib/search/autoExpand.ts` - Date range auto-expansion
- `src/lib/search/voyageGate.ts` - Voyage rerank integration

**Extraction & Filtering**:
- `src/lib/extract/speakers.ts` - Enhanced speaker validation
- `src/lib/filters/pageType.ts` - Page type classification
- `src/lib/filters/scope.ts` - Geographic/temporal scoping

**Utils**:
- `src/lib/llm/json.ts` - JSON parsing with repair
- `src/lib/utils/url.ts` - URL normalization
- `src/lib/utils/llm-retry.ts` - LLM retry strategies

---

## 🔍 Dependency Analysis

### 1. **API Dependencies** ✅ SAFE

**fix/qc-nov12** adds:
- Voyage AI API (reranking) - Optional, has fallback
- No breaking changes to existing APIs

**Result**: No conflicts with feat-cc API usage

---

### 2. **Environment Variables** ⚠️ CHECK REQUIRED

**New env vars in fix/qc-nov12**:
```bash
VOYAGE_API_KEY=          # Optional - falls back to micro-bias
MIN_SOLID_HITS=3         # Has default
RERANK_MAX_DOCS=40       # Has default
RERANK_TOP_K=12          # Has default
AUTO_EXPAND=true         # Has default
MIN_QUALITY_TO_EXTRACT=0.55  # Has default
MIN_SPEAKERS_FOR_SOLID=2     # Has default
```

**Action**: Add these to `.env` files (all have safe defaults)

---

### 3. **TypeScript Types** ✅ SAFE

**New types in fix/qc-nov12**:
- `CandidateMeta` - Quality metadata
- `QualityWindow` - Date window
- `RerankMetrics` - Rerank stats
- `Speaker` - Enhanced speaker type

**Result**: All new, no conflicts with existing types

---

### 4. **React Components** ⚠️ MANUAL REVIEW

**EventsClient.tsx**:
- fix/qc-nov12: Added `dateRangeSource` handling
- feat-cc: Enhanced search UI

**EventCard.tsx**:
- fix/qc-nov12: Added date range badges
- feat-cc: UI improvements

**Action**: Need to merge both sets of UI changes

---

### 5. **Search Flow** ❗ CRITICAL

**fix/qc-nov12 flow**:
```
Discovery → Voyage Gate → Gemini Prioritization → 
Quality Scoring → Auto-Expand → Return Results
```

**feat-cc flow**:
```
Discovery → Gemini Prioritization (optimized) → 
Return Results
```

**Integration required**: Insert Voyage Gate + Quality Gate into feat-cc flow

---

## 🛠️ Safe Merge Strategy

### Option 1: Merge feat-cc INTO fix/qc-nov12 (RECOMMENDED) ✅

**Pros**:
- Keep all QC fixes intact
- Add UI improvements on top
- Easier to resolve conflicts

**Steps**:
1. Stay on `fix/qc-nov12`
2. Merge `feat-cc-search-update-ZdaCs` into it
3. Resolve conflict in `optimized-orchestrator.ts`:
   - Keep QC pipeline structure
   - Integrate CC prompt optimizations
4. Test thoroughly
5. Push merged branch

**Timeline**: 30-45 minutes

---

### Option 2: Cherry-pick QC fixes INTO feat-cc

**Pros**:
- Cleaner feat-cc history
- UI already tested

**Cons**:
- More complex - 6+ commits to cherry-pick
- Higher risk of breaking QC fixes

**Timeline**: 1-2 hours

---

## 📝 Merge Checklist

### Pre-Merge
- [x] Identify conflicts (1 file)
- [x] Analyze dependencies
- [ ] Backup current work
- [ ] Review recent commits on both branches

### During Merge
- [ ] Run: `git merge origin/feat-cc-search-update-ZdaCs`
- [ ] Resolve `optimized-orchestrator.ts` conflict:
  - [ ] Keep Voyage gate integration
  - [ ] Keep quality scoring
  - [ ] Keep auto-expand logic
  - [ ] Integrate CC prompt optimizations
- [ ] Check for other conflicts
- [ ] Update imports/exports if needed

### Post-Merge Testing
- [ ] TypeScript compilation: `npm run build`
- [ ] Linter: `npm run lint`
- [ ] Search functionality works
- [ ] Quality gate filters correctly
- [ ] Voyage reranking active
- [ ] Command Centre UI functional
- [ ] Event cards display properly
- [ ] Date range auto-expansion works

### Deployment
- [ ] Test in local dev
- [ ] Commit merged changes
- [ ] Push to GitHub
- [ ] Deploy to Vercel
- [ ] Test in production

---

## 🚨 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Search breaks | HIGH | Test all search scenarios |
| UI regression | MEDIUM | Check all UI components |
| Missing env vars | LOW | All have defaults |
| Performance impact | LOW | Voyage is cached |
| Type errors | LOW | TypeScript will catch |

**Overall Risk**: MEDIUM (manageable with careful merge)

---

## 💡 Recommended Approach

1. **Create backup branch**:
   ```bash
   git branch fix/qc-nov12-backup
   ```

2. **Merge feat-cc into fix/qc-nov12**:
   ```bash
   git merge origin/feat-cc-search-update-ZdaCs
   ```

3. **Resolve conflict** in `optimized-orchestrator.ts`:
   - Keep QC pipeline stages
   - Integrate CC prompt improvements
   - Test both work together

4. **Test thoroughly**:
   - Search returns results ✓
   - Quality gate works ✓
   - Command Centre functional ✓
   - No TypeScript errors ✓

5. **Deploy**:
   - Push merged branch
   - Test in Vercel
   - Monitor logs

---

## 📊 Expected Outcome

After merge, you'll have:
- ✅ All QC fixes (Voyage, quality gate, speaker validation)
- ✅ All CC UI improvements (command centre enhancements)
- ✅ Optimized Gemini prompts from both branches
- ✅ Better search results + better UX

**Result**: Best of both worlds! 🎉

---

## 🆘 If Things Go Wrong

**Scenario 1: Merge conflict too complex**
```bash
git merge --abort
# Try Option 2 (cherry-pick) instead
```

**Scenario 2: Search breaks after merge**
```bash
git reset --hard fix/qc-nov12-backup
# Review conflict resolution
```

**Scenario 3: UI breaks**
```bash
# Check EventsClient.tsx and CommandCentre.tsx
# Likely missing props or type mismatches
```

---

## 🎯 Next Steps

**Ready to proceed?**

1. I can help resolve the merge conflict
2. We can do Option 1 (merge feat-cc into fix/qc-nov12)
3. I'll guide you through each step
4. We'll test everything works

**Estimated time**: 30-45 minutes for complete merge + testing

Let me know if you'd like to proceed! 🚀

