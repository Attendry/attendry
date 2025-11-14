# Kanban & List Views Upgrade Plan

## Executive Summary

This document outlines a comprehensive plan to upgrade the Events Board Kanban and List views from their current "crappy" state to a production-ready, brand-consistent, accessible, and performant experience. The upgrade prioritizes alignment with the existing design system (Next.js + Tailwind + shadcn/ui), maintains existing data structures, and delivers measurable improvements in usability, performance, and accessibility.

### Top 5 Issues by Impact

1. **Visual Design Off-Brand** (High Impact - Usability & Consistency)
   - Hardcoded color values (`bg-blue-50`, `bg-yellow-50`) bypass design tokens
   - Inconsistent spacing rhythm (mixed `gap-2`, `gap-3`, `gap-4` without system)
   - Typography scale not aligned with design system (`text-base`, `text-sm` used inconsistently)
   - Border radius inconsistencies (`rounded-lg` vs `rounded-md` vs `rounded-xl`)
   - Shadow usage doesn't follow elevation system (`shadow-md` instead of `shadow-elevation-2`)

2. **Brittle Drag/Drop Interactions** (High Impact - Usability)
   - No optimistic updates (UI waits for server response)
   - Missing keyboard navigation for drag/drop (only pointer sensor)
   - No visual feedback during drag (opacity only, no elevation change)
   - Drop target detection feels imprecise (basic `closestCorners` collision)
   - No autoscroll when dragging near viewport edges
   - Position updates trigger full reload instead of incremental updates

3. **List View Lacks Clarity** (High Impact - Usability)
   - Card-based layout doesn't scale (no table component)
   - Limited column visibility (only title, date, location in collapsed state)
   - No resizable/sortable columns
   - Basic filtering (status dropdown only, no multi-filter)
   - No density controls (comfortable/compact modes)
   - Empty state is generic ("No events found matching your criteria")

4. **Inconsistent Component Usage** (Medium Impact - Consistency)
   - Native `<select>` instead of shadcn/ui Select component
   - Inconsistent Badge usage (hardcoded colors vs variants)
   - Missing shadcn/ui primitives (Table, DropdownMenu, Popover, Tooltip, Skeleton)
   - No use of Dialog for edit modal (uses `prompt()`)

5. **Performance Issues** (Medium Impact - Performance)
   - No virtualization for large boards/lists (renders all items)
   - Full page reload on every drag/drop operation
   - No memoization of filtered/sorted lists
   - Missing loading states (skeleton components available but not used)

### Quick Wins vs. Deeper Refactors

**Quick Wins (1-2 days each):**
- Replace hardcoded colors with design tokens
- Standardize spacing using Tailwind scale (`gap-2`, `gap-4`, `gap-6`)
- Add shadcn/ui Select component for status filter
- Implement proper empty states with CTAs
- Add Skeleton loading states
- Replace `prompt()` with Dialog component
- Standardize border radius (`rounded-lg` for cards, `rounded-md` for buttons)
- Use shadow elevation tokens

**Deeper Refactors (1-2 weeks each):**
- Implement optimistic updates with rollback
- Add keyboard navigation for drag/drop
- Build proper Table component for List view
- Add virtualization (react-window already in dependencies)
- Implement saved views with URL params
- Add column customization (show/hide, resize, reorder)
- Build comprehensive filtering system
- Add autoscroll and improved collision detection

---

## Architecture Snapshot (As-Is)

### Kanban Flow

```
Data Flow:
Supabase (user_event_board) 
  → API Route (/api/events/board/list)
    → EventsBoardPage (loadBoardItems)
      → EventBoardKanban (items prop)
        → SortableItem (wraps EventBoardCard)
          → DndContext (manages drag state)
            → DroppableColumn (drop targets)
              → onDragEnd → handleReorder → API PATCH → full reload

State Management:
- Local useState in EventsBoardPage (items, loading, error)
- Local useState in EventBoardKanban (columns, activeId)
- No global state management (Zustand/Redux not used)
- No optimistic updates (waits for server response)

Libraries:
- @dnd-kit/core (v6.1.0): DndContext, DragOverlay, useDroppable
- @dnd-kit/sortable (v8.0.0): SortableContext, useSortable
- @dnd-kit/utilities (v3.2.2): CSS transform utilities
- Sensors: PointerSensor, KeyboardSensor (basic implementation)

Persistence:
- Supabase table: user_event_board
- API: PATCH /api/events/board/update
- Updates: column_status, position, notes, tags
- No debouncing (immediate API call on every drag)
- No conflict resolution (last write wins)

Design Tokens:
- Bypassed: Uses hardcoded `bg-blue-50`, `bg-yellow-50`, etc.
- Should use: `bg-surface-alt`, `border-border`, `text-text-primary`
- Shadow: Uses `shadow-md` instead of `shadow-elevation-2`
- Radius: Mixed `rounded-lg`, `rounded-md` (should standardize)
```

### List Flow

```
Data Flow:
Supabase (user_event_board)
  → API Route (/api/events/board/list)
    → EventsBoardPage (loadBoardItems)
      → EventBoardList (items prop)
        → useMemo (filteredAndSorted)
          → EventBoardCard (repeated for each item)
            → No table structure (card-based layout)

State Management:
- Local useState in EventBoardList (searchTerm, statusFilter, sortField, sortDirection)
- useMemo for filtering/sorting (recomputes on every render if deps change)
- No persistence of view preferences (filters, sort, density)

Libraries:
- No drag/drop library (static list)
- No table library (card-based)
- Basic native HTML select for status filter

Persistence:
- Same as Kanban (Supabase via API)
- No saved views or URL params
- Filters/sort reset on page reload

Design Tokens:
- Similar issues as Kanban (hardcoded colors)
- Uses native select instead of shadcn/ui Select
- No Table component (should use shadcn/ui Table)
```

### Design Token Consumption

