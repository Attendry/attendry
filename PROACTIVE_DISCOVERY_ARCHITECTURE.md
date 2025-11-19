# Proactive Event Discovery Architecture
**Date:** 2025-11-19  
**Paradigm Shift:** From "Event Search" to "Opportunity Discovery"  
**Version:** 2.0 (Enhanced with 8 Critical Improvements)

---

## Architecture Overview

This document describes a **complete transformation** from a search-centric event discovery system to a proactive, intelligence-driven opportunity discovery platform. The architecture eliminates query complexity, reduces latency to zero, and delivers actionable sales intelligence.

### Core Innovation
- **Background Discovery:** System proactively discovers events based on user profiles
- **Pre-computed Opportunities:** Events + Signals + Relevance stored in database
- **Instant UI:** Users see curated opportunities immediately (no search wait time)
- **Signal-Rich Intelligence:** Shows WHO, WHY, and WHEN to act

### V2 Enhancements (8 Critical Improvements)

1. **Temporal Intelligence** - Tells users WHEN to act (optimal outreach timing)
2. **Network Effects** - Collective intelligence across users (trending opportunities)
3. **Lifecycle Management** - Auto-refresh prevents stale data
4. **Multi-Signal Enrichment** - News, jobs, funding signals beyond events
5. **Team Collaboration** - Shared opportunities and team intelligence
6. **Predictive Scoring** - ML-powered conversion probability
7. **Integration Hub** - CRM, email, calendar connectors
8. **Cost Optimization** - Shared cache and batch processing for scalability

---

## The Fundamental Problem with Current Approach

### Current Model: Event Search (Pull)
```
User thinks: "I wonder what compliance events are happening?"
    ↓
User opens app → searches "compliance"
    ↓
System searches (55 seconds)
    ↓
User sees 2 events → has to evaluate relevance
    ↓
User clicks event → sees speakers → manually checks if they're relevant
```

**Problems:**
- ❌ User has to **initiate** the discovery
- ❌ User has to **wait** for search results
- ❌ User has to **evaluate** if events are relevant
- ❌ User has to **manually check** if speakers are prospects
- ❌ **Friction at every step**

### Proposed Model: Opportunity Discovery (Push)
```
System runs automated discovery (background)
    ↓
System matches to user's ICP, accounts, territories
    ↓
System enriches with speaker intelligence & scores match confidence
    ↓
User opens app → sees curated opportunities
    ↓
"3 new events with prospects attending"
"GC Summit: 5 of your target accounts will be there"
```

**Benefits:**
- ✅ **Zero friction** - user sees opportunities immediately
- ✅ **Pre-qualified** - only relevant events shown
- ✅ **Signal-rich** - shows WHO and WHY it matters
- ✅ **Actionable** - direct path to outreach
- ✅ **Proactive** - user doesn't have to remember to check

---

## Architectural Shift

### From Search-Centric to Intelligence-Centric

| Aspect | Old: Event Search | New: Opportunity Discovery |
|--------|-------------------|----------------------------|
| **Primary UI** | Search bar | Opportunity feed |
| **User Action** | Searches for events | Reviews curated opportunities |
| **System Role** | Responds to queries | Proactively discovers |
| **Timing** | On-demand (slow) | Continuous background (instant UI) |
| **Relevance** | User evaluates | System pre-qualifies |
| **Focus** | Events | People + Accounts + Events |
| **Value Prop** | Find events | Discover sales opportunities |

### New User Journey

```
1. USER ONBOARDING
   ↓
   Define: ICP, target accounts (watchlist), territories, competitors
   ↓
   System creates "discovery profile"
   ↓
   **Smart Backfill:** Immediate "warm start" from similar profiles (no waiting)

2. BACKGROUND DISCOVERY (Automated, Continuous)
   ↓
   System runs searches based on profile
   ↓
   Discovers events in user's region/industry
   ↓
   Enriches with speaker data
   ↓
   Matches speakers to target accounts (with Confidence Score)
   ↓
   Scores relevance (ICP fit, account match, signal strength)
   ↓
   Stores in "opportunity queue" OR triggers "Critical Alert"

3. USER OPENS APP
   ↓
   Sees curated feed (instant, no search needed)
   ↓
   "Dashboard" view, not "Search" view

4. FEEDBACK LOOP (The "Teaching" Layer)
   ↓
   User actions: Save, Outreach, or Dismiss (with reason)
   ↓
   System learns and refines future recommendations
```

---

## New Information Architecture

### Core Entities (Shift in Priority)

**OLD Priority:**
1. Events (primary)
2. Speakers (secondary)
3. Accounts (tertiary)

**NEW Priority:**
1. **Opportunities** (events + people + accounts matched together)
2. **Signals** (why this matters for outreach)
3. **Events** (context for the opportunity)

### New Data Model

