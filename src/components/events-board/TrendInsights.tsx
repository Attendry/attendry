"use client";

import React from "react";
import { TrendInsight } from "@/lib/types/event-board";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, MapPin, Calendar, Building2 } from "lucide-react";

interface TrendInsightsProps {
  trends: TrendInsight[];
}

export function TrendInsights({ trends }: TrendInsightsProps) {
  const typeIcons = {
    industry: Building2,
    event_type: Calendar,
    geographic: MapPin,
    temporal: TrendingUp,
  };

  const typeLabels = {
    industry: "Industry",
    event_type: "Event Type",
    geographic: "Location",
    temporal: "Timing",
  };

  if (trends.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <TrendingUp className="h-12 w-12 mx-auto mb-2 text-gray-300" />
        <p>No trend information available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {trends.map((trend, idx) => {
        const Icon = typeIcons[trend.type] || TrendingUp;
        const label = typeLabels[trend.type] || trend.type;

        return (
          <Card key={idx} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <Icon className="h-5 w-5 text-gray-600 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{trend.label}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {label}
                  </div>
                  {trend.description && (
                    <div className="text-xs text-gray-500 mt-1">
                      {trend.description}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {trend.type === 'temporal' && (
                  <Badge variant="outline" className="text-xs">
                    {trend.value} days
                  </Badge>
                )}
                {trend.change !== undefined && (
                  <div className={`text-xs font-medium ${
                    trend.change > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {trend.change > 0 ? '+' : ''}{trend.change.toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