**Current State:**
- Design tokens defined in `src/app/globals.css`:
  - Colors: `--bg-primary`, `--bg-surface`, `--border`, `--text-primary`, etc.
  - Radius: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`
  - Shadows: `--shadow-elevation-0` through `--shadow-elevation-3`
- Tailwind config extends these via CSS variables
- shadcn/ui components use tokens (Button, Card, Badge)

**Where Tokens Are Bypassed:**
- `EventBoardKanban.tsx`: Hardcoded `bg-blue-50`, `bg-yellow-50`, `bg-green-50`, `bg-purple-50`
- `EventBoardCard.tsx`: Hardcoded `bg-blue-100`, `text-blue-800`, etc. in `getStatusColor`
- `EventBoardList.tsx`: Native `<select>` with inline styles
- Both: Uses `text-gray-600`, `text-gray-400` instead of `text-text-secondary`, `text-text-muted`

---

## UX Objectives & Success Criteria

### Objectives

1. **Brand Alignment**: Visual design matches app's design system (spacing, typography, colors, shadows, radii)
2. **Fast Comprehension**: Users understand board state at a glance (clear column headers, status badges, date formatting)
3. **Smooth Drag/Drop**: Drag operations feel responsive (<100ms latency), clear visual feedback, reliable drop targets
4. **Reliable Persistence**: Changes save reliably with optimistic updates, conflict resolution, and clear error states
5. **Confident Motion**: Animations feel intentional (200-250ms for micro-interactions, 160ms for list reflow)
6. **Strong Keyboard Support**: Full keyboard navigation for drag/drop, filtering, sorting, and card actions

### Success Metrics

**Usability Metrics:**
- Task success rate for "move card to different column": Target 95% (baseline: ~80% based on brittle interactions)
- Task success rate for "filter list by status and sort by date": Target 90% (baseline: ~70% due to unclear UI)
- Average time to find event in list: Target <5s (baseline: ~10s due to poor filtering)
- User satisfaction (NPS): Target +50 (baseline: unknown, assume neutral)

**Performance Metrics:**
- Average drag latency (time from mousedown to visual feedback): Target <100ms (baseline: ~200ms due to no optimistic updates)
- Drop failure rate (drops that don't persist): Target <1% (baseline: ~5% based on network issues)
- Cumulative Layout Shift (CLS) in Kanban transitions: Target <0.1 (baseline: ~0.3 due to layout jumps)
- Time to Interactive (TTI) on board page: Target <2s (baseline: ~3s due to no virtualization)

**Accessibility Metrics:**
- Keyboard coverage (percentage of mouse actions available via keyboard): Target 100% (baseline: ~60% - drag/drop missing)
- Lighthouse accessibility score: Target 100 (baseline: ~85 due to missing ARIA)
- AXE violations: Target 0 (baseline: ~5-10 violations)

**Brand Consistency Metrics:**
- Design token usage (percentage of hardcoded values replaced): Target 100% (baseline: ~30%)
- Component consistency (percentage of shadcn/ui primitives used): Target 90%+ (baseline: ~50%)

---

## Design System Alignment

### Tailwind Scales

**Spacing Scale (Standardize):**
- Tight: `gap-2` (8px) - Related items (badges, icons with text)
- Normal: `gap-4` (16px) - Standard flow (card elements, form fields)
- Loose: `gap-6` (24px) - Major separations (sections, card groups)
- Extra Loose: `gap-8` (32px) - Page-level spacing

**Typography Scale:**
- Headings: `text-2xl font-bold` (h1), `text-xl font-semibold` (h2), `text-lg font-semibold` (h3)
- Body: `text-base` (16px) - Primary text, `text-sm` (14px) - Secondary text, `text-xs` (12px) - Labels/metadata
- Line heights: `leading-tight` (1.25) for headings, `leading-normal` (1.5) for body

**Border Radius:**
- Cards: `rounded-lg` (8px) - Standard cards, `rounded-md` (6px) - Compact cards
- Buttons: `rounded-md` (6px) - Primary, `rounded-sm` (4px) - Secondary/ghost
- Badges: `rounded-md` (6px) - Less "pill" feel, more confident
- Inputs: `rounded-md` (6px)

**Shadows (Elevation System):**
- `shadow-elevation-0`: None (default surfaces)
- `shadow-elevation-1`: Subtle (hover states, inputs)
- `shadow-elevation-2`: Standard (cards, dropdowns)
- `shadow-elevation-3`: Elevated (modals, popovers, dragging cards)

**Color Tokens:**
- Backgrounds: `bg-surface` (default), `bg-surface-alt` (alternate), `bg-surface-elevated` (hover/active)
- Borders: `border-border` (default), `border-border-muted` (subtle), `border-border-strong` (emphasis)
- Text: `text-text-primary` (headings), `text-text-secondary` (body), `text-text-muted` (metadata)
- Status Colors: Use semantic tokens (`bg-positive`, `bg-warn`, `bg-danger`) with status-specific variants

### shadcn/ui Primitives to Standardize

**Required Components:**
1. **Card** (already used, but needs variant consistency)
   - Variants: `default`, `elevated` (drag state), `interactive` (hover)
   - Use: `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`

2. **Table** (needs to be added)
   - Install: `npx shadcn@latest add table`
   - Use for List view: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`
   - Features: Sticky header, resizable columns, sortable headers

3. **Tabs** (already available)
   - Use for view mode switcher (Kanban/List) if needed
   - Or keep as Button group (current approach is fine)

4. **DropdownMenu** (needs to be added)
   - Install: `npx shadcn@latest add dropdown-menu`
   - Use for: Status filter, card actions menu, column options

5. **Dialog** (already available)
   - Use for: Edit modal (replace `prompt()`), card details, bulk actions

6. **Popover** (needs to be added)
   - Install: `npx shadcn@latest add popover`
   - Use for: Quick filters, date picker, column customization

7. **Tooltip** (needs to be added)
   - Install: `npx shadcn@latest add tooltip`
   - Use for: Action buttons, truncated text, status explanations

8. **Badge** (already used, needs variant consistency)
   - Variants: `default`, `secondary`, `outline`, `destructive`
   - Status-specific: Create custom variants using design tokens

9. **Skeleton** (needs to be added)
   - Install: `npx shadcn@latest add skeleton`
   - Use for: Loading states (cards, table rows, columns)

10. **Select** (needs to be added)
    - Install: `npx shadcn@latest add select`
    - Use for: Status filter (replace native `<select>`)

11. **Input** (already available)
    - Use for: Search (already used correctly)

### Motion Guardrails

**Duration Rules:**
- Micro-interactions (hover, focus): 150ms (`duration-150`)
- Standard transitions (card hover, button press): 200ms (`duration-200`)
- Deliberate actions (modal open, dropdown): 250ms (`duration-250`)
- Page transitions: 300ms (`duration-300`)

**Easing:**
- Default: `ease-out` (feels snappy)
- Smooth: `ease-in-out` (for modals)
- Snappy: `ease-out` (for buttons, hovers)

**Max Duration:**
- Micro-interactions: Max 200ms
- List reflow animations: Max 160ms (to avoid feeling sluggish)
- Drag/drop feedback: Immediate (0ms delay, 200ms transition)

**Reduced Motion:**
- Respect `prefers-reduced-motion`
- Use `@media (prefers-reduced-motion: reduce)` to disable animations
- Fallback: Instant state changes without transitions

**Motion Patterns:**
- Card pickup: Scale to 1.02, elevate shadow (`shadow-elevation-3`), opacity 0.9
- Card drop: Scale to 1.0, shadow back to `shadow-elevation-2`, opacity 1.0
- List reflow: Use `@dnd-kit/sortable` transitions (already handles this)
- Modal open: Fade in (opacity 0→1) + scale (0.95→1.0)

---

## Information Architecture (IA) & Model

### Canonical Entities

**Event (from `collected_events` table):**
- Required: `id`, `title`, `source_url`, `starts_at`
- Optional: `ends_at`, `city`, `country`, `venue`, `organizer`, `description`, `topics[]`, `speakers[]`, `sponsors[]`, `participating_organizations[]`, `partners[]`, `competitors[]`, `confidence`
- Derived: `freshness` (days until event), `duration` (ends_at - starts_at), `location` (city + country), `topic_count`, `speaker_count`

**Column/Stage (from `user_event_board.column_status`):**
- Values: `interested`, `researching`, `attending`, `follow-up`, `archived`
- Metadata: Label, color (from design tokens), icon, order (display sequence)

**Card (BoardItemWithEvent):**
- Required: `id`, `user_id`, `event_url`, `column_status`, `position`, `added_at`
- Optional: `event_id` (FK to collected_events), `notes`, `tags[]`, `updated_at`
- Derived: `event` (joined from collected_events), `age` (days since added_at), `is_fresh` (event starts within 30 days)

**Tag:**
- Type: `string[]` (stored in `user_event_board.tags`)
- Usage: User-defined labels for filtering/grouping
- Examples: "Q1 2025", "High Priority", "Tech Conference", "Networking"

**Assignee:**
- Current: Not implemented (single-user board)
- Future: Could add `assigned_to` field for team boards

**Priority:**
- Current: Not implemented
- Future: Could add `priority` field (`low`, `medium`, `high`, `urgent`)

**Dates:**
- `starts_at`: Event start (required)
- `ends_at`: Event end (optional)
- `added_at`: When added to board (auto-set)
- `updated_at`: Last modification (auto-updated)
- Derived: `days_until_event`, `is_past`, `is_upcoming`, `is_today`

### Grouping Options

**By Status (Current):**
- Default grouping in Kanban view
- Columns: Interested, Researching, Attending, Follow-up, Archived

**By Topic (Future):**
- Group cards by `event.topics[]`
- Useful for: Finding all "AI" or "Blockchain" events
- Implementation: Add topic filter/group toggle

