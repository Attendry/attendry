"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { EventBoardList } from "@/components/events-board/EventBoardList";
import { EventInsightsPanel } from "@/components/events-board/EventInsightsPanel";
import { EventBoardEditor } from "@/components/events-board/EventBoardEditor";
import { BoardItemWithEvent, ColumnStatus } from "@/lib/types/event-board";
import { SavedView } from "@/lib/types/saved-views";
import { Button } from "@/components/ui/button";
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
import { Save, BookOpen, Trash2, List } from "lucide-react";
import { EmptyState } from "@/components/States/EmptyState";
import { ContentContainer } from "@/components/Layout/PageContainer";
import { PageHeader, PageHeaderActions } from "@/components/Layout/PageHeader";
import { LoadingState, SkeletonList } from "@/components/States/LoadingState";
import { ErrorState } from "@/components/States/ErrorState";
import { toast } from "sonner";

function EventsBoardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<BoardItemWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BoardItemWithEvent | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [loadingViews, setLoadingViews] = useState(false);

  // Remove view param from URL if present
  useEffect(() => {
    const view = searchParams.get('view');
    if (view) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('view');
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    loadBoardItems();
    loadSavedViews();
  }, [loadBoardItems]);

  const loadBoardItems = useCallback(async (retryCount = 0) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/events/board/list");
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Authentication required. Please log in again.");
        } else if (response.status >= 500 && retryCount < 2) {
          // Retry on server errors
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return loadBoardItems(retryCount + 1);
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load board items (${response.status})`);
      }
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to load board items");
      }
      
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
      const errorMessage = err.message || "Failed to load board items";
      setError(errorMessage);
      console.error("Error loading board items:", err);
      
      // Show user-friendly error toast
      if (retryCount === 0) {
        toast.error("Failed to load events", {
          description: errorMessage,
          action: {
            label: "Retry",
            onClick: () => loadBoardItems(0)
          }
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleViewInsights = (eventId: string) => {
    setSelectedEventId(eventId);
    setInsightsOpen(true);
  };

  const handleEdit = (item: BoardItemWithEvent) => {
    setEditingItem(item);
    setEditorOpen(true);
  };

  const handleSaveEdit = async (
    itemId: string,
    updates: { notes?: string; tags?: string[]; columnStatus?: ColumnStatus }
  ) => {
    try {
      const response = await fetch("/api/events/board/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId, ...updates }),
      });
      if (!response.ok) throw new Error("Failed to update");
      await loadBoardItems();
    } catch (err: any) {
      throw err; // Re-throw for EventBoardEditor to handle
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
      toast.success("Event removed", {
        description: "Event has been removed from your board"
      });
    } catch (err: any) {
      toast.error("Failed to remove", {
        description: err.message || "An error occurred. Please try again."
      });
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
      toast.success("Status updated", {
        description: "Event status has been changed"
      });
    } catch (err: any) {
      toast.error("Failed to update status", {
        description: err.message || "An error occurred. Please try again."
      });
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
      const response = await fetch(`/api/events/board/views?view_type=list`);
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
          view_type: 'list',
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


  // Build header actions
  const headerActions = (
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
    </div>
  );

  if (loading) {
    return (
      <ContentContainer>
        <PageHeader
          title="Events Board"
          subtitle="Manage and track events you're interested in"
          actions={headerActions}
        />
        <div className="mt-6">
          <SkeletonList count={5} />
        </div>
      </ContentContainer>
    );
  }

  if (error) {
    return (
      <ContentContainer>
        <PageHeader
          title="Events Board"
          subtitle="Manage and track events you're interested in"
        />
        <div className="mt-6">
          <ErrorState
            title="Failed to load events"
            message={error}
            action={{
              label: "Try Again",
              onClick: loadBoardItems
            }}
          />
        </div>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer>
      <PageHeader
        title="Events Board"
        subtitle="Find events with good contacts for outreach or that make business sense"
        actions={headerActions}
      />

      {/* Board Content */}
      <div className="mt-6">
        {items.length === 0 ? (
          <EmptyState
            icon={<List className="h-12 w-12" />}
            title="Your board is empty"
            description="Add events from search results to get started"
            action={{
              label: "Browse Events",
              onClick: () => router.push("/events")
            }}
          />
        ) : (
          <EventBoardList
            items={items}
            onViewInsights={handleViewInsights}
            onEdit={handleEdit}
            onRemove={handleRemove}
            onStatusChange={handleStatusChange}
            onItemsChange={loadBoardItems}
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
      </div>

      {/* Insights Panel */}
      <EventInsightsPanel
        eventId={selectedEventId}
        isOpen={insightsOpen}
        onClose={() => {
          setInsightsOpen(false);
          setSelectedEventId(null);
        }}
      />

      {/* Editor Panel */}
      <EventBoardEditor
        item={editingItem}
        isOpen={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveEdit}
      />
    </ContentContainer>
  );
}

export default function EventsBoardPage() {
  return (
    <Suspense fallback={
      <ContentContainer>
        <PageHeader
          title="Events Board"
          subtitle="Manage and track events you're interested in"
        />
        <div className="mt-6">
          <SkeletonList count={5} />
        </div>
      </ContentContainer>
    }>
      <EventsBoardPageContent />
    </Suspense>
  );
}

