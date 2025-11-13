"use client";

import React, { useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EventBoardCard } from "./EventBoardCard";
import { BoardItemWithEvent, ColumnStatus } from "@/lib/types/event-board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EventBoardKanbanProps {
  items: BoardItemWithEvent[];
  onViewInsights?: (eventId: string) => void;
  onEdit?: (item: BoardItemWithEvent) => void;
  onRemove?: (itemId: string) => void;
  onStatusChange?: (itemId: string, status: ColumnStatus) => void;
  onReorder?: (itemId: string, newStatus: ColumnStatus, newPosition: number) => void;
}

const COLUMNS: Array<{ id: ColumnStatus; label: string; color: string }> = [
  { id: "interested", label: "Interested", color: "bg-blue-50 border-blue-200" },
  { id: "researching", label: "Researching", color: "bg-yellow-50 border-yellow-200" },
  { id: "attending", label: "Attending", color: "bg-green-50 border-green-200" },
  { id: "follow-up", label: "Follow-up", color: "bg-purple-50 border-purple-200" },
  { id: "archived", label: "Archived", color: "bg-gray-50 border-gray-200" },
];

function SortableItem({
  item,
  onViewInsights,
  onEdit,
  onRemove,
  onStatusChange,
}: {
  item: BoardItemWithEvent;
  onViewInsights?: (eventId: string) => void;
  onEdit?: (item: BoardItemWithEvent) => void;
  onRemove?: (itemId: string) => void;
  onStatusChange?: (itemId: string, status: ColumnStatus) => void;
}) {
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
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <EventBoardCard
        item={item}
        onViewInsights={onViewInsights}
        onEdit={onEdit}
        onRemove={onRemove}
        onStatusChange={onStatusChange}
      />
    </div>
  );
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
  
  // Initialize columns from items
  const initializeColumns = React.useMemo((): Record<ColumnStatus, BoardItemWithEvent[]> => {
    const cols: Record<ColumnStatus, BoardItemWithEvent[]> = {
      interested: [],
      researching: [],
      attending: [],
      "follow-up": [],
      archived: [],
    };
    items.forEach((item) => {
      cols[item.column_status].push(item);
    });
    // Sort by position
    Object.keys(cols).forEach((key) => {
      cols[key as ColumnStatus].sort((a, b) => a.position - b.position);
    });
    return cols;
  }, [items]);

  const [columns, setColumns] = useState<Record<ColumnStatus, BoardItemWithEvent[]>>(initializeColumns);

  // Update columns when items change
  useEffect(() => {
    setColumns(initializeColumns);
  }, [initializeColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the item being dragged
    let activeItem: BoardItemWithEvent | null = null;
    let activeColumn: ColumnStatus | null = null;

    for (const [status, items] of Object.entries(columns)) {
      const item = items.find((i) => i.id === activeId);
      if (item) {
        activeItem = item;
        activeColumn = status as ColumnStatus;
        break;
      }
    }

    if (!activeItem || !activeColumn) return;

    // Check if dropping on a column
    const overColumn = COLUMNS.find((col) => col.id === overId)?.id;
    
    if (overColumn && overColumn !== activeColumn) {
      // Moving to different column
      const newColumns = { ...columns };
      newColumns[activeColumn] = newColumns[activeColumn].filter(
        (item) => item.id !== activeId
      );
      newColumns[overColumn] = [...newColumns[overColumn], activeItem];
      
      setColumns(newColumns);
      
      if (onReorder) {
        onReorder(activeId, overColumn, newColumns[overColumn].length - 1);
      }
      if (onStatusChange) {
        onStatusChange(activeId, overColumn);
      }
    } else {
      // Reordering within same column
      const overItem = columns[activeColumn].find((i) => i.id === overId);
      if (overItem && activeId !== overId) {
        const oldIndex = columns[activeColumn].findIndex((i) => i.id === activeId);
        const newIndex = columns[activeColumn].findIndex((i) => i.id === overId);
        
        const newColumns = { ...columns };
        newColumns[activeColumn] = arrayMove(
          newColumns[activeColumn],
          oldIndex,
          newIndex
        );
        
        setColumns(newColumns);
        
        if (onReorder) {
          onReorder(activeId, activeColumn, newIndex);
        }
      }
    }
  };

  const activeItem = activeId
    ? items.find((item) => item.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => {
          const columnItems = columns[column.id];
          const itemIds = columnItems.map((item) => item.id);

          return (
            <div key={column.id} className="flex-shrink-0 w-80">
              <Card className={`h-full ${column.color}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">
                      {column.label}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {columnItems.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <SortableContext
                    items={itemIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3 min-h-[200px]">
                      {columnItems.map((item) => (
                        <SortableItem
                          key={item.id}
                          item={item}
                          onViewInsights={onViewInsights}
                          onEdit={onEdit}
                          onRemove={onRemove}
                          onStatusChange={onStatusChange}
                        />
                      ))}
                      {columnItems.length === 0 && (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          No events
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
      <DragOverlay>
        {activeItem ? (
          <div className="opacity-50">
            <EventBoardCard item={activeItem} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

