"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AttendeeInsights } from "./AttendeeInsights";
import { TrendInsights } from "./TrendInsights";
import { PositioningInsights } from "./PositioningInsights";
import { RecommendationsInsights } from "./RecommendationsInsights";
import { CompetitiveInsights } from "./CompetitiveInsights";
import { CompetitorDiscovery } from "../competitive-intelligence/CompetitorDiscovery";
import { EventInsightsResponse } from "@/lib/types/event-board";
import { Loader2, BarChart3, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cached insights from localStorage
  const loadCachedInsights = useCallback((eventId: string): EventInsightsResponse | null => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(`event-insights-${eventId}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Cache expires after 24 hours
        const cacheAge = Date.now() - timestamp;
        if (cacheAge < 24 * 60 * 60 * 1000) {
          return data;
        }
      }
    } catch (e) {
      console.warn('Failed to load cached insights:', e);
    }
    return null;
  }, []);

  // Save insights to cache
  const saveCachedInsights = useCallback((eventId: string, data: EventInsightsResponse) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`event-insights-${eventId}`, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.warn('Failed to cache insights:', e);
    }
  }, []);

  useEffect(() => {
    if (isOpen && eventId) {
      // Load cached insights immediately (optimistic loading)
      const cached = loadCachedInsights(eventId);
      if (cached) {
        setInsights(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      
      // Then load fresh insights in background
      loadInsights(true);
    } else {
      setInsights(null);
      setError(null);
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOpen, eventId, loadCachedInsights]);

  // Handle escape key to close panel
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const loadInsights = async (isBackgroundRefresh = false) => {
    if (!eventId) return;

    if (isBackgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // First try to get existing insights
      let response = await fetch(`/api/events/board/insights/${eventId}`);
      
      // If insights don't exist (404), generate them
      if (response.status === 404) {
        // Generate insights using the intelligence API
        const generateResponse = await fetch(`/api/events/${eventId}/intelligence`, {
          method: 'POST',
        });
        
        if (!generateResponse.ok) {
          throw new Error("Failed to generate insights");
        }
        
        // After generation, try to get insights again
        response = await fetch(`/api/events/board/insights/${eventId}`);
      }
      
      if (!response.ok) {
        throw new Error("Failed to load insights");
      }
      
      const data = await response.json();
      setInsights(data);
      saveCachedInsights(eventId, data);
      
      if (isBackgroundRefresh) {
        toast.success("Insights refreshed", { duration: 2000 });
      }
    } catch (err: any) {
      setError(err.message || "Failed to load insights");
      // Don't show error toast if we have cached data
      if (!isBackgroundRefresh || !insights) {
        toast.error("Failed to load insights", { description: err.message });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (!eventId) return null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Side Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-slate-900",
          "border-l border-slate-200 dark:border-slate-700 shadow-xl z-50",
          "transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Event Insights
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Comprehensive analysis of attendees, trends, and positioning opportunities
              </p>
            </div>
            <div className="flex items-center gap-2">
              {insights?.insightScore && (
                <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                  <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <div className="text-right">
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Score</div>
                    <div className={`text-lg font-bold ${
                      insights.insightScore.overallScore >= 0.7
                        ? 'text-green-600 dark:text-green-400'
                        : insights.insightScore.overallScore >= 0.4
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {Math.round(insights.insightScore.overallScore * 100)}%
                    </div>
                  </div>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadInsights(false)}
                disabled={loading || refreshing}
                className="h-8 w-8 p-0"
                title="Refresh insights"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading && !insights && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 mb-2" />
                <p className="text-sm text-slate-600 dark:text-slate-400">Generating insights...</p>
              </div>
            )}

            {error && !insights && (
              <div className="text-center py-8">
                <p className="text-red-600 dark:text-red-400 mb-2">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadInsights(false)}
                >
                  Try again
                </Button>
              </div>
            )}

            {insights && (
          <Tabs defaultValue="recommendations" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
              <TabsTrigger value="attendees">Attendees</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="positioning">Positioning</TabsTrigger>
              <TabsTrigger value="competitive">Competitive</TabsTrigger>
              <TabsTrigger value="discovery">Discovery</TabsTrigger>
            </TabsList>
            
            {/* Score Breakdown - Phase 2B */}
            {insights.insightScore && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-semibold text-gray-900">Score Breakdown</span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Relevance</div>
                    <div className="text-sm font-semibold text-blue-600">
                      {Math.round(insights.insightScore.breakdown?.relevance * 100 || 0)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {(insights.insightScore.breakdown?.factors?.relevance?.icpMatch * 100 || 0).toFixed(0)}% ICP Match
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Impact</div>
                    <div className="text-sm font-semibold text-green-600">
                      {Math.round(insights.insightScore.breakdown?.impact * 100 || 0)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {insights.insightScore.breakdown?.factors?.impact?.roiEstimate ? 
                        `${Math.round(insights.insightScore.breakdown.factors.impact.roiEstimate * 100)}% ROI` : 
                        'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Urgency</div>
                    <div className="text-sm font-semibold text-orange-600">
                      {Math.round(insights.insightScore.breakdown?.urgency * 100 || 0)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {insights.insightScore.breakdown?.factors?.urgency?.timeSensitivity ? 
                        `${Math.round(insights.insightScore.breakdown.factors.urgency.timeSensitivity * 100)}% Time Sensitive` : 
                        'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Confidence</div>
                    <div className="text-sm font-semibold text-purple-600">
                      {Math.round(insights.insightScore.breakdown?.confidence * 100 || 0)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {insights.insightScore.breakdown?.factors?.confidence?.dataQuality ? 
                        `${Math.round(insights.insightScore.breakdown.factors.confidence.dataQuality * 100)}% Data Quality` : 
                        'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <TabsContent value="recommendations" className="mt-4">
              <RecommendationsInsights recommendations={insights.recommendations || []} />
            </TabsContent>
            
            <TabsContent value="attendees" className="mt-4">
              <AttendeeInsights attendees={insights.attendees} />
            </TabsContent>
            
            <TabsContent value="trends" className="mt-4">
              <TrendInsights trends={insights.trends} />
            </TabsContent>
            
            <TabsContent value="positioning" className="mt-4">
              <PositioningInsights positioning={insights.positioning} />
            </TabsContent>
            
            <TabsContent value="competitive" className="mt-4">
              <CompetitiveInsights
                context={insights.competitiveContext}
                alerts={insights.competitiveAlerts}
              />
            </TabsContent>
            
              <TabsContent value="discovery" className="mt-4">
                <CompetitorDiscovery />
              </TabsContent>
            </Tabs>
            )}
            
            {refreshing && insights && (
              <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Refreshing insights...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