```typescript
// NEW: Opportunity (the atomic unit)
interface Opportunity {
  id: string;
  user_id: string;
  
  // Event context
  event: {
    id: string;
    title: string;
    date: string;
    location: string;
    source_url: string;
  };
  
  // Signal intelligence (WHY this matters)
  signals: {
    target_accounts_attending: number;
    icp_matches: number;
    competitor_presence: boolean;
    account_connections: Array<{
      account_name: string;
      account_id?: string;
      confidence_score: number; // 0-100 (How sure are we?)
      verification_source: 'exact_match' | 'domain_match' | 'linkedin_verified' | 'fuzzy_match';
      speakers: Array<{
        name: string;
        title: string;
        match_reason: string;
      }>;
    }>;
  };
  
  // Relevance scoring
  relevance: {
    score: number; // 0-100
    reasons: string[]; // ["3 target accounts attending", "ICP match: General Counsel"]
    signal_strength: 'strong' | 'medium' | 'weak';
  };
  
  // NEW: Temporal Intelligence (Gap 1)
  action_timing: {
    urgency: 'critical' | 'high' | 'medium' | 'low';
    optimal_outreach_date: string; // "Start outreach 2 weeks before event"
    days_until_event: number;
    action_window_status: 'open' | 'closing_soon' | 'closed';
    recommended_actions: string[]; // ["Send LinkedIn connection", "Request meeting"]
  };
  
  // NEW: Network Effects (Gap 2)
  collective_intelligence: {
    users_tracking_count: number; // Anonymized count
    industry_peers_tracking: number;
    competitor_tracking: boolean; // Are competitors tracking this?
    trending_score: number; // 0-100 (how many users recently added this)
    peer_insights: string[]; // ["3 users saved speakers from this event"]
  };
  
  // NEW: Lifecycle Management (Gap 3)
  lifecycle: {
    last_refreshed: string;
    has_updates: boolean;
    update_summary: string; // "3 new speakers added yesterday"
    staleness_score: number; // 0-100 (how stale is this data?)
  };
  
  // NEW: Multi-Signal Enrichment (Gap 4)
  enriched_signals: {
    event_signals: {
      // Existing event-based signals
    };
    news_signals: Array<{
      headline: string;
      date: string;
      relevance: string; // "Company announced expansion"
    }>;
    job_signals: Array<{
      role: string;
      company: string;
      date: string;
      relevance: string; // "New CTO hired"
    }>;
    funding_signals: Array<{
      amount: string;
      round: string;
      date: string;
    }>;
    combined_signal_strength: number; // 0-100 (aggregate of all signals)
  };
  
  // NEW: Team Collaboration (Gap 5)
  team_context: {
    is_shared: boolean;
    team_members_tracking: Array<{
      user_id: string;
      user_name: string; // "John D."
      status: string; // "actively pursuing"
    }>;
    team_notes: string;
    team_priority: 'high' | 'medium' | 'low';
  };
  
  // NEW: Predictive Intelligence (Gap 6)
  predictive_intelligence: {
    conversion_probability: number; // 0-100 (ML model prediction)
    conversion_factors: string[]; // ["High confidence match", "Event in target region"]
    similar_opportunities_converted: number; // "3 similar opportunities led to deals"
    estimated_deal_size: string; // "€50K-€100K" (based on account size)
    recommended_priority: 'pursue_now' | 'monitor' | 'low_priority';
  };
  
  // NEW: Integration Actions (Gap 7)
  integration_actions: {
    crm_sync: {
      available: boolean;
      crm_type: 'salesforce' | 'hubspot' | 'pipedrive' | null;
      sync_status: 'synced' | 'pending' | 'failed';
      crm_record_id: string | null;
    };
    email_tools: {
      create_campaign: boolean; // "Create email sequence"
      templates_available: string[]; // ["Event outreach template"]
    };
    calendar: {
      add_to_calendar: boolean;
      set_reminder: boolean; // "Remind me 2 weeks before event"
    };
  };
  
  // User engagement
  status: 'new' | 'viewed' | 'saved' | 'actioned' | 'dismissed';
  dismissal_reason?: 'not_icp' | 'irrelevant_event' | 'already_know' | 'bad_match';
  created_at: string;
  viewed_at?: string;
  
  // Quick actions
  quick_actions: {
    add_to_board: boolean;
    save_speakers: boolean;
    create_outreach_list: boolean;
  };
}
```

### New Database Schema

