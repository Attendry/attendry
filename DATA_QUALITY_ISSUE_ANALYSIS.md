# Data Quality Issue Analysis - collected_events Table
**Date:** 2025-11-14  
**Issue:** Missing sponsors, competitors, topics, and other fields in collected_events table

---

## Problem Summary

**Current State:**
- 52 events in `collected_events` table
- Quality: 3/10
- **Missing:** Sponsors, Competitors (completely absent)
- **Missing:** Topics, participating_organizations, partners
- **Missing:** extraction_method, source_domain
- Extraction method shows "run" or "firecrawl" but not properly stored

---

## Root Cause

**Location:** `src/app/api/cron/collect-events/route.ts` - `storeEventsInDatabase()` function (lines 288-340)

**Issue:** The function is **NOT storing** all available fields from the event data.

**Current Code (BROKEN):**
```typescript
const eventsToInsert = events.map(event => ({
  title: event.title,
  description: event.description,
  starts_at: event.starts_at,
  ends_at: event.ends_at,
  city: event.city,
  country: event.country,
  location: event.location,
  venue: event.venue,
  organizer: event.organizer,
  source_url: event.source_url,
  speakers: event.speakers || [],
  confidence: event.confidence || 0.5,
  collected_at: new Date().toISOString(),
  collection_metadata: { ... }
}));
```

**Missing Fields:**
- ❌ `sponsors` - NOT stored
- ❌ `competitors` - NOT stored
- ❌ `topics` - NOT stored
- ❌ `participating_organizations` - NOT stored
- ❌ `partners` - NOT stored
- ❌ `extraction_method` - NOT stored
- ❌ `source_domain` - NOT stored

---

## Data Availability

**✅ The data IS available** from `SearchService.runEventDiscovery()`:

From `src/lib/services/search-service.ts` - `EventRec` interface (lines 46-66):
```typescript
export interface EventRec {
  source_url: string;
  title?: string;
  description?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  city?: string | null;
  country?: string | null;
  location?: string | null;
  venue?: string | null;
  organizer?: string | null;
  topics?: string[] | null;  // ✅ Available
  speakers?: { ... }[] | null;
  sponsors?: string[] | null;  // ✅ Available
  participating_organizations?: string[] | null;  // ✅ Available
  partners?: string[] | null;  // ✅ Available
  competitors?: string[] | null;  // ✅ Available
  confidence?: number | null;
  ...
}
```

**The extraction process DOES extract these fields** (see `processExtractResults` at line 1437-1478):
```typescript
events.push({
  ...
  topics: event.topics || null,
  speakers: event.speakers || null,
  sponsors: event.sponsors || null,  // ✅ Extracted
  participating_organizations: event.participating_organizations || null,  // ✅ Extracted
  partners: event.partners || null,  // ✅ Extracted
  competitors: event.competitors || null,  // ✅ Extracted
  ...
});
```

**Conclusion:** The data is being extracted correctly, but **NOT being stored** in the database.

---

## Extraction Method Issue

**Current State:**
- Extraction method shows "run" or "firecrawl" in database
- But `extraction_method` field is NOT being set in `storeEventsInDatabase()`

**What "run" means:**
- Likely refers to events extracted via `/api/events/run` endpoint
- Should be "firecrawl" for cron jobs (which use Firecrawl provider)

**Fix Needed:**
- Set `extraction_method` based on metadata or provider
- For cron jobs: `extraction_method: 'firecrawl'` (since provider is "firecrawl")

---

## Impact

**High Impact:**
1. **Trend Analysis** - Can't analyze sponsor/competitor trends
2. **Market Intelligence** - Missing company participation data
3. **Event Intelligence** - Can't generate sponsor/competitor insights
4. **Data Completeness** - Low quality scores (3/10)

**Features Affected:**
- Hot topics analysis (needs topics)
- Sponsor analysis (needs sponsors)
- Competitor tracking (needs competitors)
- Company intelligence (needs participating_organizations)

---

## Solution

### Fix 1: Update `storeEventsInDatabase()` in cron job

**File:** `src/app/api/cron/collect-events/route.ts`