**By Timeframe (Future):**
- Groups: "This Week", "This Month", "Next Quarter", "Later"
- Based on `starts_at` relative to today
- Useful for: Time-based planning

**By Sponsor (Future):**
- Group by `event.sponsors[]`
- Useful for: Tracking sponsor relationships

**By Priority (Future):**
- If priority field added
- Groups: High, Medium, Low

### Saved Views

**Definition:**
A saved view is a combination of:
- Query (filters): Status, topics, date range, search term
- Columns (List view): Which columns to show, order, widths
- Sort: Field and direction
- Density: Comfortable or compact
- Grouping: Status, topic, timeframe, etc.

**Storage:**
- Table: `user_saved_views` (new table)
- Fields: `id`, `user_id`, `name`, `view_type` ('kanban' | 'list'), `filters` (JSONB), `columns` (JSONB), `sort` (JSONB), `density`, `is_default`, `created_at`, `updated_at`

**URL Params:**
- Shareable URLs: `/events-board?view=kanban&status=attending&sort=date:asc`
- Params: `view`, `status`, `topic`, `date_from`, `date_to`, `search`, `sort`, `density`, `columns`
- On load: Parse URL params, apply to view, optionally save as new view

**Default Views:**
- "All Events" (default): All statuses, sort by added_at desc
- "Upcoming": Status = attending, date >= today, sort by starts_at asc
- "Needs Follow-up": Status = follow-up, sort by updated_at desc

---

## Kanban Interaction Model

### Drag/Drop Library Choice & Rationale

**Current: @dnd-kit (Keep)**
- Rationale: Already in use, composable, good keyboard support, active maintenance
- Version: @dnd-kit/core v6.1.0, @dnd-kit/sortable v8.0.0
- Strengths: Accessibility built-in, flexible collision detection, good TypeScript support
- Weaknesses: Requires more setup than HTML5 DnD, but worth it for keyboard support

**Improvements Needed:**
1. Better collision detection: Use `rectIntersection` or `closestCenter` instead of `closestCorners`
2. Autoscroll: Add `AutoScrollPlugin` or custom implementation
3. Keyboard navigation: Enhance `KeyboardSensor` with better coordinate getter
4. Drag preview: Improve `DragOverlay` with better styling and animations

### Snap-to-Column Logic

**Current:**
- Drop on column header or empty space in column
- Uses `closestCorners` collision detection
- No visual feedback until drop

**Improved:**
- Visual indicator when dragging over column (border highlight, background tint)
- Snap to column when drag enters column bounds (not just on drop)
- Show drop indicator line between cards
- Animate column expansion when dragging near edge

**Implementation:**
```typescript
// In DroppableColumn
const { setNodeRef, isOver } = useDroppable({ id });
// Add visual feedback:
className={cn(
  "transition-colors duration-200",
  isOver && "bg-surface-alt border-2 border-primary"
)}
```

### Drop Targets

**Current:**
- Column headers (via DroppableColumn)
- Cards (via SortableItem)
- Issue: Can't drop between cards precisely

**Improved:**
- Column as drop target (for moving to column)
- Between cards (show insertion indicator)
- On specific card (reorder within column)
- Visual feedback for each target type

### Autoscroll Behavior

**Current:**
- No autoscroll
- Issue: Can't drag to columns outside viewport

**Implementation:**
- Detect when drag is near viewport edge (top/bottom/left/right)
- Scroll container automatically when within threshold (e.g., 50px from edge)
- Smooth scroll with easing
- Respect `prefers-reduced-motion`

### Column Virtualization

**Current:**
- Renders all columns and all cards
- Issue: Performance degrades with many cards

**Future (if needed):**
- Only render visible columns (horizontal scroll)
- Virtualize cards within columns (react-window)
- Threshold: Virtualize if column has >20 cards

### Card Affordances

**Hover Tools:**
- Show on card hover: Quick actions (status change, edit, remove)
- Position: Top-right corner, fade in on hover
- Actions: Status dropdown, Edit icon, Remove icon, Expand icon

**Quick Actions:**
- Status change: DropdownMenu with status options
- Edit: Open Dialog with notes/tags editor
- Remove: ConfirmDialog before deletion
- Expand: Toggle card details (already implemented)

**Implementation:**
```typescript
// In EventBoardCard
const [showActions, setShowActions] = useState(false);
// On hover: setShowActions(true)
// Actions menu: DropdownMenu with status options, edit, remove
```

### Persistence Strategy

**Optimistic Updates:**
- Update UI immediately on drag/drop
- Show loading state on card (spinner, disabled state)
- Call API in background
- On success: Confirm update (remove loading)
- On error: Rollback UI, show error toast, restore original position

**Debounced Sync:**
- For rapid drags: Debounce API calls (300ms)
- Batch multiple position updates into single API call
- Use `useDebouncedCallback` from a utility library

**Conflict Resolution:**
- On concurrent edits: Last write wins (current behavior)
- Future: Add version field, detect conflicts, show merge dialog
- For now: Optimistic updates reduce conflict window

**Implementation:**
```typescript
// In EventBoardKanban
const [optimisticColumns, setOptimisticColumns] = useState(columns);
const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());

const handleDragEnd = async (event: DragEndEvent) => {
  // Optimistic update
  setOptimisticColumns(newColumns);
  setPendingUpdates(prev => new Set(prev).add(activeId));
  
  try {
    await onReorder(activeId, newStatus, newPosition);
    setPendingUpdates(prev => {
      const next = new Set(prev);
      next.delete(activeId);
      return next;
    });
  } catch (error) {
    // Rollback
    setOptimisticColumns(columns);
    toast.error("Failed to update. Please try again.");
  }
};
```

### Keyboard Navigation

**Current:**
- Basic KeyboardSensor with `sortableKeyboardCoordinates`
- Issue: No visual feedback, no announcements

**Improved:**
- Arrow keys: Move card within column (up/down)
- Shift+Arrow: Move card between columns (left/right)
- Enter: Activate card (open details)
- Escape: Cancel drag
- Tab: Navigate between cards, then columns

**ARIA Live Updates:**
- Announce card moves: "Moved [Event Title] to [Column Name]"
- Announce position: "Position 3 of 5 in [Column Name]"
- Use `aria-live="polite"` region

**Implementation:**
```typescript
// Enhanced KeyboardSensor
const keyboardSensor = useSensor(KeyboardSensor, {
  coordinateGetter: (event, { context }) => {
    // Custom coordinate getter for column navigation
    // Handle ArrowLeft/Right for column moves
    // Handle ArrowUp/Down for position moves
  },
});

// ARIA announcements
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {announcement}
</div>
```

---

## List View Redesign

### Column Set (Customizable)

**Default Columns:**
1. **Title** (required, always visible)
   - Content: Event title (truncate with ellipsis, tooltip on hover)
   - Width: Flexible (min 200px)
   - Sortable: Yes (alphabetical)

2. **Date(s)** (optional, default visible)
   - Content: `starts_at` formatted (e.g., "Jan 15, 2025")
   - Width: 120px
   - Sortable: Yes (chronological)
   - Show: Start date, or range if `ends_at` exists

3. **Topic(s)** (optional, default visible)
   - Content: First 2-3 topics as badges, "+N more" if more
   - Width: 200px
   - Sortable: No (multi-value)
   - Filterable: Yes (multi-select)

4. **Speaker(s)** (optional, default hidden)
   - Content: First 2 speaker names, "+N more"
   - Width: 200px
   - Sortable: No
   - Filterable: Yes (search)

5. **Sponsor(s)** (optional, default hidden)
   - Content: First 2 sponsor names, "+N more"
   - Width: 200px
   - Sortable: No
   - Filterable: Yes (search)

6. **Stage/Status** (required, always visible)
   - Content: Badge with status label
   - Width: 120px
   - Sortable: Yes
   - Filterable: Yes (multi-select)

7. **Priority** (optional, future)
   - Content: Badge or icon
   - Width: 100px
   - Sortable: Yes

