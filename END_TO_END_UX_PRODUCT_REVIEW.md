# End-to-End UX & Product Review Report
**Attendry - B2B Sales Intelligence Platform for Event-Based Prospecting**  
**Date:** 2025-02-25  
**Reviewer:** Product Manager, UX Researcher, Senior Full-Stack Engineer  
**Scope:** Complete user journey analysis from landing to core sales prospecting workflows

**Product Purpose:** Enable sales & event professionals to find conferences/events, evaluate who will be attending, and use this intelligence for warm outreach, positioning, and networking to drive opportunity generation and ROI. **Not** for finding events to attend.

---

## 1. Executive Summary

### Overall Impression
Attendry is a B2B sales intelligence platform that enables sales and event professionals to find conferences and events, evaluate who will be attending, and use this intelligence for warm outreach, positioning, and networking to drive opportunity generation and ROI. The platform is **not** designed for users to find events to attend—rather, it's a prospecting tool that uses events as a context for identifying and connecting with target accounts and decision-makers. The platform demonstrates strong technical capabilities with AI-powered search, speaker extraction, and attendee intelligence features. However, the user experience suffers from several critical friction points that prevent users from quickly understanding this value proposition and achieving their sales goals.

### Main Strengths
- **Comprehensive sales intelligence**: Event discovery, attendee evaluation, speaker profiles, account intelligence, competitive intelligence
- **Advanced search capabilities**: Natural language processing, multi-provider search (Firecrawl, Google CSE), AI-powered content extraction
- **Rich attendee data**: Speaker detection, sponsor tracking, organization intelligence, opportunity scoring for warm outreach
- **Sales workflow support**: Watchlists, event boards, saved profiles with outreach status tracking
- **Multiple interaction patterns**: Command Centre dashboard, adaptive UI, traditional list views
- **Strong technical foundation**: Well-structured codebase, context providers, service layer architecture

### Top 7 Issues Harming User Experience

1. **Value proposition unclear on first visit** - Landing page doesn't communicate that this is a sales prospecting tool, not an event attendance tool; users don't understand the ROI/outreach value proposition
2. **Overwhelming first-time experience** - Command Centre dashboard shows too many panels/options without clear entry points
3. **Inconsistent navigation terminology** - "Command Centre" vs "Dashboard", "Market Intelligence" vs "Recommendations", "Events Board" vs "Watchlist"
4. **Poor error feedback** - Heavy use of browser `alert()` dialogs instead of inline toast notifications; technical error messages
5. **Confusing empty states** - Some empty states suggest features that don't exist (e.g., "Upload accounts (mock)", "Invite marketing partner")
6. **Search results lack context** - No clear indication of why events match, what filters are active, or how to refine results
7. **Watchlist vs Board confusion** - Two similar concepts (watchlist and events board) with unclear differentiation and purpose

---

## 2. Core User Journeys

### Journey 1: First-Time Visitor → Understanding → Sign Up → First Search
**Persona:** Sales professional at a legal tech company looking to prospect at compliance conferences  
**Goal:** Understand that this tool helps identify events where target accounts/decision-makers will be, not to find events to attend  
**Starting Point:** Landing page (`/`)  
**Intended Outcome:** User understands this is a sales intelligence tool for event-based prospecting and finds their first event with valuable attendee intelligence

**Step-by-Step Flow:**
1. **Landing Page** (`src/app/(public)/page.tsx`)
   - Sees generic marketing copy: "Discover Events That Drive Your Growth"
   - Features listed: Smart Search, AI Recommendations, Event Comparison, etc.
   - **Critical Issue:** Copy suggests finding events to attend, not prospecting at events. No mention of "warm outreach", "attendee intelligence", "sales prospecting", or "ROI"
   - **Issue:** No concrete examples showing: "Find events → See who's attending → Warm outreach → Generate opportunities"
   - **Issue:** "10x Faster event discovery" - doesn't communicate the sales intelligence value
   - Clicks "Sign in to Continue" → Redirected to `/login`

2. **Login Page** (`src/app/(public)/login/page.tsx`)
   - Standard Supabase auth UI
   - **Works well:** Clear, functional authentication

3. **Post-Login Redirect** → `/dashboard` (Command Centre)
   - **Major Issue:** User lands on Command Centre (`src/components/command-centre/CommandCentre.tsx`)
   - Sees multiple panels: Quick Event Search, Saved Profiles, Account Intelligence, Trending Insights
   - **Confusion:** What should they do first? No onboarding or guided tour
   - **Confusion:** "Command Centre" terminology is unclear - sounds like admin/technical
   - **Issue:** Many panels are empty or show placeholder content