**Changes Needed:**
1. Add missing fields to `eventsToInsert` mapping
2. Set `extraction_method` based on provider
3. Extract `source_domain` from `source_url`
4. Calculate `data_completeness` score

### Fix 2: Update `storeEventsInDatabase()` in deep collection

**File:** `src/app/api/cron/collect-events-deep/route.ts`

**Same fixes needed** (function is duplicated)

---

## Recommended Fix

Update the `storeEventsInDatabase` function to include all fields:

```typescript
async function storeEventsInDatabase(events: any[], metadata: any): Promise<number> {
  try {
    const supabase = await supabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    // Prepare events for database insertion
    const eventsToInsert = events.map(event => {
      // Extract source domain from URL
      let sourceDomain = null;
      try {
        sourceDomain = new URL(event.source_url).hostname;
      } catch {
        // Invalid URL, skip domain extraction
      }

      // Calculate data completeness score
      const fields = {
        title: !!event.title,
        description: !!event.description,
        starts_at: !!event.starts_at,
        city: !!event.city,
        country: !!event.country,
        venue: !!event.venue,
        organizer: !!event.organizer,
        topics: !!(event.topics && event.topics.length > 0),
        speakers: !!(event.speakers && event.speakers.length > 0),
        sponsors: !!(event.sponsors && event.sponsors.length > 0),
        participating_organizations: !!(event.participating_organizations && event.participating_organizations.length > 0),
        partners: !!(event.partners && event.partners.length > 0),
        competitors: !!(event.competitors && event.competitors.length > 0),
      };
      const completenessScore = Object.values(fields).filter(Boolean).length / Object.keys(fields).length;

      return {
        title: event.title,
        description: event.description,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        city: event.city,
        country: event.country,
        location: event.location,
        venue: event.venue,
        organizer: event.organizer,
        source_url: event.source_url,
        source_domain: sourceDomain,
        description: event.description,
        topics: event.topics || [],
        speakers: event.speakers || [],
        sponsors: event.sponsors || [],
        participating_organizations: event.participating_organizations || [],
        partners: event.partners || [],
        competitors: event.competitors || [],
        extraction_method: metadata.source === 'cron_firecrawl' ? 'firecrawl' : 'run',
        confidence: event.confidence || 0.5,
        data_completeness: Math.round(completenessScore * 100) / 100,
        collected_at: new Date().toISOString(),
        industry: metadata.industry,
        search_terms: [metadata.industry],
        collection_metadata: {
          source: metadata.source,
          industry: metadata.industry,
          country: metadata.country,
          from: metadata.from,
          to: metadata.to,
          collectedAt: metadata.collectedAt
        }
      };
    });

    // Insert events (upsert to avoid duplicates)
    const { data, error } = await supabase
      .from('collected_events')
      .upsert(eventsToInsert, { 
        onConflict: 'source_url',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('Database insertion error:', error);
      throw error;
    }

    console.log(`[CRON] Stored ${eventsToInsert.length} events in database for ${metadata.country}/${metadata.industry}`);
    return eventsToInsert.length;

  } catch (error: any) {
    console.error('[CRON] Failed to store events in database:', error.message);
    return 0;
  }
}
```

---

## Additional Recommendations

### 1. Backfill Existing Data
- Create a migration script to re-extract missing fields for existing 52 events
- Or mark them for re-collection in next cron run

### 2. Improve Extraction Quality
- Review Firecrawl extraction prompts to ensure sponsors/competitors are captured
- Add fallback extraction methods if Firecrawl misses data

### 3. Add Validation
- Add data quality checks before storing
- Log warnings for events with low completeness scores
- Set minimum thresholds for storage

### 4. Monitor Data Quality
- Track `data_completeness` scores over time
- Alert if quality drops below threshold
- Dashboard showing field coverage statistics

---

## Testing Checklist

After fix:
- [ ] Verify sponsors are stored
- [ ] Verify competitors are stored
- [ ] Verify topics are stored
- [ ] Verify extraction_method is set correctly
- [ ] Verify source_domain is extracted
- [ ] Verify data_completeness is calculated
- [ ] Test with new cron run
- [ ] Check database for all fields populated

---

**End of Analysis**

