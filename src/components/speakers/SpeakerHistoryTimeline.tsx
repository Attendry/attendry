"use client";

import React, { useState, useEffect } from "react";
import { Calendar, ExternalLink, Loader2 } from "lucide-react";
import { getSpeakerHistory } from "@/lib/services/speaker-search-service";
import Link from "next/link";

interface SpeakerHistoryTimelineProps {
  speakerKey: string | null;
  speakerName: string;
  speakerOrg?: string | null;
}

export function SpeakerHistoryTimeline({
  speakerKey,
  speakerName,
  speakerOrg,
}: SpeakerHistoryTimelineProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (speakerKey) {
      loadHistory();
    } else {
      // Try to find speaker by name/org
      searchSpeaker();
    }
  }, [speakerKey, speakerName, speakerOrg]);

  async function loadHistory() {
    if (!speakerKey) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/speakers/search?speakerKey=${speakerKey}&limit=20`);
      if (!response.ok) throw new Error("Failed to load speaker history");

      const data = await response.json();
      setHistory(data.history || []);
    } catch (err: any) {
      setError(err.message || "Failed to load speaker history");
    } finally {
      setLoading(false);
    }
  }

  async function searchSpeaker() {
    if (!speakerName) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/speakers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: speakerName,
          org: speakerOrg,
          limit: 1,
        }),
      });

      if (!response.ok) throw new Error("Failed to search speaker");

      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        if (result.speaker_key) {
          const historyResponse = await fetch(
            `/api/speakers/search?speakerKey=${result.speaker_key}&limit=20`
          );
          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            setHistory(historyData.history || []);
          }
        } else if (result.events) {
          setHistory(result.events);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to search speaker");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-muted p-8 text-center">
        <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">
          No speaking history found for this speaker
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Speaking History</h4>
        <span className="text-sm text-muted-foreground">
          {history.length} event{history.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3">
        {history.map((event, idx) => (
          <div
            key={idx}
            className="flex gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex-shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {event.event_title || "Event"}
              </div>
              {event.talk_title && (
                <div className="text-sm text-muted-foreground truncate">
                  {event.talk_title}
                </div>
              )}
              {event.appeared_at && (
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(event.appeared_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              )}
            </div>
            {event.event_id && (
              <Link
                href={`/events/${event.event_id}`}
                className="flex-shrink-0 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

