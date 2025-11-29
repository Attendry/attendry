# Proactive Discovery Architecture - Implementation Plan
**Date:** 2025-01-19  
**Status:** Analysis & Planning Phase  
**Branch:** `feat/proactive-discovery`

---

## Executive Summary

This document provides a comprehensive analysis of the current codebase against the proposed Proactive Discovery Architecture, identifies gaps, and outlines a phased implementation plan with specific to-dos.

### Current State Assessment

**✅ What Exists:**
- User profiles (`profiles` table) with ICP terms, industry terms, competitors
- Watchlist system (`watchlists` table) supporting companies, attendees, events
- Event collection system (`collected_events` table) with background cron jobs
- Speaker tracking (`speaker_event_history` table) with cross-event history
- User event board (`user_event_board` table) for Kanban-style event management
- Search infrastructure (`SearchService`, `EventDiscoverer`, optimized orchestrator)
- Speaker matching and enrichment services

**❌ What's Missing:**
- Opportunity data model (events + signals + relevance pre-computed)
- Discovery profiles (what to look for, when to run)
- Background discovery engine (automated, continuous)
- Opportunity feed API (replaces search API for dashboard)
- Confidence scoring system (exact vs fuzzy matching)
- All V2 enhancements (temporal intelligence, network effects, lifecycle management, etc.)

---

## Gap Analysis: Current vs. Proposed Architecture

### 1. Data Model Gaps

| Component | Current State | Required State | Gap |
|-----------|--------------|----------------|-----|
| **Opportunities** | ❌ None | `user_opportunities` table | **NEW** - Core entity |
| **Discovery Profiles** | ⚠️ Partial (`profiles` table exists but lacks discovery config) | `user_discovery_profiles` table | **ENHANCE** - Add discovery settings |
| **Discovery Logs** | ❌ None | `discovery_run_logs` table | **NEW** - Tracking & debugging |
| **Event Lifecycle** | ❌ None | `event_lifecycle_events` table | **NEW** - Change tracking |
| **Team Collaboration** | ❌ None | `teams`, `team_members`, `team_opportunities` tables | **NEW** - V2 Feature |
| **Cost Tracking** | ❌ None | `discovery_cost_tracking` table | **NEW** - V2 Feature |
| **Shared Cache** | ⚠️ Basic cache exists | `shared_query_cache` table | **ENHANCE** - Multi-user cache |

### 2. Service Layer Gaps

| Service | Current State | Required State | Gap |
|---------|--------------|----------------|-----|
| **Discovery Engine** | ❌ None | `DiscoveryEngine` class | **NEW** - Core service |
| **Opportunity Feed API** | ⚠️ Search API exists | `/api/opportunities/feed` | **NEW** - Dashboard endpoint |
| **Confidence Scoring** | ⚠️ Basic matching | Confidence scoring system | **ENHANCE** - Exact/fuzzy/domain matching |
| **Temporal Intelligence** | ❌ None | `TemporalIntelligenceEngine` | **NEW** - V2 Feature |
| **Collective Intelligence** | ❌ None | `CollectiveIntelligenceEngine` | **NEW** - V2 Feature |
| **Lifecycle Management** | ❌ None | `LifecycleManagementEngine` | **NEW** - V2 Feature |
| **Multi-Signal Enrichment** | ❌ None | `MultiSignalEnrichmentEngine` | **NEW** - V2 Feature |
| **Predictive Intelligence** | ❌ None | `PredictiveIntelligenceEngine` | **NEW** - V2 Feature |
| **Integration Hub** | ❌ None | `IntegrationHub` | **NEW** - V2 Feature |

### 3. UI/UX Gaps

| Component | Current State | Required State | Gap |
|-----------|--------------|----------------|-----|
| **Opportunity Dashboard** | ⚠️ Search page exists | `/opportunities` page | **NEW** - Feed-based UI |
| **Opportunity Cards** | ⚠️ EventCard exists | `OpportunityCard` component | **ENHANCE** - Signal-rich display |
| **Feedback Loop** | ❌ None | Dismiss with reason | **NEW** - Learning system |
| **Temporal UI** | ❌ None | Urgency badges, action windows | **NEW** - V2 Feature |
| **Lifecycle UI** | ❌ None | Update indicators | **NEW** - V2 Feature |

