# UI Issues Resolution Plan

## Issues Identified

### 1. **Watchlist Saved Profiles Issues**
- **Problem**: Profile cards under `/watchlist` Saved Profile tab don't show enhanced speaker information
- **Problem**: Cards are not interactive (no inline editing, status changes, etc.)
- **Problem**: New cards with job titles are displayed but not functional

### 2. **Search Filters Display Issues**
- **Problem**: Search filters only show location and timeframe, missing ICP Terms
- **Problem**: ICP Terms are shown on `/calendar` but not on `/run` (events search)

### 3. **Calendar Event Workflow Issues**
- **Problem**: Calendar events only show "View Event" link to website
- **Problem**: No way to "promote" events to general workflow for analysis and attendee extraction

## Root Cause Analysis

### Issue 1: Watchlist Saved Profiles
- **Root Cause**: The watchlist page is using a basic card layout instead of the `EnhancedSavedProfileCard` component
- **Root Cause**: Missing integration with the enhanced profile management system
- **Root Cause**: No connection to the interactive features (inline editing, status management)

### Issue 2: Search Filters
- **Root Cause**: `SearchParams` interface only includes basic fields (keywords, country, from, to, timestamp)
- **Root Cause**: Missing ICP terms, industry terms, and other profile-based filters in search context
- **Root Cause**: Search context doesn't capture user profile data for filtering

### Issue 3: Calendar Workflow
- **Root Cause**: Calendar events are read-only from `collected_events` table
- **Root Cause**: No integration with the main event analysis pipeline
- **Root Cause**: Missing "Promote to Analysis" functionality

## Resolution Plan

### Phase 1: Fix Watchlist Saved Profiles (Priority: High)

#### 1.1 Replace Basic Cards with Enhanced Cards
**Goal**: Use the existing `EnhancedSavedProfileCard` component in watchlist page

**Implementation**:
- **MODIFY**: `src/app/(protected)/watchlist/page.tsx` - Replace basic profile cards with `EnhancedSavedProfileCard`
- **ADD**: Import and integration of the enhanced profile card component
- **ADD**: Interactive functionality (status changes, notes editing, etc.)

**Key Changes**:
```typescript
// Replace this basic card structure:
<div className="card">
  <h3>{profile.speaker_data?.name}</h3>
  <span>{profile.speaker_data?.title}</span>
  // ... basic display only
</div>

// With this enhanced component:
<EnhancedSavedProfileCard
  profile={profile}
  onEdit={openEditModal}
  onDelete={deleteProfile}
  onStatusChange={updateProfileStatus}
  onNotesChange={updateProfileNotes}
  showActions={true}
  compact={false}
/>
```

#### 1.2 Add Missing Functions
**Goal**: Implement the required callback functions for enhanced profile management

**Implementation**:
- **ADD**: `updateProfileStatus` function for inline status changes
- **ADD**: `updateProfileNotes` function for inline notes editing
- **ADD**: `openEditModal` function for detailed editing
- **ADD**: `deleteProfile` function for profile removal

### Phase 2: Enhance Search Filters (Priority: High)

#### 2.1 Extend SearchParams Interface
**Goal**: Include user profile data in search parameters

**Implementation**:
- **MODIFY**: `src/context/SearchResultsContext.tsx` - Extend SearchParams interface
- **ADD**: User profile fields to search context

**New SearchParams Interface**:
```typescript
export interface SearchParams {
  keywords: string;
  country: string;
  from: string;
  to: string;
  timestamp: number;
  // NEW FIELDS:
  userProfile?: {
    industryTerms: string[];
    icpTerms: string[];
    competitors: string[];
  };
  profileFilters?: {
    includeIndustryMatch: boolean;
    includeIcpMatch: boolean;
    includeCompetitorMatch: boolean;
  };
}
```

#### 2.2 Update ActiveFilters Component
**Goal**: Display user profile filters in the active filters display

**Implementation**:
- **MODIFY**: `src/components/ActiveFilters.tsx` - Add profile filter display
- **ADD**: ICP terms, industry terms, and competitor filters to filter chips
- **ADD**: Visual indicators for profile-based filtering

#### 2.3 Integrate User Profile in Search
**Goal**: Capture and use user profile data in search operations

**Implementation**:
- **MODIFY**: `src/app/(protected)/events/EventsPageNew.tsx` - Load user profile data
- **MODIFY**: `src/app/(protected)/events/EventsClient.tsx` - Include profile in search params
- **ADD**: Profile data loading and integration with search context

### Phase 3: Add Calendar Event Workflow Integration (Priority: Medium)

#### 3.1 Create Event Promotion API
**Goal**: Allow promoting calendar events to the main analysis pipeline

**Implementation**:
- **NEW**: `src/app/api/events/promote/route.ts` - API endpoint for event promotion
- **ADD**: Function to move events from `collected_events` to analysis pipeline
- **ADD**: Integration with existing event analysis workflow

#### 3.2 Add Promotion UI to Calendar
**Goal**: Add "Promote to Analysis" button to calendar events

**Implementation**:
- **MODIFY**: `src/components/RelevantEventsCalendar.tsx` - Add promotion button
- **ADD**: "Promote to Analysis" action button
- **ADD**: Loading states and success feedback
- **ADD**: Integration with event analysis pipeline