4. **First Search Attempt**
   - User might try Quick Event Search panel in Command Centre
   - Or navigate to `/search` or `/events` via sidebar
   - **Issue:** Three different search entry points with different UIs
   - **Issue:** No guidance on which to use

**What Works:**
- Authentication flow is smooth
- Multiple search entry points provide flexibility

**What Breaks Flow:**
- Landing page doesn't demonstrate value
- Command Centre is overwhelming for first-time users
- No clear "start here" guidance
- Terminology ("Command Centre") is confusing

---

### Journey 2: Returning User → Search → Evaluate Attendees → Save for Outreach
**Persona:** Sales development rep looking to prospect at tech conferences in Germany next month  
**Goal:** Find events where target accounts will be, evaluate attendee quality (speakers, sponsors, participants), identify warm outreach opportunities  
**Starting Point:** `/events` or `/search`  
**Intended Outcome:** User finds events with valuable attendee intelligence, identifies target accounts/decision-makers, saves events and profiles for outreach workflow

**Step-by-Step Flow:**

1. **Search Page** (`src/app/(protected)/search/page.tsx` or `src/app/(protected)/events/page.tsx`)
   - User enters natural language query: "compliance conferences in Germany next month"
   - **Issue:** Natural language search exists but isn't clearly labeled or explained
   - **Issue:** No examples of good queries shown
   - Clicks search

2. **Search Execution**
   - Loading state: "Searching..." spinner
   - **Issue:** No progress indication for long-running searches
   - **Issue:** No estimated time or what's happening behind the scenes

3. **Results Display**
   - Events shown in grid/list (`EventCard` components)
   - **Issue:** No explanation of why these events match or what makes them valuable for prospecting
   - **Issue:** No indication of attendee quality or opportunity scores upfront
   - **Issue:** Filters not clearly visible or explained
   - **Issue:** "Watchlist Match" badges appear but user may not understand this means target accounts are attending
   - **Issue:** Event cards show speakers/sponsors but don't emphasize "these are your prospects"

4. **Event Card Interaction**
   - User clicks to expand event details
   - **Works well:** Expandable sections, speaker information, sponsors, participating organizations
   - **Issue:** Attendee intelligence (speakers, sponsors) not framed as "prospects" or "outreach targets"
   - **Issue:** "Save" button not immediately visible (if it exists)
   - **Issue:** Two save options: "Add to Board" and watchlist - unclear difference for sales workflow
   - **Issue:** No clear "Save Speaker for Outreach" or "Add to CRM" actions

5. **Save Action**
   - User clicks "Add to Board" or save button
   - **Issue:** Uses browser `alert()` for feedback instead of toast notifications
   - **Issue:** If not authenticated, redirects to login (loses context)
   - **Issue:** No confirmation of what "board" means or where to find saved items for outreach
   - **Issue:** No clear next step guidance: "Now go to your board to start outreach"

**What Works:**
- Event cards show rich information (speakers, sponsors, dates, locations)
- Expandable details provide good information hierarchy
- Watchlist matching is a nice feature (when explained)

**What Breaks Flow:**
- Search results lack context and explanation
- Save actions use poor feedback mechanisms
- Unclear distinction between watchlist and board
- No clear path to view saved items

---

### Journey 3: Power User → Manage Prospecting Pipeline → Track Outreach → Generate Opportunities
**Persona:** Sales manager managing event-based prospecting pipeline and team outreach  
**Goal:** Organize events by opportunity stage, track speaker/account outreach status, manage warm outreach workflow  
**Starting Point:** `/watchlist` or `/events-board`  
**Intended Outcome:** User organizes events by sales stage, tracks outreach to attendees/speakers, manages opportunity pipeline

**Step-by-Step Flow:**

1. **Watchlist Page** (`src/app/(protected)/watchlist/page.tsx`)
   - Two tabs: "Watchlist" and "Saved Profiles"
   - **Confusion:** What's the difference between these?
   - Watchlist shows manually added items (companies, people, events)
   - **Issue:** Watchlist items are just labels - no rich event data shown
   - **Issue:** "Add to Watchlist" form is unclear - what kind of items should be added?

2. **Events Board** (`src/app/(protected)/events-board/page.tsx`)
   - Kanban-style board with columns (interested, evaluating, etc.)
   - **Issue:** Similar to watchlist but different - why two systems?
   - **Issue:** No clear workflow explanation
   - **Issue:** Adding events to board also adds to watchlist (automatic) - user may not realize this

