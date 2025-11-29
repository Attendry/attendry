# Relevance Scoring & Match Reasons - Current State Audit

## ✅ What Already Exists

### 1. **RelevanceIndicator Component** (`src/components/RelevanceIndicator.tsx`)
- ✅ Fully implemented UI component
- ✅ Shows match reasons with icons
- ✅ Displays confidence scores
- ✅ Compact and expanded views
- ✅ Already used in `EventCard.tsx` (line 724-730)

### 2. **extractMatchReasons Function** (`src/components/RelevanceIndicator.tsx`)
- ✅ Extracts basic match reasons:
  - Location match
  - Date match
  - Keyword match (from topics)
  - Organizer match
- ✅ Already called in `EventCard.tsx` (line 179-182)

### 3. **RelevanceService** (`src/lib/services/relevance-service.ts`)
- ✅ Comprehensive relevance scoring service
- ✅ Calculates scores based on:
  - Industry terms match (40% weight)
  - ICP terms match (30% weight)
  - Competitor presence (20% weight)
  - Data quality (10% weight)
  - Recency bonus (5% bonus)
- ✅ Returns relevance scores (0-1) with reasons
- ✅ Includes matched terms breakdown

### 4. **Quality Scoring** (`src/lib/quality/eventQuality.ts`)
- ✅ `computeQuality()` function
- ✅ `isSolidHit()` function
- ✅ Used in optimized orchestrator

### 5. **Confidence Scores**
- ✅ Events already have `confidence` field
- ✅ Displayed in RelevanceIndicator

---

## ❌ What's Missing

### 1. **RelevanceService NOT Integrated into Search Pipeline**
- ❌ `/api/events/run` does NOT call RelevanceService
- ❌ `/api/events/run-progressive` does NOT call RelevanceService
- ❌ RelevanceService only used in `/api/events/relevant-calendar` (separate endpoint)

### 2. **No Relevance Scores in Search Results**
- ❌ Search results don't include relevance scores
- ❌ RelevanceService not called with user profile
- ❌ Scores not passed to frontend

### 3. **No Sorting by Relevance**
- ❌ Events search page has no sort options
- ❌ Results not sorted by relevance by default
- ❌ No UI for sorting (relevance/date/quality)

### 4. **Match Reasons Are Basic**
- ⚠️ `extractMatchReasons` only checks:
  - Location (country match)
  - Date (in range)
  - Keywords (from topics)
  - Organizer
- ❌ Does NOT check:
  - User profile industry terms
  - User profile ICP terms
  - User profile competitors
  - Keyword matches in title/description (only topics)

### 5. **No Keyword Highlighting**
- ❌ Search query keywords not highlighted in snippets
- ❌ `highlightKeywords` function exists but not used in EventCard

---

## 🎯 What Needs to Be Built

### Priority 1: Integrate RelevanceService into Search Pipeline
**Files to modify:**
- `src/app/api/events/run/route.ts`
- `src/app/api/events/run-progressive/route.ts`

**What to do:**
1. Load user profile in search endpoint
2. Call `RelevanceService.calculateRelevanceScores()` for results
3. Attach relevance scores to events
4. Sort results by relevance score (default)

### Priority 2: Enhance Match Reasons
**Files to modify:**
- `src/components/RelevanceIndicator.tsx` (extractMatchReasons function)

**What to do:**
1. Check user profile industry terms in title/description
2. Check user profile ICP terms
3. Check user profile competitors
4. Extract keyword matches from search query
5. Merge with RelevanceService matched terms

### Priority 3: Add Sorting UI
**Files to modify:**
- `src/app/(protected)/events/EventsPageNew.tsx`

**What to do:**
1. Add sort dropdown (Relevance, Date, Quality)
2. Implement sorting logic
3. Persist sort preference

### Priority 4: Keyword Highlighting
**Files to modify:**
- `src/components/EventCard.tsx`

**What to do:**
1. Use `highlightKeywords` function
2. Highlight matched keywords in description
3. Show highlighted keywords in RelevanceIndicator

---

## 📋 Implementation Plan

### Step 1: Integrate RelevanceService (Backend)
1. Modify `/api/events/run` to:
   - Load user profile
   - Calculate relevance scores for results
   - Attach scores to events
   - Sort by relevance

2. Modify `/api/events/run-progressive` to:
   - Same as above, but for each stage

### Step 2: Enhance Match Reasons (Frontend)
1. Update `extractMatchReasons` to:
   - Accept user profile
   - Check industry/ICP/competitor matches
   - Extract keywords from search query
   - Merge with RelevanceService results

2. Update `EventCard` to:
   - Pass user profile to `extractMatchReasons`
   - Use enhanced match reasons

### Step 3: Add Sorting (Frontend)
1. Add sort dropdown to EventsPageNew
2. Implement sort logic
3. Update SearchResultsContext if needed

### Step 4: Keyword Highlighting (Frontend)
1. Use `highlightKeywords` in EventCard description
2. Show highlighted keywords in RelevanceIndicator

---

## 🚀 Quick Win: Start with Step 1

The biggest gap is that **RelevanceService exists but isn't being used in search**. 

**Immediate action:**
- Integrate RelevanceService into `/api/events/run-progressive`
- Calculate and attach relevance scores
- Sort results by relevance

This will give users relevance scores immediately, even if match reasons are still basic.

