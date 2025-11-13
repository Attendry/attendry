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
  Sparkles
} from 'lucide-react';
import { EventData } from '@/lib/types/core';

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
          setIntelligence({
            cached: false,
            loading: false
          });
        } else {
          setIntelligence({
            discussions: data.discussions,
            sponsors: data.sponsors,
            location: data.location,
            outreach: data.outreach,
            cached: data.cached || false,
            loading: false
          });
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
                    hasOutreach: !!result.outreach
                  });
                  
                  // Update state directly with the response data
                  setIntelligence({
                    discussions: result.discussions,
                    sponsors: result.sponsors,
                    location: result.location,
                    outreach: result.outreach,
                    cached: result.cached || false,
                    loading: false
                  });
                  
                  // Also reload to ensure we have the latest
                  await loadIntelligence();
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

          {/* View Full Link */}
          <button
            onClick={onViewFull}
            className="w-full mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1"
          >
            View Full Intelligence
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