```sql
-- Core table: User Opportunities (replaces ad-hoc search)
CREATE TABLE user_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  event_id UUID NOT NULL REFERENCES events(id),
  
  -- Signal data
  target_accounts_attending INTEGER DEFAULT 0,
  icp_matches INTEGER DEFAULT 0,
  competitor_presence BOOLEAN DEFAULT false,
  account_connections JSONB DEFAULT '[]'::jsonb,
  
  -- Relevance
  relevance_score INTEGER NOT NULL, -- 0-100
  relevance_reasons TEXT[] DEFAULT ARRAY[]::TEXT[],
  signal_strength TEXT NOT NULL, -- 'strong', 'medium', 'weak'
  
  -- User engagement
  status TEXT DEFAULT 'new', -- 'new', 'viewed', 'saved', 'actioned', 'dismissed'
  dismissal_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ,
  
  -- Metadata
  discovery_method TEXT, -- 'profile_match', 'account_match', 'watchlist_match', 'smart_backfill'
  last_enriched_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, event_id)
);

CREATE INDEX idx_user_opps_relevance ON user_opportunities(user_id, relevance_score DESC, created_at DESC);
CREATE INDEX idx_user_opps_status ON user_opportunities(user_id, status, created_at DESC);
CREATE INDEX idx_user_opps_signals ON user_opportunities(user_id, signal_strength, relevance_score DESC);

-- Discovery profiles (defines what to look for)
CREATE TABLE user_discovery_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- What to look for
  industries TEXT[] DEFAULT ARRAY[]::TEXT[],
  event_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  regions TEXT[] DEFAULT ARRAY[]::TEXT[],
  date_range_days INTEGER DEFAULT 90, -- Look ahead 90 days
  
  -- Who to look for
  target_titles TEXT[] DEFAULT ARRAY[]::TEXT[],
  target_companies TEXT[] DEFAULT ARRAY[]::TEXT[], -- The Watchlist
  competitors TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Discovery settings
  discovery_frequency TEXT DEFAULT 'daily', -- 'hourly', 'daily', 'weekly'
  min_relevance_score INTEGER DEFAULT 50, -- Only surface opps above this score
  enable_critical_alerts BOOLEAN DEFAULT true, -- Email/Slack alerts for high-confidence matches
  
  -- Last run
  last_discovery_run TIMESTAMPTZ,
  last_discovery_events_found INTEGER DEFAULT 0,
  last_discovery_opportunities_created INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Discovery run logs (track what was searched)
CREATE TABLE discovery_run_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  profile_id UUID NOT NULL REFERENCES user_discovery_profiles(id),
  
  -- Run details
  run_at TIMESTAMPTZ DEFAULT NOW(),
  duration_ms INTEGER,
  
  -- Query used
  query_used TEXT,
  search_params JSONB,
  
  -- Results
  events_discovered INTEGER DEFAULT 0,
  opportunities_created INTEGER DEFAULT 0,
  opportunities_high_signal INTEGER DEFAULT 0,
  
  -- Performance
  api_calls INTEGER DEFAULT 0,
  cache_hit_rate DECIMAL(5,2),
  
  -- Status
  status TEXT DEFAULT 'success', -- 'success', 'partial', 'failed'
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_discovery_logs_user ON discovery_run_logs(user_id, run_at DESC);

-- NEW: Event lifecycle tracking (Gap 3)
CREATE TABLE event_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  event_type TEXT NOT NULL, -- 'speaker_added', 'speaker_removed', 'date_changed', 'venue_changed'
  old_value JSONB,
  new_value JSONB,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lifecycle_events ON event_lifecycle_events(event_id, detected_at DESC);

-- NEW: Team collaboration (Gap 5)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT DEFAULT 'member', -- 'admin', 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE team_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES user_opportunities(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  shared_by_user_id UUID NOT NULL REFERENCES users(id),
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  team_notes TEXT,
  team_status TEXT DEFAULT 'active', -- 'active', 'won', 'lost', 'archived'
  team_priority TEXT DEFAULT 'medium', -- 'high', 'medium', 'low'
  UNIQUE(opportunity_id, team_id)
);

CREATE INDEX idx_team_opps_team ON team_opportunities(team_id, team_status, team_priority);

-- NEW: Cost tracking (Gap 8)
CREATE TABLE discovery_cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  discovery_run_id UUID REFERENCES discovery_run_logs(id),
  api_calls INTEGER DEFAULT 0,
  cost_estimate DECIMAL(10,2) DEFAULT 0, -- Estimated cost in USD
  cache_hits INTEGER DEFAULT 0,
  cache_savings DECIMAL(10,2) DEFAULT 0,
  run_date DATE DEFAULT CURRENT_DATE
);

CREATE INDEX idx_cost_tracking_date ON discovery_cost_tracking(run_date, user_id);

-- NEW: Shared query cache (Gap 8 - Cost Optimization)
CREATE TABLE shared_query_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT NOT NULL, -- Hash of query + region
  query_text TEXT NOT NULL,
  region TEXT,
  results JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER DEFAULT 0,
  UNIQUE(query_hash, region)
);

CREATE INDEX idx_shared_cache_expires ON shared_query_cache(expires_at);
```

---

## System Components

### 1. Discovery Engine (Background Service)

**Purpose:** Continuously discover events, match with confidence, and create opportunities

