# Query Construction & Narrative Query Analysis
## Context: Finding Events with Speakers for Sales Outreach

**Date:** 2025-11-30  
**Purpose:** Analyze current query construction and narrative query strategies to improve discovery of events with speakers for sales outreach

---

## Executive Summary

The current query construction system is optimized for general event discovery but **lacks explicit focus on speaker-rich events**, which are critical for sales outreach. Narrative queries are simplified to 80-120 characters but don't signal the need for speaker data, resulting in events being discovered that may not have published speaker information.

**Key Finding:** The system discovers events first, then extracts speakers. This approach misses events that prominently feature speakers in their marketing but may not be discovered by generic queries.

---

## Current Query Construction Architecture

### 1. Narrative Query Structure

**Current Format:**
```
{userSearchTerm} {industryTerms} {eventType} {year}
```

**Examples:**
- `"compliance conference 2026"`
- `"legal compliance conference"`
- `"business conference"`

**Characteristics:**
- ✅ Concise (80-120 characters)
- ✅ Includes year for future dates
- ✅ Prioritizes user search terms
- ❌ **No mention of speakers, agenda, or program**
- ❌ **No signal that speaker data is required**
- ❌ **Doesn't prioritize events with published speaker lists**

### 2. Enhanced Query Structure (for CSE/Database)

**Current Format:**
```
{baseQuery} ({eventTypes OR ...}) ({locationTerms OR ...}) ({temporalTerms OR ...})
```

**Example:**
```
legal compliance (conference OR event OR summit) (Germany OR Berlin) (2026 OR upcoming)
```

**Characteristics:**
- ✅ Comprehensive coverage with OR logic
- ✅ Multiple event types, locations, temporal terms
- ❌ **No speaker-related keywords**
- ❌ **No agenda/program keywords**

### 3. Query Variations

**Current Approach:**
- 13 query variations generated
- Focus on event types, locations, temporal terms
- **Missing:** Speaker-focused variations

**Current Variations:**
1. Event type focused
2. Location focused
3. Temporal focused
4. Natural language
5. Multi-language

**Missing Variations:**
- ❌ Speaker-focused: `"{topic} conference speakers 2026"`
- ❌ Agenda-focused: `"{topic} conference agenda program 2026"`
- ❌ Program-focused: `"{topic} conference program speakers list"`

---

## Current Speaker Discovery Flow

### Discovery Phase
1. **Query Construction** → Generic event queries (no speaker focus)
2. **Search Execution** → Firecrawl/CSE/Database search
3. **URL Collection** → Event pages discovered
4. **URL Filtering** → Generic listings filtered out

### Extraction Phase
1. **Deep Crawling** → Event pages crawled
2. **Sub-page Discovery** → Looks for `/speakers/`, `/agenda/`, `/program/`
3. **Speaker Extraction** → Extracts from main page + sub-pages
4. **PDF Extraction** → Extracts from linked PDFs

**Problem:** If an event doesn't have a prominent speaker section on the main page, it may not be prioritized for deep crawling, even if speakers exist.

---

## Issues Identified

### 1. **Narrative Queries Don't Signal Speaker Need**

**Current:**
```
"compliance conference 2026"
```

**Problem:** Firecrawl doesn't know we need speaker data, so it may return events without published speaker information.

**Impact:** 
- Events discovered may not have speakers
- Wasted extraction time on events without speaker data
- Lower quality results for sales outreach

### 2. **No Speaker-Focused Query Variations**

**Current:** All variations focus on event discovery, not speaker discovery.

**Missing:**
- `"{topic} conference speakers 2026"`
- `"{topic} conference with speakers agenda"`
- `"{topic} conference speaker lineup 2026"`

**Impact:**
- Events with prominent speaker sections may not be discovered
- Speaker-rich events may rank lower in results

### 3. **Query Doesn't Prioritize Speaker-Rich Events**

**Current:** Generic event queries return all events equally.

**Missing:** No signal to prioritize:
- Events with published speaker lists
- Events with detailed agendas
- Events with program information

### 4. **No Multi-Language Speaker Terms**

**Current:** Event types have multi-language support, but speaker terms don't.

**Missing:**
- German: `"referenten"`, `"vortragende"`, `"sprecher"`
- French: `"conférenciers"`, `"intervenants"`, `"orateurs"`
- English: `"speakers"`, `"presenters"`, `"panelists"`

### 5. **Narrative Query Too Generic for Sales Outreach**

**Current:** `"compliance conference 2026"`

**Better for Sales Outreach:**
- `"compliance conference speakers 2026"`
- `"compliance conference with speakers agenda 2026"`
- `"compliance conference speaker lineup program 2026"`

---

## Recommendations

### Priority 1: Enhance Narrative Queries for Speaker Discovery

#### 1.1 Add Speaker Keywords to Narrative Queries

**Current:**
```typescript
function buildNarrativeQuery(...) {
  return `${userSearchTerm} ${primaryEventType}`;
}
```

