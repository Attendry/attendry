"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { FixedSizeList } from "react-window";
import { EventBoardCard } from "./EventBoardCard";
import { BoardItemWithEvent, ColumnStatus } from "@/lib/types/event-board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowUpDown, 
  Search, 
  Filter, 
  Inbox, 
  ChevronDown,
  ChevronUp,
  Settings2,
  Columns3,
  Eye,
  EyeOff,
  GripVertical,
  X,
  Calendar,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EventBoardListProps {
  items: BoardItemWithEvent[];
  onViewInsights?: (eventId: string) => void;
  onEdit?: (item: BoardItemWithEvent) => void;
  onRemove?: (itemId: string) => void;
  onStatusChange?: (itemId: string, status: ColumnStatus) => void;
  // Phase 3: URL params and saved views
  initialFilters?: {
    search?: string;
    status?: string[];
    topics?: string[];
    sort?: { field: string; direction: 'asc' | 'desc' };
    density?: Density;
  };
  onFiltersChange?: (filters: any) => void;
  onSortChange?: (sort: any) => void;
}

type SortField = 'date' | 'title' | 'status' | 'added';
type SortDirection = 'asc' | 'desc';
type Density = 'comfortable' | 'compact';

interface ColumnDef {
  id: string;
  label: string;
  accessor: (item: BoardItemWithEvent) => React.ReactNode;
  width: number;
  minWidth: number;
  sortable?: boolean;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  {
    id: 'title',
    label: 'Title',
    accessor: (item) => (
      <div className="font-medium text-text-primary line-clamp-2">
        {item.event?.title || item.event_url.split('/').pop() || "Untitled Event"}
      </div>
    ),
    width: 300,
    minWidth: 200,
    sortable: true,
  },
  {
    id: 'date',
    label: 'Date',
    accessor: (item) => {
      if (!item.event?.starts_at) return <span className="text-text-muted">TBD</span>;
      const date = new Date(item.event.starts_at);
      return <span className="text-text-secondary">{date.toLocaleDateString()}</span>;
    },
    width: 120,
    minWidth: 100,
    sortable: true,
  },
  {
    id: 'topics',
    label: 'Topics',
    accessor: (item) => {
      const topics = item.event?.topics || [];
      if (topics.length === 0) return <span className="text-text-muted">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {topics.slice(0, 2).map((topic: string, idx: number) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {topic}
            </Badge>
          ))}
          {topics.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{topics.length - 2}
            </Badge>
          )}
        </div>
      );
    },
    width: 200,
    minWidth: 150,
    sortable: false,
  },
  {
    id: 'status',
    label: 'Status',
    accessor: (item) => {
      const statusColors: Record<ColumnStatus, string> = {
        'interested': 'bg-primary/10 text-primary',
        'researching': 'bg-warn/10 text-warn',
        'attending': 'bg-positive/10 text-positive',
        'follow-up': 'bg-accent/10 text-accent',
        'archived': 'bg-surface-alt text-text-secondary'
      };
      return (
        <Badge className={statusColors[item.column_status]}>
          {item.column_status}
        </Badge>
      );
    },
    width: 120,
    minWidth: 100,
    sortable: true,
  },
  {
    id: 'actions',
    label: '',
    accessor: (item) => (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            if (onViewInsights && item.event?.id) {
              onViewInsights(item.event.id);
            }
          }}
          className="h-8 w-8 p-0"
        >
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    ),
    width: 100,
    minWidth: 80,
    sortable: false,
  },
];

