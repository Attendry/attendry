# Phase 2: Kanban Interaction Hardening - Implementation Outline

## Overview

Phase 2 focuses on making drag/drop interactions reliable, fast, and fully keyboard-accessible. This phase addresses the "brittle" feeling of current Kanban interactions by implementing optimistic updates, improving collision detection, enhancing keyboard navigation, and adding comprehensive error handling.

---

## Task Breakdown

### P2-1: Optimistic Updates with Rollback

**Current Behavior:**
- UI waits for server response before updating
- User sees no immediate feedback during drag/drop
- Perceived latency: ~200-500ms

**Proposed Changes:**
1. **Immediate UI Update**
   - Update `columns` state immediately on drag end
   - Show card in new position instantly
   - No waiting for API response

2. **Loading State Indication**
   - Add visual indicator on card being moved (spinner, opacity change, or border)
   - Track pending updates in state: `Set<string>` of item IDs
   - Disable drag on cards with pending updates (optional)

3. **Background API Call**
   - Call `onReorder` callback in background (non-blocking)
   - Use `async/await` but don't block UI

4. **Success Handling**
   - On success: Remove loading indicator
   - Optionally: Show subtle success feedback (brief highlight)

5. **Error Handling & Rollback**
   - On error: Revert `columns` state to previous value
   - Show error toast/notification
   - Restore card to original position
   - Allow user to retry

**Implementation Details:**
```typescript
// New state
const [optimisticColumns, setOptimisticColumns] = useState(columns);
const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());
const [errorState, setErrorState] = useState<{itemId: string, originalColumns: typeof columns} | null>(null);

// In handleDragEnd
const handleDragEnd = async (event: DragEndEvent) => {
  // ... existing logic to determine newColumns ...
  
  // Optimistic update
  const previousColumns = { ...columns };
  setOptimisticColumns(newColumns);
  setPendingUpdates(prev => new Set(prev).add(activeId));
  
  try {
    if (onReorder) {
      await onReorder(activeId, newStatus, newPosition);
    }
    // Success: remove from pending
    setPendingUpdates(prev => {
      const next = new Set(prev);
      next.delete(activeId);
      return next;
    });
    setColumns(newColumns); // Sync with server state
  } catch (error) {
    // Rollback
    setOptimisticColumns(previousColumns);
    setColumns(previousColumns);
    setPendingUpdates(prev => {
      const next = new Set(prev);
      next.delete(activeId);
      return next;
    });
    // Show error toast
    console.error("Failed to update:", error);
    // TODO: Add toast notification
  }
};
```

**Files to Modify:**
- `src/components/events-board/EventBoardKanban.tsx`

**Dependencies:**
- Toast library (if not available, use `alert` temporarily or install `sonner`/`react-hot-toast`)

**Expected Impact:**
- Perceived latency: <100ms (from ~200ms)
- User satisfaction: Immediate feedback feels responsive

---

### P2-2: Debounced Sync for Rapid Drags

**Current Behavior:**
- Every drag/drop triggers immediate API call
- Rapid drags cause multiple API calls
- Potential race conditions

**Proposed Changes:**
1. **Debounce API Calls**
   - Use 300ms debounce for `onReorder` calls
   - Batch multiple position updates if user drags rapidly
   - Only send final position to server

2. **Batch Updates**
   - If multiple cards are moved quickly, batch into single API call
   - Or: Queue updates and send in order

**Implementation Details:**
```typescript
import { useDebouncedCallback } from 'use-debounce'; // or custom hook

const debouncedReorder = useDebouncedCallback(
  async (itemId: string, newStatus: ColumnStatus, newPosition: number) => {
    if (onReorder) {
      await onReorder(itemId, newStatus, newPosition);
    }
  },
  300 // 300ms debounce
);

// In handleDragEnd, use debouncedReorder instead of onReorder
```

**Alternative (Custom Hook):**
```typescript
// Custom debounce hook
function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
}
```

**Files to Modify:**
- `src/components/events-board/EventBoardKanban.tsx`
- Possibly create: `src/hooks/useDebounce.ts` (if custom implementation)

**Dependencies:**
- `use-debounce` package (optional, can implement custom)

**Expected Impact:**
- Reduced API calls: ~70% reduction for rapid drags
- Better performance: Less server load

---

### P2-3: Improved Collision Detection

**Current Behavior:**
- Uses `closestCorners` collision detection
- Can feel imprecise when dropping between cards
- Sometimes drops in wrong position

