"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";
import { EventBoardCard } from "./EventBoardCard";
import { QuickActionsMenu } from "./QuickActionsMenu";
import { BulkActionsBar } from "./BulkActionsBar";
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
  X,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EventBoardListProps {
  items: BoardItemWithEvent[];
  onViewInsights?: (eventId: string) => void;
  onEdit?: (item: BoardItemWithEvent) => void;
  onRemove?: (itemId: string) => void;
  onStatusChange?: (itemId: string, status: ColumnStatus) => void;
  onItemsChange?: () => void; // Callback to refresh items after bulk operations
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
  accessor: (item: BoardItemWithEvent, onStatusChange?: (itemId: string, status: ColumnStatus) => void) => React.ReactNode;
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
    accessor: (item, onStatusChange) => {
      const statusColors: Record<ColumnStatus, string> = {
        'interested': 'bg-primary/10 text-primary',
        'researching': 'bg-warn/10 text-warn',
        'attending': 'bg-positive/10 text-positive',
        'follow-up': 'bg-accent/10 text-accent',
        'archived': 'bg-surface-alt text-text-secondary'
      };
      const statusOptions: ColumnStatus[] = ['interested', 'researching', 'attending', 'archived'];
      
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="cursor-pointer hover:opacity-80 transition-opacity">
              <Badge className={statusColors[item.column_status]}>
                {item.column_status}
              </Badge>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Change Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {statusOptions.map((status) => (
              <DropdownMenuItem
                key={status}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onStatusChange && status !== item.column_status) {
                    onStatusChange(item.id, status);
                  }
                }}
                className={item.column_status === status ? "bg-surface-alt" : ""}
              >
                <Badge className={statusColors[status]}>{status}</Badge>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
            if (onViewInsights) {
              // Use board item ID (unique) or event source_url (unique) as identifier
              // This ensures we get the correct event even if event.id is an optimized_ ID
              const identifier = item.id || item.event?.source_url || item.event?.id;
              if (identifier) {
                onViewInsights(identifier);
              }
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
  onItemsChange,
  initialFilters,
  onFiltersChange,
  onSortChange,
}: EventBoardListProps) {
  const [searchTerm, setSearchTerm] = useState(initialFilters?.search || "");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialFilters?.search || "");
  const [statusFilter, setStatusFilter] = useState<ColumnStatus[]>(initialFilters?.status || []);
  const [topicFilter, setTopicFilter] = useState<string[]>(initialFilters?.topics || []);

  // Debounce search input
  const debouncedSearch = useDebouncedCallback((value: string) => {
    setDebouncedSearchTerm(value);
  }, 300);

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);
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
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Clear selection when items change (e.g., after deletion)
  useEffect(() => {
    const itemIds = new Set(items.map(item => item.id));
    setSelectedItems(prev => {
      const filtered = new Set([...prev].filter(id => itemIds.has(id)));
      return filtered.size !== prev.size ? filtered : prev;
    });
  }, [items]);

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

    // Apply search filter (using debounced term)
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase();
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
  }, [items, debouncedSearchTerm, statusFilter, topicFilter, sortField, sortDirection]);

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


  // Update URL params when filters/sort change (using debounced search)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const params = new URLSearchParams(window.location.search);
    if (debouncedSearchTerm) {
      params.set('search', debouncedSearchTerm);
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
  }, [debouncedSearchTerm, statusFilter, topicFilter, sortField, sortDirection, density]);

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
      {/* Filters and Search - Modern Layout */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Select All Checkbox */}
          {filteredAndSorted.length > 0 && (
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectedItems.size === filteredAndSorted.length && filteredAndSorted.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedItems(new Set(filteredAndSorted.map(item => item.id)));
                  } else {
                    setSelectedItems(new Set());
                  }
                }}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                title="Select all"
              />
            </div>
          )}
          
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
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
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 border-l border-slate-200 dark:border-slate-700 pl-3">
            <Filter className="h-4 w-4" />
            <span>Sort:</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSort('date')}
              className={cn(
                "h-7",
                sortField === 'date' && "bg-slate-100 dark:bg-slate-700"
              )}
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
              className={cn(
                "h-7",
                sortField === 'title' && "bg-slate-100 dark:bg-slate-700"
              )}
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
              className={cn(
                "h-7",
                sortField === 'added' && "bg-slate-100 dark:bg-slate-700"
              )}
            >
              Added
              {sortField === 'added' && (
                <ArrowUpDown className="h-3 w-3 ml-1" />
              )}
            </Button>
          </div>
        </div>

        {/* Active Filters and Results Count */}
        <div className="flex items-center justify-between gap-4 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 flex-wrap">
            {(statusFilter.length > 0 || topicFilter.length > 0) && (
              <>
                <span className="text-sm text-slate-600 dark:text-slate-400">Active filters:</span>
                {statusFilter.map((status) => (
                  <Badge key={status} variant="secondary" className="gap-1">
                    {status}
                    <button
                      onClick={() => setStatusFilter(statusFilter.filter(s => s !== status))}
                      className="ml-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
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
                      className="ml-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
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
              </>
            )}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Showing {filteredAndSorted.length} of {items.length} events
          </div>
        </div>
      </div>

      {/* Modern Card-Based List View */}
      {filteredAndSorted.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Inbox className="h-12 w-12 mx-auto mb-4 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No events found
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
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
            <Button onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = "/events";
              }
            }}>
              Browse Events
            </Button>
          )}
        </div>
      ) : (
        // Modern card-based layout
        <div className="space-y-3">
          {/* Selection Header */}
          {selectedItems.size > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                {selectedItems.size} event{selectedItems.size !== 1 ? 's' : ''} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedItems(new Set())}
              >
                Clear selection
              </Button>
            </div>
          )}

          {filteredAndSorted.map((item) => {
            const isExpanded = expandedRows.has(item.id);
            const isSelected = selectedItems.has(item.id);
            const event = item.event;
            
            return (
              <div
                key={item.id}
                className={cn(
                  "bg-white dark:bg-slate-800 rounded-lg border transition-all duration-200",
                  isSelected
                    ? "border-blue-500 dark:border-blue-400 shadow-md"
                    : isExpanded 
                      ? "border-slate-300 dark:border-slate-600 shadow-md" 
                      : "border-slate-200 dark:border-slate-700 hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-600"
                )}
              >
                {/* Main Row - Card Style */}
                <div
                  className={cn(
                    "flex items-center gap-4 p-4",
                    isExpanded && "bg-slate-50 dark:bg-slate-900/50",
                    isSelected && "bg-blue-50/50 dark:bg-blue-900/10"
                  )}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedItems(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) {
                          next.add(item.id);
                        } else {
                          next.delete(item.id);
                        }
                        return next;
                      });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />

                  <div
                    className="flex-1 flex items-center gap-4 cursor-pointer"
                    onClick={() => toggleRowExpansion(item.id)}
                  >
                  {/* Title Column */}
                  {columnVisibility.title !== false && (
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white line-clamp-1 mb-1">
                        {event?.title || item.event_url.split('/').pop() || "Untitled Event"}
                      </div>
                      {event?.city || event?.country ? (
                        <div className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                          {event.city && event.country ? `${event.city}, ${event.country}` : event.city || event.country}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Date Column */}
                  {columnVisibility.date !== false && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 min-w-[120px]">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      {event?.starts_at ? (
                        <span>{new Date(event.starts_at).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-slate-400">TBD</span>
                      )}
                    </div>
                  )}

                  {/* Topics Column */}
                  {columnVisibility.topics !== false && (
                    <div className="flex flex-wrap gap-1.5 min-w-[150px] max-w-[200px]">
                      {(event?.topics || []).slice(0, 2).map((topic: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {topic}
                        </Badge>
                      ))}
                      {(event?.topics || []).length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{(event?.topics || []).length - 2}
                        </Badge>
                      )}
                      {(event?.topics || []).length === 0 && (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  )}

                  {/* Status Column */}
                  {columnVisibility.status !== false && (
                    <div className="min-w-[120px]" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const statusColors: Record<ColumnStatus, string> = {
                              'interested': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                              'researching': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
                              'attending': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                              'follow-up': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
                              'archived': 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                            };
                            const statusOptions: ColumnStatus[] = ['interested', 'researching', 'attending', 'archived'];
                            
                            return (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="cursor-pointer hover:opacity-80 transition-opacity">
                                    <Badge className={statusColors[item.column_status]}>
                                      {item.column_status}
                                    </Badge>
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {statusOptions.map((status) => (
                                    <DropdownMenuItem
                                      key={status}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (onStatusChange && status !== item.column_status) {
                                          onStatusChange(item.id, status);
                                        }
                                      }}
                                      className={item.column_status === status ? "bg-slate-100 dark:bg-slate-800" : ""}
                                    >
                                      <Badge className={statusColors[status]}>{status}</Badge>
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            );
                          })()}
                    </div>
                  )}

                  {/* Actions Column */}
                  {columnVisibility.actions !== false && (
                    <div className="flex items-center gap-1 min-w-[80px] justify-end">
                      <QuickActionsMenu
                        item={item}
                        onViewInsights={onViewInsights}
                        onEdit={onEdit}
                        onRemove={onRemove}
                        onCreateOutreachList={async (itemId: string) => {
                          try {
                            const response = await fetch(`/api/events/board/${itemId}/create-outreach-list`, {
                              method: 'POST',
                            });
                            const data = await response.json();
                            if (!response.ok) {
                              throw new Error(data.error || 'Failed to create outreach list');
                            }
                            toast.success("Outreach list created", {
                              description: `${data.contactsCreated} contact${data.contactsCreated !== 1 ? 's' : ''} added. Navigate to Outreach to view.`,
                              action: {
                                label: "Go to Outreach",
                                onClick: () => {
                                  if (typeof window !== 'undefined') {
                                    window.location.href = '/outreach';
                                  }
                                }
                              }
                            });
                          } catch (error: any) {
                            throw error;
                          }
                        }}
                        onExport={(item) => {
                          const event = item.event;
                          const exportData = {
                            title: event?.title || 'Untitled Event',
                            date: event?.starts_at || null,
                            location: event?.city && event?.country ? `${event.city}, ${event.country}` : event?.city || event?.country || null,
                            venue: event?.venue || null,
                            description: event?.description || null,
                            topics: event?.topics || [],
                            speakers: event?.speakers || [],
                            sponsors: event?.sponsors || [],
                            status: item.column_status,
                            notes: item.notes || null,
                            tags: item.tags || [],
                            source_url: event?.source_url || item.event_url,
                          };
                          const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `${(event?.title || 'event').replace(/[^a-z0-9]/gi, '_')}.json`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                          toast.success("Event exported", {
                            description: "Event data downloaded as JSON"
                          });
                        }}
                        onShare={(item) => {
                          const event = item.event;
                          const shareText = `${event?.title || 'Event'}\n${event?.starts_at ? new Date(event.starts_at).toLocaleDateString() : ''}\n${event?.city && event?.country ? `${event.city}, ${event.country}` : ''}\n${event?.source_url || ''}`;
                          if (navigator.share) {
                            navigator.share({
                              title: event?.title || 'Event',
                              text: shareText,
                              url: event?.source_url || window.location.href,
                            }).catch(() => {
                              // Fallback to clipboard
                              navigator.clipboard.writeText(shareText);
                              toast.success("Event details copied to clipboard");
                            });
                          } else {
                            navigator.clipboard.writeText(shareText);
                            toast.success("Event details copied to clipboard");
                          }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRowExpansion(item.id);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                  </div>
                </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
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
          })}
        </div>
      )}

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedItems.size}
        onBulkStatusChange={async (status) => {
          const itemIds = Array.from(selectedItems);
          const response = await fetch('/api/events/board/bulk', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemIds, action: 'status', data: { status } }),
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update status');
          }
          setSelectedItems(new Set());
          if (onItemsChange) onItemsChange();
        }}
        onBulkDelete={async () => {
          const itemIds = Array.from(selectedItems);
          const response = await fetch('/api/events/board/bulk', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemIds, action: 'delete' }),
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete');
          }
          setSelectedItems(new Set());
          if (onItemsChange) onItemsChange();
        }}
        onBulkExport={() => {
          const selectedItemsData = filteredAndSorted.filter(item => selectedItems.has(item.id));
          const exportData = selectedItemsData.map(item => ({
            title: item.event?.title || 'Untitled Event',
            date: item.event?.starts_at || null,
            location: item.event?.city && item.event?.country ? `${item.event.city}, ${item.event.country}` : item.event?.city || item.event?.country || null,
            venue: item.event?.venue || null,
            description: item.event?.description || null,
            topics: item.event?.topics || [],
            speakers: item.event?.speakers || [],
            sponsors: item.event?.sponsors || [],
            status: item.column_status,
            notes: item.notes || null,
            tags: item.tags || [],
            source_url: item.event?.source_url || item.event_url,
          }));
          const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `events-board-export-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }}
        onBulkAddToOutreach={async () => {
          const itemIds = Array.from(selectedItems);
          let totalContacts = 0;
          let errors: string[] = [];

          for (const itemId of itemIds) {
            try {
              const response = await fetch(`/api/events/board/${itemId}/create-outreach-list`, {
                method: 'POST',
              });
              const data = await response.json();
              if (!response.ok) {
                errors.push(data.error || 'Failed to create outreach list');
                continue;
              }
              totalContacts += data.contactsCreated || 0;
            } catch (error: any) {
              errors.push(error.message || 'Unknown error');
            }
          }

          if (errors.length > 0 && totalContacts === 0) {
            throw new Error(`Failed to create outreach lists: ${errors.join(', ')}`);
          }

          setSelectedItems(new Set());
          if (onItemsChange) onItemsChange();
        }}
        onBulkTag={async (action, tags) => {
          const itemIds = Array.from(selectedItems);
          const response = await fetch('/api/events/board/bulk', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemIds, action: 'tags', data: { tags, action } }),
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update tags');
          }
          setSelectedItems(new Set());
          if (onItemsChange) onItemsChange();
        }}
      />
    </div>
  );
}