3. **Saved Profiles Tab**
   - Shows saved speaker profiles with outreach status
   - **Works well:** Status tracking (not_started, contacted, responded, meeting_scheduled)
   - **Issue:** No clear way to bulk manage or filter by status
   - **Issue:** Edit functionality shows alert placeholder: "This feature will be enhanced in a future update"

4. **Taking Action**
   - User wants to export prospects, share with team, or integrate with CRM
   - **Issue:** No export functionality visible (CSV of speakers/accounts for outreach)
   - **Issue:** No CRM integration (Salesforce, HubSpot) for syncing prospects
   - **Issue:** No sharing or collaboration features for team prospecting
   - **Issue:** No bulk outreach capabilities or email templates

**What Works:**
- Kanban board provides visual organization
- Status tracking for speaker outreach is useful
- Saved profiles have good metadata

**What Breaks Flow:**
- Watchlist and Board are confusingly similar
- No clear workflow or guidance
- Limited action capabilities (no export, share, calendar)
- Incomplete features (edit modal placeholder)

---

### Journey 4: Discovery → Recommendations → Evaluate Opportunity Intelligence
**Persona:** Sales leader looking for high-opportunity events and attendee intelligence  
**Goal:** Discover events with best attendee quality for prospecting, get AI recommendations based on ICP, understand opportunity scores  
**Starting Point:** `/recommendations` or `/trending`  
**Intended Outcome:** User identifies high-ROI events for prospecting, understands why events are recommended (ICP match, attendee quality), prioritizes outreach efforts

**Step-by-Step Flow:**

1. **Market Intelligence Page** (`src/app/(protected)/recommendations/page.tsx`)
   - Shows `MarketIntelligenceStandalone` component
   - **Issue:** Page title says "Market Intelligence" but sidebar says "Recommendations"
   - **Issue:** No clear explanation of what intelligence is provided
   - **Issue:** Intelligence may be shallow (per `MARKET_INTELLIGENCE_OPTIMIZATION_PLAN.md`)

2. **Trending Events** (`src/app/(protected)/trending/page.tsx`)
   - Shows trending events
   - **Issue:** No explanation of what "trending" means (views? saves? recency?)
   - **Issue:** No time period context

3. **Event Intelligence Panel**
   - When viewing event details, intelligence panel shows
   - **Works well:** Opportunity scores, urgency indicators, ICP matching (these are sales-relevant!)
   - **Issue:** Scores and indicators may not be clearly explained in sales context (e.g., "High opportunity = good for prospecting")
   - **Issue:** Intelligence doesn't emphasize "who to reach out to" or "why this event matters for your pipeline"
   - **Issue:** "View Full Intelligence" button navigates but may fail if event not in DB

**What Works:**
- Intelligence features exist and are technically sophisticated
- Opportunity scoring provides value

**What Breaks Flow:**
- Intelligence value not clearly communicated
- Terminology inconsistencies
- Missing explanations of how intelligence is calculated

---

## 3. Detailed Findings by Category

### 3.1 Value & Positioning

#### Finding 1.1: Landing Page Doesn't Communicate Sales Prospecting Value
**Problem:** Landing page (`src/app/(public)/page.tsx`) uses generic event discovery language that suggests finding events to attend, not prospecting at events. No mention of "warm outreach", "attendee intelligence", "sales prospecting", or ROI. Claims like "10x Faster event discovery" don't communicate the sales intelligence value proposition.

**User Impact:** Sales professionals may not realize this tool is for them. They may think it's for event attendance planning, not B2B prospecting. Low conversion from landing to sign-up among target users.

**Where:** `src/app/(public)/page.tsx` lines 63-70, 129-142

**Evidence:**
- Generic headline: "Discover Events That Drive Your Growth"
- No screenshots, demos, or example results
- Feature list is abstract: "Smart Search", "AI Recommendations" - what does this mean in practice?

---

#### Finding 1.2: Command Centre Overwhelms First-Time Users
**Problem:** Dashboard (`/dashboard`) shows Command Centre with multiple panels (Quick Event Search, Saved Profiles, Account Intelligence, Trending Insights) without guidance on where to start.

**User Impact:** New users feel lost and don't know what to do first. High bounce rate from dashboard.

**Where:** `src/components/command-centre/CommandCentre.tsx`

**Evidence:**
- Multiple panels visible simultaneously
- No onboarding tour or "start here" guidance
- Empty states in panels don't guide users
- Terminology "Command Centre" is technical/confusing

---

