# Phase 2: Actionability & Prioritization - Next Steps
**Date:** 2025-02-22  
**Status:** 📋 Planning - Awaiting Approval  
**Previous Phase:** Phase 1 (Complete) ✅  
**Timeline:** Weeks 5-9 (5 weeks total)

---

## Overview

Phase 2 focuses on making insights **actionable** and **prioritized**. This phase transforms insights from descriptive summaries into strategic recommendations that drive user actions.

**Goal:** Convert insights into specific, actionable steps with clear prioritization based on value, urgency, and relevance.

---

## Phase 2A: Actionability Core (Weeks 5-7)
**Timeline:** 3 weeks  
**Risk Level:** Medium  
**Value:** High

### 2.2 Competitive Intelligence
**Risk:** 🟢 Low | **Effort:** 🟡 Medium (1-2 weeks) | **Value:** ⭐⭐⭐ High

#### Objectives
- Track competitors in events (speakers, sponsors, attendees)
- Compare user's activity vs. competitors
- Identify gaps (competitors attending events user isn't)
- Alert when competitors appear in high-value events

#### Implementation Tasks

1. **Enhance Competitor Tracking** (2-3 days)
   - **File:** `src/lib/services/company-intelligence-ai-service.ts`
   - Add competitor detection logic in event intelligence
   - Track competitors from user profile (`competitors` field)
   - Match competitors against:
     - Event speakers (by name + organization)
     - Event sponsors (by company name)
     - Event attendees/organizations (fuzzy matching)
   - Store competitor appearances in event intelligence cache

2. **Add Comparison Logic** (2-3 days)
   - **File:** `src/lib/services/competitive-intelligence-service.ts` (NEW)
   - Create service to:
     - Compare user's event participation vs. competitors
     - Identify events where competitors are present but user isn't
     - Calculate competitive activity scores
     - Generate competitive insights (e.g., "Competitor X is increasing event presence by 40%")
   - Add competitive context to event intelligence

3. **Create Competitive Alerts** (2 days)
   - **File:** `src/lib/services/competitive-intelligence-service.ts`
   - Alert generation for:
     - High-value events with competitor presence
     - Competitor activity spikes
     - Competitive gaps (opportunities)
   - Integrate alerts into event intelligence response

4. **Integrate into Insights** (2 days)
   - **Files:** 
     - `src/lib/services/event-intelligence-service.ts`
     - `src/app/api/events/[eventId]/intelligence/route.ts`
   - Add competitive intelligence to `EventIntelligence` interface
   - Include competitive context in all event insights
   - Update UI components to display competitive intel

5. **Testing** (2 days)
   - Test competitor matching accuracy
   - Validate competitive insights generation
   - Test with various competitor lists
   - Performance testing (ensure no significant slowdown)

#### Dependencies
- ✅ User profile data (competitors list) - Available
- ✅ Event data (speakers, sponsors) - Available
- ✅ Company intelligence service - Available
- ⚠️ Phase 1B (Opportunity Scoring) - Helpful but not required

#### Deliverables
- `src/lib/services/competitive-intelligence-service.ts` (NEW)
- Enhanced `EventIntelligence` interface with competitive fields
- Competitive context in all event insights
- Competitive alerts system

#### Success Metrics
- 100% of event insights show competitive context when competitors are present
- Competitor matching accuracy > 90%
- Competitive alerts generated for high-value events with competitor presence

---

### 2.1 Recommendations Engine
**Risk:** 🟡 Medium | **Effort:** 🔴 High (2-3 weeks) | **Value:** ⭐⭐⭐ High

#### Objectives
- Convert insights into specific, actionable recommendations
- Provide clear "what, why, when, how" for each recommendation
- Rank recommendations by priority and impact
- Support multiple recommendation types (immediate, strategic, research)

#### Implementation Tasks

1. **Design Recommendation Framework** (2 days)
   - **File:** `src/lib/services/recommendation-engine.ts` (NEW)
   - Define recommendation types:
     - **Immediate Actions** (time-sensitive, high impact)
     - **Strategic Actions** (long-term opportunities)
     - **Research Actions** (gather more information)
   - Design recommendation data structure:
     ```typescript
     interface Recommendation {
       id: string;
       type: 'immediate' | 'strategic' | 'research';
       title: string;
       description: string;
       why: string; // Why it matters
       when: string; // When to act (urgency)
       how: string | null; // How to execute (if applicable)
       expectedOutcome: string;
       priority: number; // 0-1
       confidence: number; // 0-1
       relatedInsightId: string;
       relatedEventId?: string;
     }
     ```

2. **Implement Recommendation Generation** (5-6 days)
   - **File:** `src/lib/services/recommendation-engine.ts`
   - Create recommendation generators for:
     - **Event-based recommendations:**
       - Sponsor event (with ROI estimate)
       - Speak at event (with positioning strategy)
       - Attend event (with networking opportunities)
       - Research event (if data incomplete)
     - **Trend-based recommendations:**
       - Capitalize on trending category
       - Monitor emerging trend
       - Research trend deeper
     - **Competitive recommendations:**
       - Match competitor activity
       - Identify competitive gaps
       - Counter-competitive actions
   - Use LLM to generate contextual "why" and "how" text
   - Integrate with opportunity scoring for priority calculation

3. **Create Ranking Algorithm** (3 days)
   - **File:** `src/lib/services/recommendation-engine.ts`
   - Rank recommendations by:
     - **Urgency** (from urgency indicators) - 30%
     - **Impact** (from opportunity score) - 30%
     - **Feasibility** (data quality, actionability) - 20%
     - **Relevance** (user profile match) - 20%
   - Sort recommendations by priority score
   - Limit to top N recommendations per insight

4. **Build Execution Guidance System** (3-4 days)
   - **File:** `src/lib/services/recommendation-engine.ts`
   - Create templates for "how to execute":
     - Contact organizer templates
     - Outreach email templates
     - Research checklists
   - Generate personalized execution steps based on:
     - Event type
     - User profile
     - Available data
   - Link to relevant resources (event pages, contact info)

5. **Integrate with All Insight Services** (3-4 days)
   - **Files:**
     - `src/lib/services/event-intelligence-service.ts`
     - `src/lib/services/trend-analysis-service.ts`
     - `src/lib/services/company-intelligence-ai-service.ts`
   - Add recommendation generation to all insight services
   - Update APIs to return recommendations
   - Ensure recommendations are cached with insights

6. **Update UI Components** (2-3 days)
   - **Files:**
     - `src/components/EventIntelligenceQuickView.tsx`
     - `src/components/EventIntelligencePanel.tsx` (if exists)
     - Event Board insights display
   - Display recommendations in insight views
   - Add "Take Action" buttons/links
   - Show recommendation priority and confidence

7. **Testing** (3-4 days)
   - Test recommendation generation for all types
   - Validate ranking algorithm
   - Test execution guidance quality
   - User acceptance testing (recommendation relevance)
   - Performance testing

#### Dependencies
- ⚠️ Phase 1B (Opportunity Scoring) - **Required** (for impact scoring)
- ⚠️ Phase 1B (Urgency Indicators) - **Required** (for urgency scoring)
- ⚠️ Phase 2A (Competitive Intelligence) - **Helpful** (for competitive recommendations)
- ✅ Event data, user profile - Available
- ✅ LLM service - Available

#### Deliverables
- `src/lib/services/recommendation-engine.ts` (NEW)
- Recommendation generation for all insight types
- Ranking and prioritization system
- Execution guidance templates
- Updated UI components with recommendations

#### Success Metrics
- 100% of insights have at least one actionable recommendation
- Top 3 recommendations account for 80% of user actions
- Recommendation relevance rating > 80% (user feedback)
- Average time to action < 7 days for immediate recommendations

---

## Phase 2B: Prioritization (Weeks 8-9)
**Timeline:** 1-2 weeks  
**Risk Level:** Medium  
**Value:** High

### 3.1 Insight Scoring System
**Risk:** 🟡 Medium | **Effort:** 🟡 Medium (1-2 weeks) | **Value:** ⭐⭐⭐ High

#### Objectives
- Rank all insights by value and relevance
- Provide transparent scoring breakdown
- Enable personalized insight ranking
- Filter low-value insights automatically

#### Implementation Tasks

1. **Design Scoring Algorithm** (2 days)
   - **File:** `src/lib/services/insight-scoring-service.ts` (NEW)
   - Define scoring factors:
     - **Relevance Score** (0-1) - 30%
       - User profile match
       - Industry alignment
       - ICP match
       - Historical engagement patterns
     - **Impact Score** (0-1) - 30%
       - Estimated business value
       - Potential ROI
       - Market size/opportunity
       - Competitive advantage
     - **Urgency Score** (0-1) - 20%
       - Time sensitivity
       - Deadline proximity
       - Market timing
       - Competitive pressure
     - **Confidence Score** (0-1) - 20%
       - Data quality
       - Statistical significance
       - Source reliability
       - Historical accuracy
   - Final score formula:
     ```
     Final Score = (Relevance × 0.3) + (Impact × 0.3) + (Urgency × 0.2) + (Confidence × 0.2)
     ```

2. **Implement Multi-Factor Scoring** (3-4 days)
   - **File:** `src/lib/services/insight-scoring-service.ts`
   - Implement each scoring factor:
     - Calculate relevance from user profile matching
     - Calculate impact from opportunity scores
     - Calculate urgency from urgency indicators
     - Calculate confidence from statistical significance + data quality
   - Combine factors with weighted formula
   - Add score breakdown for transparency

3. **Add Personalization Weighting** (2 days)
   - **File:** `src/lib/services/insight-scoring-service.ts`
   - Adjust scoring weights based on:
     - User preferences (if available)
     - Behavioral patterns (if available)
     - Explicit user settings
   - Allow users to customize weights (optional)

4. **Integrate into All Services** (3-4 days)
   - **Files:**
     - `src/lib/services/event-intelligence-service.ts`
     - `src/lib/services/trend-analysis-service.ts`
     - `src/lib/services/company-intelligence-ai-service.ts`
     - `src/app/api/events/trending/route.ts`
     - `src/app/api/events/[eventId]/intelligence/route.ts`
   - Add scoring to all insight generation
   - Update interfaces to include scores
   - Cache scores with insights

5. **Update APIs** (1-2 days)
   - Add score fields to all insight API responses
   - Add optional `minScore` filter parameter
   - Add optional `sortBy` parameter (score, relevance, urgency, etc.)

6. **Update UI to Show Ranked Insights** (2-3 days)
   - **Files:**
     - `src/components/EventIntelligenceQuickView.tsx`
     - Event Board insights
     - Command Centre insights
     - Trending insights display
   - Display insight scores
   - Sort insights by score (default)
   - Show score breakdown (expandable)
   - Filter low-score insights (optional toggle)

7. **Testing** (2-3 days)
   - Test scoring accuracy with various insights
   - Validate score calculations
   - Test personalization weighting
   - User acceptance testing (do scores match user perception?)
   - Performance testing

#### Dependencies
- ⚠️ Phase 1A (Statistical Significance) - **Required** (for confidence score)
- ⚠️ Phase 1B (Opportunity Scoring) - **Required** (for impact score)
- ⚠️ Phase 1B (Urgency Indicators) - **Required** (for urgency score)
- ✅ User profile data - Available
- ✅ Event data - Available

#### Deliverables
- `src/lib/services/insight-scoring-service.ts` (NEW)
- Scoring integrated into all insight services
- Updated APIs with score fields
- Ranked insights in UI
- Score breakdown display

#### Success Metrics
- Top 20% of insights (by score) account for 80% of user actions
- Score accuracy: User feedback matches scores > 70% of the time
- Average insight score > 0.6 (filtering out low-value insights)
- User engagement with top-scored insights 2x higher than low-scored

---

## Database Changes

### New Tables

1. **`insight_recommendations`** (for Phase 2A)
   ```sql
   CREATE TABLE insight_recommendations (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     insight_id TEXT NOT NULL,
     insight_type TEXT NOT NULL, -- 'event', 'trend', 'account'
     recommendation_type TEXT NOT NULL, -- 'immediate', 'strategic', 'research'
     title TEXT NOT NULL,
     description TEXT NOT NULL,
     why TEXT NOT NULL,
     when_text TEXT, -- When to act
     how TEXT, -- How to execute
     expected_outcome TEXT,
     priority DECIMAL(3,2) NOT NULL, -- 0-1
     confidence DECIMAL(3,2) NOT NULL, -- 0-1
     related_event_id UUID REFERENCES collected_events(id),
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **`competitive_intelligence`** (for Phase 2A)
   ```sql
   CREATE TABLE competitive_intelligence (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES auth.users(id),
     event_id UUID REFERENCES collected_events(id),
     competitor_name TEXT NOT NULL,
     competitor_role TEXT, -- 'speaker', 'sponsor', 'attendee'
     detected_at TIMESTAMPTZ DEFAULT NOW(),
     alert_sent BOOLEAN DEFAULT FALSE
   );
   ```

### Modified Tables

1. **`event_intelligence`** (add fields)
   ```sql
   ALTER TABLE event_intelligence
   ADD COLUMN competitive_intel JSONB,
   ADD COLUMN recommendation_ids UUID[],
   ADD COLUMN insight_score DECIMAL(3,2),
   ADD COLUMN score_breakdown JSONB;
   ```

---

## Success Metrics Summary

### Phase 2A Metrics
- ✅ 100% of event insights show competitive context when available
- ✅ 100% of insights have at least one actionable recommendation
- ✅ Top 3 recommendations account for 80% of user actions
- ✅ Recommendation relevance rating > 80%

### Phase 2B Metrics
- ✅ Top 20% of insights (by score) account for 80% of user actions
- ✅ Score accuracy: User feedback matches scores > 70%
- ✅ Average insight score > 0.6
- ✅ User engagement with top-scored insights 2x higher

---

## Risk Mitigation

### Phase 2A Risks

1. **Recommendation Quality**
   - **Risk:** Bad recommendations hurt user trust
   - **Mitigation:** 
     - A/B test recommendation formats
     - Allow users to dismiss/feedback on recommendations
     - Start with simple recommendations, expand gradually
     - Show confidence scores

2. **Competitive Intelligence Privacy**
   - **Risk:** Privacy concerns with competitor tracking
   - **Mitigation:**
     - Make competitor tracking opt-in
     - Only show competitive intel when data available
     - Clear privacy policy

### Phase 2B Risks

1. **Scoring Accuracy**
   - **Risk:** Scores may not match user perception
   - **Mitigation:**
     - Make scoring weights configurable
     - Show score breakdown (transparency)
     - Iterate on weights based on user feedback
     - Allow users to override rankings

2. **Performance**
   - **Risk:** Scoring many insights may slow down APIs
   - **Mitigation:**
     - Cache scores with insights
     - Pre-compute scores in cron jobs
     - Use async processing for heavy calculations

---

## Dependencies Checklist

### Required (Must Complete First)
- ✅ Phase 1A: Statistical Significance Testing
- ✅ Phase 1B: Opportunity Scoring
- ✅ Phase 1B: Urgency Indicators

### Helpful (Can Start Without)
- ⚠️ Phase 2A Competitive Intelligence (helps with recommendations)

### External Dependencies
- ✅ User profile data (competitors, ICP) - Available
- ✅ Event data - Available
- ✅ LLM service - Available
- ✅ Database (Supabase) - Available

---

## Timeline Summary

| Phase | Duration | Start Week | End Week |
|-------|----------|------------|----------|
| **Phase 2A** | 3 weeks | Week 5 | Week 7 |
| - Competitive Intelligence | 1-2 weeks | Week 5 | Week 6 |
| - Recommendations Engine | 2-3 weeks | Week 5 | Week 7 |
| **Phase 2B** | 1-2 weeks | Week 8 | Week 9 |
| - Insight Scoring | 1-2 weeks | Week 8 | Week 9 |

**Total:** 5 weeks (Weeks 5-9)

---

## Next Steps (After Approval)

1. ✅ **Review and approve Phase 2 plan**
2. 🔄 **Create feature branch:** `feat/phase2-actionability-prioritization`
3. 🔄 **Set up database migrations** for new tables
4. 🔄 **Begin Phase 2A implementation:**
   - Start with Competitive Intelligence (lower risk)
   - Then Recommendations Engine (higher effort)
5. 🔄 **Test with real data** after each component
6. 🔄 **Begin Phase 2B** after Phase 2A complete
7. 🔄 **Update UI components** to display recommendations and scores
8. 🔄 **Deploy and monitor** success metrics

---

## Questions for Discussion

1. **Priority:** Should we start with Competitive Intelligence or Recommendations Engine first?
2. **Scope:** Are there specific recommendation types that are most critical?
3. **UI/UX:** How should recommendations be displayed? (cards, list, expandable?)
4. **Scoring:** Should users be able to customize scoring weights?
5. **Testing:** Do we have user feedback on current insights to guide improvements?

---

**End of Phase 2 Next Steps**


