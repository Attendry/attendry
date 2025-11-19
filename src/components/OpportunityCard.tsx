/**
 * PHASE 2: Opportunity Card Component
 * 
 * Displays a single opportunity with signal-rich information, temporal intelligence,
 * and feedback actions. This is the core UI component for the opportunity feed.
 */

"use client";

import React, { useState } from 'react';
import { 
  Calendar, 
  MapPin, 
  Building2, 
  Users, 
  TrendingUp, 
  AlertCircle,
  X,
  Save,
  MoreVertical,
  Clock,
  Target,
  CheckCircle2,
  RefreshCw,
  Info
} from 'lucide-react';
import { TemporalIntelligenceEngine } from '@/lib/services/temporal-intelligence-engine';
import { toast } from 'sonner';

interface Opportunity {
  id: string;
  event: {
    id: string;
    title: string;
    starts_at: string | null;
    ends_at: string | null;
    city: string | null;
    country: string | null;
    venue: string | null;
    organizer: string | null;
    description: string | null;
    topics: string[] | null;
    source_url: string;
  };
  signals: {
    target_accounts_attending: number;
    icp_matches: number;
    competitor_presence: boolean;
    account_connections: Array<{
      account_name: string;
      confidence_score: number;
      verification_source: string;
      speakers: Array<{ name: string; title: string }>;
    }>;
  };
  relevance: {
    score: number;
    reasons: string[];
    signal_strength: 'strong' | 'medium' | 'weak';
  };
  action_timing: {
    urgency: 'critical' | 'high' | 'medium' | 'low';
    optimal_outreach_date: string;
    days_until_event: number;
    action_window_status: 'open' | 'closing_soon' | 'closed';
    recommended_actions: string[];
  } | null;
  status: 'new' | 'viewed' | 'saved' | 'actioned' | 'dismissed';
  dismissal_reason?: string;
  discovery_method: string;
  created_at: string;
}

interface OpportunityCardProps {
  opportunity: Opportunity;
  onDismiss: (id: string, reason: string) => void;
  onSave: (id: string) => void;
  lifecycleInfo?: {
    has_updates: boolean;
    update_summary: string;
    staleness_score: number;
  };
}