**Recommended:**
```typescript
function buildNarrativeQuery(...) {
  const speakerTerms = getSpeakerTerms(language); // ["speakers", "agenda", "program"]
  const baseQuery = `${userSearchTerm} ${primaryEventType}`;
  
  // Add speaker terms for sales outreach context
  if (includeSpeakerFocus) {
    return `${baseQuery} ${speakerTerms[0]}`; // "compliance conference speakers 2026"
  }
  return baseQuery;
}
```

**Benefits:**
- Firecrawl will prioritize events with speaker information
- Better alignment with sales outreach use case
- Higher quality results

#### 1.2 Create Speaker-Focused Query Variations

**Add to `generateQueryVariations()`:**
```typescript
// Variation: Speaker-focused
const speakerTerms = getSpeakerTerms(language);
const speakerQuery = `${baseQuery} ${firstEventType} ${speakerTerms[0]} ${firstTemporal}`;
variations.push(speakerQuery);

// Variation: Agenda-focused
const agendaTerms = getAgendaTerms(language);
const agendaQuery = `${baseQuery} ${firstEventType} ${agendaTerms[0]} ${firstTemporal}`;
variations.push(agendaQuery);
```

**Benefits:**
- Discovers events with prominent speaker sections
- Better coverage of speaker-rich events
- Higher probability of finding events with published speaker lists

### Priority 2: Add Multi-Language Speaker Terms

#### 2.1 Create Speaker Terms Dictionary

**Add to `src/config/search-dictionaries.ts`:**
```typescript
export const SPEAKER_TERMS = {
  'en': ['speakers', 'presenters', 'panelists', 'keynotes', 'agenda', 'program', 'lineup'],
  'de': ['referenten', 'vortragende', 'sprecher', 'agenda', 'programm', 'fachprogramm'],
  'fr': ['conférenciers', 'intervenants', 'orateurs', 'agenda', 'programme']
};

export const AGENDA_TERMS = {
  'en': ['agenda', 'program', 'schedule', 'lineup', 'speakers list'],
  'de': ['agenda', 'programm', 'fachprogramm', 'zeitplan', 'referentenliste'],
  'fr': ['agenda', 'programme', 'horaire', 'liste des conférenciers']
};
```

**Benefits:**
- Better discovery in non-English markets
- More comprehensive coverage
- Aligns with existing multi-language support

### Priority 3: Enhance Query Builder for Sales Outreach Context

#### 3.1 Add `salesOutreach` Flag to Query Builder

**Add to `QueryBuilderParams`:**
```typescript
export interface QueryBuilderParams {
  // ... existing params
  salesOutreach?: boolean; // If true, prioritize speaker-rich events
}
```

**Modify `buildNarrativeQuery()`:**
```typescript
function buildNarrativeQuery(params: {
  // ... existing params
  salesOutreach?: boolean;
}): string {
  const { salesOutreach, language, ... } = params;
  
  if (salesOutreach) {
    const speakerTerms = SPEAKER_TERMS[language] || SPEAKER_TERMS.en;
    return `${baseQuery} ${primaryEventType} ${speakerTerms[0]}`;
  }
  
  // Existing logic...
}
```

**Benefits:**
- Context-aware query construction
- Better results for sales outreach use case
- Maintains backward compatibility

#### 3.2 Prioritize Speaker-Rich Events in Discovery

**Modify `discoverEventCandidates()`:**
```typescript
// Add speaker-focused query variations when salesOutreach is true
if (params.salesOutreach) {
  const speakerVariations = generateSpeakerFocusedVariations(baseQuery, language);
  queryVariations.push(...speakerVariations);
}
```

**Benefits:**
- More speaker-rich events discovered
- Better alignment with use case
- Higher quality results

### Priority 4: Improve Query Signal for Firecrawl

#### 4.1 Use More Descriptive Narrative Queries

**Current:**
```
"compliance conference 2026"
```

**Recommended:**
```
"compliance conference with speakers 2026"
"compliance conference speakers agenda 2026"
```

**Benefits:**
- Firecrawl understands we need speaker data
- Better ranking of speaker-rich events
- More relevant results

#### 4.2 Add Speaker Context to Extraction Prompt

**Current:** Extraction prompt mentions speakers but doesn't prioritize them.

**Recommended:** Add to narrative query context:
```
"Find compliance conferences in 2026 that publish speaker lists, agendas, and programs"
```

**Benefits:**
- Firecrawl prioritizes events with published speaker information
- Better alignment with extraction requirements
- Higher quality discovery

### Priority 5: Optimize Query Variations for Speaker Discovery

#### 5.1 Add Speaker-Focused Variations

**Current:** 5 variations (event type, location, temporal, natural language, multi-language)

**Recommended:** Add 3 more variations:
1. **Speaker-focused:** `"{topic} conference speakers 2026"`
2. **Agenda-focused:** `"{topic} conference agenda program 2026"`
3. **Program-focused:** `"{topic} conference program speakers list 2026"`

**Benefits:**
- Better coverage of speaker-rich events
- Discovers events with different speaker page structures
- Higher probability of finding events with published speaker lists

