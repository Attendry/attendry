# Phase 2C: Competitive Intelligence - Detailed Task Breakdown
**Date:** 2025-02-23  
**Status:** 📋 Planning - Ready for Implementation  
**Previous Phases:** Phase 1 (Complete) ✅ | Phase 2A (Complete) ✅ | Phase 2B (Complete) ✅  
**Timeline:** 1-2 weeks (8-10 days)  
**Risk Level:** 🟢 Low  
**Value:** ⭐⭐⭐⭐ High

---

## Overview

Phase 2C adds **competitive intelligence** capabilities to track competitors in events, compare user activity vs. competitors, identify gaps, and generate alerts. This provides strategic context for competitive-focused users.

**Goal:** Enable users to track competitor activity in events, identify opportunities where competitors are present, and receive alerts for high-value competitive events.

---

## Task Breakdown

### **Task 1: Create Competitive Intelligence Service** 
**Priority:** High | **Effort:** 2-3 days | **Dependencies:** None

#### Objectives
- Create new service for competitive intelligence operations
- Define data structures for competitor tracking
- Implement core competitor detection logic

#### Implementation Details

**File:** `src/lib/services/competitive-intelligence-service.ts` (NEW)

**Interfaces to Define:**
```typescript
export interface CompetitorMatch {
  competitorName: string;
  matchType: 'speaker' | 'sponsor' | 'attendee' | 'organizer';
  matchConfidence: number; // 0-1
  matchDetails: {
    eventId: string;
    eventTitle: string;
    eventDate: string;
    role: string; // e.g., "Keynote Speaker", "Gold Sponsor"
    organization?: string;
    speakerName?: string;
  };
}

export interface CompetitiveContext {
  competitorsPresent: CompetitorMatch[];
  competitorCount: number;
  highValueCompetitors: string[]; // Competitors in high-value events
  competitiveGaps: {
    competitorName: string;
    eventsAttending: string[];
    eventsUserNotAttending: string[];
  }[];
  activityComparison: {
    competitorName: string;
    userEventCount: number;
    competitorEventCount: number;
    growthRate: number; // Competitor's growth rate
    gapCount: number; // Events competitor is in, user isn't
  }[];
}

export interface CompetitiveAlert {
  id: string;
  type: 'high_value_event' | 'activity_spike' | 'competitive_gap' | 'new_competitor';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  eventId?: string;
  competitorName: string;
  recommendedAction: string;
  createdAt: string;
}
```

**Core Functions:**
1. `detectCompetitorsInEvent(event: EventData, competitors: string[]): CompetitorMatch[]`
   - Match competitors against event speakers, sponsors, attendees
   - Use fuzzy matching for company names
   - Return matches with confidence scores

