# Proactive Discovery - Quick Reference
**Date:** 2025-01-19  
**Status:** Planning Phase

---

## Current State vs. Proposed State

### Current Architecture (Search-Based)
```
User → Search Query → SearchService → Events → User evaluates
```
- **Trigger:** User-initiated search
- **Timing:** On-demand (55 seconds)
- **Relevance:** User evaluates manually
- **Friction:** High (user must remember to search)

### Proposed Architecture (Discovery-Based)
```
System → Background Discovery → Opportunities → User reviews
```
- **Trigger:** Automated, continuous
- **Timing:** Pre-computed (instant UI)
- **Relevance:** System pre-qualifies with confidence scores
- **Friction:** Zero (opportunities appear automatically)

---

## Key Components Mapping

| Proposed Component | Current Equivalent | Action |
|-------------------|-------------------|--------|
| `user_opportunities` | ❌ None | **CREATE** |
| `user_discovery_profiles` | `profiles` table | **ENHANCE** |
| `DiscoveryEngine` | `SearchService` | **REUSE + NEW** |
| Opportunity Feed API | Search API | **NEW** |
| Confidence Scoring | Basic matching | **ENHANCE** |
| Smart Backfill | ❌ None | **CREATE** |

---

## Implementation Phases Summary

### Phase 0: Foundation (Week 1)
- Database schema
- Discovery Engine (shadow mode)
- Signal confidence validation

### Phase 1: Core Backend (Week 1-2)
- Smart Backfill
- Opportunity Feed API
- Critical Alerts
- Temporal Intelligence
- Lifecycle Management
- Cost Optimization

### Phase 2: Dashboard UI (Week 2-3)
- Opportunity Dashboard
- Opportunity Cards
- Feedback Loop
- Temporal & Lifecycle UI
- Onboarding Flow

### Phase 3: Automation (Week 3-4)
- Scheduled Discovery Jobs
- User Migration
- Critical Alerts Deployment
- Lifecycle Refresh Job

### Phase 4: V2 Features (Week 4-5)
- Collective Intelligence
- Predictive Intelligence
- Integration Hub

### Phase 5: Advanced (Week 6+)
- Multi-Signal Enrichment
- Team Collaboration
- ML Model Training

---

## Database Tables to Create

1. **user_opportunities** - Core opportunities table
2. **user_discovery_profiles** - Discovery configuration
3. **discovery_run_logs** - Tracking & debugging
4. **event_lifecycle_events** - Change tracking
5. **teams** - Team collaboration (V2)
6. **team_members** - Team membership (V2)
7. **team_opportunities** - Shared opportunities (V2)
8. **discovery_cost_tracking** - Cost monitoring (V2)
9. **shared_query_cache** - Multi-user cache (V2)

---

## Services to Create

1. **DiscoveryEngine** - Core discovery service
2. **TemporalIntelligenceEngine** - Action timing (V2)
3. **CollectiveIntelligenceEngine** - Network effects (V2)
4. **LifecycleManagementEngine** - Event refresh (V2)
5. **MultiSignalEnrichmentEngine** - News/jobs/funding (V2)
6. **PredictiveIntelligenceEngine** - ML scoring (V2)
7. **IntegrationHub** - CRM/email/calendar (V2)

---

## APIs to Create

1. **GET /api/opportunities/feed** - Opportunity feed
2. **GET /api/opportunities/[id]** - Single opportunity
3. **POST /api/opportunities/feedback** - Feedback loop
4. **POST /api/cron/discover-opportunities** - Discovery job
5. **POST /api/cron/refresh-event-lifecycle** - Lifecycle job

---

## UI Components to Create

1. **OpportunityDashboard** - Main feed page
2. **OpportunityCard** - Opportunity display
3. **DiscoveryProfileWizard** - Onboarding
4. **TemporalIntelligenceBadge** - Urgency indicators
5. **LifecycleUpdateIndicator** - Change notifications

---

## Key Decisions Needed

1. **Confidence Thresholds:**
   - What confidence score minimum to show opportunity?
   - What confidence score triggers critical alert?

2. **Discovery Frequency:**
   - Default frequency (hourly/daily/weekly)?
   - Per-user customization?

3. **Cost Management:**
   - API budget per user?
   - Cache hit rate target?

4. **Migration Strategy:**
   - Opt-in or automatic?
   - Timeline for deprecating old search?

5. **V2 Feature Priority:**
   - Which V2 features are must-have vs nice-to-have?
   - Timeline for each?

---

## Success Criteria

- **Signal Confidence:** > 85% true positive rate
- **User Engagement:** > 50% view opportunities
- **Time to Value:** < 5 minutes after onboarding
- **Discovery Success:** 100% job completion rate
- **Cost Efficiency:** > 60% cache hit rate

---

## Risk Areas

1. **Low Signal Confidence** → Start conservative, iterate
2. **High API Costs** → Shared cache + batch processing
3. **User Adoption** → Smart backfill + onboarding
4. **Performance** → Indexes + pagination + caching

---

## Next Actions

1. ✅ Review architecture document
2. ✅ Create implementation plan
3. ⏳ **Review with team**
4. ⏳ **Create feature branch**
5. ⏳ **Start Phase 0**

---

**Last Updated:** 2025-01-19