8. **Confidence** (optional, default hidden)
   - Content: Progress bar or badge (0-100%)
   - Width: 100px
   - Sortable: Yes
   - Show: Only if confidence < 80% (low confidence indicator)

9. **Source** (optional, default hidden)
   - Content: Domain from `source_url` (e.g., "eventbrite.com")
   - Width: 150px
   - Sortable: Yes
   - Filterable: Yes

10. **Actions** (required, always visible)
    - Content: Icon buttons (View, Edit, Remove)
    - Width: 100px (fixed)
    - Sortable: No

**Column Customization:**
- Show/hide: Checkbox list in Popover
- Reorder: Drag handles in column header
- Resize: Drag column border (min/max widths)
- Save: Persist to saved view or user preferences

### Table Behaviors

**Sticky Header:**
- Header stays visible when scrolling
- Use `position: sticky; top: 0; z-index: 10`
- Background: `bg-surface-elevated` with shadow

**Resizable Columns:**
- Drag handle on column border
- Min width: 100px (except Title: 200px)
- Max width: 400px (except Title: unlimited)
- Persist widths to localStorage or saved view

**Sortable:**
- Click header to sort
- Visual indicator: Arrow icon (up/down) in header
- Multi-sort: Shift+click for secondary sort (future)
- Default: Sort by `added_at` desc

**Multi-Filter:**
- Filter bar above table
- Status: Multi-select dropdown
- Topics: Multi-select with search
- Date range: Date picker (from/to)
- Search: Text input (searches title, description, notes)
- Clear all: Button to reset filters

**Density Switch:**
- Toggle: Comfortable (default) / Compact
- Comfortable: `py-4` rows, `text-base` text
- Compact: `py-2` rows, `text-sm` text
- Persist to user preferences

**Inline Quick Actions:**
- Hover row: Show action buttons (View, Edit, Remove, Status)
- Or: Always show in Actions column
- Use DropdownMenu for status change

### Empty State

**No Events:**
- Icon: LayoutGrid (Kanban icon) or Calendar
- Heading: "Your board is empty"
- Description: "Add events from search results to get started"
- CTA: Button "Browse Events" → `/events`
- Visual: Subtle illustration or gradient background

**No Results (Filtered):**
- Icon: Filter or Search
- Heading: "No events match your filters"
- Description: "Try adjusting your search or filters"
- CTA: Button "Clear Filters"
- Show: Active filters with remove buttons

**Loading:**
- Skeleton: Table rows with shimmer
- Use shadcn/ui Skeleton component
- Show 5-10 skeleton rows

### Row Expansion

**Current:**
- Card-based expansion (already in EventBoardCard)
- Issue: Not suitable for table rows

**Improved:**
- Click row to expand (or expand icon)
- Expanded row: Shows full event details below
- Content: Description, full topic/speaker/sponsor lists, notes, tags
- Actions: Edit, Remove, View Insights (same as card)
- Animation: Smooth height transition (200ms)

**Implementation:**
```typescript
// In table row
const [expanded, setExpanded] = useState(false);
// Toggle on row click or expand button
// Render expanded content in <tr> below main row
```

---

## Consistency & Visual Polish

### Spacing Rhythm

**Standardize:**
- Card padding: `p-4` (16px) for CardContent, `p-6` (24px) for CardHeader
- Card gaps: `gap-3` (12px) between card elements, `gap-4` (16px) between cards
- Column gaps: `gap-4` (16px) between columns in Kanban
- Table spacing: `px-4` (16px) horizontal, `py-3` (12px) vertical for cells

**Remove Inconsistencies:**
- Replace `mb-3` with `gap-3` in flex containers
- Replace `space-y-3` with `gap-3` where appropriate
- Use consistent `gap-*` values throughout

### Typographic Scale

**Headings:**
- Page title: `text-3xl font-bold` (30px) - "Events Board"
- Section title: `text-xl font-semibold` (20px) - Column headers
- Card title: `text-base font-semibold` (16px) - Event title
- Label: `text-sm font-medium` (14px) - Field labels

**Body:**
- Primary: `text-base` (16px) - Card descriptions, table cells
- Secondary: `text-sm` (14px) - Metadata, timestamps
- Tertiary: `text-xs` (12px) - Badges, counts, helper text

**Remove Inconsistencies:**
- Standardize all headings to use scale above
- Remove arbitrary font sizes (`text-[15px]`, etc.)

### Iconography Rules

**Size:**
- Small: `h-3 w-3` (12px) - Inline with text
- Medium: `h-4 w-4` (16px) - Buttons, badges
- Large: `h-5 w-5` (20px) - Empty states, headers

**Usage:**
- Status icons: Use lucide-react icons (Calendar, MapPin, Users, etc.)
- Actions: Use semantic icons (Edit, Trash2, Eye, etc.)
- Consistency: Use same icon for same action across views

### Badge Styles per Tag Type

**Status Badges:**
- Use design token colors: `bg-positive`, `bg-warn`, `bg-danger` for semantic meanings
- Variant: `default` (solid) for status
- Size: `text-xs` (12px) with `px-2 py-0.5` padding

**Topic Badges:**
- Variant: `secondary` (muted background)
- Size: `text-xs` with `px-2 py-0.5`

**Tag Badges:**
- Variant: `outline` (border only)
- Size: `text-xs` with `px-2 py-0.5`

**Remove Hardcoded Colors:**
- Replace `bg-blue-100 text-blue-800` with `bg-primary/10 text-primary` or status-specific tokens

### Reduce "AI-Generated" Feel

**Tune Radii:**
- Cards: `rounded-lg` (8px) instead of `rounded-2xl` (16px)
- Buttons: `rounded-md` (6px) for primary, `rounded-sm` (4px) for secondary
- Badges: `rounded-md` (6px) instead of `rounded-full`

**Tune Shadows:**
- Use elevation tokens: `shadow-elevation-1` for hover, `shadow-elevation-2` for cards
- Remove arbitrary shadows (`shadow-[0_2px_4px_rgba(0,0,0,0.1)]`)

**Tune Spacing:**
- Use consistent scale: `gap-2`, `gap-4`, `gap-6` (no `gap-3.5`, `gap-5`)
- Remove arbitrary padding (`p-[18px]` → `p-4` or `p-6`)

**Unify Headline Sizes:**
- All page titles: `text-3xl font-bold`
- All section titles: `text-xl font-semibold`
- All card titles: `text-base font-semibold`

**Consistent Microcopy:**
- Use short verbs: "Add" not "Add to board", "Edit" not "Edit event"
- Remove verbose text: "No events found matching your criteria" → "No events found"
- Use action-oriented language: "Browse Events" not "Go to events page"

### Motion

**Card Pick-up:**
- Scale: `scale-[1.02]` (2% larger)
- Shadow: `shadow-elevation-3` (elevated)
- Opacity: `opacity-90`
- Duration: `duration-200` (200ms)
- Easing: `ease-out`

**Card Drop:**
- Scale: `scale-100` (back to normal)
- Shadow: `shadow-elevation-2` (standard)
- Opacity: `opacity-100`
- Duration: `duration-200`

**List Reflow:**
- Use @dnd-kit/sortable transitions (automatic)
- Cap duration to 160ms (feels snappy)
- Easing: `ease-out`

**Implementation:**
```typescript
// In SortableItem
const style = {
  transform: CSS.Transform.toString(transform),
  transition: isDragging ? 'none' : 'transform 160ms ease-out',
  opacity: isDragging ? 0.9 : 1,
  scale: isDragging ? 1.02 : 1,
};
```

---

## Performance Plan

### Virtualization

**Library:**
- Already in dependencies: `react-window` v2.2.1
- Use: `FixedSizeList` for vertical lists, `FixedSizeGrid` for tables

**Kanban Virtualization:**
- Virtualize cards within columns if column has >20 items
- Threshold: Show virtualization warning if column has >50 items
- Implementation: Wrap column content in `FixedSizeList`