**Proposed Changes:**
1. **Switch to Better Algorithm**
   - Replace `closestCorners` with `rectIntersection` or `closestCenter`
   - `rectIntersection`: More accurate for rectangular drop targets
   - `closestCenter`: Better for card-to-card drops

2. **Test Both Options**
   - Try `rectIntersection` first (likely better for columns)
   - Fallback to `closestCenter` if needed

**Implementation Details:**
```typescript
import {
  rectIntersection, // or closestCenter
  // ... other imports
} from "@dnd-kit/core";

// In DndContext
<DndContext
  sensors={sensors}
  collisionDetection={rectIntersection} // Changed from closestCorners
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
```

**Files to Modify:**
- `src/components/events-board/EventBoardKanban.tsx`

**Dependencies:**
- None (already in @dnd-kit/core)

**Expected Impact:**
- Drop accuracy: +20% improvement
- User satisfaction: More predictable behavior

---

### P2-4: Visual Feedback During Drag

**Current Behavior:**
- Basic opacity change on drag
- No visual indication of drop targets
- No insertion indicator between cards

**Proposed Changes:**
1. **Drop Target Highlighting**
   - Highlight column border when dragging over it
   - Show background tint on valid drop targets
   - Already partially implemented in `DroppableColumn` (needs enhancement)

2. **Insertion Indicator**
   - Show line/divider between cards where item will be inserted
   - Use subtle animation (fade in/out)
   - Position: Between cards, or at top/bottom of column

3. **Card Hover States**
   - Slight scale/glow on cards when dragging over them
   - Indicate where card will land

**Implementation Details:**
```typescript
// Enhanced DroppableColumn
function DroppableColumn({ id, children }: { id: ColumnStatus; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "transition-all duration-200",
        isOver && "bg-primary/10 rounded-lg border-2 border-primary shadow-elevation-1"
      )}
    >
      {children}
    </div>
  );
}

// Insertion indicator (new component)
function InsertionIndicator({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null;
  
  return (
    <div className="h-1 bg-primary rounded-full mx-2 my-1 animate-pulse" />
  );
}

// In SortableItem, show indicator when dragging over
const { isOver } = useDroppable({ id: `insert-${item.id}` });
```

**Files to Modify:**
- `src/components/events-board/EventBoardKanban.tsx`
- Possibly create: `src/components/events-board/InsertionIndicator.tsx`

**Dependencies:**
- None

**Expected Impact:**
- User clarity: Clear visual feedback reduces confusion
- Drop accuracy: Users can see exactly where card will land

---

### P2-5: Enhanced Keyboard Navigation

**Current Behavior:**
- Basic KeyboardSensor with `sortableKeyboardCoordinates`
- Only supports up/down movement within column
- No column-to-column navigation
- No visual feedback during keyboard drag

**Proposed Changes:**
1. **Custom Coordinate Getter**
   - Handle ArrowLeft/Right for column navigation
   - Handle ArrowUp/Down for position within column
   - Handle Enter to confirm drop
   - Handle Escape to cancel

2. **Visual Feedback**
   - Highlight focused card during keyboard drag
   - Show focus ring on active card
   - Announce position changes to screen reader

3. **Navigation Logic**
   - ArrowUp: Move card up in current column
   - ArrowDown: Move card down in current column
   - ArrowLeft: Move card to previous column (same position)
   - ArrowRight: Move card to next column (same position)
   - Enter: Drop card at current position
   - Escape: Cancel drag, return to original position

