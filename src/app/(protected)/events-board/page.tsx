"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { EventBoardKanban } from "@/components/events-board/EventBoardKanban";
import { EventBoardList } from "@/components/events-board/EventBoardList";
import { EventInsightsPanel } from "@/components/events-board/EventInsightsPanel";
import { BoardItemWithEvent, ColumnStatus } from "@/lib/types/event-board";
import { SavedView } from "@/lib/types/saved-views";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutGrid, List, Plus, Save, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { CollectedEvent } from "@/lib/types/database";

type ViewMode = "kanban" | "list";

export default function EventsBoardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [items, setItems] = useState<BoardItemWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [loadingViews, setLoadingViews] = useState(false);

  // Parse URL params on load
  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'list' || view === 'kanban') {
      setViewMode(view);
    }
  }, [searchParams]);

  useEffect(() => {
    loadBoardItems();
    loadSavedViews();
  }, []);

  const loadBoardItems = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/events/board/list");
      if (!response.ok) {
        throw new Error("Failed to load board items");
      }
      const data = await response.json();
      
      // Transform the data to include event data
      // The API now returns event field, but we ensure it's properly structured
      const transformedItems: BoardItemWithEvent[] = (data.items || []).map((item: any) => {
        // Use event from API (which uses collected_events or event_data)
        // If not available, try to construct from available data
        let event = item.event;
        
        if (!event && item.collected_events) {
          event = {
            id: item.collected_events.id,
            title: item.collected_events.title,
            starts_at: item.collected_events.starts_at,
            ends_at: item.collected_events.ends_at,
            city: item.collected_events.city,
            country: item.collected_events.country,
            venue: item.collected_events.venue,
            organizer: item.collected_events.organizer,
            description: item.collected_events.description,
            topics: item.collected_events.topics,
            speakers: item.collected_events.speakers,
            sponsors: item.collected_events.sponsors,
            participating_organizations: item.collected_events.participating_organizations,
            partners: item.collected_events.partners,
            competitors: item.collected_events.competitors,
            source_url: item.collected_events.source_url,
            confidence: item.collected_events.confidence,
          };
        } else if (!event && item.event_data) {
          // Use stored event_data as fallback
          event = item.event_data;
        }

        return {
          ...item,
          event,
        };
      });

      setItems(transformedItems);
    } catch (err: any) {
      setError(err.message || "Failed to load board items");
    } finally {
      setLoading(false);
    }
  };

  const handleViewInsights = (eventId: string) => {
    setSelectedEventId(eventId);
    setInsightsOpen(true);
  };

  const handleEdit = async (item: BoardItemWithEvent) => {
    // TODO: Implement edit modal
    const notes = prompt("Edit notes:", item.notes || "");
    if (notes !== null) {
      try {
        const response = await fetch("/api/events/board/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, notes }),
        });
        if (!response.ok) throw new Error("Failed to update");
        await loadBoardItems();
      } catch (err: any) {
        alert(err.message || "Failed to update");
      }
    }
  };

  const handleRemove = async (itemId: string) => {
    if (!confirm("Remove this event from your board?")) return;

    try {
      const response = await fetch(`/api/events/board/remove?id=${itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to remove");
      await loadBoardItems();
    } catch (err: any) {
      alert(err.message || "Failed to remove");
    }
  };

  const handleStatusChange = async (itemId: string, status: ColumnStatus) => {
    try {
      const response = await fetch("/api/events/board/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId, columnStatus: status }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      await loadBoardItems();
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  const handleReorder = async (
    itemId: string,
    newStatus: ColumnStatus,
    newPosition: number
  ): Promise<void> => {
    try {
      const response = await fetch("/api/events/board/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId, columnStatus: newStatus, position: newPosition }),
      });
      if (!response.ok) {
        throw new Error("Failed to reorder");
      }
      // Don't reload immediately - optimistic updates handle UI
      // Only reload if needed for consistency
    } catch (err: any) {
      // Error will be handled by optimistic update rollback
      throw err; // Re-throw for retry mechanism
    }
  };

  const loadSavedViews = async () => {
    setLoadingViews(true);
    try {
      const response = await fetch(`/api/events/board/views?view_type=${viewMode}`);
      if (!response.ok) throw new Error("Failed to load saved views");
      const data = await response.json();
      setSavedViews(data.views || []);
    } catch (err: any) {
      console.error("Failed to load saved views:", err);
    } finally {
      setLoadingViews(false);
    }
  };

  const saveCurrentView = async () => {
    if (!viewName.trim()) {
      toast.error("Please enter a view name");
      return;
    }

    try {
      const filters = {
        // Extract current filters from URL or state
        search: searchParams.get('search') || undefined,
        status: searchParams.get('status')?.split(',') || undefined,
        topics: searchParams.get('topics')?.split(',') || undefined,
      };
      const sort = {
        field: searchParams.get('sort')?.split(':')[0] || 'added',
        direction: (searchParams.get('sort')?.split(':')[1] || 'desc') as 'asc' | 'desc',
      };

      const response = await fetch("/api/events/board/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: viewName.trim(),
          view_type: viewMode,
          filters,
          sort,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save view");
      }

      toast.success("View saved successfully");
      setSaveViewDialogOpen(false);
      setViewName("");
      await loadSavedViews();
    } catch (err: any) {
      toast.error(err.message || "Failed to save view");
    }
  };

  const loadSavedView = async (view: SavedView) => {
    try {
      // Update URL params from saved view
      const params = new URLSearchParams();
      if (view.filters?.search) params.set('search', view.filters.search);
      if (view.filters?.status && view.filters.status.length > 0) {
        params.set('status', view.filters.status.join(','));
      }
      if (view.filters?.topics && view.filters.topics.length > 0) {
        params.set('topics', view.filters.topics.join(','));
      }
      if (view.sort) {
        params.set('sort', `${view.sort.field}:${view.sort.direction}`);
      }
      if (view.density) {
        params.set('density', view.density);
      }
      params.set('view', view.view_type);

      router.push(`/events-board?${params.toString()}`);
      toast.success(`Loaded view: ${view.name}`);
    } catch (err: any) {
      toast.error("Failed to load view");
    }
  };

  const deleteSavedView = async (viewId: string) => {
    if (!confirm("Delete this saved view?")) return;

    try {
      const response = await fetch(`/api/events/board/views/${viewId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete view");

      toast.success("View deleted");
      await loadSavedViews();
    } catch (err: any) {
      toast.error("Failed to delete view");
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', mode);
    router.push(`/events-board?${params.toString()}`);
    loadSavedViews(); // Reload views for new mode
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-80">
              <div className="border rounded-lg p-4 space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-danger mb-4">{error}</p>
        <Button onClick={loadBoardItems}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Events Board</h1>
          <p className="text-text-secondary mt-1">
            Manage and track events you're interested in
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Saved Views Dropdown */}
          {savedViews.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Saved Views
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {savedViews.map((view) => (
                  <DropdownMenuItem
                    key={view.id}
                    onClick={() => loadSavedView(view)}
                    className="flex items-center justify-between"
                  >
                    <span>{view.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSavedView(view.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Save View Dialog */}
          <Dialog open={saveViewDialogOpen} onOpenChange={setSaveViewDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save View
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Current View</DialogTitle>
                <DialogDescription>
                  Save your current filters, sort, and column settings as a named view.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="View name (e.g., 'Upcoming Events')"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveCurrentView();
                    }
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveViewDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveCurrentView}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant={viewMode === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => handleViewModeChange("kanban")}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Kanban
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => handleViewModeChange("list")}
          >
            <List className="h-4 w-4 mr-2" />
            List
          </Button>
        </div>
      </div>

      {/* Board Content */}
      {items.length === 0 ? (
        <div className="text-center py-12 bg-surface-alt rounded-lg">
          <LayoutGrid className="h-16 w-16 mx-auto mb-4 text-text-muted" />
          <h3 className="text-xl font-semibold text-text-primary mb-2">
            Your board is empty
          </h3>
          <p className="text-text-secondary mb-4">
            Add events from search results to get started
          </p>
          <Button onClick={() => (window.location.href = "/events")}>
            <Plus className="h-4 w-4 mr-2" />
            Browse Events
          </Button>
        </div>
      ) : (
        <>
          {viewMode === "kanban" ? (
            <EventBoardKanban
              items={items}
              onViewInsights={handleViewInsights}
              onEdit={handleEdit}
              onRemove={handleRemove}
              onStatusChange={handleStatusChange}
              onReorder={handleReorder}
            />
          ) : (
            <EventBoardList
              items={items}
              onViewInsights={handleViewInsights}
              onEdit={handleEdit}
              onRemove={handleRemove}
              onStatusChange={handleStatusChange}
              initialFilters={{
                search: searchParams.get('search') || undefined,
                status: searchParams.get('status')?.split(',') as ColumnStatus[] || undefined,
                topics: searchParams.get('topics')?.split(',') || undefined,
                sort: searchParams.get('sort') ? {
                  field: searchParams.get('sort')?.split(':')[0] || 'added',
                  direction: (searchParams.get('sort')?.split(':')[1] || 'desc') as 'asc' | 'desc',
                } : undefined,
                density: (searchParams.get('density') as 'comfortable' | 'compact') || undefined,
              }}
            />
          )}
        </>
      )}

      {/* Insights Panel */}
      <EventInsightsPanel
        eventId={selectedEventId}
        isOpen={insightsOpen}
        onClose={() => {
          setInsightsOpen(false);
          setSelectedEventId(null);
        }}
      />
    </div>
  );
}