2. `compareUserActivity(userEvents: string[], competitorEvents: Record<string, string[]>): CompetitiveContext`
   - Compare user's event participation vs. each competitor
   - Identify gaps (events competitor is in, user isn't)
   - Calculate activity scores

3. `generateCompetitiveAlerts(context: CompetitiveContext, eventIntelligence: EventIntelligence): CompetitiveAlert[]`
   - Generate alerts for high-value events with competitors
   - Alert on competitor activity spikes
   - Alert on competitive gaps

#### Acceptance Criteria
- [ ] Service file created with all interfaces
- [ ] Competitor detection function implemented
- [ ] Comparison logic implemented
- [ ] Alert generation function implemented
- [ ] Unit tests written (basic structure)

---

### **Task 2: Implement Competitor Detection Logic**
**Priority:** High | **Effort:** 2 days | **Dependencies:** Task 1

#### Objectives
- Implement fuzzy matching for competitor names
- Match competitors against event data (speakers, sponsors, attendees)
- Calculate match confidence scores

#### Implementation Details

**File:** `src/lib/services/competitive-intelligence-service.ts`

**Fuzzy Matching Strategy:**
```typescript
function normalizeCompanyName(name: string): string {
  // Remove common suffixes (Inc, LLC, GmbH, etc.)
  // Normalize whitespace
  // Convert to lowercase
  // Remove special characters
}

function calculateNameSimilarity(name1: string, name2: string): number {
  // Use Levenshtein distance or similar
  // Return 0-1 similarity score
}

function matchCompetitorInSpeakers(
  competitorName: string,
  speakers: EventSpeaker[]
): CompetitorMatch[] {
  // 1. Normalize competitor name
  // 2. Check speaker names (fuzzy match)
  // 3. Check speaker organizations (fuzzy match)
  // 4. Return matches with confidence scores
}

function matchCompetitorInSponsors(
  competitorName: string,
  sponsors: EventSponsor[]
): CompetitorMatch[] {
  // 1. Normalize competitor name
  // 2. Check sponsor company names (fuzzy match)
  // 3. Return matches with confidence scores
}

function matchCompetitorInAttendees(
  competitorName: string,
  attendees: string[] // Organization names
): CompetitorMatch[] {
  // 1. Normalize competitor name
  // 2. Fuzzy match against attendee organizations
  // 3. Return matches with confidence scores
}
```

**Main Detection Function:**
```typescript
export async function detectCompetitorsInEvent(
  event: EventData,
  competitors: string[]
): Promise<CompetitorMatch[]> {
  const matches: CompetitorMatch[] = [];
  
  for (const competitor of competitors) {
    // Check speakers
    const speakerMatches = matchCompetitorInSpeakers(
      competitor,
      event.speakers || []
    );
    matches.push(...speakerMatches);
    
    // Check sponsors
    const sponsorMatches = matchCompetitorInSponsors(
      competitor,
      event.sponsors || []
    );
    matches.push(...sponsorMatches);
    
    // Check attendees/organizations
    const attendeeMatches = matchCompetitorInAttendees(
      competitor,
      event.participating_organizations || []
    );
    matches.push(...attendeeMatches);
  }
  
  // Deduplicate and sort by confidence
  return deduplicateMatches(matches).sort((a, b) => 
    b.matchConfidence - a.matchConfidence
  );
}
```

**Confidence Scoring:**
- Exact match: 1.0
- Normalized match (same after normalization): 0.95
- High similarity (>0.9): 0.85
- Medium similarity (>0.7): 0.7
- Low similarity (>0.5): 0.5
- Below threshold: excluded

#### Acceptance Criteria
- [ ] Fuzzy matching implemented with Levenshtein distance
- [ ] Competitor detection works for speakers, sponsors, attendees
- [ ] Confidence scores calculated accurately
- [ ] Handles edge cases (null/undefined data, empty arrays)
- [ ] Unit tests with various competitor name formats

---

### **Task 3: Implement Activity Comparison Logic**
**Priority:** High | **Effort:** 2 days | **Dependencies:** Task 1, Task 2

#### Objectives
- Compare user's event participation vs. competitors
- Identify events where competitors are present but user isn't
- Calculate competitive activity scores and growth rates

#### Implementation Details

**File:** `src/lib/services/competitive-intelligence-service.ts`

**Comparison Function:**
```typescript
export async function compareUserActivity(
  userId: string,
  competitors: string[],
  timeWindow?: { from: Date; to: Date }
): Promise<CompetitiveContext> {
  // 1. Get user's events from user_event_board
  const userEvents = await getUserEvents(userId, timeWindow);
  
  // 2. For each competitor, find their events
  const competitorEvents: Record<string, string[]> = {};
  for (const competitor of competitors) {
    const events = await findCompetitorEvents(competitor, timeWindow);
    competitorEvents[competitor] = events.map(e => e.id);
  }
  
  // 3. Calculate gaps (events competitor is in, user isn't)
  const gaps = calculateCompetitiveGaps(userEvents, competitorEvents);
  
  // 4. Calculate activity comparison
  const activityComparison = calculateActivityComparison(
    userEvents,
    competitorEvents,
    timeWindow
  );
  
  // 5. Identify high-value competitors
  const highValueCompetitors = identifyHighValueCompetitors(
    competitorEvents,
    userEvents
  );
  
  return {
    competitorsPresent: [], // Will be populated in event intelligence
    competitorCount: competitors.length,
    highValueCompetitors,
    competitiveGaps: gaps,
    activityComparison
  };
}

function calculateCompetitiveGaps(
  userEvents: string[],
  competitorEvents: Record<string, string[]>
): CompetitiveContext['competitiveGaps'] {
  const gaps: CompetitiveContext['competitiveGaps'] = [];
  
  for (const [competitor, events] of Object.entries(competitorEvents)) {
    const eventsUserNotAttending = events.filter(
      eventId => !userEvents.includes(eventId)
    );
    
    if (eventsUserNotAttending.length > 0) {
      gaps.push({
        competitorName: competitor,
        eventsAttending: events,
        eventsUserNotAttending
      });
    }
  }
  
  return gaps;
}

function calculateActivityComparison(
  userEvents: string[],
  competitorEvents: Record<string, string[]>,
  timeWindow?: { from: Date; to: Date }
): CompetitiveContext['activityComparison'] {
  const comparison: CompetitiveContext['activityComparison'] = [];
  
  // Get previous period for growth calculation
  const previousWindow = timeWindow ? {
    from: new Date(timeWindow.from.getTime() - (timeWindow.to.getTime() - timeWindow.from.getTime())),
    to: timeWindow.from
  } : undefined;
  
  for (const [competitor, events] of Object.entries(competitorEvents)) {
    const currentCount = events.length;
    const previousCount = previousWindow 
      ? await getCompetitorEventCount(competitor, previousWindow)
      : 0;
    
    const growthRate = previousCount > 0
      ? ((currentCount - previousCount) / previousCount) * 100
      : currentCount > 0 ? 100 : 0;
    
    const gapCount = events.filter(e => !userEvents.includes(e)).length;
    
    comparison.push({
      competitorName: competitor,
      userEventCount: userEvents.length,
      competitorEventCount: currentCount,
      growthRate,
      gapCount
    });
  }
  
  return comparison;
}
```

**Helper Functions:**
- `getUserEvents(userId: string, timeWindow?: { from: Date; to: Date }): Promise<string[]>`
- `findCompetitorEvents(competitorName: string, timeWindow?: { from: Date; to: Date }): Promise<EventData[]>`
- `getCompetitorEventCount(competitorName: string, timeWindow: { from: Date; to: Date }): Promise<number>`

#### Acceptance Criteria
- [ ] Activity comparison calculates correctly
- [ ] Competitive gaps identified accurately
- [ ] Growth rates calculated for competitors
- [ ] Handles users with no events
- [ ] Handles competitors with no events
- [ ] Unit tests with various scenarios

---

### **Task 4: Implement Competitive Alerts System**
**Priority:** Medium | **Effort:** 2 days | **Dependencies:** Task 1, Task 2, Task 3

#### Objectives
- Generate alerts for high-value events with competitor presence
- Alert on competitor activity spikes
- Alert on competitive gaps (opportunities)

#### Implementation Details

**File:** `src/lib/services/competitive-intelligence-service.ts`

**Alert Generation:**
```typescript
export function generateCompetitiveAlerts(
  context: CompetitiveContext,
  eventIntelligence: EventIntelligence,
  event: EventData
): CompetitiveAlert[] {
  const alerts: CompetitiveAlert[] = [];
  
  // 1. High-value event alerts
  if (context.competitorsPresent.length > 0 && 
      eventIntelligence.opportunityScore?.overallScore >= 0.7) {
    alerts.push({
      id: generateAlertId(),
      type: 'high_value_event',
      severity: 'high',
      title: `${context.competitorsPresent.length} competitor(s) in high-value event`,
      description: `Competitors ${context.competitorsPresent.map(c => c.competitorName).join(', ')} are present in this high-value event (${Math.round(eventIntelligence.opportunityScore.overallScore * 100)}% opportunity score).`,
      eventId: event.id,
      competitorName: context.competitorsPresent[0].competitorName,
      recommendedAction: 'Consider attending or sponsoring to maintain competitive presence.',
      createdAt: new Date().toISOString()
    });
  }
  
  // 2. Activity spike alerts
  for (const activity of context.activityComparison) {
    if (activity.growthRate > 50 && activity.competitorEventCount > 5) {
      alerts.push({
        id: generateAlertId(),
        type: 'activity_spike',
        severity: 'medium',
        title: `${activity.competitorName} activity spike`,
        description: `${activity.competitorName} has increased event participation by ${activity.growthRate.toFixed(0)}% (${activity.competitorEventCount} events vs. your ${activity.userEventCount}).`,
        competitorName: activity.competitorName,
        recommendedAction: 'Review competitor strategy and consider matching their event presence.',
        createdAt: new Date().toISOString()
      });
    }
  }
  
  // 3. Competitive gap alerts
  for (const gap of context.competitiveGaps) {
    if (gap.eventsUserNotAttending.length >= 3) {
      alerts.push({
        id: generateAlertId(),
        type: 'competitive_gap',
        severity: 'high',
        title: `Competitive gap: ${gap.competitorName}`,
        description: `${gap.competitorName} is attending ${gap.eventsUserNotAttending.length} events you're not. These may be valuable opportunities.`,
        competitorName: gap.competitorName,
        recommendedAction: `Review ${gap.eventsUserNotAttending.length} events where ${gap.competitorName} is present.`,
        createdAt: new Date().toISOString()
      });
    }
  }
  
  return alerts;
}
```

**Alert Prioritization:**
- High severity: High-value events with competitors, large competitive gaps
- Medium severity: Activity spikes, moderate gaps
- Low severity: Minor gaps, low-value events with competitors

#### Acceptance Criteria
- [ ] Alerts generated for high-value events with competitors
- [ ] Activity spike alerts work correctly
- [ ] Competitive gap alerts generated appropriately
- [ ] Alert severity levels assigned correctly
- [ ] Recommended actions are actionable
- [ ] Unit tests for all alert types

---

### **Task 5: Integrate into Event Intelligence Service**
**Priority:** High | **Effort:** 1 day | **Dependencies:** Task 1, Task 2, Task 3, Task 4

#### Objectives
- Add competitive intelligence to EventIntelligence interface
- Integrate competitor detection into intelligence generation
- Include competitive context in cached intelligence

#### Implementation Details

**File:** `src/lib/services/event-intelligence-service.ts`

**Update EventIntelligence Interface:**
```typescript
export interface EventIntelligence {
  // ... existing fields ...
  
