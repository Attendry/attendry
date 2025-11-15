/**
 * Competitive Insights Component
 * 
 * Displays competitive intelligence for events in the Event Board
 * Phase 2C: Competitive Intelligence
 */

import React from "react";
import { Users, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

interface CompetitiveInsightsProps {
  context?: any; // CompetitiveContext
  alerts?: any[]; // CompetitiveAlert[]
}

export function CompetitiveInsights({ context, alerts }: CompetitiveInsightsProps) {
  if (!context || (context.competitorsPresent?.length || 0) === 0) {
    return (
      <div className="text-center text-text-secondary py-8">
        <Users className="h-8 w-8 mx-auto mb-2 text-text-muted" />
        <p>No competitors detected in this event.</p>
        <p className="text-sm text-text-muted mt-1">
          Add competitors to your profile to see competitive intelligence.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Competitors Present */}
      {context.competitorsPresent && context.competitorsPresent.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-600" />
            Competitors Present
          </h3>
          <div className="space-y-2">
            {context.competitorsPresent.map((match: any, idx: number) => (
              <div key={idx} className="border border-orange-200 rounded-lg p-3 bg-orange-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-text-primary">{match.competitorName}</span>
                  <span className="text-sm text-text-muted capitalize">{match.matchType}</span>
                </div>
                <div className="text-sm text-text-secondary space-y-1">
                  <div>
                    <span className="font-medium">Role:</span> {match.matchDetails?.role || 'Unknown'}
                  </div>
                  {match.matchDetails?.organization && (
                    <div>
                      <span className="font-medium">Organization:</span> {match.matchDetails.organization}
                    </div>
                  )}
                  {match.matchDetails?.speakerName && (
                    <div>
                      <span className="font-medium">Speaker:</span> {match.matchDetails.speakerName}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-text-muted">Confidence:</span>
                    <span className={`text-xs font-semibold ${
                      match.matchConfidence >= 0.8 ? 'text-green-600' :
                      match.matchConfidence >= 0.6 ? 'text-yellow-600' :
                      'text-orange-600'
                    }`}>
                      {Math.round(match.matchConfidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Competitive Alerts
          </h3>
          <div className="space-y-2">
            {alerts.map((alert: any) => (
              <div
                key={alert.id}
                className={`border rounded-lg p-3 ${
                  alert.severity === 'high'
                    ? 'border-red-300 bg-red-50'
                    : alert.severity === 'medium'
                    ? 'border-orange-300 bg-orange-50'
                    : 'border-yellow-300 bg-yellow-50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-text-primary">{alert.title}</h4>
                  <span
                    className={`text-xs px-2 py-1 rounded font-medium ${
                      alert.severity === 'high'
                        ? 'bg-red-200 text-red-800'
                        : alert.severity === 'medium'
                        ? 'bg-orange-200 text-orange-800'
                        : 'bg-yellow-200 text-yellow-800'
                    }`}
                  >
                    {alert.severity}
                  </span>
                </div>
                <p className="text-sm text-text-secondary mb-2">{alert.description}</p>
                <div className="mt-2 pt-2 border-t border-border-light">
                  <p className="text-xs text-text-muted">
                    <strong>Recommended Action:</strong> {alert.recommendedAction}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Comparison */}
      {context.activityComparison && context.activityComparison.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            Activity Comparison
          </h3>
          <div className="space-y-3">
            {context.activityComparison.map((activity: any, idx: number) => (
              <div key={idx} className="border border-border-light rounded-lg p-3 bg-surface-soft">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-text-primary">{activity.competitorName}</span>
                  <div className="flex items-center gap-1">
                    {activity.growthRate > 0 ? (
                      <TrendingUp className="h-4 w-4 text-red-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-green-600" />
                    )}
                    <span
                      className={`text-sm font-semibold ${
                        activity.growthRate > 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {activity.growthRate > 0 ? '+' : ''}
                      {activity.growthRate.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-text-muted">Your events:</span>
                    <span className="ml-2 font-medium text-text-primary">{activity.userEventCount}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Their events:</span>
                    <span className="ml-2 font-medium text-text-primary">{activity.competitorEventCount}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-text-muted">Gap:</span>
                    <span className="ml-2 font-medium text-orange-600">
                      {activity.gapCount} event{activity.gapCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitive Gaps */}
      {context.competitiveGaps && context.competitiveGaps.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Competitive Gaps</h3>
          <div className="space-y-3">
            {context.competitiveGaps.map((gap: any, idx: number) => (
              <div key={idx} className="border border-orange-200 rounded-lg p-3 bg-orange-50/50">
                <div className="font-medium text-text-primary mb-2">{gap.competitorName}</div>
                <div className="text-sm text-text-secondary">
                  <p>
                    Attending <strong>{gap.eventsAttending?.length || 0}</strong> events, of which you're not attending{' '}
                    <strong className="text-orange-600">{gap.eventsUserNotAttending?.length || 0}</strong>.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