#### 5.2 Weight Speaker Variations Higher

**Current:** All variations treated equally.

**Recommended:** When `salesOutreach` is true, prioritize speaker-focused variations:
```typescript
const variations = [
  ...speakerFocusedVariations, // Higher priority
  ...standardVariations        // Lower priority
];
```

**Benefits:**
- Speaker-rich events discovered first
- Better alignment with use case
- Higher quality results

---

## Implementation Plan

### Phase 1: Quick Wins (1-2 days)

1. ✅ Add speaker terms to narrative queries
2. ✅ Create speaker terms dictionary
3. ✅ Add speaker-focused query variations

**Files to Modify:**
- `src/lib/unified-query-builder.ts`
- `src/lib/services/weighted-query-builder.ts`
- `src/config/search-dictionaries.ts`

### Phase 2: Enhanced Context (2-3 days)

1. ✅ Add `salesOutreach` flag to query builder
2. ✅ Enhance narrative queries with speaker context
3. ✅ Prioritize speaker-focused variations

**Files to Modify:**
- `src/lib/unified-query-builder.ts`
- `src/lib/optimized-orchestrator.ts`
- `src/lib/services/weighted-query-builder.ts`

### Phase 3: Advanced Optimization (3-5 days)

1. ✅ Add speaker context to Firecrawl extraction prompt
2. ✅ Weight speaker variations higher
3. ✅ Add speaker-focused sub-page discovery

**Files to Modify:**
- `src/lib/services/firecrawl-search-service.ts`
- `src/lib/event-pipeline/discover.ts`
- `src/lib/optimized-orchestrator.ts`

---

## Expected Impact

### Before (Current)
- **Discovery:** Generic event queries
- **Speaker Discovery:** Happens during extraction phase
- **Result Quality:** Mixed (some events have speakers, some don't)
- **Sales Outreach Fit:** Moderate (need to filter for events with speakers)

### After (Recommended)
- **Discovery:** Speaker-focused queries + generic queries
- **Speaker Discovery:** Happens during discovery phase (better prioritization)
- **Result Quality:** High (events with published speaker information prioritized)
- **Sales Outreach Fit:** Excellent (events discovered are more likely to have speakers)

### Metrics to Track

1. **Speaker Discovery Rate:** % of discovered events with speakers
2. **Query Relevance:** % of queries that return speaker-rich events
3. **Extraction Efficiency:** % of extractions that find speakers
4. **Sales Outreach Fit:** % of events suitable for sales outreach

---

## Code Examples

### Example 1: Enhanced Narrative Query

**Before:**
```typescript
buildNarrativeQuery({ baseQuery: "compliance", eventTypes: ["conference"], ... })
// Returns: "compliance conference 2026"
```

**After:**
```typescript
buildNarrativeQuery({ 
  baseQuery: "compliance", 
  eventTypes: ["conference"], 
  salesOutreach: true,
  language: "en",
  ...
})
// Returns: "compliance conference speakers 2026"
```

### Example 2: Speaker-Focused Query Variations

**Before:**
```typescript
generateQueryVariations({ baseQuery: "compliance", ... })
// Returns: [
//   "compliance (conference OR event) Germany 2026",
//   "compliance conference (Germany OR Berlin) 2026",
//   ...
// ]
```

**After:**
```typescript
generateQueryVariations({ 
  baseQuery: "compliance", 
  salesOutreach: true,
  language: "en",
  ...
})
// Returns: [
//   "compliance conference speakers 2026",        // NEW
//   "compliance conference agenda program 2026", // NEW
//   "compliance (conference OR event) Germany 2026",
//   ...
// ]
```

### Example 3: Multi-Language Speaker Terms

**Before:**
```typescript
// No speaker terms in queries
```

**After:**
```typescript
const speakerTerms = SPEAKER_TERMS[language] || SPEAKER_TERMS.en;
// English: ["speakers", "presenters", "agenda", "program"]
// German: ["referenten", "vortragende", "agenda", "programm"]
// French: ["conférenciers", "intervenants", "agenda", "programme"]
```

---

## Conclusion

The current query construction system is well-optimized for general event discovery but **lacks explicit focus on speaker-rich events**, which are critical for sales outreach. By enhancing narrative queries with speaker terms, adding speaker-focused query variations, and prioritizing speaker-rich events, we can significantly improve the quality of discovered events for sales outreach.

**Key Recommendations:**
1. ✅ Add speaker terms to narrative queries
2. ✅ Create speaker-focused query variations
3. ✅ Add multi-language speaker terms
4. ✅ Enhance query builder for sales outreach context
5. ✅ Prioritize speaker-rich events in discovery

**Expected Outcome:**
- Higher speaker discovery rate
- Better alignment with sales outreach use case
- More relevant results for sales teams
- Improved extraction efficiency

---

## Next Steps

1. **Review this analysis** with the team
2. **Prioritize recommendations** based on impact vs. effort
3. **Implement Phase 1** (Quick Wins) first
4. **Test and measure** impact on speaker discovery rate
5. **Iterate** based on results