**List Virtualization:**
- Virtualize table rows if list has >50 items
- Sticky header: Keep header visible during scroll
- Implementation: Use `react-window` with custom `Table` component

**Column Virtualization (Future):**
- If board has >10 columns, virtualize horizontal scroll
- Use `FixedSizeList` with horizontal layout

### Memoization and Keying Strategies

**Memoize Filtered/Sorted Lists:**
```typescript
const filteredAndSorted = useMemo(() => {
  // Filter and sort logic
}, [items, searchTerm, statusFilter, sortField, sortDirection]);
```

**Memoize Card Components:**
```typescript
const MemoizedEventBoardCard = memo(EventBoardCard, (prev, next) => {
  return prev.item.id === next.item.id &&
         prev.item.column_status === next.item.column_status &&
         prev.item.position === next.item.position;
});
```

**Stable Keys:**
- Use `item.id` for keys (not index)
- Ensure keys are stable across renders

### Incremental Rendering

**Lazy Load Columns:**
- Load visible columns first
- Load off-screen columns on scroll or after initial render
- Use `IntersectionObserver` to detect visible columns

**Lazy Load Card Details:**
- Load basic card info first (title, date, status)
- Load expanded details on demand (speakers, sponsors, description)
- Use `useDeferredValue` for non-critical data

### Local Cache Strategy

**Stale-While-Revalidate:**
- Show cached data immediately on page load
- Fetch fresh data in background
- Update UI when fresh data arrives
- Use React Query or SWR (or custom hook)

**Cache Storage:**
- localStorage: Cache board items (key: `events-board-cache`)
- TTL: 5 minutes (stale after 5 min, but show while fetching)
- Invalidate: On manual refresh, after mutations

### Payload Size Limits

**Pagination:**
- If board has >100 items, implement pagination
- Load 50 items per page
- Or: Infinite scroll with 50-item chunks

**Field Selection:**
- Only fetch required fields from API
- Use Supabase `.select()` to limit fields
- Don't fetch full event data if not needed

### Metrics to Track

**TTI (Time to Interactive) on Board Page:**
- Target: <2s
- Measure: Time from page load to first interactive element
- Tool: Lighthouse, Web Vitals

**Drag FPS:**
- Target: 60 FPS during drag
- Measure: Frame rate during drag operation
- Tool: Chrome DevTools Performance tab

**List Scroll FPS:**
- Target: 60 FPS during scroll
- Measure: Frame rate during table scroll
- Tool: Chrome DevTools Performance tab

**API Response Time:**
- Target: <500ms for board list, <200ms for updates
- Measure: Time from API call to response
- Tool: Network tab, API monitoring

---

## Accessibility (A11y)

### Keyboard Flows

**Kanban Reorder/Move:**
- Tab: Navigate to card
- Space: Start drag
- Arrow keys: Move card (up/down within column, left/right between columns)
- Enter: Drop card
- Escape: Cancel drag

**List Navigation:**
- Tab: Navigate through table cells
- Arrow keys: Move between cells
- Enter: Activate cell (expand row, open details)
- Space: Select row (for bulk actions, future)

**Filtering/Sorting:**
- Tab: Navigate to filter controls
- Enter/Space: Activate filter (open dropdown, toggle sort)
- Arrow keys: Navigate dropdown options
- Escape: Close dropdown

### Focus Management

**After Drag/Drop:**
- Return focus to moved card
- Announce move to screen reader
- Highlight moved card briefly (focus ring)

**After Modal Close:**
- Return focus to trigger button
- Announce action result (e.g., "Event updated")

**Skip Links:**
- Add skip link to main content: `<a href="#main-content" className="sr-only focus:not-sr-only">Skip to main content</a>`
- Add skip link to filters: `Skip to filters`

### ARIA Roles

**Kanban:**
- Container: `role="application"` (justified: complex drag/drop)
- Column: `role="region"` with `aria-label="[Column Name] column"`
- Card: `role="button"` with `aria-label="[Event Title], [Status]"`
- Drag state: `aria-grabbed="true"` when dragging

**List:**
- Table: `role="table"` (semantic HTML table)
- Row: `role="row"`
- Cell: `role="cell"` or `role="columnheader"`
- No `role="grid"` (table is appropriate for tabular data)

**Live Regions:**
- Drag announcements: `<div aria-live="polite" aria-atomic="true">`
- Filter announcements: "Showing X of Y events"
- Update announcements: "Event moved to [Column]"

### Contrast

**Text Contrast:**
- Primary text: WCAG AA (4.5:1) - `text-text-primary` meets this
- Secondary text: WCAG AA (4.5:1) - `text-text-secondary` meets this
- Muted text: WCAG AA (4.5:1) - `text-text-muted` meets this

**Interactive Elements:**
- Buttons: Ensure contrast on hover states
- Links: Ensure contrast (use `text-primary`)

**Status Badges:**
- Ensure text contrast on colored backgrounds
- Test: Use contrast checker tool

### Hit-Target Sizes

**Minimum: 44x44px (WCAG 2.5.5):**
- Buttons: Ensure `h-10` (40px) or larger, add padding if needed
- Icons: Ensure clickable area is 44x44px (not just icon size)
- Cards: Entire card should be clickable (not just title)

**Implementation:**
```typescript
// Ensure buttons meet size requirement
<Button size="sm" className="min-h-[44px] min-w-[44px]">
  <Icon className="h-4 w-4" />
</Button>
```

### Tooltip Semantics

**Use Tooltip Component:**
- Install shadcn/ui Tooltip
- Use for: Truncated text, action explanations, status meanings
- Ensure tooltip is keyboard accessible (focusable trigger)

**Avoid Title Attributes:**
- Don't use `title` attribute (not accessible)
- Use Tooltip component instead

### Reduced-Motion Support

**Respect `prefers-reduced-motion`:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Or in Tailwind:**
```typescript
className={cn(
  "transition-all duration-200",
  "motion-reduce:transition-none"
)}
```

**Test:**
- Enable reduced motion in OS settings
- Verify animations are disabled or minimal

---

## Data Contracts & APIs

### JSON Schemas

**EventCard (BoardItemWithEvent):**
```typescript
interface BoardItemWithEvent {
  // Required
  id: string; // UUID
  user_id: string; // UUID
  event_url: string; // URL
  column_status: ColumnStatus; // 'interested' | 'researching' | 'attending' | 'follow-up' | 'archived'
  position: number; // Integer, 0-based
  added_at: string; // ISO 8601 timestamp
  
  // Optional
  event_id?: string | null; // UUID, FK to collected_events
  notes?: string | null;
  tags?: string[] | null;
  updated_at?: string; // ISO 8601 timestamp
  
  // Derived (from join)
  event?: EventData | null; // Full event data from collected_events
}

interface EventData {
  id: string;
  title: string;
  starts_at: string; // ISO 8601
  ends_at?: string | null; // ISO 8601
  city?: string | null;
  country?: string | null;
  venue?: string | null;
  organizer?: string | null;
  description?: string | null;
  topics?: string[] | null;
  speakers?: any[] | null; // Complex type, see database schema
  sponsors?: any[] | null;
  source_url: string;
  confidence?: number | null; // 0-100
}
```

**BoardColumn:**
```typescript
interface BoardColumn {
  id: ColumnStatus;
  label: string; // Display name
  color: string; // Design token class (e.g., "bg-primary/10")
  icon?: string; // Lucide icon name
  order: number; // Display order
  itemCount: number; // Derived: items.length
}
```

