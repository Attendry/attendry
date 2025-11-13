/**
 * Event Comparison Component
 * 
 * This component provides side-by-side event comparison with
 * detailed analysis and export capabilities.
 */

"use client";
import { useState, useEffect, useCallback, memo } from 'react';
import { EventData } from '@/lib/types/core';

/**
 * Comparison metrics interface
 */
interface ComparisonMetrics {
  dateComparison: {
    earlier: string;
    later: string;
    daysDifference: number;
  };
  locationComparison: {
    sameCountry: boolean;
    sameCity: boolean;
    distance?: number;
  };
  topicSimilarity: number;
  costComparison?: {
    cheaper: string;
    moreExpensive: string;
    priceDifference?: number;
  };
  durationComparison: {
    shorter: string;
    longer: string;
    durationDifference: number;
  };
}

/**
 * Event comparison props
 */
interface EventComparisonProps {
  events: EventData[];
  onRemoveEvent: (eventId: string) => void;
  onClearComparison: () => void;
  className?: string;
}

/**
 * Event Comparison Component
 */
const EventComparison = memo(function EventComparison({
  events,
  onRemoveEvent,
  onClearComparison,
  className = '',
}: EventComparisonProps) {
  const [comparisonMetrics, setComparisonMetrics] = useState<ComparisonMetrics | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['date', 'location', 'topic', 'duration']);
  const [isExporting, setIsExporting] = useState(false);

  // Calculate comparison metrics
  useEffect(() => {
    if (events.length >= 2) {
      const metrics = calculateComparisonMetrics(events);
      setComparisonMetrics(metrics);
    } else {
      setComparisonMetrics(null);
    }
  }, [events]);

  // Calculate comparison metrics
  const calculateComparisonMetrics = useCallback((events: EventData[]): ComparisonMetrics => {
    const [event1, event2] = events;

    // Date comparison
    const date1 = new Date(event1.starts_at || '');
    const date2 = new Date(event2.starts_at || '');
    const daysDifference = Math.abs((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));

    // Location comparison
    const sameCountry = event1.country === event2.country;
    const sameCity = event1.city === event2.city;

    // Topic similarity (simplified)
    const topicSimilarity = calculateTopicSimilarity(event1, event2);

    // Duration comparison
    const duration1 = event1.ends_at && event1.starts_at 
      ? new Date(event1.ends_at).getTime() - new Date(event1.starts_at).getTime()
      : 0;
    const duration2 = event2.ends_at && event2.starts_at
      ? new Date(event2.ends_at).getTime() - new Date(event2.starts_at).getTime()
      : 0;

    return {
      dateComparison: {
        earlier: date1 < date2 ? event1.title : event2.title,
        later: date1 < date2 ? event2.title : event1.title,
        daysDifference: Math.round(daysDifference),
      },
      locationComparison: {
        sameCountry,
        sameCity,
      },
      topicSimilarity,
      durationComparison: {
        shorter: duration1 < duration2 ? event1.title : event2.title,
        longer: duration1 < duration2 ? event2.title : event1.title,
        durationDifference: Math.abs(duration1 - duration2) / (1000 * 60 * 60), // hours
      },
    };
  }, []);

  // Calculate topic similarity
  const calculateTopicSimilarity = useCallback((event1: EventData, event2: EventData): number => {
    const words1 = (event1.title + ' ' + (event1.description || '')).toLowerCase().split(/\s+/);
    const words2 = (event2.title + ' ' + (event2.description || '')).toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return Math.round((intersection.size / union.size) * 100);
  }, []);

  // Export comparison
  const exportComparison = useCallback(async (format: 'pdf' | 'json') => {
    setIsExporting(true);
    
    try {
      const response = await fetch('/api/events/export-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events,
          metrics: comparisonMetrics,
          format,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `event-comparison-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export comparison:', error);
    } finally {
      setIsExporting(false);
    }
  }, [events, comparisonMetrics]);

  // Format date
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  // Format duration
  const formatDuration = useCallback((hours: number) => {
    if (hours < 24) {
      return `${Math.round(hours)} hours`;
    } else {
      return `${Math.round(hours / 24)} days`;
    }
  }, []);

  if (events.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">No events to compare</h3>
        <p className="text-slate-600">Add events to your comparison to see side-by-side analysis</p>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Event Comparison</h2>
            <p className="text-sm text-slate-600">Compare {events.length} events side by side</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => exportComparison('json')}
              disabled={isExporting}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              Export JSON
            </button>
            <button
              onClick={() => exportComparison('pdf')}
              disabled={isExporting}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Export PDF
            </button>
            <button
              onClick={onClearComparison}
              className="px-4 py-2 text-sm text-red-600 hover:text-red-700 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {events.map((event, index) => (
            <div key={event.id || index} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 line-clamp-2">
                  {event.title}
                </h3>
                <button
                  onClick={() => onRemoveEvent(event.id || index.toString())}
                  className="text-slate-400 hover:text-red-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                {/* Date */}
                {event.starts_at && (
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-slate-600">
                      {formatDate(event.starts_at)}
                      {event.ends_at && ` - ${formatDate(event.ends_at)}`}
                    </span>
                  </div>
                )}

                {/* Location */}
                {(event.city || event.country) && (
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm text-slate-600">
                      {[event.city, event.country].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}

                {/* Organizer */}
                {event.organizer && (
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="text-sm text-slate-600">{event.organizer}</span>
                  </div>
                )}

                {/* Description */}
                {event.description && (
                  <div>
                    <p className="text-sm text-slate-600 line-clamp-3">{event.description}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Comparison Metrics */}
        {comparisonMetrics && events.length >= 2 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Comparison Analysis</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date Comparison */}
              {selectedMetrics.includes('date') && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-medium text-slate-900 mb-2">Date Comparison</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Earlier:</span>
                      <span className="text-sm font-medium text-slate-900">{comparisonMetrics.dateComparison.earlier}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Later:</span>
                      <span className="text-sm font-medium text-slate-900">{comparisonMetrics.dateComparison.later}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Days apart:</span>
                      <span className="text-sm font-medium text-slate-900">{comparisonMetrics.dateComparison.daysDifference}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Location Comparison */}
              {selectedMetrics.includes('location') && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-medium text-slate-900 mb-2">Location Comparison</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Same country:</span>
                      <span className={`text-sm font-medium ${comparisonMetrics.locationComparison.sameCountry ? 'text-green-600' : 'text-red-600'}`}>
                        {comparisonMetrics.locationComparison.sameCountry ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Same city:</span>
                      <span className={`text-sm font-medium ${comparisonMetrics.locationComparison.sameCity ? 'text-green-600' : 'text-red-600'}`}>
                        {comparisonMetrics.locationComparison.sameCity ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Topic Similarity */}
              {selectedMetrics.includes('topic') && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-medium text-slate-900 mb-2">Topic Similarity</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Similarity:</span>
                      <span className="text-sm font-medium text-slate-900">{comparisonMetrics.topicSimilarity}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${comparisonMetrics.topicSimilarity}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Duration Comparison */}
              {selectedMetrics.includes('duration') && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-medium text-slate-900 mb-2">Duration Comparison</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Shorter:</span>
                      <span className="text-sm font-medium text-slate-900">{comparisonMetrics.durationComparison.shorter}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Longer:</span>
                      <span className="text-sm font-medium text-slate-900">{comparisonMetrics.durationComparison.longer}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Difference:</span>
                      <span className="text-sm font-medium text-slate-900">
                        {formatDuration(comparisonMetrics.durationComparison.durationDifference)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default EventComparison;
