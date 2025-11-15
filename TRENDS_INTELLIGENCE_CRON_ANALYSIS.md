# Trends & Market Intelligence - Cron Usage Analysis
**Date:** 2025-11-14  
**Purpose:** Comprehensive analysis of how trends and market intelligence features use cron jobs and collected_events data

---

## Executive Summary

**✅ YES - Trends and Market Intelligence features heavily depend on cron jobs!**

The trends and market intelligence features are **directly powered by** the cron-collected events data. Here's how:

1. **Trend Analysis** - Queries `collected_events` table directly for trend calculations
2. **Event Intelligence** - Pre-computed by cron job (`/api/cron/precompute-intelligence`)
3. **Market Intelligence** - Uses `collected_events` for company/account analysis
4. **Trending Events API** - Reads from `collected_events` for hot topics and emerging themes

**Key Finding:** Without cron jobs collecting events, these features would have **no data to analyze**.

---

## Data Flow Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CRON JOBS (Background)                   │
│  /api/cron/collect-events (Daily 2 AM UTC)                  │
│  /api/cron/collect-events-deep (Weekly Sunday 3 AM UTC)     │
│  └─ Stores events in collected_events table                 │
│                                                              │
│  /api/cron/precompute-intelligence (Every 6 hours)         │
│  └─ Processes intelligence_queue                            │
│     └─ Generates event_intelligence from collected_events   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Events stored in database
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              collected_events TABLE (Supabase)              │
│  - Events with: title, dates, topics, speakers, sponsors    │
│  - Indexed by: starts_at, collected_at, country, industry  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Queried by:
                       ├──────────────────────────────────────┐
                       │                                      │
                       ▼                                      ▼
        ┌──────────────────────────┐         ┌──────────────────────────┐
        │  Trend Analysis Service  │         │  Intelligence Queue      │
        │  - Hot topics            │         │  - Pre-compute intel     │
        │  - Emerging themes       │         │  - Event insights        │
        │  - Category trends       │         │  - Outreach recs         │
        └───────────┬──────────────┘         └───────────┬──────────────┘
                    │                                    │
                    │ Used by:                          │ Used by:
                    │ - /api/events/trending            │ - /api/cron/precompute-intelligence
                    │ - Trend snapshots                 │ - /api/events/[id]/intelligence
                    │                                    │
                    ▼                                    ▼
        ┌──────────────────────────────────────────────────────────┐
        │              USER-FACING ENDPOINTS                         │
        │  - /api/events/trending (trending events)                │
        │  - /api/events/[id]/intelligence (event insights)        │
        │  - Market Intelligence Module (account analysis)          │
        └──────────────────────┬─────────────────────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────────────────┐
        │                    FRONTEND PAGES                         │
        │  - Trending events display                                │
        │  - Event intelligence cards                               │
        │  - Market intelligence dashboard                           │
        └──────────────────────────────────────────────────────────┘
```

---

## 1. Trend Analysis Service

### Location
- **Service:** `src/lib/services/trend-analysis-service.ts`
- **API Endpoint:** `src/app/api/events/trending/route.ts`

### How It Uses Cron Data

**Direct Query to `collected_events`:**
```typescript
// From trend-analysis-service.ts (line 461)
const { data: eventsData, error } = await supabase
  .from('collected_events')
  .select('*')
  .not('starts_at', 'is', null)
  .gte('starts_at', getTimeWindowStart(timeWindow))
  .lte('starts_at', getTimeWindowEnd(timeWindow));
```

**From trending API (line 127-132):**
```typescript
// Get recent events based on time window
const daysBack = timeWindow === 'week' ? 7 : timeWindow === 'quarter' ? 90 : 30;
const startDate = new Date();
startDate.setDate(startDate.getDate() - daysBack);

const { data: recentEvents } = await supabase
  .from('collected_events')
  .select('*')
  .gte('collected_at', startDate.toISOString())
  .order('collected_at', { ascending: false })
  .limit(200);
```

### Features Powered by Cron Data

1. **Hot Topics Extraction**
   - Analyzes events from `collected_events` to identify trending topics
   - Uses LLM to extract hot topics from event descriptions
   - Calculates mention count, growth rate, momentum
   - **Source:** Events collected by cron jobs

2. **Emerging Themes**
   - Identifies new themes across events
   - Compares current period vs. previous period
   - Calculates growth rates
   - **Source:** Historical data from `collected_events`

3. **Category Trends**
   - Analyzes trends by industry category (Legal, FinTech, Healthcare, etc.)
   - Analyzes trends by event type (Conference, Summit, Workshop, etc.)
   - Calculates growth percentages
   - **Source:** Events grouped by topics/categories from `collected_events`

4. **Trend Snapshots**
   - Generates snapshots for week/month/quarter/year
   - Tracks topic frequencies over time
   - Calculates growth rates between periods
   - **Source:** Historical `collected_events` data

### Caching
- Results cached in `trend_analysis_cache` table
- TTL: 6 hours
- Cache key includes user profile hash for personalization

### Dependency on Cron
**✅ CRITICAL DEPENDENCY:** Without cron jobs collecting events, trend analysis would have **zero data** to analyze.

---

## 2. Event Intelligence Service

### Location
- **Service:** `src/lib/services/event-intelligence-service.ts`
- **API Endpoint:** `src/app/api/events/[eventId]/intelligence/route.ts`
- **Cron Job:** `src/app/api/cron/precompute-intelligence/route.ts`

### How It Uses Cron Data

**Intelligence Queue Processing:**
```typescript
// From intelligence-queue.ts (line 89-93)
// Get event from collected_events
const { data: event, error: eventError } = await supabase
  .from('collected_events')
  .select('*')
  .or(`id.eq.${item.event_id},source_url.eq.${item.event_id}`)
  .single();