export function EventBoardList({
  items,
  onViewInsights,
  onEdit,
  onRemove,
  onStatusChange,
  initialFilters,
  onFiltersChange,
  onSortChange,
}: EventBoardListProps) {
  const [searchTerm, setSearchTerm] = useState(initialFilters?.search || "");
  const [statusFilter, setStatusFilter] = useState<ColumnStatus[]>(initialFilters?.status || []);
  const [topicFilter, setTopicFilter] = useState<string[]>(initialFilters?.topics || []);
  const [sortField, setSortField] = useState<SortField>((initialFilters?.sort?.field as SortField) || "added");
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialFilters?.sort?.direction || "desc");
  const [density, setDensity] = useState<Density>(initialFilters?.density || "comfortable");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    title: true,
    date: true,
    topics: true,
    status: true,
    actions: true,
  });
  const [columnCustomizationOpen, setColumnCustomizationOpen] = useState(false);
  const listRef = useRef<FixedSizeList<any> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get all unique topics from items
  const allTopics = useMemo(() => {
    const topicsSet = new Set<string>();
    items.forEach(item => {
      if (item.event?.topics && Array.isArray(item.event.topics)) {
        item.event.topics.forEach((topic: string) => topicsSet.add(topic));
      }
    });
    return Array.from(topicsSet).sort();
  }, [items]);

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
    if (statusFilter.length > 0) {
      filtered = filtered.filter(item => statusFilter.includes(item.column_status));
    }

    // Apply topic filter
    if (topicFilter.length > 0) {
      filtered = filtered.filter(item => {
        const itemTopics = item.event?.topics || [];
        return topicFilter.some(filterTopic => 
          itemTopics.some((itemTopic: string) => itemTopic.toLowerCase() === filterTopic.toLowerCase())
        );
      });
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
  }, [items, searchTerm, statusFilter, topicFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    const newDirection = sortField === field && sortDirection === 'desc' ? 'asc' : 'desc';
    setSortField(field);
    setSortDirection(newDirection);
    if (onSortChange) {
      onSortChange({ field, direction: newDirection });
    }
  };

  const toggleRowExpansion = (itemId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleColumnVisibility = (columnId: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnId]: !prev[columnId]
    }));
  };

  const visibleColumns = useMemo(() => {
    return columns.filter(col => columnVisibility[col.id] !== false);
  }, [columns, columnVisibility]);

  const baseRowHeight = density === 'comfortable' ? 80 : 60;
  const shouldVirtualize = filteredAndSorted.length > 50;
  const listHeight = Math.min(600, filteredAndSorted.length * baseRowHeight);

  // Virtualized row renderer
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = filteredAndSorted[index];
    const isExpanded = expandedRows.has(item.id);

    return (
      <div style={style} className="border-b">
        <div
          className={cn(
            "flex cursor-pointer hover:bg-surface-alt transition-colors",
            isExpanded && "bg-surface-alt"
          )}
          onClick={() => toggleRowExpansion(item.id)}
        >
          {visibleColumns.map((column) => (
            <div
              key={column.id}
              className={cn(
                density === 'compact' ? "py-2 px-4" : "py-4 px-4",
                "flex items-center"
              )}
              style={{ width: column.width, minWidth: column.minWidth }}
            >
              {column.accessor(item)}
            </div>
          ))}
        </div>
        {isExpanded && (
          <div className="bg-surface-alt p-4 border-b">
            <EventBoardCard
              item={item}
              onViewInsights={onViewInsights}
              onEdit={onEdit}
              onRemove={onRemove}
              onStatusChange={onStatusChange}
            />
          </div>
        )}
      </div>
    );
  }, [filteredAndSorted, expandedRows, visibleColumns, density, onViewInsights, onEdit, onRemove, onStatusChange]);

  // Update URL params when filters/sort change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const params = new URLSearchParams(window.location.search);
    if (searchTerm) {
      params.set('search', searchTerm);
    } else {
      params.delete('search');
    }
    if (statusFilter.length > 0) {
      params.set('status', statusFilter.join(','));
    } else {
      params.delete('status');
    }
    if (topicFilter.length > 0) {
      params.set('topics', topicFilter.join(','));
    } else {
      params.delete('topics');
    }
    if (sortField !== 'added' || sortDirection !== 'desc') {
      params.set('sort', `${sortField}:${sortDirection}`);
    } else {
      params.delete('sort');
    }
    if (density !== 'comfortable') {
      params.set('density', density);
    } else {
      params.delete('density');
    }

    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [searchTerm, statusFilter, topicFilter, sortField, sortDirection, density]);

  // Persist column preferences to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('events-board-column-visibility', JSON.stringify(columnVisibility));
    } catch (e) {
      console.warn('Failed to save column preferences:', e);
    }
  }, [columnVisibility]);

  // Load column preferences from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('events-board-column-visibility');
      if (saved) {
        const parsed = JSON.parse(saved);
        setColumnVisibility(prev => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.warn('Failed to load column preferences:', e);
    }
  }, []);

  // Sync with initialFilters prop changes (from URL params)
  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.search !== undefined) setSearchTerm(initialFilters.search);
      if (initialFilters.status !== undefined) setStatusFilter(initialFilters.status as ColumnStatus[]);
      if (initialFilters.topics !== undefined) setTopicFilter(initialFilters.topics);
      if (initialFilters.sort) {
        setSortField(initialFilters.sort.field as SortField);
        setSortDirection(initialFilters.sort.direction);
      }
      if (initialFilters.density) setDensity(initialFilters.density);
    }
  }, [initialFilters]);

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Multi-select Status Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-between">
              <Filter className="h-4 w-4 mr-2" />
              Status
              {statusFilter.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {statusFilter.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56">
            <div className="space-y-2">
              <div className="font-medium text-sm">Filter by Status</div>
              {(['interested', 'researching', 'attending', 'follow-up', 'archived'] as ColumnStatus[]).map((status) => (
                <label key={status} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={statusFilter.includes(status)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setStatusFilter([...statusFilter, status]);
                      } else {
                        setStatusFilter(statusFilter.filter(s => s !== status));
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm capitalize">{status}</span>
                </label>
              ))}
              {statusFilter.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusFilter([])}
                  className="w-full mt-2"
                >
                  Clear
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Topic Filter */}
        {allTopics.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[180px] justify-between">
                <Columns3 className="h-4 w-4 mr-2" />
                Topics
                {topicFilter.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {topicFilter.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                <div className="font-medium text-sm mb-2">Filter by Topics</div>
                <Input
                  placeholder="Search topics..."
                  className="mb-2"
                  onChange={(e) => {
                    // Simple search - could be enhanced
                  }}
                />
                {allTopics.map((topic) => (
                  <label key={topic} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={topicFilter.includes(topic)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setTopicFilter([...topicFilter, topic]);
                        } else {
                          setTopicFilter(topicFilter.filter(t => t !== topic));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{topic}</span>
                  </label>
                ))}
                {topicFilter.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTopicFilter([])}
                    className="w-full mt-2"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Density Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="h-4 w-4 mr-2" />
              {density === 'comfortable' ? 'Comfortable' : 'Compact'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Density</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={density === 'comfortable'}
              onCheckedChange={(checked) => {
                if (checked) setDensity('comfortable');
              }}
            >
              Comfortable
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={density === 'compact'}
              onCheckedChange={(checked) => {
                if (checked) setDensity('compact');
              }}
            >
              Compact
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Column Customization */}
        <Popover open={columnCustomizationOpen} onOpenChange={setColumnCustomizationOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 className="h-4 w-4 mr-2" />
              Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <div className="font-medium text-sm mb-2">Show Columns</div>
              {columns.map((column) => (
                <label key={column.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={columnVisibility[column.id] !== false}
                    onChange={() => {
                      if (column.id !== 'actions') {
                        toggleColumnVisibility(column.id);
                      }
                    }}
                    disabled={column.id === 'actions'}
                    className="rounded"
                  />
                  <span className="text-sm">{column.label}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-2 text-sm text-text-secondary">
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

      {/* Active Filters */}
      {(statusFilter.length > 0 || topicFilter.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-text-secondary">Active filters:</span>
          {statusFilter.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1">
              {status}
              <button
                onClick={() => setStatusFilter(statusFilter.filter(s => s !== status))}
                className="ml-1 hover:bg-surface-alt rounded"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {topicFilter.map((topic) => (
            <Badge key={topic} variant="secondary" className="gap-1">
              {topic}
              <button
                onClick={() => setTopicFilter(topicFilter.filter(t => t !== topic))}
                className="ml-1 hover:bg-surface-alt rounded"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter([]);
              setTopicFilter([]);
            }}
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Results Count */}
      <div className="text-sm text-text-secondary">
        Showing {filteredAndSorted.length} of {items.length} events
      </div>

      {/* Table View */}
      {filteredAndSorted.length === 0 ? (
        <div className="text-center py-12">
          <Inbox className="h-12 w-12 mx-auto mb-4 text-text-muted" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            No events found
          </h3>
          <p className="text-sm text-text-secondary mb-4">
            {searchTerm || statusFilter.length > 0 || topicFilter.length > 0
              ? "Try adjusting your search or filters"
              : "Add events from search results to get started"}
          </p>
          {searchTerm || statusFilter.length > 0 || topicFilter.length > 0 ? (
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter([]);
                setTopicFilter([]);
              }}
            >
              Clear Filters
            </Button>
          ) : (
            <Button onClick={() => (window.location.href = "/events")}>
              Browse Events
            </Button>
          )}
        </div>
      ) : shouldVirtualize ? (
        // Virtualized table for large lists
        <div ref={containerRef} className="border rounded-lg overflow-hidden">
          <div className="sticky top-0 z-10 bg-surface-elevated border-b">
            <div className="flex">
              {visibleColumns.map((column) => (
                <div
                  key={column.id}
                  className={cn(
                    column.sortable && "cursor-pointer hover:bg-surface-alt",
                    density === 'compact' ? "py-2 px-4" : "py-3 px-4",
                    "font-medium text-text-secondary text-sm"
                  )}
                  onClick={() => column.sortable && handleSort(column.id as SortField)}
                  style={{ width: column.width, minWidth: column.minWidth }}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable && sortField === column.id && (
                      <ArrowUpDown className="h-3 w-3" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ height: listHeight }}>
            <FixedSizeList
              ref={listRef}
              height={listHeight}
              itemCount={filteredAndSorted.length}
              itemSize={baseRowHeight}
              width="100%"
            >
              {Row}
            </FixedSizeList>
          </div>
        </div>
      ) : (
        // Regular table for smaller lists
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-surface-elevated">
              <TableRow>
                {visibleColumns.map((column) => (
                  <TableHead
                    key={column.id}
                    className={cn(
                      column.sortable && "cursor-pointer hover:bg-surface-alt",
                      density === 'compact' ? "py-2" : "py-3"
                    )}
                    onClick={() => column.sortable && handleSort(column.id as SortField)}
                    style={{ width: column.width }}
                  >
                    <div className="flex items-center gap-2">
                      {column.label}
                      {column.sortable && sortField === column.id && (
                        <ArrowUpDown className="h-3 w-3" />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((item) => {
                const isExpanded = expandedRows.has(item.id);
                return (
                  <React.Fragment key={item.id}>
                    <TableRow
                      className={cn(
                        "cursor-pointer hover:bg-surface-alt transition-colors",
                        isExpanded && "bg-surface-alt"
                      )}
                      onClick={() => toggleRowExpansion(item.id)}
                    >
                      {visibleColumns.map((column) => (
                        <TableCell
                          key={column.id}
                          className={cn(
                            density === 'compact' ? "py-2" : "py-4"
                          )}
                          style={{ width: column.width }}
                        >
                          {column.accessor(item)}
                        </TableCell>
                      ))}
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={visibleColumns.length} className="bg-surface-alt p-4">
                          <EventBoardCard
                            item={item}
                            onViewInsights={onViewInsights}
                            onEdit={onEdit}
                            onRemove={onRemove}
                            onStatusChange={onStatusChange}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