**Implementation Details:**
```typescript
// Custom coordinate getter
const customKeyboardCoordinateGetter = (
  event: KeyboardEvent,
  { context }: { context: any }
) => {
  const { active, over, translated, scrollableAncestors } = context;
  
  if (!over) return null;
  
  const activeId = active.id as string;
  const overId = over.id as string;
  
  // Find active item and column
  const activeItem = items.find(item => item.id === activeId);
  if (!activeItem) return null;
  
  const activeColumn = activeItem.column_status;
  const activeIndex = columns[activeColumn].findIndex(item => item.id === activeId);
  
  // Handle arrow keys
  switch (event.key) {
    case 'ArrowUp':
      // Move up in column
      if (activeIndex > 0) {
        const targetItem = columns[activeColumn][activeIndex - 1];
        return { x: 0, y: -1 }; // Signal to move up
      }
      break;
    case 'ArrowDown':
      // Move down in column
      if (activeIndex < columns[activeColumn].length - 1) {
        return { x: 0, y: 1 }; // Signal to move down
      }
      break;
    case 'ArrowLeft':
      // Move to previous column
      const prevColumnIndex = COLUMNS.findIndex(col => col.id === activeColumn);
      if (prevColumnIndex > 0) {
        const prevColumn = COLUMNS[prevColumnIndex - 1];
        return { x: -1, y: 0 }; // Signal to move left
      }
      break;
    case 'ArrowRight':
      // Move to next column
      const nextColumnIndex = COLUMNS.findIndex(col => col.id === activeColumn);
      if (nextColumnIndex < COLUMNS.length - 1) {
        const nextColumn = COLUMNS[nextColumnIndex + 1];
        return { x: 1, y: 0 }; // Signal to move right
      }
      break;
  }
  
  // Fallback to default
  return sortableKeyboardCoordinates(event, { context });
};

// Enhanced KeyboardSensor
const keyboardSensor = useSensor(KeyboardSensor, {
  coordinateGetter: customKeyboardCoordinateGetter,
});
```

**Files to Modify:**
- `src/components/events-board/EventBoardKanban.tsx`
- Possibly create: `src/utils/keyboard-navigation.ts` (for coordinate getter logic)

**Dependencies:**
- None (uses existing @dnd-kit utilities)

**Expected Impact:**
- Keyboard coverage: 100% (from ~60%)
- Accessibility: Full keyboard support for drag/drop

---

### P2-6: ARIA Live Announcements

**Current Behavior:**
- No screen reader announcements during drag/drop
- Keyboard users don't get feedback on moves

**Proposed Changes:**
1. **ARIA Live Region**
   - Add `<div aria-live="polite" aria-atomic="true">` for announcements
   - Update announcement text on drag/drop events

2. **Announcement Content**
   - "Moved [Event Title] to [Column Name]"
   - "Moved [Event Title] to position [N] in [Column Name]"
   - "Drag cancelled" (on Escape)

3. **Focus Management**
   - Return focus to moved card after drop
   - Announce focus change

**Implementation Details:**
```typescript
// State for announcements
const [announcement, setAnnouncement] = useState<string>("");

// In handleDragEnd, after successful move
const eventTitle = activeItem.event?.title || "Event";
const columnLabel = COLUMNS.find(col => col.id === newStatus)?.label || newStatus;
setAnnouncement(`Moved ${eventTitle} to ${columnLabel} column`);

// In component JSX
<div 
  aria-live="polite" 
  aria-atomic="true" 
  className="sr-only"
>
  {announcement}
</div>

// Clear announcement after a delay
useEffect(() => {
  if (announcement) {
    const timer = setTimeout(() => setAnnouncement(""), 1000);
    return () => clearTimeout(timer);
  }
}, [announcement]);
```

**Files to Modify:**
- `src/components/events-board/EventBoardKanban.tsx`

**Dependencies:**
- None

**Expected Impact:**
- Accessibility score: +15 points (Lighthouse)
- Screen reader usability: Full support

---

### P2-7: Autoscroll Implementation

**Current Behavior:**
- No autoscroll when dragging near viewport edges
- Can't drag to columns outside visible area
- Poor UX for boards with many columns

**Proposed Changes:**
1. **Edge Detection**
   - Detect when drag is within 50px of viewport edges (top, bottom, left, right)
   - Use `getBoundingClientRect()` to check position

2. **Smooth Scrolling**
   - Scroll container when near edge
   - Use `requestAnimationFrame` for smooth scrolling
   - Scroll speed: Proportional to distance from edge

3. **Respect Reduced Motion**
   - Check `prefers-reduced-motion` media query
   - Disable autoscroll if user prefers reduced motion