export default function OpportunityCard({
  opportunity,
  onDismiss,
  onSave,
  lifecycleInfo
}: OpportunityCardProps) {
  const [showDismissMenu, setShowDismissMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { event, signals, relevance, action_timing, status } = opportunity;

  // Format date
  const eventDate = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : 'TBA';

  // Format location
  const location = [event.city, event.country].filter(Boolean).join(', ') || 'Location TBA';

  // Urgency badge styling
  const getUrgencyBadge = () => {
    if (!action_timing) return null;

    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-gray-100 text-gray-800 border-gray-300'
    };

    const labels = {
      critical: 'Act now',
      high: 'This week',
      medium: 'This month',
      low: 'Monitor'
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[action_timing.urgency]}`}
      >
        <AlertCircle className="w-3 h-3 mr-1" />
        {labels[action_timing.urgency]}
      </span>
    );
  };

  // Signal strength badge
  const getSignalStrengthBadge = () => {
    const colors = {
      strong: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      weak: 'bg-gray-100 text-gray-800'
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[relevance.signal_strength]}`}
      >
        {relevance.signal_strength} signal
      </span>
    );
  };

  const handleSave = async () => {
    if (isSaving || status === 'saved') return;
    setIsSaving(true);
    try {
      await onSave(opportunity.id);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDismiss = (reason: string) => {
    setShowDismissMenu(false);
    onDismiss(opportunity.id, reason);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-semibold text-gray-900">{event.title}</h3>
            {status === 'new' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                New
              </span>
            )}
            {status === 'saved' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Saved
              </span>
            )}
          </div>

          {/* Event Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{eventDate}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{location}</span>
            </div>
            {event.venue && (
              <div className="flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                <span>{event.venue}</span>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {action_timing && getUrgencyBadge()}
            {getSignalStrengthBadge()}
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
              {relevance.score}% match
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {status !== 'saved' && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Save opportunity"
            >
              <Save className="w-5 h-5" />
            </button>
          )}
          
          <div className="relative">
            <button
              onClick={() => setShowDismissMenu(!showDismissMenu)}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Dismiss opportunity"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showDismissMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDismissMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  <div className="py-1">
                    <button
                      onClick={() => handleDismiss('not_icp')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Not my ICP
                    </button>
                    <button
                      onClick={() => handleDismiss('irrelevant_event')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Irrelevant event
                    </button>
                    <button
                      onClick={() => handleDismiss('already_know')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Already know this
                    </button>
                    <button
                      onClick={() => handleDismiss('bad_match')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Bad match
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Signals Section */}
      <div className="mb-4 space-y-3">
        {/* Target Accounts */}
        {signals.target_accounts_attending > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-blue-900">
                {signals.target_accounts_attending} Target Account{signals.target_accounts_attending !== 1 ? 's' : ''} Attending
              </span>
            </div>
            <div className="space-y-1">
              {signals.account_connections.slice(0, 3).map((conn, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-blue-800">{conn.account_name}</span>
                  <span className="text-blue-600 font-medium">
                    {conn.confidence_score}% confidence
                  </span>
                </div>
              ))}
              {signals.account_connections.length > 3 && (
                <div className="text-xs text-blue-600">
                  +{signals.account_connections.length - 3} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* ICP Matches */}
        {signals.icp_matches > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Users className="w-4 h-4 text-green-600" />
            <span>
              <strong>{signals.icp_matches}</strong> ICP match{signals.icp_matches !== 1 ? 'es' : ''}
            </span>
          </div>
        )}

        {/* Competitor Presence */}
        {signals.competitor_presence && (
          <div className="flex items-center gap-2 text-sm text-orange-700">
            <AlertCircle className="w-4 h-4" />
            <span>Competitor presence detected</span>
          </div>
        )}

        {/* Relevance Reasons */}
        {relevance.reasons.length > 0 && (
          <div className="text-sm text-gray-600">
            <strong>Why this matters:</strong>{' '}
            {relevance.reasons.slice(0, 2).join(', ')}
            {relevance.reasons.length > 2 && ` +${relevance.reasons.length - 2} more`}
          </div>
        )}
      </div>

      {/* Temporal Intelligence */}
      {action_timing && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-gray-600" />
            <span className="font-semibold text-gray-900">Action Timing</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Days until event:</span>
              <span className="font-medium">
                {TemporalIntelligenceEngine.formatDaysUntil(action_timing.days_until_event)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Optimal outreach:</span>
              <span className="font-medium">
                {new Date(action_timing.optimal_outreach_date).toLocaleDateString()}
              </span>
            </div>
            {action_timing.action_window_status === 'closing_soon' && (
              <div className="text-orange-600 font-medium">
                ⚠️ Action window closing soon
              </div>
            )}
            {action_timing.recommended_actions.length > 0 && (
              <div className="mt-2">
                <div className="text-gray-600 mb-1">Recommended actions:</div>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  {action_timing.recommended_actions.slice(0, 3).map((action, idx) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lifecycle Updates */}
      {lifecycleInfo && lifecycleInfo.has_updates && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <Info className="w-4 h-4" />
            <span>{lifecycleInfo.update_summary}</span>
            <button
              className="ml-auto flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
              title="Refresh opportunity data"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Staleness Warning */}
      {lifecycleInfo && lifecycleInfo.staleness_score > 70 && (
        <div className="mt-2 text-xs text-orange-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          <span>Event data may be outdated (staleness: {lifecycleInfo.staleness_score}%)</span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
        <span>
          Discovered via {opportunity.discovery_method?.replace('_', ' ') || 'profile match'}
        </span>
        <a
          href={event.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 hover:underline"
        >
          View event →
        </a>
      </div>
    </div>
  );
}