```typescript
// NEW: Discovery Engine
class DiscoveryEngine {
  /**
   * Main discovery loop (runs on schedule)
   */
  async runDiscovery(userId: string): Promise<DiscoveryResult> {
    const profile = await this.getDiscoveryProfile(userId);
    
    // 1. Build search query from profile (not user input!)
    const query = this.buildProfileQuery(profile);
    
    // 2. Run search (using optimized query builder)
    const events = await this.searchEvents(query, profile);
    
    // 3. Enrich events with speaker data
    const enrichedEvents = await this.enrichSpeakers(events);
    
    // 4. Match speakers to user's accounts/ICP with CONFIDENCE SCORING
    const opportunities = await this.matchToProfile(enrichedEvents, profile);
    
    // 5. Score relevance
    const scoredOpportunities = await this.scoreRelevance(opportunities, profile);
    
    // 6. Store high-value opportunities OR trigger Critical Alert
    await this.storeOrAlert(userId, scoredOpportunities, profile);
    
    return {
      eventsDiscovered: events.length,
      opportunitiesCreated: scoredOpportunities.length,
      highSignalOpportunities: scoredOpportunities.filter(o => o.relevance.score >= 70).length
    };
  }
  
  /**
   * Match speakers to user's profile with Confidence Scoring
   */
  private async matchToProfile(events: Event[], profile: DiscoveryProfile): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];
    
    for (const event of events) {
      const signals = {
        target_accounts_attending: 0,
        icp_matches: 0,
        competitor_presence: false,
        account_connections: []
      };
      
      // Check each speaker
      for (const speaker of event.speakers) {
        // Match to target companies (Watchlist)
        const companyMatch = this.matchCompany(speaker.company, profile.target_companies);
        
        if (companyMatch.matched) {
          signals.target_accounts_attending++;
          signals.account_connections.push({
            account_name: speaker.company,
            confidence_score: companyMatch.confidence, // e.g. 95 for exact match, 60 for fuzzy
            verification_source: companyMatch.source,
            speakers: [{ 
              name: speaker.name, 
              title: speaker.title,
              match_reason: 'Target account'
            }]
          });
        }
        
        // ... matches for ICP and Competitors ...
      }
      
      // Only create opportunity if there are signals above threshold
      if (signals.target_accounts_attending > 0 || signals.icp_matches > 0) {
        opportunities.push({
          event,
          signals,
          relevance: this.calculateRelevance(signals),
          status: 'new',
          created_at: new Date().toISOString()
        });
      }
    }
    
    return opportunities;
  }
  
  /**
   * Helper: Match company with confidence
   */
  private matchCompany(speakerCompany: string, targetCompanies: string[]): MatchResult {
    // Implement exact match, domain match, fuzzy match logic here
    // Return { matched: boolean, confidence: number, source: string }
  }

  /**
   * Store opportunities or trigger Critical Alert for Watchlist matches
   */
  private async storeOrAlert(userId: string, opps: Opportunity[], profile: DiscoveryProfile) {
     for (const opp of opps) {
        // NEW: Calculate temporal intelligence (Gap 1)
        opp.action_timing = this.calculateActionTiming(opp.event.date);
        
        // NEW: Enrich with collective intelligence (Gap 2)
        opp.collective_intelligence = await this.getCollectiveIntelligence(opp.event.id);
        
        // NEW: Check lifecycle updates (Gap 3)
        opp.lifecycle = await this.checkLifecycleUpdates(opp.event.id);
        
        // NEW: Enrich with multi-signal data (Gap 4)
        opp.enriched_signals = await this.enrichWithMultiSignals(opp);
        
        // NEW: Calculate predictive intelligence (Gap 6)
        opp.predictive_intelligence = await this.calculatePredictiveScore(opp);
        
        await this.saveOpportunity(opp);
        
        // Watchlist Integration: Critical Alert
        const hasHighConfidenceWatchlist = opp.signals.account_connections.some(
           ac => ac.confidence_score > 80
        );
        
        if (hasHighConfidenceWatchlist && profile.enable_critical_alerts) {
           await this.sendCriticalAlert(userId, opp); // Slack/Email
        }
     }
  }
  
  /**
   * NEW: Calculate action timing (Gap 1)
   */
  private calculateActionTiming(eventDate: string): ActionTiming {
    const daysUntil = this.daysUntil(eventDate);
    const optimalOutreachDays = 14; // 2 weeks before event
    
    let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
    let action_window_status: 'open' | 'closing_soon' | 'closed' = 'open';
    const recommended_actions: string[] = [];
    
    if (daysUntil <= 7) {
      urgency = 'critical';
      action_window_status = 'closing_soon';
      recommended_actions.push('Send immediate connection request', 'Request urgent meeting');
    } else if (daysUntil <= 14) {
      urgency = 'high';
      recommended_actions.push('Connect on LinkedIn this week', 'Send personalized outreach');
    } else if (daysUntil <= 30) {
      urgency = 'medium';
      recommended_actions.push('Add to calendar', 'Research speakers');
    } else {
      urgency = 'low';
      recommended_actions.push('Monitor for updates', 'Plan ahead');
    }
    
    const optimalOutreachDate = new Date(eventDate);
    optimalOutreachDate.setDate(optimalOutreachDate.getDate() - optimalOutreachDays);
    
    return {
      urgency,
      optimal_outreach_date: optimalOutreachDate.toISOString(),
      days_until_event: daysUntil,
      action_window_status,
      recommended_actions
    };
  }
  
  /**
   * NEW: Get collective intelligence (Gap 2)
   */
  private async getCollectiveIntelligence(eventId: string): Promise<CollectiveIntelligence> {
    // Aggregate anonymous tracking data
    const trackingStats = await this.getTrackingStats(eventId);
    
    return {
      users_tracking_count: trackingStats.total,
      industry_peers_tracking: trackingStats.industryPeers,
      competitor_tracking: trackingStats.hasCompetitors,
      trending_score: trackingStats.trendingScore,
      peer_insights: trackingStats.insights
    };
  }
  
  /**
   * NEW: Check lifecycle updates (Gap 3)
   */
  private async checkLifecycleUpdates(eventId: string): Promise<LifecycleInfo> {
    const lastRefresh = await this.getLastRefreshTime(eventId);
    const updates = await this.getRecentUpdates(eventId);
    
    return {
      last_refreshed: lastRefresh,
      has_updates: updates.length > 0,
      update_summary: updates.length > 0 
        ? `${updates.length} new speaker(s) added ${this.formatTimeAgo(updates[0].detected_at)}`
        : 'No recent updates',
      staleness_score: this.calculateStalenessScore(lastRefresh)
    };
  }
  
  /**
   * NEW: Enrich with multi-signal data (Gap 4)
   */
  private async enrichWithMultiSignals(opp: Opportunity): Promise<EnrichedSignals> {
    const accountNames = opp.signals.account_connections.map(ac => ac.account_name);
    
    // Fetch news, jobs, funding signals for target accounts
    const [news, jobs, funding] = await Promise.all([
      this.fetchNewsSignals(accountNames),
      this.fetchJobSignals(accountNames),
      this.fetchFundingSignals(accountNames)
    ]);
    
    // Calculate combined signal strength
    const combinedStrength = this.calculateCombinedSignalStrength(
      opp.relevance.score,
      news.length,
      jobs.length,
      funding.length
    );
    
    return {
      event_signals: opp.signals,
      news_signals: news,
      job_signals: jobs,
      funding_signals: funding,
      combined_signal_strength: combinedStrength
    };
  }
  
  /**
   * NEW: Calculate predictive score (Gap 6)
   */
  private async calculatePredictiveScore(opp: Opportunity): Promise<PredictiveIntelligence> {
    // Use ML model to predict conversion probability
    const features = {
      confidence_score: opp.signals.account_connections[0]?.confidence_score || 0,
      signal_strength: opp.relevance.signal_strength,
      account_count: opp.signals.target_accounts_attending,
      days_until_event: opp.action_timing.days_until_event
    };
    
    const conversionProbability = await this.mlModel.predict(features);
    const similarOpps = await this.findSimilarOpportunities(opp);
    
    return {
      conversion_probability: conversionProbability,
      conversion_factors: this.identifyConversionFactors(opp),
      similar_opportunities_converted: similarOpps.convertedCount,
      estimated_deal_size: this.estimateDealSize(opp),
      recommended_priority: this.recommendPriority(conversionProbability)
    };
  }
  
  /**
   * NEW: Shared query cache for cost optimization (Gap 8)
   */
  async searchEvents(query: string, profile: DiscoveryProfile) {
    // Check shared cache first
    const cacheKey = this.hashQuery(query, profile.regions[0]);
    const cached = await this.checkSharedCache(cacheKey);
    
    if (cached && !this.isCacheExpired(cached)) {
      await this.incrementCacheHits(cacheKey);
      return cached.results;
    }
    
    // Run fresh search
    const result = await this.runSearch(query);
    
    // Cache for sharing (24 hour TTL)
    await this.cacheForSharing(cacheKey, query, profile.regions[0], result);
    
    return result;
  }
  
  /**
   * NEW: Batch processing for cost optimization (Gap 8)
   */
  async runDiscoveryBatch(userIds: string[]) {
    // Group users by similar profiles
    const profileGroups = await this.groupBySimilarProfiles(userIds);
    
    // Run one search per group, distribute results
    for (const group of profileGroups) {
      const query = this.buildGroupQuery(group);
      const results = await this.searchEvents(query, group[0].profile);
      
      // Distribute results to all users in group
      for (const user of group) {
        await this.distributeResults(user.id, results);
      }
    }
  }
}
```