  // Phase 2C: Competitive Intelligence
  competitiveContext?: CompetitiveContext;
  competitiveAlerts?: CompetitiveAlert[];
}
```

**Update generateEventIntelligence Function:**
```typescript
export async function generateEventIntelligence(
  eventId: string,
  userProfile?: UserProfile
): Promise<EventIntelligence> {
  // ... existing intelligence generation ...
  
  // Phase 2C: Add competitive intelligence
  let competitiveContext: CompetitiveContext | undefined;
  let competitiveAlerts: CompetitiveAlert[] = [];
  
  if (userProfile?.competitors && userProfile.competitors.length > 0) {
    try {
      // Detect competitors in this event
      const competitorMatches = await detectCompetitorsInEvent(
        event,
        userProfile.competitors
      );
      
      if (competitorMatches.length > 0) {
        // Get full competitive context
        competitiveContext = await compareUserActivity(
          userProfile.id!,
          userProfile.competitors,
          { from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), to: new Date() }
        );
        
        // Add competitors present in this event
        competitiveContext.competitorsPresent = competitorMatches;
        
        // Generate alerts
        competitiveAlerts = generateCompetitiveAlerts(
          competitiveContext,
          intelligence,
          event
        );
      }
    } catch (error) {
      console.error('[EventIntelligence] Error generating competitive intelligence:', error);
      // Continue without competitive intelligence
    }
  }
  
  return {
    // ... existing fields ...
    competitiveContext,
    competitiveAlerts
  };
}
```

**Update cacheEventIntelligence Function:**
```typescript
await supabase
  .from('event_intelligence')
  .upsert({
    // ... existing fields ...
    competitive_context: intelligence.competitiveContext || null,
    competitive_alerts: intelligence.competitiveAlerts || null
  }, { onConflict: 'event_id,user_profile_hash' });
