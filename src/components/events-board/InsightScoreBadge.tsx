"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightScoreBadgeProps {
  eventId: string;
  onClick?: () => void;
  className?: string;
}

interface CachedScore {
  score: number;
  timestamp: number;
}

export function InsightScoreBadge({ eventId, onClick, className }: InsightScoreBadgeProps) {
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventId) return;

    // Load cached score
    const loadCachedScore = () => {
      if (typeof window === 'undefined') return null;
      try {
        const cached = localStorage.getItem(`event-insight-score-${eventId}`);
        if (cached) {
          const { score, timestamp }: CachedScore = JSON.parse(cached);
          // Cache expires after 24 hours
          const cacheAge = Date.now() - timestamp;
          if (cacheAge < 24 * 60 * 60 * 1000) {
            return score;
          }
        }
      } catch (e) {
        console.warn('Failed to load cached score:', e);
      }
      return null;
    };

    const cachedScore = loadCachedScore();
    if (cachedScore !== null) {
      setScore(cachedScore);
    } else {
      // Fetch score in background
      fetchScore();
    }
  }, [eventId]);

  const fetchScore = async () => {
    if (!eventId || loading) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/events/board/insights/${eventId}`);
      if (response.ok) {
        const data = await response.json();
        const insightScore = data.insightScore?.overallScore;
        if (insightScore !== undefined) {
          setScore(insightScore);
          // Cache the score
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`event-insight-score-${eventId}`, JSON.stringify({
                score: insightScore,
                timestamp: Date.now(),
              }));
            } catch (e) {
              console.warn('Failed to cache score:', e);
            }
          }
        }
      }
    } catch (err) {
      // Silently fail - badge just won't show
      console.warn('Failed to fetch insight score:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && score === null) {
    return (
      <Badge
        variant="outline"
        className={cn("cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800", className)}
        onClick={onClick}
      >
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        <span className="text-xs">Loading...</span>
      </Badge>
    );
  }

  if (score === null) {
    return null; // Don't show badge if no score available
  }

  const scorePercent = Math.round(score * 100);
  const scoreColor =
    score >= 0.7
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800'
      : score >= 0.4
      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-600';

  return (
    <Badge
      variant="outline"
      className={cn(
        "cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1",
        scoreColor,
        className
      )}
      onClick={onClick}
      title={`Insight Score: ${scorePercent}% - Click to view insights`}
    >
      <BarChart3 className="h-3 w-3" />
      <span className="text-xs font-semibold">{scorePercent}%</span>
    </Badge>
  );
}