### 2. Opportunity Feed API (Replaces Search API)

```typescript
// NEW: Opportunity Feed API
// File: src/app/api/opportunities/feed/route.ts

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ... auth check ...
  
  // ... query builder ...
  
  // Support "Dismiss" feedback loop
  // POST /api/opportunities/feedback
  // body: { opportunityId, action: 'dismiss', reason: 'not_icp' }
}
```

### 3. Opportunity Dashboard UI (with Feedback Loop)

```typescript
// NEW: Opportunity Dashboard
// File: src/app/(protected)/opportunities/page.tsx

export default function OpportunitiesPage() {
  // ... state ...

  return (
    <div className="container mx-auto py-8">
      {/* ... header ... */}
      
      {/* Opportunity cards */}
      <div className="space-y-4">
        {opportunities.map(opp => (
          <OpportunityCard 
            key={opp.id} 
            opportunity={opp} 
            onDismiss={(id, reason) => handleDismiss(id, reason)} // Explicit Feedback
          />
        ))}
      </div>
    </div>
  );
}

// Opportunity Card
function OpportunityCard({ opportunity, onDismiss }) {
  // ... rendering ...
  
  return (
     // ...
     <div className="flex gap-2">
        {/* ... Positive actions ... */}
        
        {/* Explicit Feedback Loop */}
        <DropdownMenu>
          <DropdownMenuTrigger>Dismiss</DropdownMenuTrigger>
          <DropdownMenuContent>
             <DropdownMenuItem onClick={() => onDismiss(opp.id, 'not_icp')}>
                Not my ICP
             </DropdownMenuItem>
             <DropdownMenuItem onClick={() => onDismiss(opp.id, 'already_know')}>
                Already know this
             </DropdownMenuItem>
             <DropdownMenuItem onClick={() => onDismiss(opp.id, 'irrelevant_event')}>
                Irrelevant event
             </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
     </div>
  )
}
```