### 4. Infrastructure Gaps

| Component | Current State | Required State | Gap |
|-----------|--------------|----------------|-----|
| **Background Jobs** | ⚠️ Cron jobs exist | Scheduled discovery runs | **ENHANCE** - Per-user discovery |
| **Smart Backfill** | ❌ None | Similarity matching on onboarding | **NEW** - Warm start |
| **Critical Alerts** | ❌ None | Email/Slack notifications | **NEW** - Watchlist alerts |
| **Cost Optimization** | ⚠️ Basic caching | Shared cache + batch processing | **ENHANCE** - V2 Feature |

---

## Implementation Phases

### Phase 0: Foundation & Data Validation (Week 1)
**Goal:** Set up database schema and validate matching accuracy in shadow mode

#### Database Schema
- [ ] Create `user_opportunities` table
- [ ] Create `user_discovery_profiles` table
- [ ] Create `discovery_run_logs` table
- [ ] Create `event_lifecycle_events` table
- [ ] Add indexes for performance
- [ ] Set up RLS policies

#### Discovery Engine (Shadow Mode)
- [ ] Create `DiscoveryEngine` class skeleton
- [ ] Implement `buildProfileQuery()` - convert profile to search query
- [ ] Implement `searchEvents()` - reuse existing `SearchService`
- [ ] Implement `enrichSpeakers()` - reuse existing speaker service
- [ ] Implement `matchToProfile()` - match speakers to watchlist/ICP
- [ ] Implement confidence scoring system:
  - [ ] Exact match (company name = watchlist item) → 100%
  - [ ] Domain match (speaker.company domain = watchlist domain) → 90%
  - [ ] Fuzzy match (Levenshtein distance < threshold) → 60-80%
  - [ ] LinkedIn verified (if available) → 95%
- [ ] Implement `scoreRelevance()` - calculate relevance score (0-100)
- [ ] Implement `storeOrAlert()` - store opportunities (shadow mode, no alerts yet)
- [ ] Add logging to `discovery_run_logs`

#### Validation & Testing
- [ ] Create test script to run discovery for sample users
- [ ] Generate Signal Confidence Report:
  - [ ] Match accuracy (true positives vs false positives)
  - [ ] Confidence score distribution
  - [ ] Common false positive patterns
- [ ] Validate against existing watchlist data
- [ ] Document matching rules and thresholds

**Deliverable:** Database schema deployed, Discovery Engine running in shadow mode, Signal Confidence Report

---

### Phase 1: Core Opportunity Backend (Week 1-2)
**Goal:** Build the opportunity backend and enable smart backfill

#### Smart Backfill
- [ ] Implement `smartBackfill()` function:
  - [ ] Query existing `user_opportunities` for similar profiles
  - [ ] Match by industry/region/ICP similarity
  - [ ] Copy relevant opportunities to new user
  - [ ] Mark `discovery_method = 'smart_backfill'`
- [ ] Trigger on `user_discovery_profiles` creation
- [ ] Add onboarding API endpoint

#### Opportunity Feed API
- [ ] Create `/api/opportunities/feed` endpoint:
  - [ ] Query `user_opportunities` for user
  - [ ] Filter by status (default: 'new', 'viewed', 'saved')
  - [ ] Sort by relevance_score DESC
  - [ ] Support pagination
  - [ ] Include event details (join `collected_events`)
  - [ ] Include signal data (account_connections, ICP matches)
- [ ] Create `/api/opportunities/[id]` endpoint (single opportunity)
- [ ] Create `/api/opportunities/feedback` endpoint:
  - [ ] POST: `{ opportunityId, action: 'dismiss', reason: 'not_icp' | 'irrelevant_event' | 'already_know' | 'bad_match' }`
  - [ ] Update opportunity status
  - [ ] Store dismissal reason for learning

#### Watchlist Critical Alerts
- [ ] Implement alert logic:
  - [ ] Check if opportunity has high-confidence watchlist match (confidence > 80)
  - [ ] Check if user has `enable_critical_alerts = true`
  - [ ] Send alert (email/Slack) with opportunity details
- [ ] Create alert service (email template, Slack webhook)
- [ ] Add alert preferences to discovery profile