```

#### Acceptance Criteria
- [ ] EventIntelligence interface updated
- [ ] Competitive intelligence generated when competitors are present
- [ ] Competitive context cached in database
- [ ] Handles users without competitors gracefully
- [ ] No performance regression (<100ms additional time)

---

### **Task 6: Create Database Migration**
**Priority:** High | **Effort:** 0.5 day | **Dependencies:** Task 5

#### Objectives
- Add competitive intelligence fields to event_intelligence table
- Ensure proper indexing for queries

#### Implementation Details

**File:** `supabase/migrations/20250224000001_add_competitive_intelligence_to_event_intelligence.sql`

```sql
-- Add Competitive Intelligence fields to Event Intelligence
-- Migration: 20250224000001
-- Phase 2C: Competitive Intelligence

-- Add competitive_context field (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_intelligence'
    AND column_name = 'competitive_context'
  ) THEN
    ALTER TABLE event_intelligence
    ADD COLUMN competitive_context JSONB;
  END IF;
END $$;

-- Add competitive_alerts field (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_intelligence'
    AND column_name = 'competitive_alerts'
  ) THEN
    ALTER TABLE event_intelligence
    ADD COLUMN competitive_alerts JSONB;
  END IF;
END $$;

-- Add GIN index for competitive_context queries
CREATE INDEX IF NOT EXISTS idx_event_intelligence_competitive_context 
ON event_intelligence USING GIN (competitive_context);

