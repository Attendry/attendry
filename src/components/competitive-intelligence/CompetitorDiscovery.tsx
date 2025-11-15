/**
 * Competitor Discovery Component
 * 
 * Enhancement 4: Displays suggested competitors and allows approval
 */

'use client';

import { useState, useEffect } from 'react';
import { Search, CheckCircle2, XCircle, Loader2, Users, TrendingUp } from 'lucide-react';

interface CompetitorSuggestion {
  companyName: string;
  confidence: number;
  reasons: string[];
  evidence: {
    sharedEvents: number;
    industryMatch: boolean;
    similarActivity: boolean;
    geographicOverlap: boolean;
  };
}

export function CompetitorDiscovery() {
  const [suggestions, setSuggestions] = useState<CompetitorSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/competitive-intelligence/discover');

      if (!response.ok) {
        throw new Error('Failed to load suggestions');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (err: any) {
      console.error('Error loading suggestions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (companyName: string, approved: boolean) => {
    setProcessing(prev => new Set(prev).add(companyName));

    try {
      const response = await fetch('/api/competitive-intelligence/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          companyName,
          approved
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update competitor');
      }

      // Remove from suggestions
      setSuggestions(prev => prev.filter(s => s.companyName !== companyName));

      if (approved) {
        // Show success message
        alert(`${companyName} has been added to your competitors list`);
      }
    } catch (err: any) {
      console.error('Error approving suggestion:', err);
      alert(`Failed to ${approved ? 'add' : 'reject'} competitor: ${err.message}`);
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(companyName);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-gray-600">Discovering competitors...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-2">Error: {error}</p>
        <button
          onClick={loadSuggestions}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
        <p>No competitor suggestions found</p>
        <p className="text-sm mt-1">Add more events to your board to discover competitors</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-600" />
            Discovered Competitors
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Based on your event participation and industry
          </p>
        </div>
        <button
          onClick={loadSuggestions}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {suggestions.map((suggestion, idx) => (
          <div
            key={idx}
            className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-text-primary">{suggestion.companyName}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    suggestion.confidence >= 0.7
                      ? 'bg-green-100 text-green-700'
                      : suggestion.confidence >= 0.5
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {Math.round(suggestion.confidence * 100)}% match
                  </span>
                </div>
                
                {/* Reasons */}
                {suggestion.reasons.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {suggestion.reasons.map((reason, rIdx) => (
                      <div key={rIdx} className="flex items-center gap-1 text-xs text-gray-600">
                        <TrendingUp className="h-3 w-3" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Evidence */}
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  {suggestion.evidence.sharedEvents > 0 && (
                    <span>{suggestion.evidence.sharedEvents} shared events</span>
                  )}
                  {suggestion.evidence.industryMatch && (
                    <span>• Industry match</span>
                  )}
                  {suggestion.evidence.similarActivity && (
                    <span>• Similar activity</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleApprove(suggestion.companyName, true)}
                  disabled={processing.has(suggestion.companyName)}
                  className="p-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Add to competitors"
                >
                  {processing.has(suggestion.companyName) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => handleApprove(suggestion.companyName, false)}
                  disabled={processing.has(suggestion.companyName)}
                  className="p-2 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Not a competitor"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