#### Temporal Intelligence (V2 - Gap 1)
- [ ] Create `TemporalIntelligenceEngine` class
- [ ] Implement `calculateActionTiming()`:
  - [ ] Calculate days until event
  - [ ] Determine urgency level (critical/high/medium/low)
  - [ ] Calculate optimal outreach date (14 days before)
  - [ ] Determine action window status (open/closing_soon/closed)
  - [ ] Generate recommended actions based on urgency
- [ ] Add `action_timing` field to opportunity storage
- [ ] Update opportunity feed to include temporal data

#### Lifecycle Management (V2 - Gap 3)
- [ ] Create `LifecycleManagementEngine` class
- [ ] Implement `refreshEventLifecycle()`:
  - [ ] Detect speaker additions/removals
  - [ ] Detect date/venue changes
  - [ ] Log changes to `event_lifecycle_events`
  - [ ] Trigger opportunity refresh for affected events
- [ ] Create cron job for daily lifecycle refresh
- [ ] Add `lifecycle` field to opportunity storage

#### Cost Optimization (V2 - Gap 8)
- [ ] Create `shared_query_cache` table
- [ ] Implement shared cache logic:
  - [ ] Hash query + region for cache key
  - [ ] Check cache before running search
  - [ ] Store results with 24-hour TTL
  - [ ] Track cache hits/misses
- [ ] Create `discovery_cost_tracking` table
- [ ] Implement cost tracking:
  - [ ] Track API calls per discovery run
  - [ ] Estimate cost (based on provider pricing)
  - [ ] Calculate cache savings
- [ ] Add batch processing:
  - [ ] Group users by similar profiles
  - [ ] Run one search per group
  - [ ] Distribute results to all users in group

**Deliverable:** Opportunity Feed API, Smart Backfill, Critical Alerts, Temporal Intelligence, Lifecycle Management, Cost Optimization

---

### Phase 2: Opportunity Dashboard UI (Week 2-3)
**Goal:** Build the user-facing opportunity dashboard with feedback loop

#### Opportunity Dashboard Page
- [ ] Create `/app/(protected)/opportunities/page.tsx`:
  - [ ] Fetch opportunities from `/api/opportunities/feed`
  - [ ] Display opportunity cards in feed layout
  - [ ] Support filtering (status, signal strength, urgency)
  - [ ] Support sorting (relevance, date, urgency)
  - [ ] Add pagination
  - [ ] Show empty state with onboarding CTA

#### Opportunity Card Component
- [ ] Create `OpportunityCard` component:
  - [ ] Display event details (title, date, location)
  - [ ] Display signals:
    - [ ] Target accounts attending (with confidence scores)
    - [ ] ICP matches count
    - [ ] Competitor presence indicator
  - [ ] Display relevance score and reasons
  - [ ] Display temporal intelligence:
    - [ ] Urgency badge (critical/high/medium/low)
    - [ ] Days until event
    - [ ] Optimal outreach date
    - [ ] Action window status
    - [ ] Recommended actions
  - [ ] Display lifecycle updates (if any)
  - [ ] Quick actions:
    - [ ] Add to board
    - [ ] Save speakers
    - [ ] Create outreach list
  - [ ] Dismiss dropdown with reasons

#### Feedback Loop UI
- [ ] Add dismiss dropdown to OpportunityCard:
  - [ ] "Not my ICP"
  - [ ] "Irrelevant event"
  - [ ] "Already know this"
  - [ ] "Bad match"
- [ ] Call `/api/opportunities/feedback` on dismiss
- [ ] Show confirmation toast
- [ ] Remove card from feed (optimistic update)

#### Temporal Intelligence UI (V2)
- [ ] Add urgency badges (color-coded):
  - [ ] Critical: Red badge, "Act now"
  - [ ] High: Orange badge, "This week"
  - [ ] Medium: Yellow badge, "This month"
  - [ ] Low: Gray badge, "Monitor"
- [ ] Add action window indicator:
  - [ ] "Window closing in X days"
  - [ ] "Optimal outreach: [date]"
- [ ] Add recommended actions list

#### Lifecycle UI (V2)
- [ ] Add update indicator badge:
  - [ ] "3 new speakers added yesterday"
  - [ ] "Event date changed"
- [ ] Add refresh button to update opportunity
- [ ] Show staleness score (if data is old)