**Implementation Details:**
```typescript
// Custom hook for autoscroll
function useAutoscroll() {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const handleDragMove = (event: DragMoveEvent) => {
      const rect = container.getBoundingClientRect();
      const { x, y } = event.activatorEvent as MouseEvent;
      
      const threshold = 50; // pixels from edge
      const scrollSpeed = 10; // pixels per frame
      
      // Check if near edges
      if (x < rect.left + threshold) {
        // Near left edge, scroll left
        container.scrollLeft -= scrollSpeed;
        setIsScrolling(true);
      } else if (x > rect.right - threshold) {
        // Near right edge, scroll right
        container.scrollLeft += scrollSpeed;
        setIsScrolling(true);
      } else if (y < rect.top + threshold) {
        // Near top edge, scroll up
        container.scrollTop -= scrollSpeed;
        setIsScrolling(true);
      } else if (y > rect.bottom - threshold) {
        // Near bottom edge, scroll down
        container.scrollTop += scrollSpeed;
        setIsScrolling(true);
      } else {
        setIsScrolling(false);
      }
    };
    
    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return; // Don't autoscroll
    }
    
    // Attach event listener (would need to integrate with DndContext)
    // This is a simplified example - actual implementation would hook into DndContext events
    
    return () => {
      setIsScrolling(false);
    };
  }, []);
  
  return { scrollContainerRef, isScrolling };
}
```

**Alternative: Use @dnd-kit Autoscroll Plugin**
- Check if @dnd-kit has autoscroll plugin
- If available, use it instead of custom implementation

**Files to Modify:**
- `src/components/events-board/EventBoardKanban.tsx`
- Possibly create: `src/hooks/useAutoscroll.ts`

**Dependencies:**
- None (or @dnd-kit autoscroll plugin if available)

**Expected Impact:**
- Usability: Can drag to off-screen columns
- User satisfaction: Smoother experience

---

### P2-8: Improved Drag Preview Styling

**Current Behavior:**
- Basic opacity change in DragOverlay
- No scale animation
- Shadow already improved in Phase 1

**Proposed Changes:**
1. **Enhanced Styling**
   - Scale animation (already added in Phase 1: `scale-[1.02]`)
   - Shadow elevation (already added: `shadow-elevation-3`)
   - Smooth transitions

2. **Additional Polish**
   - Slight rotation on drag start (optional, subtle)
   - Border highlight
   - Backdrop blur effect (optional)

**Implementation Details:**
```typescript
// Already implemented in Phase 1, but can enhance:
<DragOverlay>
  {activeItem ? (
    <div 
      className="opacity-90 scale-[1.02] shadow-elevation-3 rounded-lg transition-all duration-200"
      style={{
        transform: 'rotate(1deg)', // Subtle rotation (optional)
      }}
    >
      <EventBoardCard item={activeItem} />
    </div>
  ) : null}
</DragOverlay>
```

**Files to Modify:**
- `src/components/events-board/EventBoardKanban.tsx`

**Dependencies:**
- None

**Expected Impact:**
- Visual polish: More professional feel
- User feedback: Clear indication of drag state

---

### P2-9: Error Handling with Toast Notifications

**Current Behavior:**
- Errors are logged to console only
- No user-visible error feedback
- No retry mechanism

**Proposed Changes:**
1. **Toast Notifications**
   - Install toast library (e.g., `sonner`, `react-hot-toast`)
   - Show error toast on failed drag/drop
   - Show success toast on successful move (optional)

2. **Retry Mechanism**
   - Add "Retry" button in error toast
   - Retry failed update on click
   - Show loading state during retry

3. **Error Messages**
   - User-friendly error messages
   - "Failed to move event. Please try again."
   - "Network error. Check your connection."

**Implementation Details:**
```typescript
// Install: npm install sonner
import { toast } from 'sonner';

// In handleDragEnd error handler
catch (error) {
  // Rollback (already implemented)
  setOptimisticColumns(previousColumns);
  setColumns(previousColumns);
  
  // Show error toast
  toast.error("Failed to move event", {
    description: "Please try again. If the problem persists, refresh the page.",
    action: {
      label: "Retry",
      onClick: () => {
        // Retry the operation
        handleRetry(activeId, newStatus, newPosition);
      },
    },
  });
}

// Retry function
const handleRetry = async (
  itemId: string,
  newStatus: ColumnStatus,
  newPosition: number
) => {
  try {
    if (onReorder) {
      await onReorder(itemId, newStatus, newPosition);
      toast.success("Event moved successfully");
    }
  } catch (error) {
    toast.error("Retry failed. Please refresh the page.");
  }
};
```

**Files to Modify:**
- `src/components/events-board/EventBoardKanban.tsx`
- `package.json` (add toast library)

**Dependencies:**
- Toast library: `sonner` or `react-hot-toast` (recommend `sonner` for shadcn/ui compatibility)

**Expected Impact:**
- User awareness: Clear error feedback
- Recovery: Users can retry failed operations