#### Finding 1.3: "Aha Moment" Not Obvious - Sales Use Case Unclear
**Problem:** The platform's core value (event-based sales prospecting with attendee intelligence for warm outreach) isn't immediately apparent. Users must search and explore to understand this is a sales tool, not an event attendance tool. The connection between "find events" → "see attendees" → "warm outreach" → "generate opportunities" is not clear.

**User Impact:** Sales professionals may leave before understanding the prospecting value. Low engagement in first session. Users may not realize they can use this for outreach ROI.

**Where:** Multiple - no clear "wow" moment in onboarding

---

### 3.2 Navigation & Information Architecture

#### Finding 2.1: Inconsistent Navigation Terminology
**Problem:** Navigation uses different terms for the same concepts:
- "Command Centre" (dashboard) vs "Dashboard" (in some places)
- "Market Intelligence" (page title) vs "Recommendations" (sidebar)
- "Events Board" vs "Watchlist" (similar but different concepts)

**User Impact:** Users get confused about where things are. Mental model doesn't match navigation.

**Where:** 
- `src/components/Navigation/Sidebar.tsx` lines 45-70
- `src/components/TopBar.tsx` lines 24-33
- `src/app/(protected)/recommendations/page.tsx`

**Evidence:**
- Sidebar: "Market Intelligence" with children "Event Recommendations" and "Trend Insights"
- Page title: "Market Intelligence" 
- Inconsistent labeling creates confusion

---

#### Finding 2.2: Multiple Search Entry Points Without Clear Differentiation
**Problem:** Users can search from:
1. Command Centre Quick Event Search panel
2. `/search` page (Natural Language Search)
3. `/events` page (Advanced Search with filters)

No guidance on which to use when.

**User Impact:** Users may try the wrong search interface for their needs. Confusion about which search is "better".

**Where:**
- `src/components/command-centre/CommandCentre.tsx` (QuickEventSearchPanel)
- `src/app/(protected)/search/page.tsx`
- `src/app/(protected)/events/page.tsx`

---

#### Finding 2.3: Important Features Buried
**Problem:** Key features like Event Comparison, Competitive Intelligence, and Predictions exist but aren't prominently featured in navigation.

**User Impact:** Users may not discover valuable features. Low feature adoption.

**Where:** Navigation structure doesn't surface these features prominently

---

### 3.3 Search & Filters

#### Finding 3.1: Search Results Lack Context
**Problem:** When search returns results, users don't see:
- Why these events match (relevance explanation)
- What filters are active
- How to refine results
- Confidence scores or match quality

**User Impact:** Users don't understand if results are good or how to improve them. May abandon search.

**Where:** 
- `src/app/(protected)/search/page.tsx` lines 156-178
- `src/app/(protected)/events/EventsPageNew.tsx` (results display)

**Evidence:**
- Results show event cards but no search context
- Intent detection shows confidence but only in debug mode
- No "refine search" suggestions

---

#### Finding 3.2: Filters Not Clearly Visible or Explained
**Problem:** Filter options exist but:
- Not always visible (may be in "Advanced" section)
- Filter labels may be unclear (e.g., "ICP filters", "Revenue tiers")
- No indication when filters are active
- No easy way to clear all filters

**User Impact:** Users may not realize filters are limiting results. May miss relevant events.

**Where:**
- `src/components/AdvancedSearch.tsx`
- `src/app/(protected)/events/EventsPageNew.tsx` (filter UI)

---

#### Finding 3.3: Natural Language Search Not Clearly Explained
**Problem:** Natural language search exists (`/search` page) but:
- No examples of good queries
- No explanation of what it can understand
- No feedback on query parsing

**User Impact:** Users may not realize they can use natural language. May use keyword search instead.

**Where:** `src/app/(protected)/search/page.tsx` lines 138-146

---

### 3.4 Results & Detail Views

#### Finding 4.1: Event Cards Show Rich Data But Lack Action Clarity
**Problem:** Event cards (`EventCard.tsx`) show comprehensive information but:
- Save/watchlist actions may not be immediately visible
- "Add to Board" vs watchlist distinction unclear
- No clear "next step" guidance

**User Impact:** Users may not take action on events they're interested in.

**Where:** `src/components/EventCard.tsx` lines 457-521

---

#### Finding 4.2: Watchlist Match Badges Not Explained
**Problem:** Events show "Watchlist Match" badges when they match user's watchlist, but:
- No explanation of what this means
- No way to see match details without clicking
- May confuse users who don't understand watchlist concept

**User Impact:** Users may ignore valuable matches or be confused by badges.

**Where:** `src/components/EventCard.tsx` lines 383-398

---

