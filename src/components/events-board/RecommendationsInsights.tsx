"use client";

import React, { useState } from "react";
import { RecommendationInsight } from "@/lib/types/event-board";
import { Lightbulb, Clock, Target, CheckCircle2, AlertCircle, Info, ChevronDown, ChevronUp } from "lucide-react";

interface RecommendationsInsightsProps {
  recommendations: RecommendationInsight[];
}

export function RecommendationsInsights({ recommendations }: RecommendationsInsightsProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="text-center py-8 text-text-secondary">
        <Lightbulb className="h-12 w-12 mx-auto mb-4 text-text-muted opacity-50" />
        <p>No recommendations available yet.</p>
        <p className="text-sm mt-2">Recommendations will appear here once event intelligence is generated.</p>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  // Sort by priority (highest first)
  const sortedRecommendations = [...recommendations].sort((a, b) => b.priority - a.priority);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'immediate':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'strategic':
        return <Target className="h-4 w-4 text-blue-600" />;
      case 'research':
        return <Info className="h-4 w-4 text-gray-600" />;
      default:
        return <Lightbulb className="h-4 w-4 text-blue-600" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'immediate':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'strategic':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      case 'research':
        return 'bg-gray-50 border-gray-200 text-gray-900';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-900';
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 0.7) return 'text-green-600';
    if (priority >= 0.4) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-text-primary">
          Actionable Recommendations ({sortedRecommendations.length})
        </h3>
      </div>

      {sortedRecommendations.map((rec) => {
        const isExpanded = expandedIds.has(rec.id);
        const priorityPercent = Math.round(rec.priority * 100);
        const confidencePercent = Math.round(rec.confidence * 100);

        return (
          <div
            key={rec.id}
            className={`border rounded-lg p-4 ${getTypeColor(rec.type)} transition-all`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {getTypeIcon(rec.type)}
                  <h4 className="font-semibold text-sm">{rec.title}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    rec.type === 'immediate'
                      ? 'bg-red-100 text-red-700'
                      : rec.type === 'strategic'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {rec.type}
                  </span>
                </div>
                <p className="text-sm mb-2 opacity-90">{rec.description}</p>
                
                {/* Priority and Confidence */}
                <div className="flex items-center gap-4 text-xs mb-2">
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    <span className={getPriorityColor(rec.priority)}>
                      Priority: {priorityPercent}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Confidence: {confidencePercent}%</span>
                  </div>
                  {rec.metadata?.timeToExecute && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{rec.metadata.timeToExecute}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expand/Collapse Button */}
              <button
                onClick={() => toggleExpand(rec.id)}
                className="text-text-muted hover:text-text-primary transition-colors"
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-current opacity-30 space-y-3">
                {/* Why */}
                <div>
                  <h5 className="font-semibold text-xs mb-1">Why it matters:</h5>
                  <p className="text-sm opacity-90">{rec.why}</p>
                </div>

                {/* When */}
                <div>
                  <h5 className="font-semibold text-xs mb-1">When to act:</h5>
                  <p className="text-sm opacity-90">{rec.when}</p>
                </div>

                {/* How */}
                {rec.how && (
                  <div>
                    <h5 className="font-semibold text-xs mb-1">How to execute:</h5>
                    <div className="text-sm opacity-90 whitespace-pre-line">{rec.how}</div>
                  </div>
                )}

                {/* Expected Outcome */}
                <div>
                  <h5 className="font-semibold text-xs mb-1">Expected outcome:</h5>
                  <p className="text-sm opacity-90">{rec.expectedOutcome}</p>
                </div>

                {/* Metadata */}
                {rec.metadata && (
                  <div className="pt-2 border-t border-current opacity-20">
                    {rec.metadata.roiEstimate && (
                      <div className="text-xs mb-1">
                        <span className="font-semibold">ROI Estimate: </span>
                        {rec.metadata.roiEstimate}
                      </div>
                    )}
                    {rec.metadata.estimatedCost && (
                      <div className="text-xs mb-1">
                        <span className="font-semibold">Estimated Cost: </span>
                        {rec.metadata.estimatedCost}
                      </div>
                    )}
                    {rec.metadata.requiredResources && rec.metadata.requiredResources.length > 0 && (
                      <div className="text-xs">
                        <span className="font-semibold">Required Resources: </span>
                        {rec.metadata.requiredResources.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