#### Onboarding Flow
- [ ] Create discovery profile setup wizard:
  - [ ] Step 1: Industries/regions
  - [ ] Step 2: Target titles (ICP)
  - [ ] Step 3: Target companies (Watchlist)
  - [ ] Step 4: Competitors
  - [ ] Step 5: Discovery frequency
  - [ ] Step 6: Alert preferences
- [ ] Trigger smart backfill after profile creation
- [ ] Show "Discovery in progress" message
- [ ] Show first opportunities when ready

**Deliverable:** Opportunity Dashboard, Opportunity Cards, Feedback Loop, Temporal & Lifecycle UI, Onboarding Flow

---

### Phase 3: Automation & Migration (Week 3-4)
**Goal:** Deploy background automation and migrate existing users

#### Scheduled Discovery Jobs
- [ ] Create cron job `/api/cron/discover-opportunities`:
  - [ ] Query all active `user_discovery_profiles`
  - [ ] Filter by `discovery_frequency` (hourly/daily/weekly)
  - [ ] Queue discovery runs (respect rate limits)
  - [ ] Process in batches
- [ ] Implement job queue system:
  - [ ] Use existing cron infrastructure
  - [ ] Add retry logic with exponential backoff
  - [ ] Add error handling and logging
- [ ] Create admin dashboard for monitoring:
  - [ ] Discovery run status
  - [ ] Opportunities created per user
  - [ ] Error rates
  - [ ] Cost tracking

#### User Migration
- [ ] Create migration script:
  - [ ] Convert existing `profiles` to `user_discovery_profiles`
  - [ ] Extract industries from `industry_terms`
  - [ ] Extract ICP from `icp_terms`
  - [ ] Extract competitors from `competitors`
  - [ ] Extract watchlist companies from `watchlists` (kind='company')
  - [ ] Set default discovery frequency (daily)
  - [ ] Set default min_relevance_score (50)
- [ ] Run initial discovery for migrated users
- [ ] Validate migration results

#### Critical Alerts Deployment
- [ ] Set up email service (SendGrid/Resend):
  - [ ] Create email templates
  - [ ] Add unsubscribe link
  - [ ] Add user preferences link
- [ ] Set up Slack webhook (optional):
  - [ ] Create Slack app
  - [ ] Add webhook URL to user preferences
- [ ] Enable alerts for users with watchlist items
- [ ] Test alert delivery

#### Lifecycle Refresh Job
- [ ] Create cron job `/api/cron/refresh-event-lifecycle`:
  - [ ] Query events with opportunities
  - [ ] Check for changes (speakers, dates, venue)
  - [ ] Log changes to `event_lifecycle_events`
  - [ ] Trigger opportunity refresh
- [ ] Run daily at off-peak hours

**Deliverable:** Scheduled Discovery Jobs, User Migration, Critical Alerts, Lifecycle Refresh Job

---

### Phase 4: V2 Value Multipliers (Week 4-5)
**Goal:** Implement network effects, predictive scoring, and integrations

#### Collective Intelligence (V2 - Gap 2)
- [ ] Create `CollectiveIntelligenceEngine` class
- [ ] Implement `getCollectiveIntelligence()`:
  - [ ] Query anonymous tracking stats (count users tracking event)
  - [ ] Calculate industry peer tracking (same industry)
  - [ ] Check competitor tracking (if competitors are tracking)
  - [ ] Calculate trending score (users added in last 7 days)
  - [ ] Generate peer insights
- [ ] Add `collective_intelligence` field to opportunity storage
- [ ] Update opportunity feed to include collective data
- [ ] Add UI indicators:
  - [ ] "12 users tracking this event"
  - [ ] "Trending in your industry"
  - [ ] "Competitors are tracking this"

#### Predictive Intelligence (V2 - Gap 6)
- [ ] Create `PredictiveIntelligenceEngine` class
- [ ] Implement ML model (start with rule-based, evolve to ML):
  - [ ] Extract features:
    - [ ] Confidence score
    - [ ] Signal strength
    - [ ] Account count
    - [ ] Days until event
    - [ ] ICP matches
  - [ ] Calculate conversion probability (0-100)
  - [ ] Identify conversion factors
  - [ ] Find similar opportunities (historical)
  - [ ] Estimate deal size (based on account size)
  - [ ] Recommend priority (pursue_now/monitor/low_priority)