#### Finding 4.3: Event Detail Page May Fail Silently
**Problem:** Event detail page (`/events/[eventId]`) tries multiple strategies to load event data but:
- May show error if event not in database
- Error message is technical: "Event not found. The event may not be in the database yet."
- No clear recovery path

**User Impact:** Users hit dead ends when clicking on search results. Frustration.

**Where:** `src/app/(protected)/events/[eventId]/page.tsx` lines 196-211

---

### 3.5 Saved Items / Watchlists / Boards

#### Finding 5.1: Watchlist vs Board Confusion
**Problem:** Two similar concepts exist:
- **Watchlist** (`/watchlist`): Manual list of items (events, companies, people) - just labels
- **Events Board** (`/events-board`): Kanban board with full event data and status columns

No clear explanation of when to use which.

**User Impact:** Users don't know which to use. May duplicate work or use wrong system.

**Where:**
- `src/app/(protected)/watchlist/page.tsx`
- `src/app/(protected)/events-board/page.tsx`

**Evidence:**
- Watchlist shows simple cards with labels
- Board shows full event cards in kanban columns
- Adding to board also adds to watchlist (automatic) - user may not realize

---

#### Finding 5.2: Watchlist Add Form Unclear
**Problem:** Watchlist page has form to "Add to Watchlist" but:
- Placeholder text is generic: "e.g., AI conferences, keynote speakers"
- No examples of what good watchlist items are
- Company type selector appears but purpose unclear

**User Impact:** Users may not understand what to add or why.

**Where:** `src/app/(protected)/watchlist/page.tsx` lines 260-349

---

#### Finding 5.3: Saved Profiles Edit Feature Incomplete
**Problem:** Saved speaker profiles have "Edit" button but:
- Shows alert: "This feature will be enhanced in a future update"
- No actual editing capability

**User Impact:** Users click expecting functionality, get frustrated by placeholder.

**Where:** `src/app/(protected)/watchlist/page.tsx` lines 142-146

---

### 3.6 Feedback, Loading & Errors

#### Finding 6.1: Heavy Use of Browser Alert() Dialogs
**Problem:** Many actions use `alert()` for feedback instead of toast notifications:
- Save actions
- Error messages
- Confirmations

**User Impact:** 
- Alerts are disruptive and block interaction
- Not accessible (screen readers)
- Poor UX compared to modern toast notifications

**Where:** Multiple files:
- `src/components/EventCard.tsx` lines 195, 212, 268
- `src/components/AttendeeCard.tsx` line 23
- `src/components/EnhancedSpeakerCard.tsx` line 128
- `src/app/(protected)/compare/page.tsx` lines 45, 50

**Evidence:** 10+ files use `alert()` instead of toast system

---

#### Finding 6.2: Loading States Lack Context
**Problem:** Loading states show spinners but:
- No indication of what's happening
- No estimated time
- No progress for long operations
- Some searches can take 30+ seconds with no feedback

**User Impact:** Users may think app is frozen. May abandon long searches.

**Where:**
- `src/app/(protected)/search/page.tsx` lines 149-154
- `src/components/command-centre/CommandCentre.tsx` lines 1192-1197

---

#### Finding 6.3: Error Messages Are Technical
**Problem:** Error messages use technical language:
- "Event not found. The event may not be in the database yet."
- "Save failed" (no explanation)
- API error messages exposed to users

**User Impact:** Users don't understand errors or how to fix them.

**Where:** Multiple error handlers throughout codebase

---

#### Finding 6.4: Empty States Suggest Non-Existent Features
**Problem:** Some empty states mention features that don't exist:
- "Upload accounts (mock)" button
- "Invite marketing partner" button
- "Watch 2-min walkthrough" button

**User Impact:** Users click expecting functionality, get nothing. Breaks trust.

**Where:** `src/app/(protected)/search/page.tsx` lines 186-196

---

### 3.7 Visual Design & Consistency

#### Finding 7.1: Inconsistent Button Styles
**Problem:** Buttons use different styles across pages:
- Some use `className="btn btn-primary"`
- Some use inline styles
- Some use Tailwind classes
- No consistent design system

**User Impact:** Visual inconsistency reduces perceived quality. Harder to learn interface.

**Where:** Multiple components use different button patterns

---

#### Finding 7.2: Typography and Spacing Inconsistencies
**Problem:** Headings, text sizes, and spacing vary across pages:
- Some pages use `text-3xl font-bold`
- Others use inline styles with `fontSize: "2.5rem"`
- Inconsistent spacing patterns

**User Impact:** Visual hierarchy unclear. Pages feel disconnected.

