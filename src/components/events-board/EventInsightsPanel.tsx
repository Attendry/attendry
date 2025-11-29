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
import { RecommendationsInsights } from "./RecommendationsInsights";
import { CompetitiveInsights } from "./CompetitiveInsights";
import { CompetitorDiscovery } from "../competitive-intelligence/CompetitorDiscovery";
import { EventInsightsResponse } from "@/lib/types/event-board";
import { Loader2, BarChart3 } from "lucide-react";

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
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Event Insights</DialogTitle>
              <DialogDescription>
                Comprehensive analysis of attendees, trends, and positioning opportunities
              </DialogDescription>
            </div>
            {insights?.insightScore && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <div className="text-right">
                  <div className="text-xs text-blue-600 font-medium">Insight Score</div>
                  <div className={`text-lg font-bold ${
                    insights.insightScore.overallScore >= 0.7
                      ? 'text-green-600'
                      : insights.insightScore.overallScore >= 0.4
                      ? 'text-yellow-600'
                      : 'text-gray-600'
                  }`}>
                    {Math.round(insights.insightScore.overallScore * 100)}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-text-secondary">Generating insights...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-danger mb-2">{error}</p>
            <button
              onClick={loadInsights}
              className="text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && insights && (
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
      </DialogContent>
    </Dialog>
  );
}