```

**Event Lookup:**
```typescript
// From event-intelligence-service.ts (line 85-89)
// Try to find event by source_url
const { data: event } = await supabase
  .from('collected_events')
  .select('id')
  .eq('source_url', eventId)
  .maybeSingle();
```

### Features Powered by Cron Data

1. **Pre-computed Intelligence**
   - Cron job (`/api/cron/precompute-intelligence`) processes `intelligence_queue`
   - Reads events from `collected_events` table
   - Generates intelligence components:
     - **Discussions:** Themes, summary, key topics, speaker insights
     - **Sponsors:** Analysis, tiers, industries, strategic significance
     - **Location:** Venue context, accessibility, local market insights
     - **Outreach:** Positioning, recommended approach, key contacts, timing, messaging

2. **Intelligence Queue**
   - Events are queued for intelligence generation
   - Cron job processes queue every 6 hours
   - Processes 10 items per run (to avoid timeout)
   - **Source:** Events must be in `collected_events` table

3. **Caching**
   - Intelligence stored in `event_intelligence` table
   - Cached per user profile (personalized)
   - Expires after TTL period
   - **Source:** Generated from `collected_events` data

### Cron Job Details

**Schedule:** Every 6 hours (`0 */6 * * *`)

**Process:**
1. Get pending items from `intelligence_queue`
2. For each item, fetch event from `collected_events`
3. Generate intelligence using AI (Gemini/Claude)
4. Store in `event_intelligence` table
5. Mark queue item as completed

**Dependency on Cron:**
**✅ CRITICAL DEPENDENCY:** 
- Intelligence queue processes events from `collected_events`
- Without cron jobs collecting events, queue would be empty
- Intelligence generation requires event data (title, description, speakers, sponsors, etc.)

---

## 3. Trending Events API

### Location
- **API Endpoint:** `src/app/api/events/trending/route.ts`

### How It Uses Cron Data

**Direct Query:**
```typescript
// Get recent events (line 127-132)
const { data: recentEvents } = await supabase
  .from('collected_events')
  .select('*')
  .gte('collected_at', startDate.toISOString())
  .order('collected_at', { ascending: false })
  .limit(200);

// Get previous period events for growth calculation (line 153-157)
const { data: previousEvents } = await supabase
  .from('collected_events')
  .select('*')
  .gte('collected_at', previousStartDate.toISOString())
  .lt('collected_at', startDate.toISOString());
```

### Features Powered by Cron Data

1. **Trending Categories**
   - Analyzes industry categories (Legal, FinTech, Healthcare, etc.)
   - Analyzes event types (Conference, Summit, Workshop, etc.)
   - Calculates growth rates between periods
   - **Source:** Events from `collected_events`

2. **Hot Topics** (if `includeHotTopics=true`)
   - Extracts hot topics using LLM
   - Calculates mention count, growth rate, momentum
   - **Source:** Event descriptions from `collected_events`

3. **Emerging Themes** (if `includeHotTopics=true`)
   - Identifies emerging themes
   - Compares current vs. previous period
   - **Source:** Historical `collected_events` data

4. **Personalization**
   - Filters events by user profile (industry, ICP, competitors)
   - Provides personalized trending results
   - **Source:** Events filtered from `collected_events`

### Dependency on Cron
**✅ CRITICAL DEPENDENCY:** Trending API queries `collected_events` directly. Without cron jobs, there would be no trending data.

---

## 4. Market Intelligence

### Location
- **Service:** `src/lib/services/company-intelligence-ai-service.ts`
- **Queue:** `src/lib/services/company-intelligence-queue.ts`
- **Module:** `src/components/adaptive/modules/MarketIntelligenceModule.tsx`

### How It Uses Cron Data

**Event Participation Analysis:**
- Analyzes which companies participate in events
- Tracks speakers, sponsors, participating organizations
- **Source:** Event data from `collected_events` (speakers, sponsors, participating_organizations fields)

**Account Intelligence:**
- Identifies accounts (companies) from events
- Analyzes event participation patterns
- Tracks speaker appearances, sponsor relationships
- **Source:** Events collected by cron jobs

### Features Powered by Cron Data

1. **Company Intelligence**
   - Analyzes company participation in events
   - Tracks speaker appearances
   - Identifies sponsor relationships
   - **Source:** `collected_events.speakers`, `collected_events.sponsors`, `collected_events.participating_organizations`

2. **Account Recommendations**
   - Recommends accounts based on event participation
   - Identifies high-value accounts
   - **Source:** Events and company data from `collected_events`

3. **Market Trends**
   - Analyzes market trends from event data
   - Tracks industry participation
   - **Source:** Events grouped by industry/topics from `collected_events`

### Dependency on Cron
**✅ CRITICAL DEPENDENCY:** Market intelligence relies on event data (speakers, sponsors, organizations) collected by cron jobs.

---

## 5. Event Insights Service

### Location
- **Service:** `src/lib/services/event-insights-service.ts`

### How It Uses Cron Data

**Event Lookup:**
```typescript
// From event-insights-service.ts (line 62-72)
// Try to get event from collected_events first
const { data: event } = await supabase
  .from('collected_events')
  .select('*')
  .eq('id', eventId)
  .or(`source_url.eq.${eventId}`)
  .maybeSingle();