**Where:** 
- `src/app/(protected)/watchlist/page.tsx` uses inline styles
- Other pages use Tailwind classes

---

#### Finding 7.3: Component Reuse Inconsistent
**Problem:** Similar UI patterns implemented differently:
- Empty states: Some use `EmptyState` component, others custom
- Loading states: Some use `LoadingState`, others custom spinners
- Cards: Multiple card components with similar but different patterns

**User Impact:** Inconsistent behavior and appearance. Harder to learn.

---

### 3.8 Performance & Responsiveness

#### Finding 8.1: Search Can Be Slow With No Progress Indication
**Problem:** Searches can take 30+ seconds (especially with Firecrawl pipeline) but:
- No progress indication
- No estimated time
- User may think app is frozen

**User Impact:** Users abandon searches. Perceived poor performance.

**Where:** Search API calls don't provide progress updates

---

#### Finding 8.2: Event Detail Page Makes Multiple Database Queries
**Problem:** Event detail page (`/events/[eventId]`) tries multiple strategies sequentially:
1. Check board by UUID
2. Check collected_events by ID
3. Check collected_events by URL
4. Check board by URL

This can result in 4+ sequential queries.

**User Impact:** Slow page loads. Poor perceived performance.

**Where:** `src/app/(protected)/events/[eventId]/page.tsx` lines 51-226

---

#### Finding 8.3: No Obvious Caching Strategy Visible
**Problem:** While caching may exist in services, UI doesn't show:
- When data is cached vs fresh
- How to refresh stale data
- Cache indicators

**User Impact:** Users may not know if data is current. May refresh unnecessarily.

---

## 4. Prioritized Actionable Recommendations

### P0 (Critical) - Fix Immediately

#### REC-001: Replace Alert() with Toast System
**Category:** [STATE]  
**Priority:** P0  
**Effort:** S  
**Action:** Replace all `alert()` calls with toast notifications using existing `ToastContainer` component  
**Where:** 
- `src/components/EventCard.tsx` (lines 195, 212, 268)
- `src/components/AttendeeCard.tsx` (line 23)
- `src/components/EnhancedSpeakerCard.tsx` (line 128)
- `src/app/(protected)/compare/page.tsx` (lines 45, 50)
- All other files using `alert()`

**Example:**
```typescript
// Before
alert("Please log in to save items.");

// After
toast.error("Please log in to save items.");
```

---

#### REC-002: Fix Empty State Placeholder Buttons
**Category:** [UX]  
**Priority:** P0  
**Effort:** S  
**Action:** Remove or implement non-functional buttons in empty states  
**Where:** `src/app/(protected)/search/page.tsx` lines 186-196

**Change:** Remove "Upload accounts (mock)", "Invite marketing partner", "Watch 2-min walkthrough" buttons or implement them

---

#### REC-003: Add Search Context to Results
**Category:** [SEARCH]  
**Priority:** P0  
**Effort:** M  
**Action:** Show active filters, query interpretation, and result count context above search results  
**Where:** `src/app/(protected)/search/page.tsx`, `src/app/(protected)/events/EventsPageNew.tsx`

**Example:** Add section above results:
```
"Found 12 events matching 'compliance conferences in Germany' 
[Clear filters] [Refine search]"
```

---

#### REC-004: Clarify Watchlist vs Board
**Category:** [NAV]  
**Priority:** P0  
**Effort:** M  
**Action:** Add clear explanation of difference between Watchlist and Events Board, or consolidate  
**Where:** 
- `src/app/(protected)/watchlist/page.tsx` (add header explanation)
- `src/app/(protected)/events-board/page.tsx` (add header explanation)
- Consider consolidating if they serve same purpose

---

### P1 (High) - Fix This Sprint

#### REC-005: Improve Landing Page Value Proposition for Sales Professionals
**Category:** [COPY]  
**Priority:** P1  
**Effort:** M  
**Action:** Rewrite landing page to clearly communicate this is a sales prospecting tool, not an event attendance tool. Show the value chain: Find events → See who's attending → Warm outreach → Generate opportunities  
**Where:** `src/app/(public)/page.tsx`

**Example:** Add section showing:
- "Find events where your target accounts will be"
- "See speakers, sponsors, and attendees - your warm prospects"
- "Track outreach and generate opportunities"
- Example: "Compliance Conference → 50+ target accounts attending → Save speakers for outreach → Track in your pipeline"
- ROI-focused messaging: "Turn events into your sales pipeline"

---

#### REC-006: Add Onboarding to Command Centre
**Category:** [UX]  
**Priority:** P1  
**Effort:** M  
**Action:** Add first-time user onboarding to Command Centre with "Start here" guidance  
**Where:** `src/components/command-centre/CommandCentre.tsx`