### 4. Smart Backfill & Onboarding

To prevent "empty feed" issues for new users:

1.  **Onboarding Trigger:** When `user_discovery_profiles` is created, trigger an immediate `DiscoveryEngine.runDiscovery(userId)` job (high priority queue).
2.  **Similarity Matching:** Query existing `user_opportunities` for *other users* with matching industry/region profiles.
3.  **Warm Start:** Copy relevant existing opportunities to the new user's feed immediately, marking discovery_method as `'smart_backfill'`.

### 5. Temporal Intelligence Engine (Gap 1)

**Purpose:** Calculate optimal action timing for opportunities

```typescript
class TemporalIntelligenceEngine {
  /**
   * Calculate when user should act on opportunity
   */
  calculateActionTiming(eventDate: string, currentDate: Date = new Date()): ActionTiming {
    const daysUntil = this.daysUntil(eventDate, currentDate);
    
    // Optimal outreach window: 2-4 weeks before event
    const optimalOutreachDays = 14;
    const optimalOutreachDate = new Date(eventDate);
    optimalOutreachDate.setDate(optimalOutreachDate.getDate() - optimalOutreachDays);
    
    // Determine urgency
    let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
    if (daysUntil <= 7) urgency = 'critical';
    else if (daysUntil <= 14) urgency = 'high';
    else if (daysUntil <= 30) urgency = 'medium';
    
    // Determine window status
    let action_window_status: 'open' | 'closing_soon' | 'closed' = 'open';
    if (daysUntil <= 7) action_window_status = 'closing_soon';
    else if (daysUntil < 0) action_window_status = 'closed';
    
    // Generate recommended actions
    const recommended_actions = this.generateRecommendedActions(daysUntil);
    
    return {
      urgency,
      optimal_outreach_date: optimalOutreachDate.toISOString(),
      days_until_event: daysUntil,
      action_window_status,
      recommended_actions
    };
  }
}
```

### 6. Collective Intelligence Engine (Gap 2)

**Purpose:** Aggregate anonymous tracking data across users

```typescript
class CollectiveIntelligenceEngine {
  /**
   * Get network effects data for an event
   */
  async getCollectiveIntelligence(eventId: string, userId: string): Promise<CollectiveIntelligence> {
    // Get anonymous tracking stats
    const stats = await this.getTrackingStats(eventId, userId);
    
    return {
      users_tracking_count: stats.totalUsers,
      industry_peers_tracking: stats.industryPeers,
      competitor_tracking: stats.hasCompetitors,
      trending_score: this.calculateTrendingScore(eventId),
      peer_insights: this.generatePeerInsights(eventId)
    };
  }
  
  /**
   * Calculate trending score based on recent activity
   */
  private calculateTrendingScore(eventId: string): number {
    // Score 0-100 based on users who added this in last 7 days
    const recentAdds = this.getRecentAdds(eventId, 7);
    return Math.min(100, recentAdds * 10); // 10 points per user, capped at 100
  }
}
```

### 7. Lifecycle Management Engine (Gap 3)

**Purpose:** Track and refresh event data to prevent staleness

```typescript
class LifecycleManagementEngine {
  /**
   * Daily refresh job to detect event changes
   */
  async refreshEventLifecycle(eventId: string): Promise<LifecycleInfo> {
    const event = await this.getEvent(eventId);
    const lastRefresh = await this.getLastRefreshTime(eventId);
    
    // Check for speaker additions/removals
    const speakerChanges = await this.detectSpeakerChanges(eventId, lastRefresh);
    
    // Check for date/venue changes
    const metadataChanges = await this.detectMetadataChanges(eventId, lastRefresh);
    
    // Log changes
    if (speakerChanges.length > 0 || metadataChanges.length > 0) {
      await this.logLifecycleEvents(eventId, [...speakerChanges, ...metadataChanges]);
      
      // Re-run matching for affected opportunities
      await this.triggerOpportunityRefresh(eventId);
    }
    
    return {
      last_refreshed: new Date().toISOString(),
      has_updates: speakerChanges.length > 0 || metadataChanges.length > 0,
      update_summary: this.generateUpdateSummary(speakerChanges, metadataChanges),
      staleness_score: this.calculateStalenessScore(lastRefresh)
    };
  }
  
  /**
   * Auto-archive expired opportunities
   */
  async archiveExpiredOpportunities() {
    const expiredEvents = await this.getExpiredEvents(30); // Events >30 days old
    for (const eventId of expiredEvents) {
      await this.archiveOpportunitiesForEvent(eventId);
    }
  }
}
```

### 8. Multi-Signal Enrichment Engine (Gap 4)

**Purpose:** Enrich opportunities with news, jobs, funding signals