-- Add GIN index for competitive_alerts queries
CREATE INDEX IF NOT EXISTS idx_event_intelligence_competitive_alerts 
ON event_intelligence USING GIN (competitive_alerts);

-- Add comments for documentation
COMMENT ON COLUMN event_intelligence.competitive_context IS 'Phase 2C: Competitive intelligence context including competitor matches, gaps, and activity comparison';
COMMENT ON COLUMN event_intelligence.competitive_alerts IS 'Phase 2C: Competitive alerts generated for high-value events, activity spikes, and competitive gaps';
```

#### Acceptance Criteria
- [ ] Migration file created
- [ ] Fields added to event_intelligence table
- [ ] Indexes created for performance
- [ ] Migration tested (up and down)
- [ ] No breaking changes to existing data

---

### **Task 7: Update Event Intelligence API**
**Priority:** High | **Effort:** 0.5 day | **Dependencies:** Task 5

#### Objectives
- Ensure competitive intelligence is returned in API responses
- Add query parameters for competitive filtering (optional)

#### Implementation Details

**File:** `src/app/api/events/[eventId]/intelligence/route.ts`

**Update GET Handler:**
```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // ... existing code ...
  
  // Competitive intelligence is already included in EventIntelligence
  // No changes needed - it's automatically included when competitors are present
  
  return NextResponse.json(intelligence);
}
```

**Optional: Add Filtering**
```typescript
// Query parameter: ?includeCompetitive=true (default: true if user has competitors)
const includeCompetitive = searchParams.get('includeCompetitive') !== 'false';