**SavedView:**
```typescript
interface SavedView {
  // Required
  id: string; // UUID
  user_id: string; // UUID
  name: string; // User-defined name
  view_type: 'kanban' | 'list';
  
  // Optional
  filters?: ViewFilters;
  columns?: ColumnConfig[]; // For list view
  sort?: SortConfig;
  density?: 'comfortable' | 'compact';
  is_default?: boolean;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

interface ViewFilters {
  status?: ColumnStatus[];
  topics?: string[];
  date_from?: string; // ISO 8601
  date_to?: string; // ISO 8601
  search?: string;
}

interface ColumnConfig {
  id: string; // Column identifier
  visible: boolean;
  width?: number; // Pixels
  order: number;
}

interface SortConfig {
  field: string; // 'date' | 'title' | 'status' | 'added'
  direction: 'asc' | 'desc';
}
```

### Update Semantics

**Reordering/Moving:**
```typescript
// API: PATCH /api/events/board/update
interface UpdateRequest {
  id: string; // Board item ID
  columnStatus?: ColumnStatus; // New column
  position?: number; // New position (0-based)
  notes?: string;
  tags?: string[];
}

// Response
interface UpdateResponse {
  success: boolean;
  boardItem?: BoardItemWithEvent;
  error?: string;
}
```

**Bulk Updates:**
```typescript
// API: PATCH /api/events/board/bulk-update
interface BulkUpdateRequest {
  items: Array<{
    id: string;
    columnStatus?: ColumnStatus;
    position?: number;
  }>;
}

// Response
interface BulkUpdateResponse {
  success: boolean;
  updated: number; // Count of updated items
  errors?: Array<{ id: string; error: string }>;
}
```

### Conflict Resolution

**Current: Last Write Wins**
- No version field
- Concurrent edits: Last update wins
- Issue: Can lose changes if two users edit simultaneously

**Future: Optimistic Locking**
- Add `version` field to `user_event_board`
- On update: Check version matches
- On conflict: Return 409 Conflict, show merge dialog
- For now: Optimistic updates reduce conflict window

**Implementation:**
```typescript
// Future: Add version to table
ALTER TABLE user_event_board ADD COLUMN version INTEGER DEFAULT 1;

// On update: Check version
UPDATE user_event_board
SET column_status = $1, position = $2, version = version + 1
WHERE id = $3 AND version = $4; -- $4 is expected version

// If no rows updated: Conflict (version mismatch)
```

### Versioning Strategy

**API Versioning:**
- Current: No versioning (assume v1)
- Future: Add `/api/v1/events/board/...` if breaking changes needed

**Data Migration:**
- Support multiple versions of data structure
- Migrate on read if needed
- Or: One-time migration script

**UI Versioning:**
- Feature flags for new UI features
- Gradual rollout (10% → 50% → 100%)
- Rollback capability

---

## Migration Strategy

### Phases

#### P1: Visual Alignment + Microcopy + Table Improvements (Week 1-2)

**Goal:** Fix visual inconsistencies and improve List view clarity

**Tasks:**
1. Replace hardcoded colors with design tokens
   - Files: `EventBoardKanban.tsx`, `EventBoardCard.tsx`
   - Replace: `bg-blue-50` → `bg-primary/10`, `text-blue-800` → `text-primary`
   - Status colors: Create status-specific token variants

2. Standardize spacing
   - Audit all spacing values
   - Replace with consistent scale: `gap-2`, `gap-4`, `gap-6`
   - Files: All board components

3. Standardize typography
   - Ensure all headings use scale: `text-3xl`, `text-xl`, `text-base`
   - Files: `EventsBoardPage.tsx`, `EventBoardCard.tsx`

4. Standardize border radius
   - Cards: `rounded-lg` (8px)
   - Buttons: `rounded-md` (6px)
   - Badges: `rounded-md` (6px)

5. Use shadow elevation tokens
   - Replace `shadow-md` with `shadow-elevation-2`
   - Hover: `shadow-elevation-3`

6. Install shadcn/ui components
   - `npx shadcn@latest add select` (for status filter)
   - `npx shadcn@latest add table` (for List view)
   - `npx shadcn@latest add skeleton` (for loading states)
   - `npx shadcn@latest add dialog` (if not already installed)

7. Replace native select with shadcn/ui Select
   - File: `EventBoardList.tsx`
   - Replace `<select>` with `<Select>` component

8. Improve empty states
   - Add meaningful icons, descriptions, CTAs
   - File: `EventBoardList.tsx`, `EventBoardKanban.tsx`

9. Add Skeleton loading states
   - Replace spinner with Skeleton components
   - File: `EventsBoardPage.tsx`

10. Improve microcopy
    - Shorten all text (remove verbose phrases)
    - Use action-oriented language
    - Files: All board components

**Success Criteria:**
- 100% design token usage (no hardcoded colors)
- Consistent spacing/typography throughout
- List view uses Table component
- Empty states have CTAs
- Loading states use Skeleton

**Rollback:** Revert commits if issues arise

---

#### P2: Kanban Interaction Hardening (Week 3-4)

**Goal:** Make drag/drop reliable, fast, and keyboard-accessible

**Tasks:**
1. Implement optimistic updates
   - Update UI immediately on drag/drop
   - Show loading state on card
   - Call API in background
   - Rollback on error
   - File: `EventBoardKanban.tsx`

2. Add debounced sync
   - Debounce API calls (300ms) for rapid drags
   - Batch multiple updates
   - File: `EventBoardKanban.tsx`

3. Improve collision detection
   - Replace `closestCorners` with `rectIntersection` or `closestCenter`
   - File: `EventBoardKanban.tsx`

4. Add visual feedback during drag
   - Highlight drop targets (column borders, between cards)
   - Show insertion indicator
   - File: `EventBoardKanban.tsx`, `DroppableColumn.tsx`

5. Enhance keyboard navigation
   - Improve KeyboardSensor coordinate getter
   - Add Arrow key handlers for column navigation
   - Add ARIA announcements
   - File: `EventBoardKanban.tsx`

6. Add autoscroll
   - Detect viewport edges
   - Scroll container when dragging near edge
   - Respect `prefers-reduced-motion`
   - File: `EventBoardKanban.tsx`

7. Improve drag preview
   - Better styling for DragOverlay
   - Scale and shadow animations
   - File: `EventBoardKanban.tsx`

8. Add error handling
   - Toast notifications on errors
   - Retry mechanism
   - File: `EventBoardKanban.tsx`, add toast library if needed

**Success Criteria:**
- Drag latency <100ms
- Drop failure rate <1%
- Full keyboard navigation works
- ARIA announcements for moves
- Autoscroll works smoothly

**Rollback:** Feature flag to disable optimistic updates

---

#### P3: Virtualization + Saved Views + Shareable Filters (Week 5-6)

**Goal:** Performance improvements and advanced features

**Tasks:**
1. Add virtualization for large lists
   - Use react-window for table rows (>50 items)
   - Sticky header
   - File: `EventBoardList.tsx`

2. Add virtualization for Kanban columns
   - Virtualize cards within columns (>20 items)
   - File: `EventBoardKanban.tsx`

3. Implement saved views
   - Create `user_saved_views` table
   - API: GET/POST/PATCH/DELETE `/api/events/board/views`
   - UI: Save view button, load view dropdown
   - Files: New API route, `EventsBoardPage.tsx`

4. Add URL params for filters/views
   - Parse URL params on load
   - Update URL on filter/sort change
   - Shareable URLs
   - File: `EventsBoardPage.tsx`

5. Add column customization (List view)
   - Show/hide columns
   - Resize columns
   - Reorder columns
   - Persist to saved view
   - File: `EventBoardList.tsx`

6. Add multi-filter
   - Status multi-select
   - Topic multi-select with search
   - Date range picker
   - Clear all button
   - File: `EventBoardList.tsx`

7. Add density toggle
   - Comfortable/Compact modes
   - Persist to user preferences
   - File: `EventBoardList.tsx`

8. Add row expansion
   - Click row to expand details
   - Smooth height transition
   - File: `EventBoardList.tsx`

**Success Criteria:**
- List scrolls at 60 FPS with 100+ items
- Saved views persist and load correctly
- URL params work for sharing
- Column customization works
- Multi-filter works