- [ ] Add `predictive_intelligence` field to opportunity storage
- [ ] Update opportunity feed to include predictive data
- [ ] Add UI indicators:
  - [ ] Conversion probability badge
  - [ ] "3 similar opportunities led to deals"
  - [ ] Estimated deal size
  - [ ] Priority recommendation

#### Integration Hub (V2 - Gap 7)
- [ ] Create `IntegrationHub` class
- [ ] Implement CRM sync:
  - [ ] Salesforce connector
  - [ ] HubSpot connector
  - [ ] Pipedrive connector
  - [ ] Create opportunity record in CRM
  - [ ] Sync status back to `user_opportunities`
- [ ] Implement email tools:
  - [ ] Generate email sequence from templates
  - [ ] Create campaign (if integrated)
- [ ] Implement calendar:
  - [ ] Add event to calendar (Google/Outlook)
  - [ ] Set reminder for optimal outreach date
- [ ] Add `integration_actions` field to opportunity storage
- [ ] Add UI buttons:
  - [ ] "Sync to CRM"
  - [ ] "Create email campaign"
  - [ ] "Add to calendar"

**Deliverable:** Collective Intelligence, Predictive Intelligence, Integration Hub

---

### Phase 5: Advanced Features (Week 6+)
**Goal:** Multi-signal enrichment and team collaboration

#### Multi-Signal Enrichment (V2 - Gap 4)
- [ ] Create `MultiSignalEnrichmentEngine` class
- [ ] Implement news signals:
  - [ ] Integrate with news APIs (Google News, Crunchbase)
  - [ ] Filter for relevant news (expansions, product launches)
  - [ ] Store news signals
- [ ] Implement job signals:
  - [ ] Integrate with job APIs (LinkedIn, Indeed)
  - [ ] Filter for relevant roles (target titles)
  - [ ] Store job signals
- [ ] Implement funding signals:
  - [ ] Integrate with funding APIs (Crunchbase)
  - [ ] Filter for recent funding rounds
  - [ ] Store funding signals
- [ ] Calculate combined signal strength
- [ ] Add `enriched_signals` field to opportunity storage
- [ ] Update opportunity feed to include multi-signal data
- [ ] Add UI indicators:
  - [ ] News badge: "Company announced expansion"
  - [ ] Job badge: "New CTO hired"
  - [ ] Funding badge: "Raised $10M Series A"

#### Team Collaboration (V2 - Gap 5)
- [ ] Create `teams` table
- [ ] Create `team_members` table
- [ ] Create `team_opportunities` table
- [ ] Implement team features:
  - [ ] Create team
  - [ ] Invite members
  - [ ] Share opportunity to team
  - [ ] Add team notes
  - [ ] Set team priority
  - [ ] Track team status (active/won/lost/archived)
- [ ] Create team UI:
  - [ ] Team management page
  - [ ] Team opportunity feed
  - [ ] Team notes and collaboration
- [ ] Add `team_context` field to opportunity storage

#### ML Model Training (V2 - Gap 6 Enhancement)
- [ ] Collect training data:
  - [ ] User actions (save, dismiss, outreach)
  - [ ] Conversion outcomes (if tracked)
  - [ ] Opportunity features
- [ ] Train ML model:
  - [ ] Use historical data
  - [ ] Feature engineering
  - [ ] Model selection (logistic regression, random forest, etc.)
  - [ ] Model evaluation
- [ ] Deploy model:
  - [ ] API endpoint for predictions
  - [ ] Batch prediction job
  - [ ] A/B testing framework
- [ ] Monitor and iterate:
  - [ ] Track prediction accuracy
  - [ ] Retrain periodically
  - [ ] Improve features

**Deliverable:** Multi-Signal Enrichment, Team Collaboration, ML Model Training

---

## Technical Considerations

### Database Migration Strategy
1. **Create new tables** alongside existing ones (no breaking changes)
2. **Migrate data** gradually (users opt-in)
3. **Run in parallel** with existing search (A/B test)
4. **Deprecate old search** only after validation

### API Compatibility
- Keep existing search APIs functional during transition
- Add new opportunity APIs without breaking changes
- Support both search and opportunity feeds during migration