```typescript
class MultiSignalEnrichmentEngine {
  /**
   * Enrich opportunity with external signals
   */
  async enrichOpportunity(opp: Opportunity): Promise<EnrichedSignals> {
    const accountNames = opp.signals.account_connections.map(ac => ac.account_name);
    
    // Fetch signals in parallel
    const [news, jobs, funding] = await Promise.all([
      this.fetchNewsSignals(accountNames),
      this.fetchJobSignals(accountNames),
      this.fetchFundingSignals(accountNames)
    ]);
    
    // Calculate combined signal strength
    const combinedStrength = this.calculateCombinedStrength(
      opp.relevance.score,
      news.length,
      jobs.length,
      funding.length
    );
    
    return {
      event_signals: opp.signals,
      news_signals: news,
      job_signals: jobs,
      funding_signals: funding,
      combined_signal_strength: combinedStrength
    };
  }
  
  /**
   * Fetch news signals for target accounts
   */
  private async fetchNewsSignals(accountNames: string[]): Promise<NewsSignal[]> {
    // Integrate with news APIs (Google News, Crunchbase)
    // Filter for relevant news (expansions, product launches, etc.)
  }
}
```

### 9. Predictive Intelligence Engine (Gap 6)

**Purpose:** Predict conversion probability using ML models

```typescript
class PredictiveIntelligenceEngine {
  /**
   * Calculate conversion probability for opportunity
   */
  async calculatePredictiveScore(opp: Opportunity): Promise<PredictiveIntelligence> {
    // Extract features
    const features = {
      confidence_score: opp.signals.account_connections[0]?.confidence_score || 0,
      signal_strength: opp.relevance.signal_strength === 'strong' ? 1 : 0,
      account_count: opp.signals.target_accounts_attending,
      days_until_event: opp.action_timing.days_until_event,
      icp_matches: opp.signals.icp_matches
    };
    
    // Predict using trained ML model
    const conversionProbability = await this.mlModel.predict(features);
    
    // Find similar opportunities
    const similarOpps = await this.findSimilarOpportunities(opp);
    
    return {
      conversion_probability: Math.round(conversionProbability * 100),
      conversion_factors: this.identifyConversionFactors(opp),
      similar_opportunities_converted: similarOpps.convertedCount,
      estimated_deal_size: this.estimateDealSize(opp),
      recommended_priority: this.recommendPriority(conversionProbability)
    };
  }
}
```

### 10. Integration Hub (Gap 7)

**Purpose:** Connect opportunities to CRM, email, calendar tools

```typescript
class IntegrationHub {
  /**
   * Sync opportunity to CRM
   */
  async syncToCRM(opp: Opportunity, crmType: 'salesforce' | 'hubspot' | 'pipedrive'): Promise<string> {
    const crmConnector = this.getConnector(crmType);
    
    // Create opportunity record in CRM
    const crmRecord = await crmConnector.createOpportunity({
      name: opp.event.title,
      account: opp.signals.account_connections[0]?.account_name,
      close_date: opp.event.date,
      amount: opp.predictive_intelligence.estimated_deal_size,
      description: opp.relevance.reasons.join(', ')
    });
    
    return crmRecord.id;
  }
  
  /**
   * Create email campaign for opportunity
   */
  async createEmailCampaign(opp: Opportunity): Promise<string> {
    // Generate email sequence using templates
    const template = this.getEmailTemplate('event_outreach');
    const sequence = this.generateSequence(opp, template);
    
    return sequence.id;
  }
  
  /**
   * Add to calendar with reminder
   */
  async addToCalendar(opp: Opportunity, reminderDays: number = 14): Promise<void> {
    // Add event to user's calendar
    // Set reminder for optimal outreach date
  }
}
```

---

## Refined Implementation Roadmap