#### 3.3 Create Event Analysis Integration
**Goal**: Connect promoted events to the main event analysis workflow

**Implementation**:
- **ADD**: Function to trigger event analysis for promoted events
- **ADD**: Integration with speaker extraction and enhancement
- **ADD**: Navigation to analysis results

## Implementation Details

### Phase 1: Watchlist Saved Profiles Fix

#### Files to Modify:
- `src/app/(protected)/watchlist/page.tsx`

#### Key Changes:
```typescript
// Add import
import { EnhancedSavedProfileCard } from "@/components/EnhancedSavedProfileCard";

// Add missing functions
async function updateProfileStatus(profileId: string, status: string) {
  // Implementation for status updates
}

async function updateProfileNotes(profileId: string, notes: string) {
  // Implementation for notes updates
}

// Replace profile display section
{savedProfiles.map((profile) => (
  <EnhancedSavedProfileCard
    key={profile.id}
    profile={profile}
    onEdit={openEditModal}
    onDelete={deleteProfile}
    onStatusChange={updateProfileStatus}
    onNotesChange={updateProfileNotes}
    showActions={true}
    compact={false}
  />
))}
```

### Phase 2: Search Filters Enhancement

#### Files to Modify:
- `src/context/SearchResultsContext.tsx`
- `src/components/ActiveFilters.tsx`
- `src/app/(protected)/events/EventsPageNew.tsx`
- `src/app/(protected)/events/EventsClient.tsx`

#### Key Changes:
```typescript
// Extended SearchParams
export interface SearchParams {
  keywords: string;
  country: string;
  from: string;
  to: string;
  timestamp: number;
  userProfile?: {
    industryTerms: string[];
    icpTerms: string[];
    competitors: string[];
  };
  profileFilters?: {
    includeIndustryMatch: boolean;
    includeIcpMatch: boolean;
    includeCompetitorMatch: boolean;
  };
}

// Enhanced ActiveFilters display
{searchParams.userProfile?.icpTerms && searchParams.userProfile.icpTerms.length > 0 && (
  <FilterChip 
    label="ICP Terms" 
    value={searchParams.userProfile.icpTerms.join(', ')}
  />
)}
```

### Phase 3: Calendar Workflow Integration

#### Files to Create/Modify:
- `src/app/api/events/promote/route.ts` (NEW)
- `src/components/RelevantEventsCalendar.tsx` (MODIFY)

#### Key Changes:
```typescript
// Add promotion button to calendar events
<button
  onClick={() => promoteEvent(event.id)}
  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
>
  <span>Promote to Analysis</span>
</button>

// Promotion function
async function promoteEvent(eventId: string) {
  const response = await fetch('/api/events/promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId })
  });
  // Handle response and navigation
}
```

## Testing Strategy

### Phase 1 Testing:
- [ ] Verify enhanced profile cards display in watchlist
- [ ] Test inline editing of status and notes
- [ ] Confirm all interactive features work
- [ ] Check that new cards with job titles are functional

### Phase 2 Testing:
- [ ] Verify ICP terms appear in search filters
- [ ] Test profile-based filtering works
- [ ] Confirm filters persist across navigation
- [ ] Check that all profile data is captured

### Phase 3 Testing:
- [ ] Test event promotion from calendar
- [ ] Verify promoted events enter analysis pipeline
- [ ] Confirm navigation to analysis results
- [ ] Check integration with existing workflow

## Success Criteria

### Phase 1 Success:
- ✅ Watchlist saved profiles show rich information
- ✅ All interactive features work (edit, delete, status change)
- ✅ New cards with job titles are fully functional

### Phase 2 Success:
- ✅ Search filters show ICP terms, industry terms, competitors
- ✅ Profile-based filtering is visible and functional
- ✅ All search parameters are captured and displayed

### Phase 3 Success:
- ✅ Calendar events can be promoted to analysis
- ✅ Promoted events enter the main workflow
- ✅ Users can analyze promoted events and extract attendees

## Implementation Timeline

### Week 1: Phase 1 (Watchlist Fix)
- Day 1-2: Replace basic cards with enhanced cards
- Day 3-4: Add missing functions and integration
- Day 5: Testing and refinement

### Week 2: Phase 2 (Search Filters)
- Day 1-2: Extend SearchParams interface
- Day 3-4: Update ActiveFilters component
- Day 5: Integration and testing

### Week 3: Phase 3 (Calendar Workflow)
- Day 1-2: Create promotion API
- Day 3-4: Add promotion UI to calendar
- Day 5: Integration and testing

## Files Summary

### New Files (1):
- `src/app/api/events/promote/route.ts`

### Modified Files (5):
- `src/app/(protected)/watchlist/page.tsx` - Enhanced profile cards
- `src/context/SearchResultsContext.tsx` - Extended search params
- `src/components/ActiveFilters.tsx` - Profile filter display
- `src/app/(protected)/events/EventsPageNew.tsx` - Profile integration
- `src/app/(protected)/events/EventsClient.tsx` - Profile integration
- `src/components/RelevantEventsCalendar.tsx` - Promotion functionality

This plan addresses all identified issues while building upon the existing infrastructure and maintaining backward compatibility.