**Rollback:** Feature flags for each feature

---

### Rollout Plan

**Phase 1 (P1):**
- Deploy to staging
- Internal testing (1-2 days)
- Deploy to production (gradual: 10% → 50% → 100% over 3 days)
- Monitor: Error rates, performance metrics

**Phase 2 (P2):**
- Deploy to staging
- Internal testing (2-3 days)
- Beta users (10% of users, 3 days)
- Deploy to production (gradual: 25% → 50% → 100% over 5 days)
- Monitor: Drag/drop success rate, error rates

**Phase 3 (P3):**
- Deploy to staging
- Internal testing (3-5 days)
- Beta users (25% of users, 5 days)
- Deploy to production (gradual: 50% → 100% over 7 days)
- Monitor: Performance metrics, user feedback

### Feature Flags

**Implementation:**
- Use environment variables or feature flag service
- Flags:
  - `ENABLE_OPTIMISTIC_UPDATES` (P2)
  - `ENABLE_VIRTUALIZATION` (P3)
  - `ENABLE_SAVED_VIEWS` (P3)
  - `ENABLE_COLUMN_CUSTOMIZATION` (P3)

**Usage:**
```typescript
const useOptimisticUpdates = process.env.NEXT_PUBLIC_ENABLE_OPTIMISTIC_UPDATES === 'true';
```

### Rollback Rules

**Automatic Rollback:**
- Error rate >5%: Auto-rollback
- Performance degradation >20%: Auto-rollback
- Critical bugs: Manual rollback

**Manual Rollback:**
- Revert commits
- Or: Disable feature flags
- Or: Route traffic to old version (if using blue-green deployment)

### Data Backfills

**Saved Views Migration:**
- No backfill needed (new feature)
- Users create views from scratch

**Column Preferences:**
- Default: Show all default columns
- No migration needed

**Position Updates:**
- If position field is inconsistent: Run one-time script to normalize positions
- Script: Set position = row_number() within each column

---

## Risk Register & Edge Cases

### Huge Boards

**Risk:** User has 500+ events, performance degrades

**Mitigation:**
- Virtualization (P3)
- Pagination or infinite scroll
- Limit: Warn user if board has >200 items, suggest archiving

**Detection:**
- Monitor: Board load time, render time
- Alert: If board has >200 items

### Flaky Network

**Risk:** API calls fail during drag/drop, user loses changes

**Mitigation:**
- Optimistic updates with rollback (P2)
- Retry mechanism (3 retries with exponential backoff)
- Offline queue: Store failed updates, retry on reconnect
- User feedback: Toast on error, show retry button

**Detection:**
- Monitor: API error rate, network failures
- Alert: If error rate >5%

### Duplicate Events

**Risk:** User adds same event twice (different URLs or timing)

**Current:** `UNIQUE(user_id, event_url)` prevents duplicates by URL

**Edge Case:** Same event, different URLs (e.g., shortened vs full URL)

**Mitigation:**
- Detect duplicates on add: Check if event_id already exists
- Show warning: "This event is already in your board"
- Option: Merge or skip

### Timezone Churn

**Risk:** Event dates show incorrectly due to timezone issues

**Current:** Dates stored as ISO 8601 timestamps in UTC

**Mitigation:**
- Always display dates in user's timezone
- Use `Intl.DateTimeFormat` with user's locale
- Store timezone preference in user settings

**Edge Case:** Multi-day events spanning timezone boundaries

**Mitigation:**
- Show date range with timezone: "Jan 15-17, 2025 (PST)"

### Multi-Day Events

**Risk:** Event spans multiple days, unclear which day to show

**Mitigation:**
- Show date range: "Jan 15-17, 2025"
- Or: Show start date with duration: "Jan 15, 2025 (3 days)"
- In filters: Include event if any day matches date range

### Archived Columns

**Risk:** Archived column has 1000+ items, slows down board

**Mitigation:**
- Virtualize archived column first (always virtualize if >20 items)
- Or: Hide archived column by default, show on toggle
- Or: Paginate archived items

### Permissioning

**Risk:** User tries to edit another user's board (shouldn't happen, but defensive)

**Current:** RLS policies prevent this

**Mitigation:**
- Verify ownership in API routes (already done)
- Return 404 (not 403) to avoid information leakage
- Log suspicious access attempts

### Concurrent Edits

**Risk:** Two users edit same board item simultaneously

**Current:** Last write wins

**Mitigation:**
- Optimistic updates reduce conflict window (P2)
- Future: Add version field, detect conflicts, show merge dialog
- For now: Acceptable risk (low probability for single-user boards)

### Large Event Data

**Risk:** Event has 100+ speakers/sponsors, card becomes huge

**Mitigation:**
- Truncate lists: Show first 3-5 items, "+N more" badge
- Lazy load: Load full list on expand
- Virtualize: If list is very long, use virtualized list

### Missing Event Data

**Risk:** `event_id` is null (event not in collected_events), card shows limited info

**Current:** Falls back to `event_url` for title

**Mitigation:**
- Show placeholder: "Event details unavailable"
- Option: Fetch event data from URL (future: background job)
- Or: Allow user to manually add event data

---

## Experiment Matrix

### Experiment 1: Density Presets

**Hypothesis:** Users prefer compact mode for scanning large lists

**Change:** Add density toggle (comfortable/compact)

**Metric:** 
- Usage: % of users who switch to compact
- Task time: Time to find event in list (compact vs comfortable)
- Satisfaction: User feedback

**Success Threshold:**
- >30% of users use compact mode
- Task time reduced by >20% in compact mode
- Satisfaction score >4/5

**Timebox:** 2 weeks

**Rollback:** Remove density toggle, default to comfortable

---

### Experiment 2: Column Grouping Modes

**Hypothesis:** Users want to group by topic/timeframe, not just status

**Change:** Add grouping toggle (Status, Topic, Timeframe)

**Metric:**
- Usage: % of users who change grouping
- Task success: Success rate for "find all AI events"
- Satisfaction: User feedback

**Success Threshold:**
- >20% of users use non-status grouping
- Task success rate >90% with topic grouping
- Satisfaction score >4/5

**Timebox:** 3 weeks

**Rollback:** Remove grouping toggle, default to status

---

### Experiment 3: Keyboard Drag/Drop

**Hypothesis:** Keyboard users want full drag/drop support

**Change:** Enhanced keyboard navigation (Arrow keys for moves)

**Metric:**
- Usage: % of users who use keyboard drag/drop
- Task success: Success rate for keyboard moves
- Accessibility: Keyboard coverage score

**Success Threshold:**
- >10% of users use keyboard drag/drop
- Task success rate >95%
- Keyboard coverage = 100%

**Timebox:** 2 weeks

**Rollback:** Revert to basic KeyboardSensor

---

### Experiment 4: Saved Views

**Hypothesis:** Users want to save and share filter/sort combinations

**Change:** Add saved views feature

**Metric:**
- Usage: % of users who create saved views
- Retention: % of users who use saved views repeatedly
- Sharing: % of saved views that are shared (via URL)

**Success Threshold:**
- >40% of users create at least one saved view
- >60% of saved views are used more than once
- >10% of saved views are shared

**Timebox:** 4 weeks

**Rollback:** Remove saved views, keep URL params

---

### Experiment 5: Optimistic Updates

**Hypothesis:** Optimistic updates make drag/drop feel faster

**Change:** Implement optimistic updates with rollback

**Metric:**
- Perceived latency: User-reported drag latency
- Error rate: % of updates that fail (require rollback)
- Satisfaction: User feedback

**Success Threshold:**
- Perceived latency <100ms (vs 200ms baseline)
- Error rate <1%
- Satisfaction score >4.5/5

**Timebox:** 2 weeks

**Rollback:** Disable optimistic updates, wait for server response

---

### Experiment 6: Table vs Card List

**Hypothesis:** Table layout is better for scanning large lists

**Change:** Replace card-based list with Table component

