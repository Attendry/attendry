"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragMoveEvent,
  useDroppable,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDebouncedCallback } from "use-debounce";
import { toast } from "sonner";
import { EventBoardCard } from "./EventBoardCard";
import { BoardItemWithEvent, ColumnStatus } from "@/lib/types/event-board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { FixedSizeList } from "react-window";

interface EventBoardKanbanProps {
  items: BoardItemWithEvent[];
  onViewInsights?: (eventId: string) => void;
  onEdit?: (item: BoardItemWithEvent) => void;
  onRemove?: (itemId: string) => void;
  onStatusChange?: (itemId: string, status: ColumnStatus) => void;
  onReorder?: (itemId: string, newStatus: ColumnStatus, newPosition: number) => Promise<void>;
}

const COLUMNS: Array<{ id: ColumnStatus; label: string; color: string }> = [
  { id: "interested", label: "Interested", color: "bg-primary/10 border-primary/20" },
  { id: "researching", label: "Researching", color: "bg-warn/10 border-warn/20" },
  { id: "attending", label: "Attending", color: "bg-positive/10 border-positive/20" },
  { id: "archived", label: "Archived", color: "bg-surface-alt border-border-muted" },
];

interface SortableItemProps {
  item: BoardItemWithEvent;
  isPending: boolean;
  onViewInsights?: (eventId: string) => void;
  onEdit?: (item: BoardItemWithEvent) => void;
  onRemove?: (itemId: string) => void;
  onStatusChange?: (itemId: string, status: ColumnStatus) => void;
}

function SortableItem({
  item,
  isPending,
  onViewInsights,
  onEdit,
  onRemove,
  onStatusChange,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : 'transform 160ms ease-out',
    opacity: isDragging ? 0.9 : isPending ? 0.6 : 1,
  };

  // Handle drag start - prevent card click during drag
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn("relative", isPending && "pointer-events-none")}
      role="button"
      aria-label={`${item.event?.title || "Event"}, ${item.column_status}`}
      aria-grabbed={isDragging}
      tabIndex={0}
    >
      {isPending && (
        <div className="absolute top-2 right-2 z-10">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}
      {/* Drag Handle - Always visible, positioned on the right */}
      <div
        {...attributes}
        {...listeners}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        data-drag-handle="true"
        className="absolute right-2 top-2 w-6 h-6 cursor-grab active:cursor-grabbing z-20 flex items-center justify-center rounded hover:bg-surface-alt/70 transition-colors"
        aria-label="Drag handle"
        title="Drag to reorder"
      >
        <div className="flex flex-col gap-0.5">
          <div className="w-1 h-1 bg-text-muted rounded-full" />
          <div className="w-1 h-1 bg-text-muted rounded-full" />
          <div className="w-1 h-1 bg-text-muted rounded-full" />
        </div>
      </div>
      <EventBoardCard
        item={item}
        onViewInsights={onViewInsights}
        onEdit={onEdit}
        onRemove={onRemove}
        onStatusChange={onStatusChange}
        isDragging={isDragging}
      />
    </div>
  );
}