**Options:**
- Tooltip tour on first visit
- Collapsed panels with "Get started" prompts
- Welcome modal with quick start guide

---

#### REC-007: Standardize Navigation Terminology
**Category:** [NAV]  
**Priority:** P1  
**Effort:** S  
**Action:** Use consistent terms across navigation:
- "Dashboard" instead of "Command Centre" (or vice versa, but be consistent)
- "Recommendations" instead of "Market Intelligence" (or vice versa)
**Where:** 
- `src/components/Navigation/Sidebar.tsx`
- `src/components/TopBar.tsx`
- Page titles

---

#### REC-008: Improve Error Messages
**Category:** [COPY]  
**Priority:** P1  
**Effort:** S  
**Action:** Rewrite error messages to be user-friendly and actionable  
**Where:** All error handlers

**Example:**
```typescript
// Before
"Event not found. The event may not be in the database yet."

// After
"We couldn't find that event. Try adding it to your board first, or search for it again."
```

---

#### REC-009: Add Loading Progress Indicators
**Category:** [STATE]  
**Priority:** P1  
**Effort:** M  
**Action:** Add progress indicators for long-running searches (estimated time, stage indicators)  
**Where:** Search components

**Example:** Show "Searching... (Step 2 of 4: Extracting event details)"

---

#### REC-010: Explain Watchlist Match Badges
**Category:** [RESULTS]  
**Priority:** P1  
**Effort:** S  
**Action:** Add tooltip or explanation for "Watchlist Match" badges  
**Where:** `src/components/EventCard.tsx` lines 383-398

**Example:** Tooltip: "This event matches items in your watchlist"

---

### P2 (Medium) - Next Sprint

#### REC-011: Add Search Examples and Guidance
**Category:** [SEARCH]  
**Priority:** P2  
**Effort:** S  
**Action:** Add example queries and search tips to search pages  
**Where:** `src/app/(protected)/search/page.tsx`

---

#### REC-012: Optimize Event Detail Page Loading
**Category:** [PERF]  
**Priority:** P2  
**Effort:** M  
**Action:** Combine database queries or add caching to reduce load time  
**Where:** `src/app/(protected)/events/[eventId]/page.tsx`

---

#### REC-013: Add Filter Visibility Indicators
**Category:** [SEARCH]  
**Priority:** P2  
**Effort:** M  
**Action:** Show active filters prominently with clear "Clear all" option  
**Where:** Search results pages

---

#### REC-014: Implement Saved Profile Editing
**Category:** [UX]  
**Priority:** P2  
**Effort:** L  
**Action:** Implement actual edit functionality for saved profiles (remove placeholder)  
**Where:** `src/app/(protected)/watchlist/page.tsx`

---

#### REC-015: Add Export/Share Functionality for Sales Workflow
**Category:** [UX]  
**Priority:** P2  
**Effort:** M  
**Action:** Add ability to export prospects (speakers, accounts) to CSV for outreach, share watchlists with team, integrate with CRM (Salesforce, HubSpot)  
**Where:** Watchlist, Events Board, and Saved Profiles pages

**Sales-focused features:**
- Export speakers/accounts to CSV with contact info
- Bulk export for email campaigns
- CRM sync for saved profiles
- Team sharing for collaborative prospecting

---

#### REC-016: Standardize Button and Card Components
**Category:** [VISUAL]  
**Priority:** P2  
**Effort:** M  
**Action:** Create consistent button and card components, migrate all pages to use them  
**Where:** All pages using custom button/card styles

---

#### REC-017: Add Search Result Relevance Explanation
**Category:** [RESULTS]  
**Priority:** P2  
**Effort:** M  
**Action:** Show why events match (highlighted keywords, relevance score explanation)  
**Where:** Event cards in search results

---

### P3 (Nice to Have)

#### REC-018: Add Guided Tour for New Users
**Category:** [UX]  
**Priority:** P3  
**Effort:** L  
**Action:** Implement interactive tour showing key features  
**Where:** Dashboard/Command Centre

---

#### REC-019: Add CRM Integration and Outreach Tools
**Category:** [UX]  
**Priority:** P3  
**Effort:** L  
**Action:** Add CRM integration (Salesforce, HubSpot) to sync saved profiles, and outreach tools (email templates, LinkedIn integration)  
**Where:** Saved Profiles, Events Board pages

**Sales-focused features:**
- Sync saved speaker profiles to CRM
- Generate outreach email templates based on event context
- LinkedIn profile linking for saved speakers
- Track outreach status in CRM