```

### Features Powered by Cron Data

1. **Event Insights**
   - Provides insights for specific events
   - Uses event data from `collected_events`
   - **Source:** Event details collected by cron jobs

2. **Board Item Integration**
   - Links board items to `collected_events`
   - Provides full event details when available
   - **Source:** Events stored by cron jobs

### Dependency on Cron
**✅ DEPENDENCY:** Event insights require event data from `collected_events` table.

---

## Summary: Cron Dependency Matrix

| Feature | Uses Cron Data | Dependency Level | Data Source |
|---------|---------------|------------------|-------------|
| **Trend Analysis** | ✅ Yes | **CRITICAL** | `collected_events` (direct query) |
| **Hot Topics** | ✅ Yes | **CRITICAL** | `collected_events` (event descriptions) |
| **Emerging Themes** | ✅ Yes | **CRITICAL** | `collected_events` (historical comparison) |
| **Trending Events API** | ✅ Yes | **CRITICAL** | `collected_events` (direct query) |
| **Event Intelligence** | ✅ Yes | **CRITICAL** | `collected_events` (via intelligence_queue) |
| **Pre-compute Intelligence** | ✅ Yes | **CRITICAL** | `collected_events` (cron processes queue) |
| **Market Intelligence** | ✅ Yes | **CRITICAL** | `collected_events` (speakers, sponsors, orgs) |
| **Account Intelligence** | ✅ Yes | **CRITICAL** | `collected_events` (company participation) |
| **Event Insights** | ✅ Yes | **HIGH** | `collected_events` (event details) |

---

## Key Insights

### ✅ What's Working

1. **Complete Integration**
   - All trends/intelligence features query `collected_events` directly
   - Cron jobs are the **sole source** of data for these features
   - Intelligence queue processes events from `collected_events`

2. **Efficient Processing**
   - Intelligence pre-computed by cron job (every 6 hours)
   - Results cached for fast retrieval
   - Queue-based processing prevents timeouts

3. **Personalization**
   - Trends filtered by user profile
   - Intelligence cached per user profile
   - Personalized hot topics and emerging themes

### ⚠️ Potential Issues

1. **Data Freshness**
   - Trend analysis uses events from last 7/30/90 days
   - If cron jobs fail, trends become stale
   - **Recommendation:** Monitor cron job execution

2. **Queue Backlog**
   - Intelligence queue processes 10 items per run
   - If queue grows faster than processing, backlog accumulates
   - **Recommendation:** Monitor queue size, increase batch size if needed

3. **No Fallback**
   - Features have no fallback if `collected_events` is empty
   - Would return empty results
   - **Recommendation:** Add graceful degradation

---

## Recommendations

### High Priority

1. **Monitor Cron Job Health**
   - Track cron job execution success rate
   - Alert if jobs fail for multiple days
   - Monitor `collected_events` table growth

2. **Monitor Intelligence Queue**
   - Track queue size and processing rate
   - Alert if backlog grows too large
   - Consider increasing batch size if needed

3. **Add Data Quality Metrics**
   - Track events collected per day
   - Monitor intelligence generation success rate
   - Track cache hit rates

### Medium Priority

4. **Improve Error Handling**
   - Add graceful degradation when data is missing
   - Show helpful messages when trends unavailable
   - Fallback to cached data when possible

5. **Optimize Queries**
   - Review query performance on `collected_events`
   - Ensure indexes are optimal
   - Consider materialized views for common queries

### Low Priority

6. **Add Real-time Updates**
   - Consider WebSocket updates for new trends
   - Push notifications for new intelligence
   - Real-time queue status updates

---

## Conclusion

**✅ Trends and Market Intelligence features are HEAVILY dependent on cron jobs.**

**Key Findings:**
1. **100% of trend data** comes from `collected_events` (populated by cron jobs)
2. **Intelligence queue** processes events from `collected_events` (via cron job)
3. **Market intelligence** analyzes event data (speakers, sponsors, orgs) from `collected_events`
4. **No fallback** - features would return empty results without cron data

**Impact:**
- If cron jobs fail, trends/intelligence features become non-functional
- Daily cron runs are **critical** for data freshness
- Intelligence pre-computation (every 6 hours) ensures fast user experience

**Status:** ✅ **Fully Integrated** - All features properly use cron-collected data

---

**End of Analysis**


