/**
 * Recommendation Engine Component
 * 
 * This component provides AI-powered event recommendations based on
 * user behavior, preferences, and industry trends.
 */

"use client";
import { useState, useEffect, useCallback, memo } from 'react';
// import { useUser } from '@supabase/auth-helpers-react';
import { EventData } from '@/lib/types/core';

/**
 * Recommendation types
 */
type RecommendationType = 
  | 'similar_events'
  | 'trending_events'
  | 'industry_events'
  | 'location_based'
  | 'time_based'
  | 'collaborative';

/**
 * Recommendation interface
 */
interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  events: EventData[];
  confidence: number;
  reason: string;
}

/**
 * Recommendation Engine Component
 */
const RecommendationEngine = memo(function RecommendationEngine() {
  // const { user } = useUser();
  const user = null; // Mock for now
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<RecommendationType | 'all'>('all');

  // Load recommendations
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!user) return;

      try {
        const response = await fetch('/api/recommendations');
        if (response.ok) {
          const data = await response.json();
          setRecommendations(data.recommendations || []);
        }
      } catch (error) {
        console.error('Failed to load recommendations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecommendations();
  }, [user]);

  // Filter recommendations by type
  const filteredRecommendations = useMemo(() => {
    if (selectedType === 'all') {
      return recommendations;
    }
    return recommendations.filter(rec => rec.type === selectedType);
  }, [recommendations, selectedType]);

  // Get recommendation type label
  const getTypeLabel = useCallback((type: RecommendationType) => {
    const labels = {
      similar_events: 'Similar Events',
      trending_events: 'Trending Events',
      industry_events: 'Industry Events',
      location_based: 'Location Based',
      time_based: 'Time Based',
      collaborative: 'Collaborative',
    };
    return labels[type];
  }, []);

  // Get recommendation type icon
  const getTypeIcon = useCallback((type: RecommendationType) => {
    const icons = {
      similar_events: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      trending_events: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      industry_events: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      location_based: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      time_based: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      collaborative: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    };
    return icons[type];
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Event Recommendations</h1>
        <p className="text-gray-600">AI-powered event suggestions based on your interests and behavior</p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Recommendations
          </button>
          {Object.values(['similar_events', 'trending_events', 'industry_events', 'location_based', 'time_based', 'collaborative'] as RecommendationType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {getTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-6">
        {filteredRecommendations.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No recommendations yet</h3>
            <p className="text-gray-600">Start exploring events to get personalized recommendations</p>
          </div>
        ) : (
          filteredRecommendations.map((recommendation) => (
            <div key={recommendation.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    {getTypeIcon(recommendation.type)}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{recommendation.title}</h2>
                    <p className="text-sm text-gray-600">{recommendation.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-sm text-gray-500">
                    {Math.round(recommendation.confidence * 100)}% confidence
                  </div>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${recommendation.confidence * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                  <strong>Why we recommend this:</strong> {recommendation.reason}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendation.events.map((event, index) => (
                  <div key={event.id || index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">{event.title}</h3>
                    
                    {event.starts_at && (
                      <div className="flex items-center space-x-2 mb-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-gray-600">
                          {new Date(event.starts_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {(event.city || event.country) && (
                      <div className="flex items-center space-x-2 mb-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm text-gray-600">
                          {[event.city, event.country].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <a
                        href={event.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        View Event
                      </a>
                      <button className="text-sm text-gray-600 hover:text-gray-800 transition-colors">
                        Save
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

export default RecommendationEngine;
