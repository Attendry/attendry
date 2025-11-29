# Sidebar Cleanup Recommendation

## Current Issues

### 1. Duplicate Routes
- `/watchlist` appears twice:
  - "Command Centre" → "Contacts" → `/watchlist`
  - "Intelligence" → "My Watchlist" → `/watchlist`
- `/opportunities` appears twice:
  - "Opportunities" → `/opportunities`
  - "Opportunities" → "My Opportunities" → `/opportunities` (same!)
- `/events` appears twice:
  - "Events" → `/events`
  - "Events" → "Speaker Search" → `/events` (same!)

### 2. Confusing Terminology
- "Command Centre" → Should be "Home" or "Dashboard"
- "Intelligence" → Vague, should be "Insights"
- "Reporting" → Should be "Activity" (matches `/activity` route)

### 3. Redundant Children
- Children pointing to same route as parent are unnecessary
- Creates confusion about which to click

### 4. Poor Organization
- No clear grouping (Primary vs Secondary vs System)
- Everything appears equally important

---

## Recommended Structure

### Clean, Non-Duplicative Navigation

```
PRIMARY ACTIONS
├── Home (Dashboard)
├── Opportunities
├── Events
└── Contacts

SECONDARY FEATURES
├── Events Board
├── Insights
└── Activity

SYSTEM
├── Notifications
└── Settings
```

### Route Mapping

| Label | Route | Notes |
|-------|-------|-------|
| Home | `/dashboard` | Renamed from "Command Centre" |
| Opportunities | `/opportunities` | No duplicate child |
| Events | `/events` | No duplicate child |
| Contacts | `/contacts` | Canonical route (not `/watchlist`) |
| Events Board | `/events-board` | Standalone, not child |
| Insights | `/trending` or `/recommendations` | Renamed from "Intelligence" |
| Activity | `/activity` | Renamed from "Reporting" |
| Notifications | `/notifications` | Unchanged |
| Settings | `/settings` | Unchanged |

---

## Implementation Plan

### Phase 1: Simplify Structure
- Remove duplicate children
- Remove children pointing to same route as parent
- Organize into clear sections

### Phase 2: Update Terminology
- "Command Centre" → "Home"
- "Intelligence" → "Insights"
- "Reporting" → "Activity"

### Phase 3: Add Visual Grouping
- Section headers (Primary, Secondary, System)
- Visual separators
- Better spacing

---

## Benefits

1. **No Duplicates** - Each route appears once
2. **Clear Hierarchy** - Primary actions first
3. **Better UX** - Users know where to find things
4. **Less Code** - Simpler structure, less duplication
5. **Consistent** - Matches audit recommendations