### Phase 0: Data & Signal Validation (Week 1) - **Shadow Mode**
- [ ] **Goal:** Validate match accuracy before showing UI.
- [ ] Create DB schema (`user_opportunities`, `user_discovery_profiles`, `event_lifecycle_events`).
- [ ] Build `DiscoveryEngine` with "Shadow Mode" (runs discovery but doesn't alert user).
- [ ] Implement `Signal Confidence` scoring (exact vs fuzzy).
- [ ] **Deliverable:** Signal Confidence Report (accuracy of matches).

### Phase 1: The "Opportunity" Backend (Week 1-2)
- [ ] Implement `Smart Backfill` logic (immediate warm start).
- [ ] Build `OpportunityFeed` API.
- [ ] Implement "Watchlist" critical alerts logic.
- [ ] **NEW (Gap 1):** Build `TemporalIntelligenceEngine` - calculate action timing.
- [ ] **NEW (Gap 3):** Build `LifecycleManagementEngine` - event refresh system.
- [ ] **NEW (Gap 8):** Implement shared query cache and cost tracking.

### Phase 2: The "Inbox" UI (Week 2-3)
- [ ] Build Dashboard UI with temporal intelligence display.
- [ ] Implement "Dismiss" feedback loop (UI + API).
- [ ] Test "Critical Alerts" (email/slack simulation).
- [ ] **NEW (Gap 1):** Show urgency badges and action windows in UI.
- [ ] **NEW (Gap 3):** Display lifecycle updates ("3 new speakers added").

### Phase 3: Automation & User Migration (Week 3-4)
- [ ] Deploy Cron Scheduler.
- [ ] Migrate existing user preferences to `discovery_profiles`.
- [ ] Enable "Critical Alerts" for real.
- [ ] **NEW (Gap 3):** Deploy daily lifecycle refresh job.
- [ ] **NEW (Gap 8):** Deploy batch processing for cost optimization.

### Phase 4: Value Multipliers (Week 4-5)
- [ ] **NEW (Gap 2):** Build `CollectiveIntelligenceEngine` - network effects.
- [ ] **NEW (Gap 6):** Build `PredictiveIntelligenceEngine` - ML conversion scoring.
- [ ] **NEW (Gap 7):** Build `IntegrationHub` - CRM/email/calendar connectors.
- [ ] A/B test discovery algorithms.
- [ ] Refine `Signal Confidence` based on user feedback (dismissals).

### Phase 5: Advanced Features (Week 6+)
- [ ] **NEW (Gap 4):** Build `MultiSignalEnrichmentEngine` - news/jobs/funding.
- [ ] **NEW (Gap 5):** Build team collaboration features.
- [ ] Train and deploy ML models for predictive scoring.
- [ ] Expand integration ecosystem (more CRMs, tools).

---

## How This Solves Original Problems

### 1. Query Complexity → Eliminated
**Old:** User searches → complex query → timeouts  
**New:** System runs profile-based queries in background → no user-facing search latency

### 2. Relevance → Dramatically Improved & Verified
**Old:** User gets all events matching keywords → has to evaluate  
**New:** System pre-qualifies with **Confidence Scores** → user only sees verified, high-signal opportunities

### 3. Speed → Instant & Continuous
**Old:** 55 second search wait time  
**New:** Instant load via **Smart Backfill** and background processing.

### 4. Value → Signal-Rich & Teachable
**Old:** Static results.
**New:** Feed that **learns** from explicit "Dismiss" feedback.

### 5. Friction → Zero
**Old:** User has to remember to search.
**New:** **Critical Alerts** notify user of "must-act" opportunities.

---

## Additional Considerations

### Privacy & Compliance
- **GDPR Compliance:** Anonymize collective intelligence data (no PII in network effects)
- **Data Retention:** Clear policies for opportunity data (auto-archive after 90 days)
- **User Control:** Allow users to opt-out of data sharing for network effects

### Failure Modes & Resilience
- **Fallback Strategy:** If discovery fails, show cached opportunities from last successful run
- **Partial Match Handling:** Surface opportunities even if only 2 of 5 target accounts match
- **Graceful Degradation:** "Discovery is running, check back in 10 minutes" message
- **Error Recovery:** Retry failed discovery runs with exponential backoff

### User Onboarding Experience
- **Interactive Profile Builder:** Step-by-step wizard with examples
- **Demo Mode:** "See how it works" with sample opportunities
- **Progressive Disclosure:** Start with high-confidence matches, expand over time
- **Onboarding Checklist:** Guide users through first opportunity actions

### Cost Management Strategy (Gap 8)
- **Shared Query Cache:** Reuse search results across users with similar profiles
- **Batch Processing:** Group users by profile similarity, run one search per group
- **Cost Tracking Dashboard:** Monitor API spend per user, set budgets
- **Rate Limit Management:** Queue discovery jobs, respect API limits
- **Cache Hit Rate Target:** >60% cache hits to reduce API costs by 60%+

## Expected Impact of Improvements

| Improvement | Impact | Business Value |
|-------------|--------|----------------|
| **Temporal Intelligence** | High | Users know WHEN to act → higher conversion |
| **Network Effects** | Very High | Platform becomes more valuable with scale → defensible moat |
| **Lifecycle Management** | High | Prevents wasted effort → better user experience |
| **Multi-Signal Enrichment** | Medium | More comprehensive intelligence → higher value |
| **Team Collaboration** | Medium | Enterprise feature → higher pricing tier |
| **Predictive Scoring** | High | Data-driven prioritization → better outcomes |
| **Integration Hub** | Very High | Reduces friction → higher adoption |
| **Cost Optimization** | Critical | Ensures profitability → sustainable business |

## Conclusion

**This pivot fundamentally solves the query complexity problem** by eliminating user-facing searches entirely. Instead of optimizing complex queries, we:

1.  **Run simple, profile-based queries in the background**
2.  **Pre-compute relevance and signals (with Confidence Scores)**
3.  **Surface only high-value opportunities**
4.  **Enable instant, friction-free discovery (with Smart Backfill)**

**With the V2 improvements, this architecture transforms from a "good discovery tool" into a "must-have sales intelligence platform"** that:

- **Tells users WHEN to act** (Temporal Intelligence)
- **Gets smarter with scale** (Network Effects)
- **Stays fresh** (Lifecycle Management)
- **Provides comprehensive signals** (Multi-Signal Enrichment)
- **Enables team collaboration** (Team Intelligence)
- **Predicts outcomes** (Predictive Scoring)
- **Integrates with workflows** (Integration Hub)
- **Scales profitably** (Cost Optimization)

**Recommendation:** Proceed with this architecture. It's more aligned with user needs, eliminates current technical problems, delivers 10x more value, and creates a defensible platform moat through network effects.