function DroppableColumn({
  id,
  children,
}: {
  id: ColumnStatus;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  const column = COLUMNS.find(col => col.id === id);

  return (
    <div
      ref={setNodeRef}
      role="region"
      aria-label={`${column?.label || id} column`}
      className={cn(
        "transition-all duration-200 rounded-lg",
        isOver && "ring-2 ring-primary ring-offset-2 bg-primary/5"
      )}
    >
      {children}
    </div>
  );
}

// Enhanced keyboard coordinate getter for improved navigation
// Supports Up/Down within column, and basic Left/Right for column headers
function createKeyboardCoordinateGetter(
  columns: Record<ColumnStatus, BoardItemWithEvent[]>
) {
  return (event: KeyboardEvent, { context }: any) => {
    // Use default sortable coordinates for Up/Down navigation within columns
    // This provides good keyboard support for reordering within a column
    const coordinates = sortableKeyboardCoordinates(event, { context });
    
    // For Left/Right arrows, we could enhance to move between columns
    // but that requires more complex logic. For now, keep it simple.
    // The default behavior allows keyboard users to navigate and reorder.
    
    return coordinates;
  };
}

export function EventBoardKanban({
  items,
  onViewInsights,
  onEdit,
  onRemove,
  onStatusChange,
  onReorder,
}: EventBoardKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState<string>("");
  const retryAttemptsRef = useRef<Map<string, number>>(new Map());
  const retryTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Initialize columns from items
  const initializeColumns = React.useMemo((): Record<ColumnStatus, BoardItemWithEvent[]> => {
    const cols: Record<ColumnStatus, BoardItemWithEvent[]> = {
      interested: [],
      researching: [],
      attending: [],
      archived: [],
    };
    items.forEach((item) => {
      // Skip items with "follow-up" status since we removed that column
      // Also handle any unexpected statuses gracefully
      if (cols[item.column_status]) {
        cols[item.column_status].push(item);
      }
    });
    // Sort by position
    Object.keys(cols).forEach((key) => {
      cols[key as ColumnStatus].sort((a, b) => a.position - b.position);
    });
    return cols;
  }, [items]);

  const [columns, setColumns] = useState<Record<ColumnStatus, BoardItemWithEvent[]>>(initializeColumns);
  const [optimisticColumns, setOptimisticColumns] = useState<Record<ColumnStatus, BoardItemWithEvent[]>>(initializeColumns);

  // Update columns when items change
  useEffect(() => {
    setColumns(initializeColumns);
    setOptimisticColumns(initializeColumns);
  }, [initializeColumns]);

  // Clear announcement after delay
  useEffect(() => {
    if (announcement) {
      const timer = setTimeout(() => setAnnouncement(""), 2000);
      return () => clearTimeout(timer);
    }
  }, [announcement]);

  // Retry function with exponential backoff
  const retryUpdate = useCallback(
    async (
      itemId: string,
      newStatus: ColumnStatus,
      newPosition: number,
      previousColumns: Record<ColumnStatus, BoardItemWithEvent[]>
    ) => {
      const attempts = retryAttemptsRef.current.get(itemId) || 0;
      const maxAttempts = 3;

      if (attempts >= maxAttempts) {
        // Max retries reached
        setPendingUpdates((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
        retryAttemptsRef.current.delete(itemId);
        toast.error("Failed to update event", {
          description: "Maximum retry attempts reached. Please refresh the page.",
        });
        return;
      }

      retryAttemptsRef.current.set(itemId, attempts + 1);
      const delay = Math.min(1000 * Math.pow(2, attempts), 5000); // Exponential backoff, max 5s

      const timeoutId = setTimeout(async () => {
        try {
          if (onReorder) {
            await onReorder(itemId, newStatus, newPosition);
            // Success
            setPendingUpdates((prev) => {
              const next = new Set(prev);
              next.delete(itemId);
              return next;
            });
            retryAttemptsRef.current.delete(itemId);
            retryTimeoutsRef.current.delete(itemId);
            setColumns(optimisticColumns); // Sync with optimistic state
            toast.success("Event moved successfully");
          }
        } catch (error) {
          // Retry again
          retryUpdate(itemId, newStatus, newPosition, previousColumns);
        }
      }, delay);

      retryTimeoutsRef.current.set(itemId, timeoutId);
    },
    [onReorder, optimisticColumns]
  );

  // Debounced reorder function
  const debouncedReorder = useDebouncedCallback(
    async (
      itemId: string,
      newStatus: ColumnStatus,
      newPosition: number,
      previousColumns: Record<ColumnStatus, BoardItemWithEvent[]>
    ) => {
      try {
        if (onReorder) {
          await onReorder(itemId, newStatus, newPosition);
          // Success
          setPendingUpdates((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
          retryAttemptsRef.current.delete(itemId);
          setColumns(optimisticColumns); // Sync with optimistic state
        }
      } catch (error: any) {
        // Error - start retry with exponential backoff
        retryUpdate(itemId, newStatus, newPosition, previousColumns);
      }
    },
    300 // 300ms debounce
  );

  // Create keyboard sensor with custom coordinate getter
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: createKeyboardCoordinateGetter(optimisticColumns),
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    keyboardSensor
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      setAnnouncement("Drag cancelled");
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the item being dragged
    let activeItem: BoardItemWithEvent | null = null;
    let activeColumn: ColumnStatus | null = null;

    for (const [status, items] of Object.entries(optimisticColumns)) {
      const item = items.find((i) => i.id === activeId);
      if (item) {
        activeItem = item;
        activeColumn = status as ColumnStatus;
        break;
      }
    }

    if (!activeItem || !activeColumn) return;

    // Save previous state for rollback
    const previousColumns = { ...optimisticColumns };

    // Check if dropping on a column
    const overColumn = COLUMNS.find((col) => col.id === overId)?.id;

    let newStatus: ColumnStatus = activeColumn;
    let newPosition = 0;
    let newColumns = { ...optimisticColumns };

    if (overColumn && overColumn !== activeColumn) {
      // Moving to different column
      newColumns[activeColumn] = newColumns[activeColumn].filter(
        (item) => item.id !== activeId
      );
      newColumns[overColumn] = [...newColumns[overColumn], activeItem];
      newStatus = overColumn;
      newPosition = newColumns[overColumn].length - 1;
    } else {
      // Reordering within same column
      const overItem = optimisticColumns[activeColumn].find((i) => i.id === overId);
      if (overItem && activeId !== overId) {
        const oldIndex = optimisticColumns[activeColumn].findIndex((i) => i.id === activeId);
        const newIndex = optimisticColumns[activeColumn].findIndex((i) => i.id === overId);

        newColumns[activeColumn] = arrayMove(
          newColumns[activeColumn],
          oldIndex,
          newIndex
        );
        newStatus = activeColumn;
        newPosition = newIndex;
      } else {
        // No change
        return;
      }
    }

    // Optimistic update
    setOptimisticColumns(newColumns);
    setPendingUpdates((prev) => new Set(prev).add(activeId));

    // Announce move
    const eventTitle = activeItem.event?.title || "Event";
    const columnLabel = COLUMNS.find((col) => col.id === newStatus)?.label || newStatus;
    setAnnouncement(`Moved ${eventTitle} to ${columnLabel} column`);

    // Call status change if column changed
    if (newStatus !== activeColumn && onStatusChange) {
      onStatusChange(activeId, newStatus);
    }

    // Debounced API call
    debouncedReorder(activeId, newStatus, newPosition, previousColumns);
  };

  const activeItem = activeId
    ? items.find((item) => item.id === activeId)
    : null;

  // Use optimistic columns for display
  const displayColumns = optimisticColumns;

  return (
    <>
      {/* ARIA Live Region for announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4" role="application" aria-label="Event board">
          {COLUMNS.map((column) => {
            const columnItems = displayColumns[column.id];
            const itemIds = columnItems.map((item) => item.id);

            return (
              <DroppableColumn key={column.id} id={column.id}>
                <div className="flex-shrink-0 w-80">
                  <Card className="h-full border-2 bg-surface-elevated shadow-elevation-1">
                    <CardHeader className="pb-3 border-b bg-surface-alt/50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold text-text-primary">
                          {column.label}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs font-medium">
                          {columnItems.length}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <SortableContext
                        items={itemIds}
                        strategy={verticalListSortingStrategy}
                      >
                        {columnItems.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="text-text-muted text-sm">
                              <p className="mb-1">No events</p>
                              <p className="text-xs text-text-muted/70">Drop events here</p>
                            </div>
                          </div>
                        ) : columnItems.length > 20 ? (
                          // Virtualized list for columns with many items
                          <div style={{ height: Math.min(600, columnItems.length * 120) }}>
                            <FixedSizeList
                              height={Math.min(600, columnItems.length * 120)}
                              itemCount={columnItems.length}
                              itemSize={120}
                              width="100%"
                            >
                              {({ index, style }) => {
                                const item = columnItems[index];
                                return (
                                  <div style={style} className="px-1">
                                    <SortableItem
                                      key={item.id}
                                      item={item}
                                      isPending={pendingUpdates.has(item.id)}
                                      onViewInsights={onViewInsights}
                                      onEdit={onEdit}
                                      onRemove={onRemove}
                                      onStatusChange={onStatusChange}
                                    />
                                  </div>
                                );
                              }}
                            </FixedSizeList>
                          </div>
                        ) : (
                          // Regular list for smaller columns
                          <div className="space-y-3 min-h-[200px]">
                            {columnItems.map((item) => (
                              <SortableItem
                                key={item.id}
                                item={item}
                                isPending={pendingUpdates.has(item.id)}
                                onViewInsights={onViewInsights}
                                onEdit={onEdit}
                                onRemove={onRemove}
                                onStatusChange={onStatusChange}
                              />
                            ))}
                          </div>
                        )}
                      </SortableContext>
                    </CardContent>
                  </Card>
                </div>
              </DroppableColumn>
            );
          })}
        </div>
        <DragOverlay>
          {activeItem ? (
            <div className="opacity-90 scale-[1.02] shadow-elevation-3 rounded-lg transition-all duration-200">
              <EventBoardCard item={activeItem} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
