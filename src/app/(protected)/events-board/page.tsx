"use client";

import React, { useState, useEffect } from "react";
import { EventBoardKanban } from "@/components/events-board/EventBoardKanban";
import { EventBoardList } from "@/components/events-board/EventBoardList";
import { EventInsightsPanel } from "@/components/events-board/EventInsightsPanel";
import { BoardItemWithEvent, ColumnStatus } from "@/lib/types/event-board";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Plus } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { CollectedEvent } from "@/lib/types/database";

type ViewMode = "kanban" | "list";

export default function EventsBoardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [items, setItems] = useState<BoardItemWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);

  useEffect(() => {
    loadBoardItems();
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
  ) => {
    try {
      const response = await fetch("/api/events/board/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId, columnStatus: newStatus, position: newPosition }),
      });
      if (!response.ok) throw new Error("Failed to reorder");
      // Reload to get updated positions
      await loadBoardItems();
    } catch (err: any) {
      console.error("Failed to reorder:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your events board...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={loadBoardItems}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Events Board</h1>
          <p className="text-gray-600 mt-1">
            Manage and track events you're interested in
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("kanban")}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Kanban
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4 mr-2" />
            List
          </Button>
        </div>
      </div>

      {/* Board Content */}
      {items.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <LayoutGrid className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Your board is empty
          </h3>
          <p className="text-gray-600 mb-4">
            Add events from search results to get started
          </p>
          <Button onClick={() => window.location.href = "/events"}>
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

