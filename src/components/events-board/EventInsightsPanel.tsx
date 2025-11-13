"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttendeeInsights } from "./AttendeeInsights";
import { TrendInsights } from "./TrendInsights";
import { PositioningInsights } from "./PositioningInsights";
import { EventInsightsResponse } from "@/lib/types/event-board";
import { Loader2 } from "lucide-react";

interface EventInsightsPanelProps {
  eventId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EventInsightsPanel({
  eventId,
  isOpen,
  onClose,
}: EventInsightsPanelProps) {
  const [insights, setInsights] = useState<EventInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && eventId) {
      loadInsights();
    } else {
      setInsights(null);
      setError(null);
    }
  }, [isOpen, eventId]);

  const loadInsights = async () => {
    if (!eventId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/board/insights/${eventId}`);
      if (!response.ok) {
        throw new Error("Failed to load insights");
      }
      const data = await response.json();
      setInsights(data);
    } catch (err: any) {
      setError(err.message || "Failed to load insights");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Event Insights</DialogTitle>
          <DialogDescription>
            Comprehensive analysis of attendees, trends, and positioning opportunities
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-red-600">
            <p>{error}</p>
            <button
              onClick={loadInsights}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && insights && (
          <Tabs defaultValue="attendees" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="attendees">Attendees</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="positioning">Positioning</TabsTrigger>
            </TabsList>
            
            <TabsContent value="attendees" className="mt-4">
              <AttendeeInsights attendees={insights.attendees} />
            </TabsContent>
            
            <TabsContent value="trends" className="mt-4">
              <TrendInsights trends={insights.trends} />
            </TabsContent>
            
            <TabsContent value="positioning" className="mt-4">
              <PositioningInsights positioning={insights.positioning} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