---

#### REC-020: Add Search History and Saved Searches
**Category:** [SEARCH]  
**Priority:** P3  
**Effort:** M  
**Action:** Show recent searches and allow saving search queries  
**Where:** Search pages

---

#### REC-021: Improve Mobile Navigation
**Category:** [NAV]  
**Priority:** P3  
**Effort:** M  
**Action:** Review and improve mobile navigation experience  
**Where:** `src/components/Navigation/MobileNavigation.tsx`

---

#### REC-022: Add Bulk Actions to Watchlist/Board
**Category:** [UX]  
**Priority:** P3  
**Effort:** M  
**Action:** Allow selecting multiple events for bulk operations (delete, move, export)  
**Where:** Watchlist and Events Board pages

---

## 5. Quick Wins vs Strategic Improvements

### Quick Wins This Week (High Impact, Low Effort)

1. **Replace alert() with toasts** (REC-001) - S effort, P0 priority
2. **Remove placeholder buttons** (REC-002) - S effort, P0 priority  
3. **Standardize navigation terms** (REC-007) - S effort, P1 priority
4. **Improve error messages** (REC-008) - S effort, P1 priority
5. **Add search examples** (REC-011) - S effort, P2 priority
6. **Explain watchlist badges** (REC-010) - S effort, P1 priority
7. **Add filter visibility** (REC-013) - M effort, P2 priority
8. **Standardize buttons** (REC-016) - M effort, P2 priority (partial - start with most common)

**Total Estimated Effort:** 1-2 developer days for all quick wins

---

### Foundational Improvements (Strategic, Higher Effort)

1. **Onboarding System** (REC-006) - M effort, P1 priority
   - Requires design and implementation of tour/tooltip system
   - Will significantly improve first-time user experience

2. **Search Context & Relevance** (REC-003, REC-017) - M effort each, P0/P2 priority
   - Requires UI changes and potentially backend changes to expose relevance data
   - Will help users understand and refine searches

3. **Watchlist/Board Consolidation** (REC-004) - M-L effort, P0 priority
   - May require data migration if consolidating
   - Will reduce confusion and simplify mental model

4. **Performance Optimization** (REC-012) - M effort, P2 priority
   - Requires query optimization and caching strategy
   - Will improve perceived performance significantly

5. **Export/Share Features** (REC-015) - M effort, P2 priority
   - Requires API work and UI implementation
   - Will increase user value and retention

6. **Landing Page Redesign** (REC-005) - M effort, P1 priority
   - Requires design work and content creation
   - Will improve conversion from landing to sign-up

**Total Estimated Effort:** 2-3 weeks for all foundational improvements

---

## 6. Additional Observations

### Technical Debt Opportunities
- Consider consolidating search entry points or making differences clearer
- Event detail page query strategy could be optimized (parallel queries instead of sequential)
- Consider implementing a design system/component library for consistency

### User Research Gaps
- No clear evidence of user testing or feedback loops
- Consider adding user feedback mechanisms (surveys, in-app feedback)
- Analytics would help identify where users drop off

### Content Strategy
- Many features exist but aren't explained well in sales context
- Consider adding help tooltips explaining sales use cases (e.g., "Save this speaker for warm outreach")
- Marketing copy should emphasize ROI, opportunity generation, and warm prospecting - not event attendance
- Event cards should frame attendees as "prospects" not just "participants"

---

## 7. Conclusion

Attendry has a strong technical foundation with sophisticated features, but the user experience needs significant improvement to help sales professionals understand the prospecting value proposition and achieve their outreach goals efficiently. The platform's positioning as a sales intelligence tool for event-based prospecting is not clearly communicated, which may cause target users to misunderstand the product's purpose.

The top priorities should be:

1. **Immediate (This Week):** Fix critical UX issues (alerts, empty states, error messages)
2. **This Sprint:** Clarify sales value proposition (landing page rewrite, onboarding focused on prospecting workflow, navigation consistency)
3. **Next Sprint:** Enhance search experience with sales context (attendee quality indicators, opportunity scores, outreach actions)
4. **Strategic:** Add sales workflow features (CRM integration, export, outreach tools), consolidate similar features, optimize performance

Focusing on these improvements will significantly increase engagement among sales professionals, reduce confusion about the product's purpose, and help users achieve their prospecting and opportunity generation goals faster.

---

**Report Generated:** 2025-02-25  
**Codebase Analyzed:** Commit on branch `feature/firecrawl-v2-optimization`  
**Files Reviewed:** 50+ components, pages, and services

