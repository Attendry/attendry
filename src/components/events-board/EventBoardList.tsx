"use client";

import React, { useState, useMemo } from "react";
import { EventBoardCard } from "./EventBoardCard";
import { BoardItemWithEvent, ColumnStatus } from "@/lib/types/event-board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, Search, Filter } from "lucide-react";

interface EventBoardListProps {
  items: BoardItemWithEvent[];
  onViewInsights?: (eventId: string) => void;
  onEdit?: (item: BoardItemWithEvent) => void;
  onRemove?: (itemId: string) => void;
  onStatusChange?: (itemId: string, status: ColumnStatus) => void;
}

type SortField = 'date' | 'title' | 'status' | 'added';
type SortDirection = 'asc' | 'desc';

export function EventBoardList({
  items,
  onViewInsights,
  onEdit,
  onRemove,
  onStatusChange
}: EventBoardListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ColumnStatus | "all">("all");
  const [sortField, setSortField] = useState<SortField>("added");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const filteredAndSorted = useMemo(() => {
    let filtered = items;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const event = item.event;
        const title = event?.title?.toLowerCase() || "";
        const description = event?.description?.toLowerCase() || "";
        const location = `${event?.city || ""} ${event?.country || ""}`.toLowerCase();
        const notes = item.notes?.toLowerCase() || "";
        return title.includes(term) || description.includes(term) || 
               location.includes(term) || notes.includes(term);
      });
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(item => item.column_status === statusFilter);
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'date':
          aValue = a.event?.starts_at ? new Date(a.event.starts_at).getTime() : 0;
          bValue = b.event?.starts_at ? new Date(b.event.starts_at).getTime() : 0;
          break;
        case 'title':
          aValue = a.event?.title || "";
          bValue = b.event?.title || "";
          break;
        case 'status':
          aValue = a.column_status;
          bValue = b.column_status;
          break;
        case 'added':
          aValue = new Date(a.added_at).getTime();
          bValue = new Date(b.added_at).getTime();
          break;
      }

      if (sortField === 'title' || sortField === 'status') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      } else {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });

    return filtered;
  }, [items, searchTerm, statusFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ColumnStatus | "all")}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="all">All Status</option>
          <option value="interested">Interested</option>
          <option value="researching">Researching</option>
          <option value="attending">Attending</option>
          <option value="follow-up">Follow-up</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Filter className="h-4 w-4" />
        <span>Sort by:</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleSort('date')}
          className="h-7"
        >
          Date
          {sortField === 'date' && (
            <ArrowUpDown className="h-3 w-3 ml-1" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleSort('title')}
          className="h-7"
        >
          Title
          {sortField === 'title' && (
            <ArrowUpDown className="h-3 w-3 ml-1" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleSort('added')}
          className="h-7"
        >
          Added
          {sortField === 'added' && (
            <ArrowUpDown className="h-3 w-3 ml-1" />
          )}
        </Button>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing {filteredAndSorted.length} of {items.length} events
      </div>

      {/* Event Cards */}
      {filteredAndSorted.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No events found matching your criteria.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAndSorted.map((item) => (
            <EventBoardCard
              key={item.id}
              item={item}
              onViewInsights={onViewInsights}
              onEdit={onEdit}
              onRemove={onRemove}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

