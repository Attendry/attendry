# Color Palette Migration: gray- → slate-

## Status: IN PROGRESS

This document tracks the migration from `gray-` to `slate-` color classes across the codebase.

## Completed Files ✅

### Core Components
- ✅ `src/components/States/EmptyState.tsx`
- ✅ `src/components/States/LoadingState.tsx`
- ✅ `src/components/LoadingStates.tsx`
- ✅ `src/app/(protected)/search/page.tsx`
- ✅ `src/components/adaptive/modules/SearchModule.tsx`
- ✅ `src/components/adaptive/modules/MarketIntelligenceModule.tsx`

### Configuration
- ✅ `src/app/globals.css` - Primary color updated to `hsl(217, 78%, 48%)`

## Remaining Files (Estimated)

Based on grep results:
- **Components**: ~50 files with gray- classes
- **App pages**: ~24 files with gray- classes
- **Total instances**: ~1490 matches

## Migration Strategy

### Phase 1: Critical User-Facing Components ✅
- Empty states
- Loading states
- Search pages
- Main modules

### Phase 2: Adaptive Components (In Progress)
- Premium search modules
- Other adaptive modules
- Topbar/Sidebar components

### Phase 3: Admin & Internal Components
- Admin dashboards
- Analytics
- System health monitors

### Phase 4: Remaining Pages
- All app pages
- Design pages
- Other routes

## Replacement Patterns

Use these patterns for bulk replacement:

```bash
# Text colors
text-gray- → text-slate-

# Background colors
bg-gray- → bg-slate-

# Border colors
border-gray- → border-slate-

# Hover states
hover:bg-gray- → hover:bg-slate-
hover:text-gray- → hover:text-slate-
hover:border-gray- → hover:border-slate-
```

## Notes

- Dark mode classes (`dark:text-gray-`, `dark:bg-gray-`) should also be updated
- Some components may intentionally use gray for semantic meaning (e.g., disabled states)
- Premium design system components may use custom color values that don't need migration

## Testing

After migration:
- [ ] Visual regression testing
- [ ] Dark mode testing
- [ ] Accessibility contrast checks
- [ ] Component functionality tests