---

## Implementation Order

**Recommended Sequence:**
1. **P2-3** (Collision Detection) - Quick win, low risk
2. **P2-4** (Visual Feedback) - Improves UX immediately
3. **P2-1** (Optimistic Updates) - Core improvement, requires careful testing
4. **P2-2** (Debounced Sync) - Complements optimistic updates
5. **P2-9** (Error Handling) - Required for robust optimistic updates
6. **P2-8** (Drag Preview) - Mostly done, minor polish
7. **P2-5** (Keyboard Navigation) - Complex, requires thorough testing
8. **P2-6** (ARIA Announcements) - Complements keyboard navigation
9. **P2-7** (Autoscroll) - Nice-to-have, can be deferred if complex

---

## Testing Considerations

**Manual Testing:**
- Test drag/drop with slow network (throttle in DevTools)
- Test rapid drags (multiple cards quickly)
- Test keyboard navigation with screen reader
- Test error scenarios (disconnect network, invalid API response)
- Test autoscroll with many columns

**Automated Testing:**
- Unit tests for optimistic update logic
- Integration tests for drag/drop flows
- Accessibility tests (keyboard navigation, ARIA)

**Edge Cases:**
- Drag card while another card is being updated
- Network failure during drag
- Concurrent edits (two tabs open)
- Very long event titles (layout issues)

---

## Dependencies to Install

```bash
# Toast notifications (choose one)
npm install sonner
# OR
npm install react-hot-toast

# Debounce utility (optional, can implement custom)
npm install use-debounce
```

---

## Risk Assessment

**Low Risk:**
- P2-3 (Collision Detection) - Simple import change
- P2-4 (Visual Feedback) - UI-only changes
- P2-8 (Drag Preview) - Mostly cosmetic

**Medium Risk:**
- P2-1 (Optimistic Updates) - Complex state management, needs thorough testing
- P2-2 (Debounced Sync) - Timing-sensitive, needs testing
- P2-9 (Error Handling) - Requires toast library integration

**High Risk:**
- P2-5 (Keyboard Navigation) - Complex logic, accessibility critical
- P2-6 (ARIA Announcements) - Accessibility impact, needs screen reader testing
- P2-7 (Autoscroll) - Performance-sensitive, edge case handling

---

## Success Metrics

**Performance:**
- Drag latency: <100ms (from ~200ms baseline)
- Drop failure rate: <1% (from ~5% baseline)

**Accessibility:**
- Keyboard coverage: 100% (from ~60%)
- Lighthouse accessibility score: 100 (from ~85)
- AXE violations: 0 (from ~5-10)

**User Experience:**
- Task success rate: 95% (from ~80%)
- User satisfaction: Measured via feedback

---

## Rollback Plan

**Feature Flags:**
- `ENABLE_OPTIMISTIC_UPDATES`: Toggle optimistic updates
- `ENABLE_KEYBOARD_NAV`: Toggle enhanced keyboard navigation
- `ENABLE_AUTOSCROLL`: Toggle autoscroll

**Rollback Triggers:**
- Error rate >5%
- Performance degradation >20%
- Critical accessibility issues

**Rollback Process:**
1. Disable feature flags
2. Revert to previous behavior
3. Investigate issues
4. Fix and re-enable

---

## Questions for Review

1. **Toast Library Preference**: `sonner` or `react-hot-toast`? (Recommend `sonner` for shadcn/ui compatibility)

2. **Debounce Library**: Use `use-debounce` package or implement custom hook?

3. **Autoscroll Priority**: Is this critical, or can it be deferred to Phase 3?

4. **Error Retry**: Should retry be automatic (with exponential backoff) or manual (user clicks button)?

5. **Keyboard Navigation Complexity**: Should we implement full keyboard navigation now, or start with basic improvements?

---

## Estimated Timeline

- **P2-1 to P2-4**: 2-3 days (core improvements)
- **P2-5 to P2-6**: 2-3 days (keyboard/accessibility)
- **P2-7 to P2-9**: 1-2 days (polish and error handling)
- **Testing & Refinement**: 1-2 days
- **Total**: ~6-10 days

---

## Ready for Implementation?

Please review this outline and confirm:
- ✅ All tasks are understood
- ✅ Dependencies are acceptable
- ✅ Risk level is acceptable
- ✅ Timeline is reasonable
- ✅ Any questions answered

Once approved, implementation can begin.