### Performance Optimization
- Use database indexes (already planned in schema)
- Implement pagination for opportunity feed
- Cache opportunity queries (Redis)
- Batch discovery runs to reduce API costs

### Error Handling
- Graceful degradation if discovery fails (show cached opportunities)
- Retry logic for failed discovery runs
- User-friendly error messages
- Monitoring and alerting for critical failures

### Security & Privacy
- RLS policies for all new tables
- Anonymize collective intelligence data (no PII)
- User control over data sharing
- GDPR compliance (data retention, deletion)

---

## Success Metrics

### Phase 0-1 (Foundation)
- [ ] Signal confidence > 85% (true positive rate)
- [ ] Discovery runs complete without errors
- [ ] Opportunities created per user > 0

### Phase 2 (UI)
- [ ] User engagement: > 50% of users view opportunities
- [ ] Feedback loop: > 30% of opportunities get user action (save/dismiss)
- [ ] Time to first opportunity: < 5 minutes after onboarding

### Phase 3 (Automation)
- [ ] Discovery runs: 100% success rate
- [ ] User migration: > 90% of users migrated
- [ ] Critical alerts: < 5% false positive rate

### Phase 4-5 (V2 Features)
- [ ] Network effects: > 20% of opportunities show collective intelligence
- [ ] Predictive accuracy: > 70% conversion probability accuracy
- [ ] Integration adoption: > 40% of users sync to CRM

---

## Risk Mitigation

### Risk: Low Signal Confidence
**Mitigation:** 
- Start with conservative matching (higher confidence threshold)
- Iterate based on user feedback
- Add manual verification option

### Risk: High API Costs
**Mitigation:**
- Implement shared cache (target > 60% hit rate)
- Batch processing to reduce API calls
- Cost tracking and budgets per user

### Risk: User Adoption
**Mitigation:**
- Smart backfill ensures immediate value
- Onboarding wizard guides setup
- A/B test against existing search

### Risk: Performance Issues
**Mitigation:**
- Database indexes from day 1
- Pagination and lazy loading
- Caching strategy
- Load testing before launch

---

## Next Steps

1. **Review this plan** with team
2. **Create feature branch** `feat/proactive-discovery`
3. **Start Phase 0** (Database schema + Shadow mode)
4. **Set up project tracking** (GitHub issues, project board)
5. **Schedule weekly reviews** to track progress

---

## Appendix: File Structure

### New Files to Create
```
src/lib/services/
  ├── discovery-engine.ts          # Core discovery service
  ├── temporal-intelligence-engine.ts
  ├── collective-intelligence-engine.ts
  ├── lifecycle-management-engine.ts
  ├── multi-signal-enrichment-engine.ts
  ├── predictive-intelligence-engine.ts
  └── integration-hub.ts

src/app/api/opportunities/
  ├── feed/route.ts                # Opportunity feed API
  ├── [id]/route.ts                # Single opportunity
  └── feedback/route.ts            # Feedback loop

src/app/api/cron/
  ├── discover-opportunities/route.ts
  └── refresh-event-lifecycle/route.ts

src/app/(protected)/opportunities/
  └── page.tsx                     # Opportunity dashboard

src/components/
  ├── OpportunityCard.tsx          # Opportunity card component
  ├── DiscoveryProfileWizard.tsx    # Onboarding wizard
  └── TemporalIntelligenceBadge.tsx # Urgency badges

supabase/migrations/
  ├── YYYYMMDD_create_user_opportunities.sql
  ├── YYYYMMDD_create_user_discovery_profiles.sql
  ├── YYYYMMDD_create_discovery_run_logs.sql
  ├── YYYYMMDD_create_event_lifecycle_events.sql
  ├── YYYYMMDD_create_teams.sql
  ├── YYYYMMDD_create_team_opportunities.sql
  ├── YYYYMMDD_create_discovery_cost_tracking.sql
  └── YYYYMMDD_create_shared_query_cache.sql
```

### Files to Enhance
```
src/lib/services/
  ├── speaker-service.ts           # Add confidence scoring
  └── search-service.ts            # Reuse for discovery

src/lib/types/
  └── database.ts                  # Add new types

src/components/
  └── EventCard.tsx                # Reference for OpportunityCard
```

---

**End of Implementation Plan**

