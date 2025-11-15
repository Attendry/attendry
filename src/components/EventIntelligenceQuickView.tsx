/**
 * Event Intelligence Quick View Component
 * 
 * Compact intelligence preview for EventCard
 * Shows essential insights only, links to full detail page
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Brain, 
  Users, 
  MapPin, 
  Target, 
  ArrowRight, 
  Loader2,
  Sparkles,
  Lightbulb,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import { EventData } from '@/lib/types/core';
import { Recommendation } from '@/lib/services/recommendation-engine';
import { InsightScore } from '@/lib/services/insight-scoring-service';
import { CompetitiveContext, CompetitiveAlert } from '@/lib/services/competitive-intelligence-service';

interface EventIntelligenceQuickViewProps {
  event: EventData;
  onViewFull?: () => void;
}

interface QuickIntelligence {
  discussions?: {
    themes: string[];
    summary: string;
  };
  sponsors?: {
    analysis: string;
    strategicSignificance: number;
  };
  location?: {
    venueContext: string;
    localMarketInsights: string;
  };
  outreach?: {
    positioning: string;
    recommendedApproach: string;
  };
  recommendations?: Recommendation[]; // Phase 2A: Recommendations
  insightScore?: InsightScore; // Phase 2B: Insight Scoring
  competitiveContext?: CompetitiveContext; // Phase 2C: Competitive Intelligence
  competitiveAlerts?: CompetitiveAlert[]; // Phase 2C: Competitive Alerts
  cached: boolean;
  loading: boolean;
}

export function EventIntelligenceQuickView({ 
  event, 
  onViewFull 
}: EventIntelligenceQuickViewProps) {
  const [intelligence, setIntelligence] = useState<QuickIntelligence>({
    cached: false,
    loading: true
  });
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadIntelligence();
  }, [event.id, event.source_url]);

  const loadIntelligence = async () => {
    try {
      setIntelligence(prev => ({ ...prev, loading: true }));
      
      const eventId = event.id || event.source_url;
      const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/intelligence`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[EventIntelligenceQuickView] Received intelligence data:', {
          hasDiscussions: !!data.discussions,
          hasSponsors: !!data.sponsors,
          hasLocation: !!data.location,
          hasOutreach: !!data.outreach,
          status: data.status,
          cached: data.cached
        });
        
        // Check if intelligence was actually generated (not just "not_generated" status)
        if (data.status === 'not_generated') {
          // Only clear state if we don't already have intelligence data
          setIntelligence(prev => {
            if (prev.discussions || prev.sponsors || prev.location || prev.outreach) {
              // Keep existing data if we have it
              return { ...prev, loading: false };
            }
            return {
              cached: false,
              loading: false
            };
          });
        } else {
          // Only update if we have actual intelligence data
          if (data.discussions || data.sponsors || data.location || data.outreach || data.recommendations || data.insightScore || data.competitiveContext) {
            setIntelligence({
              discussions: data.discussions,
              sponsors: data.sponsors,
              location: data.location,
              outreach: data.outreach,
              recommendations: data.recommendations,
              insightScore: data.insightScore,
              competitiveContext: data.competitiveContext,
              competitiveAlerts: data.competitiveAlerts,
              cached: data.cached || false,
              loading: false
            });
          } else {
            // No intelligence data, but no error - keep existing state if we have it
            setIntelligence(prev => ({
              ...prev,
              loading: false
            }));
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[EventIntelligenceQuickView] Failed to load intelligence:', errorData);
        setIntelligence(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('[EventIntelligenceQuickView] Error loading intelligence:', error);
      setIntelligence(prev => ({ ...prev, loading: false }));
    }
  };

  if (intelligence.loading) {
    return (
      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading intelligence...</span>
        </div>
      </div>
    );
  }

  if (!intelligence.discussions && !intelligence.sponsors && !intelligence.location) {
    return (
      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Brain className="h-4 w-4" />
            <span>Intelligence not yet generated</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (generating) return;
                
                setGenerating(true);
                // Trigger generation
                const eventId = event.id || event.source_url;
                try {
                  const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/intelligence`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      event: event,
                      source_url: event.source_url
                    })
                  });
                  
                  if (response.ok) {
                    const result = await response.json();
                    console.log('[EventIntelligenceQuickView] Generation response:', {
                      hasDiscussions: !!result.discussions,
                      hasSponsors: !!result.sponsors,
                      hasLocation: !!result.location,
                      hasOutreach: !!result.outreach,
                      resultKeys: Object.keys(result)
                    });
                    
                    // Update state directly with the response data
                    // Only update if we actually have intelligence data
                    if (result.discussions || result.sponsors || result.location || result.outreach || result.recommendations || result.insightScore || result.competitiveContext) {
                      setIntelligence({
                        discussions: result.discussions,
                        sponsors: result.sponsors,
                        location: result.location,
                        outreach: result.outreach,
                        recommendations: result.recommendations,
                        insightScore: result.insightScore,
                        competitiveContext: result.competitiveContext,
                        competitiveAlerts: result.competitiveAlerts,
                        cached: result.cached || false,
                        loading: false
                      });
                      
                      // Don't reload immediately - the POST response has the data
                      // Reload after a short delay to get cached version
                      setTimeout(async () => {
                        await loadIntelligence();
                      }, 1000);
                    } else {
                      console.warn('[EventIntelligenceQuickView] POST response missing intelligence data');
                      setIntelligence(prev => ({ ...prev, loading: false }));
                    }
                  } else {
                    const error = await response.json();
                    console.error('[EventIntelligenceQuickView] Failed to generate intelligence:', error);
                    alert(`Failed to generate intelligence: ${error.error || 'Unknown error'}`);
                  }
                } catch (error: any) {
                  console.error('Error generating intelligence:', error);
                  alert(`Error generating intelligence: ${error.message || 'Unknown error'}`);
                } finally {
                  setGenerating(false);
                }
              }}
              disabled={generating}
              className={`text-xs font-medium px-3 py-1.5 rounded transition-colors ${
                generating 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
              }`}
              style={{ pointerEvents: generating ? 'none' : 'auto' }}
            >
              {generating ? (
                <>
                  <Loader2 className="h-3 w-3 inline-block animate-spin mr-1" />
                  Generating...
                </>
              ) : (
                'Generate'
              )}
            </button>
            {/* Always show View Full Intelligence link, even when not generated */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[EventIntelligenceQuickView] View Full Intelligence clicked (no intelligence)', {
                  hasCallback: !!onViewFull,
                  eventId: event.id || event.source_url,
                  eventTitle: event.title
                });
                
                if (onViewFull) {
                  onViewFull();
                } else {
                  const eventId = event.id || event.source_url;
                  if (eventId) {
                    console.log('[EventIntelligenceQuickView] Navigating to event detail:', eventId);
                    window.location.href = `/events/${encodeURIComponent(eventId)}`;
                  } else {
                    console.error('[EventIntelligenceQuickView] No event ID available for navigation');
                    alert('Unable to view full intelligence: event ID not available');
                  }
                }
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 hover:underline cursor-pointer"
            >
              View Full
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-blue-100/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-blue-900">Event Intelligence</span>
          {intelligence.insightScore && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
              intelligence.insightScore.overallScore >= 0.7
                ? 'bg-green-100 text-green-700'
                : intelligence.insightScore.overallScore >= 0.4
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {Math.round(intelligence.insightScore.overallScore * 100)}% Score
            </span>
          )}
          {intelligence.cached && (
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
              Cached
            </span>
          )}
        </div>
        <ArrowRight 
          className={`h-4 w-4 text-blue-600 transition-transform ${expanded ? 'rotate-90' : ''}`} 
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-blue-200 pt-4">
          {/* Insight Score - Phase 2B */}
          {intelligence.insightScore && (
            <div className="bg-white rounded-lg p-3 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-900">Insight Score</span>
                </div>
                <span className={`text-lg font-bold ${
                  intelligence.insightScore.overallScore >= 0.7
                    ? 'text-green-600'
                    : intelligence.insightScore.overallScore >= 0.4
                    ? 'text-yellow-600'
                    : 'text-gray-600'
                }`}>
                  {Math.round(intelligence.insightScore.overallScore * 100)}%
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="text-center">
                  <div className="font-semibold text-blue-700">Relevance</div>
                  <div className="text-blue-600">{Math.round(intelligence.insightScore.breakdown.relevance * 100)}%</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-blue-700">Impact</div>
                  <div className="text-blue-600">{Math.round(intelligence.insightScore.breakdown.impact * 100)}%</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-blue-700">Urgency</div>
                  <div className="text-blue-600">{Math.round(intelligence.insightScore.breakdown.urgency * 100)}%</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-blue-700">Confidence</div>
                  <div className="text-blue-600">{Math.round(intelligence.insightScore.breakdown.confidence * 100)}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Discussions */}
          {intelligence.discussions && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Key Themes</span>
              </div>
              <p className="text-xs text-blue-800 line-clamp-2">
                {intelligence.discussions.summary || intelligence.discussions.themes?.slice(0, 3).join(', ')}
              </p>
              {intelligence.discussions.themes && intelligence.discussions.themes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {intelligence.discussions.themes.slice(0, 3).map((theme, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sponsors */}
          {intelligence.sponsors && intelligence.sponsors.strategicSignificance > 0.5 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Sponsors</span>
              </div>
              <p className="text-xs text-blue-800 line-clamp-2">
                {intelligence.sponsors.analysis}
              </p>
            </div>
          )}

          {/* Location */}
          {intelligence.location && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Location</span>
              </div>
              <p className="text-xs text-blue-800 line-clamp-2">
                {intelligence.location.localMarketInsights || intelligence.location.venueContext}
              </p>
            </div>
          )}

          {/* Quick Outreach Tip */}
          {intelligence.outreach && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Quick Tip</span>
              </div>
              <p className="text-xs text-blue-800 line-clamp-2">
                {intelligence.outreach.recommendedApproach || intelligence.outreach.positioning}
              </p>
            </div>
          )}

          {/* Recommendations - Phase 2A */}
          {intelligence.recommendations && intelligence.recommendations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Top Recommendations</span>
              </div>
              <div className="space-y-2">
                {intelligence.recommendations.slice(0, 3).map((rec) => (
                  <div
                    key={rec.id}
                    className="border border-blue-200 rounded-lg p-2 bg-white"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-blue-900">
                            {rec.title}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            rec.type === 'immediate' 
                              ? 'bg-red-100 text-red-700'
                              : rec.type === 'strategic'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {rec.type}
                          </span>
                        </div>
                        <p className="text-xs text-blue-800 line-clamp-2">
                          {rec.description}
                        </p>
                      </div>
                    </div>
                    {rec.how && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Show how to execute in a modal or expand
                          alert(rec.how);
                        }}
                        className="mt-1 text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
                      >
                        View Steps
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitive Intelligence - Phase 2C */}
          {intelligence.competitiveContext && intelligence.competitiveContext.competitorsPresent.length > 0 && (
            <div className="border-t border-orange-200 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-blue-900">Competitive Intelligence</span>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-blue-800">
                  <strong>{intelligence.competitiveContext.competitorsPresent.length}</strong> competitor(s) present:
                </div>
                {intelligence.competitiveContext.competitorsPresent.slice(0, 3).map((match, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs bg-white border border-orange-200 rounded p-2">
                    <span className="font-medium text-blue-900">{match.competitorName}</span>
                    <span className="text-blue-600">({match.matchType})</span>
                    <span className="text-blue-500">
                      {Math.round(match.matchConfidence * 100)}% match
                    </span>
                  </div>
                ))}
                
                {/* Show alerts if any */}
                {intelligence.competitiveAlerts && intelligence.competitiveAlerts.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-orange-200">
                    <div className="flex items-center gap-1 text-xs font-medium text-orange-700 mb-1">
                      <AlertTriangle className="h-3 w-3" />
                      {intelligence.competitiveAlerts.length} alert(s)
                    </div>
                    {intelligence.competitiveAlerts.slice(0, 2).map((alert) => (
                      <div key={alert.id} className={`text-xs p-2 rounded mb-1 ${
                        alert.severity === 'high' ? 'bg-red-50 border border-red-200' :
                        alert.severity === 'medium' ? 'bg-orange-50 border border-orange-200' :
                        'bg-yellow-50 border border-yellow-200'
                      }`}>
                        <div className="font-medium text-blue-900">{alert.title}</div>
                        <div className="text-blue-700 mt-0.5 line-clamp-2">{alert.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* View Full Link */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[EventIntelligenceQuickView] View Full Intelligence clicked', {
                hasCallback: !!onViewFull,
                eventId: event.id || event.source_url,
                eventTitle: event.title
              });
              
              if (onViewFull) {
                onViewFull();
              } else {
                // Fallback: navigate to event detail page
                const eventId = event.id || event.source_url;
                if (eventId) {
                  console.log('[EventIntelligenceQuickView] Navigating to event detail:', eventId);
                  window.location.href = `/events/${encodeURIComponent(eventId)}`;
                } else {
                  console.error('[EventIntelligenceQuickView] No event ID available for navigation');
                  alert('Unable to view full intelligence: event ID not available');
                }
              }
            }}
            className="w-full mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1 hover:underline cursor-pointer"
          >
            View Full Intelligence
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