if (!includeCompetitive && intelligence.competitiveContext) {
  // Remove competitive intelligence if not requested
  delete intelligence.competitiveContext;
  delete intelligence.competitiveAlerts;
}
```

#### Acceptance Criteria
- [ ] Competitive intelligence included in API responses
- [ ] Handles users without competitors
- [ ] Optional filtering works (if implemented)
- [ ] API documentation updated

---

### **Task 8: Update UI Components - EventIntelligenceQuickView**
**Priority:** Medium | **Effort:** 1 day | **Dependencies:** Task 5, Task 7

#### Objectives
- Display competitive context in quick view
- Show competitor alerts
- Add visual indicators for competitive events

#### Implementation Details

**File:** `src/components/EventIntelligenceQuickView.tsx`

**Add Competitive Section:**
```typescript
{intelligence.competitiveContext && intelligence.competitiveContext.competitorsPresent.length > 0 && (
  <div className="mt-3 border-t border-blue-200 pt-3">
    <div className="flex items-center gap-2 mb-2">
      <Users className="h-4 w-4 text-orange-600" />
      <span className="text-sm font-medium text-blue-900">Competitive Intelligence</span>
    </div>
    <div className="space-y-2">
      <div className="text-xs text-blue-800">
        <strong>{intelligence.competitiveContext.competitorsPresent.length}</strong> competitor(s) present:
      </div>
      {intelligence.competitiveContext.competitorsPresent.slice(0, 3).map((match, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          <span className="font-medium text-blue-900">{match.competitorName}</span>
          <span className="text-blue-600">({match.matchType})</span>
          <span className="text-blue-500">
            {Math.round(match.matchConfidence * 100)}% match
          </span>
        </div>
      ))}
    </div>
    
    {/* Show alerts if any */}
    {intelligence.competitiveAlerts && intelligence.competitiveAlerts.length > 0 && (
      <div className="mt-2 pt-2 border-t border-orange-200">
        <div className="flex items-center gap-1 text-xs font-medium text-orange-700">
          <AlertTriangle className="h-3 w-3" />
          {intelligence.competitiveAlerts.length} alert(s)
        </div>
      </div>
    )}
  </div>
)}
```

#### Acceptance Criteria
- [ ] Competitive section displays when competitors are present
- [ ] Competitor matches shown with confidence scores
- [ ] Alerts displayed if present
- [ ] Responsive design maintained
- [ ] Handles empty states gracefully

---

### **Task 9: Update UI Components - Event Board**
**Priority:** Medium | **Effort:** 1 day | **Dependencies:** Task 5, Task 7, Task 8

#### Objectives
- Add competitive intelligence tab to Event Board insights
- Display competitive context and alerts
- Show competitive gaps and activity comparison

#### Implementation Details

**File:** `src/components/events-board/EventInsightsPanel.tsx`

**Add Competitive Tab:**
```typescript
<Tabs defaultValue="recommendations" className="w-full">
  <TabsList className="grid w-full grid-cols-5">
    <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
    <TabsTrigger value="attendees">Attendees</TabsTrigger>
    <TabsTrigger value="trends">Trends</TabsTrigger>
    <TabsTrigger value="positioning">Positioning</TabsTrigger>
    <TabsTrigger value="competitive">Competitive</TabsTrigger>
  </TabsList>
  
  {/* ... existing tabs ... */}
  
  <TabsContent value="competitive" className="mt-4">
    <CompetitiveInsights 
      context={insights.competitiveContext}
      alerts={insights.competitiveAlerts}
    />
  </TabsContent>
</Tabs>
```

**New Component:** `src/components/events-board/CompetitiveInsights.tsx`
```typescript
interface CompetitiveInsightsProps {
  context?: CompetitiveContext;
  alerts?: CompetitiveAlert[];
}

