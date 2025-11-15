# Root Cause: Kartellrecht Events Filtered Out

## Problem
2 Kartellrecht events were discovered and extracted, but **not shown to the user**.

## Root Cause Analysis

### Filtering Pipeline

Events go through multiple filtering stages:

1. **Discovery** ✅ - Events found
2. **Prioritization** ✅ - Events prioritized (2/12 candidates)
3. **Extraction** ✅ - Deep crawl started
4. **Content Filtering** ❌ - **LIKELY FAILED HERE**
5. **Quality Gate** ❌ - **OR FAILED HERE**

---

### Stage 4: Content Filtering (`filterByContentRelevance`)

**Location:** `src/lib/optimized-orchestrator.ts:2182-2249`

**Logic:**
```typescript
// Filters events by user profile industry terms
const industryTerms = ['compliance', 'investigations', 'audit', ...];
const hasIndustryMatch = industryTerms.some(term => 
  regex.test(`${eventTitle} ${eventDescription}`)
);

if (!hasIndustryMatch) {
  console.log(`✗ Event filtered out (no match): "${eventTitle}"`);
  return false; // EVENT REJECTED
}
```

**Problem:**
- User profile has: `['compliance', 'investigations', 'audit', 'legal technology', 'internal audit']`
- Kartellrecht events might not contain these exact terms
- "Kartellrecht" = "antitrust law" / "competition law" - different domain!

**Example:**
- Event: "Kartellrecht November 2025"
- Content: "Kartellrecht, Wettbewerbsrecht, competition law"
- Industry terms: "compliance, investigations, audit"
- **Result:** ❌ **NO MATCH** - Filtered out!

---

### Stage 5: Quality Gate (`isSolidHit`)

**Location:** `src/lib/quality/eventQuality.ts:66-133`

**Requirements:**
1. **≥2 speakers** (required)
2. **Valid date** (in window or within tolerance)
3. **Quality score** (based on date, location, speakers, etc.)

**Potential Issues:**
- If extraction didn't find ≥2 speakers → **REJECTED**
- If date extraction failed or date outside window → **REJECTED**
- If quality score too low → **REJECTED**

---

## Why Logs Don't Show Filtering

The logs cut off at:
```
[optimized-orchestrator] Deep crawling event: https://www.diruj.de/produkt/kartellrecht-november-2025/
[event-analysis] Processing 4 metadata chunks...
```

**Missing logs:**
- Extraction completion
- Content filtering results: `[optimized-orchestrator] ✗ Event filtered out (no match)`
- Quality gate results: `[quality-gate] Filtered: "..." | Quality: X.XX`

**Possible reasons:**
1. Extraction still in progress (logs incomplete)
2. Extraction failed silently
3. Filtering happened but logs not captured

---

## Most Likely Root Cause

### **Content Filtering Mismatch**

**Hypothesis:**
1. Kartellrecht events extracted successfully
2. Content filtering checked for: "compliance", "investigations", "audit"
3. Kartellrecht events contain: "Kartellrecht", "Wettbewerbsrecht", "competition law"
4. **No match** → Events filtered out
5. User sees 0 results

**Evidence:**
- User profile industry terms: `['compliance', 'investigations', 'audit', ...]`
- Kartellrecht is a **different legal domain** (antitrust/competition law)
- Content filter requires **exact term match** in title/description
- "Kartellrecht" ≠ "compliance" → **No match**

---

## Solution

### Option 1: Include User Search Keyword in Content Filter

**File:** `src/lib/optimized-orchestrator.ts:2182-2249`

**Change:** When user provides search keyword, include it in content filtering:

```typescript
async function filterByContentRelevance(events: EventCandidate[], params: OptimizedSearchParams): Promise<EventCandidate[]> {
  const userProfile = await getUserProfile();
  
  // Get user search keyword (e.g., "Kartellrecht")
  const userKeyword = params.userText?.toLowerCase().trim();
  
  // Build search terms: user keyword + profile terms
  const searchTerms: string[] = [];
  
  if (userKeyword) {
    // Add user keyword and its translations
    searchTerms.push(userKeyword);
    const keywordContext = getKeywordContext(userKeyword);
    if (keywordContext) {
      searchTerms.push(...keywordContext.split(', ').map(t => t.toLowerCase()));
    }
  }
  
  // Add profile industry terms
  if (userProfile?.industry_terms) {
    searchTerms.push(...userProfile.industry_terms.map(t => t.toLowerCase()));
  }
  
  // Filter: event must match ANY search term
  return events.filter(event => {
    const searchText = `${event.title} ${event.description}`.toLowerCase();
    const hasMatch = searchTerms.some(term => {
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(searchText);
    });
    
    if (hasMatch) {
      console.log(`✓ Event matches search terms: "${event.title}"`);
      return true;
    }
    
    console.log(`✗ Event filtered out (no match): "${event.title}"`);
    return false;
  });
}
```

**Benefits:**
- Kartellrecht events will match "Kartellrecht" keyword
- Also matches "antitrust law", "competition law" translations
- Still respects user profile terms for non-keyword searches

---

### Option 2: Bypass Content Filter for Keyword Searches

**Change:** If user provides specific keyword, skip content filtering:

```typescript
// If user provided specific keyword, don't filter by profile terms
if (params.userText && params.userText.trim()) {
  console.log('[optimized-orchestrator] User keyword provided, skipping content filtering');
  return events;
}
```

**Benefits:**
- Simple fix
- User keyword searches always return results
- But: May return irrelevant events if keyword is too broad

---

### Option 3: Make Content Filter More Lenient

**Change:** Use keyword matching instead of exact term matching:

```typescript
// Check if event title/description contains user keyword OR profile terms
const hasMatch = 
  (userKeyword && searchText.includes(userKeyword)) ||
  industryTerms.some(term => searchText.includes(term));
```

**Benefits:**
- More lenient matching
- But: May return false positives

---

## Recommended Fix

**Option 1** is best because:
1. Respects user intent (keyword search)
2. Still uses profile terms for context
3. Includes keyword translations for better matching
4. Maintains quality standards

---

## Verification

After fix, logs should show:
```
[optimized-orchestrator] Filtering with search terms: ['kartellrecht', 'antitrust law', 'competition law', 'compliance', ...]
[optimized-orchestrator] ✓ Event matches search terms: "Kartellrecht November 2025"
[quality-gate] Quality scoring: 2 → 2 solid hits
```

Instead of:
```
[optimized-orchestrator] ✗ Event filtered out (no match): "Kartellrecht November 2025"
```

