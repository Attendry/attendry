"use client";

import React from "react";
import { PositioningRecommendation } from "@/lib/types/event-board";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PositioningInsightsProps {
  positioning: PositioningRecommendation[];
}

export function PositioningInsights({ positioning }: PositioningInsightsProps) {
  const actionLabels = {
    sponsor: "Sponsor",
    speak: "Speak",
    attend: "Attend",
    network: "Network",
  };

  const opportunityColors = {
    high: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-gray-100 text-gray-800",
  };

  const getScoreIcon = (score: number) => {
    if (score > 0.7) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (score > 0.4) return <Minus className="h-4 w-4 text-yellow-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  if (positioning.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Target className="h-12 w-12 mx-auto mb-2 text-gray-300" />
        <p>No positioning recommendations available</p>
        <p className="text-xs mt-2">Complete your profile for personalized recommendations</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {positioning.map((rec, idx) => (
        <Card key={idx} className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-gray-600" />
              <div className="font-medium text-sm">
                {actionLabels[rec.action] || rec.action}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getScoreIcon(rec.score)}
              <Badge className={opportunityColors[rec.opportunity]}>
                {rec.opportunity} opportunity
              </Badge>
            </div>
          </div>
          
          <div className="text-xs text-gray-600 mb-2">
            Score: {(rec.score * 100).toFixed(0)}%
          </div>

          {rec.reasoning && rec.reasoning.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-700">Why this matters:</div>
              <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                {rec.reasoning.map((reason, reasonIdx) => (
                  <li key={reasonIdx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