**Metric:**
- Task time: Time to find event in list
- Satisfaction: User feedback
- Usage: % of users who prefer table vs cards

**Success Threshold:**
- Task time reduced by >30%
- Satisfaction score >4/5
- >70% of users prefer table

**Timebox:** 3 weeks

**Rollback:** Revert to card-based list

---

## Prioritized Roadmap

### 0-2 Weeks (Quick Wins)

#### Visual Alignment
- **Goal:** Fix visual inconsistencies, align with design system
- **Proposed Action:**
  - Replace hardcoded colors with design tokens
  - Standardize spacing/typography/radii/shadows
  - Install shadcn/ui components (Select, Table, Skeleton, Dialog)
  - Replace native select with shadcn/ui Select
  - Improve empty states and microcopy
- **Effort:** S (Small - 3-5 days)
- **Dependencies:** None
- **Expected Impact:**
  - Usability: +15% (clearer UI, better empty states)
  - Consistency: +50% (100% token usage)
  - Brand: +30% (aligned with design system)

#### Table Component for List View
- **Goal:** Replace card-based list with proper Table
- **Proposed Action:**
  - Install shadcn/ui Table component
  - Build table structure with columns (Title, Date, Topics, Status, Actions)
  - Add sticky header, sortable columns
  - Keep row expansion for details
- **Effort:** M (Medium - 5-7 days)
- **Dependencies:** shadcn/ui Table component
- **Expected Impact:**
  - Usability: +25% (better scanning, more info visible)
  - Performance: +10% (table is more efficient than cards)
  - Consistency: +20% (uses shadcn/ui primitive)

---

### 2-6 Weeks (Core Improvements)

#### Kanban Interaction Hardening
- **Goal:** Make drag/drop reliable, fast, keyboard-accessible
- **Proposed Action:**
  - Implement optimistic updates with rollback
  - Add debounced sync
  - Improve collision detection and visual feedback
  - Enhance keyboard navigation with ARIA announcements
  - Add autoscroll
- **Effort:** L (Large - 10-14 days)
- **Dependencies:** Toast library (if not available)
- **Expected Impact:**
  - Usability: +30% (smooth drag/drop, keyboard support)
  - Performance: +20% (optimistic updates reduce perceived latency)
  - Accessibility: +40% (full keyboard support, ARIA)

#### List View Enhancements
- **Goal:** Add filtering, sorting, density controls
- **Proposed Action:**
  - Add multi-filter (status, topics, date range, search)
  - Add density toggle (comfortable/compact)
  - Add column customization (show/hide, resize, reorder)
  - Add row expansion
- **Effort:** L (Large - 10-14 days)
- **Dependencies:** shadcn/ui Popover, DatePicker (if needed)
- **Expected Impact:**
  - Usability: +35% (better filtering, customization)
  - Performance: +5% (density controls reduce render)
  - Consistency: +15% (uses shadcn/ui primitives)

---

### 6-10 Weeks (Advanced Features)

#### Virtualization
- **Goal:** Handle large boards/lists without performance degradation
- **Proposed Action:**
  - Add react-window for table rows (>50 items)
  - Add react-window for Kanban cards (>20 per column)
  - Implement sticky headers
  - Add loading states for virtualized content
- **Effort:** M (Medium - 7-10 days)
- **Dependencies:** react-window (already in dependencies)
- **Expected Impact:**
  - Performance: +50% (60 FPS with 100+ items)
  - Scalability: +100% (handles 500+ items)

#### Saved Views & URL Params
- **Goal:** Allow users to save and share filter/sort combinations
- **Proposed Action:**
  - Create `user_saved_views` table
  - Build API routes (GET/POST/PATCH/DELETE)
  - Add UI for saving/loading views
  - Add URL params for sharing
  - Parse URL params on load
- **Effort:** L (Large - 12-15 days)
- **Dependencies:** Database migration, API routes
- **Expected Impact:**
  - Usability: +25% (saved views, shareable URLs)
  - Retention: +15% (users return to saved views)

#### Performance Optimization
- **Goal:** Optimize rendering and API calls
- **Proposed Action:**
  - Add memoization for filtered/sorted lists
  - Implement local cache (stale-while-revalidate)
  - Add pagination or infinite scroll for large boards
  - Optimize API payloads (field selection)
- **Effort:** M (Medium - 7-10 days)
- **Dependencies:** React Query or SWR (or custom hook)
- **Expected Impact:**
  - Performance: +30% (faster loads, smoother interactions)
  - Scalability: +50% (handles larger datasets)

---

## Constraints & Principles

### No Code Changes in This Run

- This document is a plan only
- No implementation will be done in this session
- All recommendations are for future implementation

### Favor Alignment with Existing Tokens and shadcn/ui Primitives

- Use design tokens from `globals.css` (not hardcoded values)
- Use shadcn/ui components (Card, Table, Select, Dialog, etc.)
- Extend shadcn/ui components if needed (don't create from scratch)

### Prefer Low-Risk, High-Leverage Steps First

**Priority Order:**
1. Visual cohesion (tokens, spacing, typography) - Low risk, high impact
2. Table clarity (List view improvements) - Low risk, high impact
3. Drag/drop stability (optimistic updates, keyboard) - Medium risk, high impact
4. Advanced features (virtualization, saved views) - Higher risk, medium impact

### Each Recommendation Must Map to at Least One Success Metric

- All recommendations include success criteria
- Metrics are measurable (task success rate, latency, error rate, etc.)
- Metrics are tracked and reported

### Maintain Existing Data Structures

- Don't change `user_event_board` table schema (unless explicitly needed)
- Don't change API contracts (maintain backward compatibility)
- Add new tables/fields only if necessary (e.g., `user_saved_views`)

### Accessibility First

- All features must be keyboard accessible
- All features must have ARIA labels
- All features must respect `prefers-reduced-motion`
- Test with screen readers

### Performance Budget

- TTI: <2s
- Drag latency: <100ms
- Scroll FPS: 60 FPS
- API response: <500ms

---

## Acceptance Criteria

### Report Completeness

✅ **Concrete File/Module/Component Names:**
- Files identified: `EventBoardKanban.tsx`, `EventBoardList.tsx`, `EventBoardCard.tsx`, `EventsBoardPage.tsx`
- Modules: `@dnd-kit/core`, `@dnd-kit/sortable`, `react-window`, shadcn/ui components
- Components: Card, Table, Select, Dialog, Skeleton, Badge, Button

✅ **Clear IA, Interaction Rules, Design Tokens:**
- IA: Entities defined (Event, Column, Card, Tag, etc.)
- Interaction rules: Drag/drop logic, keyboard navigation, persistence strategy
- Design tokens: Colors, spacing, typography, shadows, radii documented

✅ **Measurable Success Criteria:**
- Metrics: Task success rate, latency, error rate, CLS, keyboard coverage, Lighthouse scores
- Targets: Specific numbers (95% success, <100ms latency, etc.)

✅ **Phased Migration:**
- Phases: P1 (Visual), P2 (Interactions), P3 (Advanced)
- Timeline: 0-2 weeks, 2-6 weeks, 6-10 weeks
- Rollout: Gradual deployment with feature flags

---

## Conclusion

This plan provides a comprehensive roadmap for upgrading the Kanban and List views from their current state to a production-ready, brand-consistent, accessible, and performant experience. The phased approach prioritizes quick wins (visual alignment, table improvements) before deeper refactors (drag/drop hardening, virtualization, saved views), ensuring measurable improvements at each stage while maintaining low risk and high leverage.

Key priorities:
1. **Visual consistency** (P1) - Align with design system, use tokens, improve empty states
2. **Interaction reliability** (P2) - Optimistic updates, keyboard support, better feedback
3. **Advanced features** (P3) - Virtualization, saved views, performance optimization

All recommendations include concrete implementation details, success metrics, and rollback strategies, ensuring a smooth and measurable upgrade process.