export function CompetitiveInsights({ context, alerts }: CompetitiveInsightsProps) {
  if (!context || context.competitorsPresent.length === 0) {
    return (
      <div className="text-center text-text-secondary py-8">
        <Users className="h-8 w-8 mx-auto mb-2 text-text-muted" />
        <p>No competitors detected in this event.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Competitors Present */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Competitors Present</h3>
        <div className="space-y-2">
          {context.competitorsPresent.map((match, idx) => (
            <div key={idx} className="border border-orange-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{match.competitorName}</span>
                <span className="text-sm text-text-muted">{match.matchType}</span>
              </div>
              <div className="text-sm text-text-secondary mt-1">
                {match.matchDetails.role} • {Math.round(match.matchConfidence * 100)}% confidence
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Competitive Alerts</h3>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className={`border rounded-lg p-3 ${
                alert.severity === 'high' ? 'border-red-300 bg-red-50' :
                alert.severity === 'medium' ? 'border-orange-300 bg-orange-50' :
                'border-yellow-300 bg-yellow-50'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium">{alert.title}</h4>
                  <span className={`text-xs px-2 py-1 rounded ${
                    alert.severity === 'high' ? 'bg-red-200 text-red-800' :
                    alert.severity === 'medium' ? 'bg-orange-200 text-orange-800' :
                    'bg-yellow-200 text-yellow-800'
                  }`}>
                    {alert.severity}
                  </span>
                </div>
                <p className="text-sm text-text-secondary mb-2">{alert.description}</p>
                <p className="text-xs text-text-muted">
                  <strong>Action:</strong> {alert.recommendedAction}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Comparison */}
      {context.activityComparison && context.activityComparison.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Activity Comparison</h3>
          <div className="space-y-3">
            {context.activityComparison.map((activity, idx) => (
              <div key={idx} className="border border-border-light rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{activity.competitorName}</span>
                  <span className={`text-sm ${
                    activity.growthRate > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {activity.growthRate > 0 ? '+' : ''}{activity.growthRate.toFixed(0)}% growth
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-text-muted">Your events:</span>
                    <span className="ml-2 font-medium">{activity.userEventCount}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Their events:</span>
                    <span className="ml-2 font-medium">{activity.competitorEventCount}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-text-muted">Gap:</span>
                    <span className="ml-2 font-medium text-orange-600">
                      {activity.gapCount} events
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Update Types:** `src/lib/types/event-board.ts`
```typescript
export interface EventInsightsResponse {
  // ... existing fields ...
  competitiveContext?: CompetitiveContext;
  competitiveAlerts?: CompetitiveAlert[];
}
```

#### Acceptance Criteria
- [ ] Competitive tab added to Event Board
- [ ] CompetitiveInsights component created
- [ ] Competitors, alerts, and activity comparison displayed
- [ ] Responsive design
- [ ] Empty states handled

---

### **Task 10: Update Event Detail Page**
**Priority:** Low | **Effort:** 0.5 day | **Dependencies:** Task 5, Task 7

#### Objectives
- Display competitive intelligence on event detail page
- Show competitive alerts prominently

#### Implementation Details

**File:** `src/app/(protected)/events/[eventId]/page.tsx`

**Add Competitive Section:**
```typescript
{intelligence?.competitiveContext && (
  <section className="mt-6">
    <h2 className="text-xl font-semibold mb-4">Competitive Intelligence</h2>
    {/* Display competitive context similar to Event Board */}
  </section>
)}
```

#### Acceptance Criteria
- [ ] Competitive intelligence displayed on event detail page
- [ ] Alerts shown prominently
- [ ] Consistent with Event Board design

---

### **Task 11: Testing & Validation**
**Priority:** High | **Effort:** 2 days | **Dependencies:** All previous tasks

#### Objectives
- Test competitor matching accuracy
- Validate competitive insights generation
- Performance testing
- Edge case handling

#### Test Cases

**1. Competitor Detection Tests:**
- [ ] Exact name matches
- [ ] Fuzzy name matches (variations, abbreviations)
- [ ] Speaker name + organization matching
- [ ] Sponsor company matching
- [ ] Attendee organization matching
- [ ] Multiple competitors in same event
- [ ] No competitors in event
- [ ] Empty competitor list

**2. Activity Comparison Tests:**
- [ ] User with events vs. competitor with events
- [ ] User with no events vs. competitor with events
- [ ] User with events vs. competitor with no events
- [ ] Both with no events
- [ ] Growth rate calculations
- [ ] Gap identification

**3. Alert Generation Tests:**
- [ ] High-value event alerts
- [ ] Activity spike alerts
- [ ] Competitive gap alerts
- [ ] Multiple alerts for same event
- [ ] No alerts when conditions not met

**4. Integration Tests:**
- [ ] Event intelligence includes competitive context
- [ ] API returns competitive intelligence
- [ ] UI displays competitive intelligence
- [ ] Database caching works
- [ ] Performance acceptable (<100ms overhead)

**5. Edge Cases:**
- [ ] User without competitors
- [ ] Competitor names with special characters
- [ ] Very long competitor lists (20+)
- [ ] Events with no speakers/sponsors/attendees
- [ ] Concurrent requests

#### Acceptance Criteria
- [ ] All test cases pass
- [ ] Competitor matching accuracy > 90%
- [ ] No performance regression
- [ ] Edge cases handled gracefully
- [ ] Integration tests pass

---

## Dependencies Summary

| Task | Dependencies | Status |
|------|-------------|--------|
| Task 1 | None | ✅ Ready |
| Task 2 | Task 1 | ✅ Ready |
| Task 3 | Task 1, Task 2 | ✅ Ready |
| Task 4 | Task 1, Task 2, Task 3 | ✅ Ready |
| Task 5 | Task 1-4 | ✅ Ready |
| Task 6 | Task 5 | ✅ Ready |
| Task 7 | Task 5 | ✅ Ready |
| Task 8 | Task 5, Task 7 | ✅ Ready |
| Task 9 | Task 5, Task 7, Task 8 | ✅ Ready |
| Task 10 | Task 5, Task 7 | ✅ Ready |
| Task 11 | All tasks | ✅ Ready |

**All dependencies available!** ✅

---

## Implementation Timeline

### Week 1 (Days 1-5)
- **Day 1-2:** Task 1 (Service creation) + Task 2 (Competitor detection)
- **Day 3-4:** Task 3 (Activity comparison) + Task 4 (Alerts)
- **Day 5:** Task 5 (Integration) + Task 6 (Database migration)

### Week 2 (Days 6-10)
- **Day 6:** Task 7 (API updates) + Task 8 (QuickView UI)
- **Day 7:** Task 9 (Event Board UI)
- **Day 8:** Task 10 (Event detail page)
- **Day 9-10:** Task 11 (Testing & validation)

**Total: 8-10 days (1.5-2 weeks)**

---

## Success Metrics

### Functional Metrics
- ✅ 100% of event insights show competitive context when competitors are present
- ✅ Competitor matching accuracy > 90%
- ✅ Competitive alerts generated for high-value events with competitor presence
- ✅ Activity comparison accurate within 5%

### Performance Metrics
- ✅ No performance regression (<100ms additional time for competitive intelligence)
- ✅ API response time < 500ms (including competitive intelligence)
- ✅ Database queries optimized (indexes used)

### User Experience Metrics
- ✅ Competitive intelligence visible in all relevant UI components
- ✅ Alerts are actionable and clear
- ✅ Empty states handled gracefully

---

## Risk Mitigation

### Risks Identified
1. **Competitor matching accuracy** - Mitigation: Fuzzy matching with confidence scores, manual review option
2. **Performance impact** - Mitigation: Caching, async processing, indexes
3. **False positives** - Mitigation: Confidence thresholds, user feedback mechanism

### Mitigation Strategies
- Start with high confidence threshold (0.8+), lower gradually
- Cache competitor detection results
- Add user feedback for match accuracy
- Monitor performance metrics

---

## Deliverables Checklist

- [ ] `src/lib/services/competitive-intelligence-service.ts` (NEW)
- [ ] Enhanced `EventIntelligence` interface with competitive fields
- [ ] Database migration for competitive intelligence fields
- [ ] Updated API endpoints
- [ ] UI components (QuickView, Event Board, Event Detail)
- [ ] Test suite
- [ ] Documentation

---

## Next Steps After Completion

1. **User Testing** - Get feedback on competitor matching accuracy
2. **Performance Monitoring** - Track performance impact
3. **Enhancements** - Consider:
   - Historical competitor tracking
   - Competitor trend analysis
   - Automated competitor discovery
   - Competitive benchmarking

---

**End of Phase 2C Breakdown**

