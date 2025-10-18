"use client";

import React, { useState, useMemo } from "react";
import { Calendar, MapPin, Clock, Star, Users, Building, TrendingUp, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

interface RelevantEvent {
  id: string;
  title: string;
  starts_at?: string;
  ends_at?: string;
  city?: string;
  country?: string;
  venue?: string;
  organizer?: string;
  description?: string;
  topics?: string[];
  speakers?: any[];
  sponsors?: any[];
  participating_organizations?: string[];
  partners?: string[];
  competitors?: string[];
  confidence?: number;
  data_completeness?: number;
  source_url?: string;
  relevance: {
    score: number;
    reasons: string[];
    matchedTerms: {
      industry: string[];
      icp: string[];
      competitors: string[];
    };
  };
}

interface RelevantEventsCalendarProps {
  events: RelevantEvent[];
  onRefresh?: () => void;
}

export default function RelevantEventsCalendar({ events, onRefresh }: RelevantEventsCalendarProps) {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'title'>('relevance');
  const [showDetails, setShowDetails] = useState<Set<string>>(new Set());
  const [promotingEvents, setPromotingEvents] = useState<Set<string>>(new Set());
  const [promotionState, setPromotionState] = useState<{
    promotedEvents: Map<string, any>;
    showResults: Set<string>;
  }>({
    promotedEvents: new Map(),
    showResults: new Set()
  });

  // Sort events based on selected criteria
  const sortedEvents = useMemo(() => {
    const sorted = [...events];
    
    switch (sortBy) {
      case 'relevance':
        return sorted.sort((a, b) => b.relevance.score - a.relevance.score);
      case 'date':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.starts_at || '');
          const dateB = new Date(b.starts_at || '');
          return dateA.getTime() - dateB.getTime();
        });
      case 'title':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return sorted;
    }
  }, [events, sortBy]);

  const toggleDetails = (eventId: string) => {
    const newShowDetails = new Set(showDetails);
    if (newShowDetails.has(eventId)) {
      newShowDetails.delete(eventId);
    } else {
      newShowDetails.add(eventId);
    }
    setShowDetails(newShowDetails);
  };

  const togglePromotionResults = (eventId: string) => {
    setPromotionState(prev => {
      const newShowResults = new Set(prev.showResults);
      if (newShowResults.has(eventId)) {
        newShowResults.delete(eventId);
      } else {
        newShowResults.add(eventId);
      }
      return {
        ...prev,
        showResults: newShowResults
      };
    });
  };

  const promoteEvent = async (eventId: string) => {
    console.log('Starting promotion for event:', eventId);
    console.log('Event ID type:', typeof eventId);
    console.log('Event ID length:', eventId.length);
    setPromotingEvents(prev => new Set(prev).add(eventId));
    
    try {
      console.log('Making fetch request to /api/events/promote');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
      
      const response = await fetch('/api/events/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log('Received response:', { status: response.status, statusText: response.statusText, ok: response.ok });
      
      let data;
      try {
        data = await response.json();
        console.log('Parsed response data:', data);
        console.log('Response data keys:', Object.keys(data));
        console.log('Has analysisResults?', !!data.analysisResults);
        console.log('AnalysisResults type:', typeof data.analysisResults);
        console.log('AnalysisResults keys:', data.analysisResults ? Object.keys(data.analysisResults) : 'none');
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        // Don't try to read response.text() here as the body stream is already consumed
        throw new Error(`Server returned invalid JSON response: ${response.status} ${response.statusText}`);
      }
      
      if (!response.ok) {
        console.error('Response not OK:', data);
        const errorMessage = data?.error || data?.message || `Server error: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      // Store the promotion result and show it inline
      console.log('Promotion successful, storing result:', { eventId, extractionId: data.extractionId, analysisResults: data.analysisResults });
      
      // Update both states together to ensure consistency
      const promotionResult = {
        extractionId: data.extractionId,
        promotedAt: new Date().toISOString(),
        status: 'success',
        analysisResults: data.analysisResults // Store the analysis results
      };
      
      console.log('Setting promotion result:', promotionResult);
      
      // Update promotion state atomically
      setPromotionState(prev => {
        const newPromotedEvents = new Map(prev.promotedEvents);
        const newShowResults = new Set(prev.showResults);
        
        console.log('Storing promotion result for eventId:', eventId);
        console.log('EventId type:', typeof eventId);
        console.log('EventId length:', eventId.length);
        
        newPromotedEvents.set(eventId, promotionResult);
        newShowResults.add(eventId);
        
        console.log('Updated promotion state:', {
          storedEventId: eventId,
          promotedEvents: newPromotedEvents,
          showResults: newShowResults,
          hasEventId: newPromotedEvents.has(eventId),
          showResultsHasEventId: newShowResults.has(eventId),
          promotionResult: promotionResult,
          hasAnalysisResults: !!promotionResult.analysisResults,
          allStoredEventIds: Array.from(newPromotedEvents.keys())
        });
        
        return {
          promotedEvents: newPromotedEvents,
          showResults: newShowResults
        };
      });
      
      // Optionally refresh the calendar
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to promote event:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        eventId,
        isAbortError: error instanceof Error && error.name === 'AbortError'
      });
      
      // Store error state
      setPromotionState(prev => {
        const newPromotedEvents = new Map(prev.promotedEvents);
        const newShowResults = new Set(prev.showResults);
        
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            errorMessage = 'Request timed out. The analysis is taking longer than expected.';
          } else if (error.message.includes('Failed to execute')) {
            errorMessage = 'Network error occurred. Please try again.';
          } else {
            errorMessage = error.message;
          }
        }
        
        newPromotedEvents.set(eventId, {
          error: errorMessage,
          promotedAt: new Date().toISOString(),
          status: 'error'
        });
        
        newShowResults.add(eventId);
        
        return {
          promotedEvents: newPromotedEvents,
          showResults: newShowResults
        };
      });
    } finally {
      setPromotingEvents(prev => {
        const newSet = new Set(prev);
        newSet.delete(eventId);
        return newSet;
      });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 0.7) return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
    if (score >= 0.4) return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20';
    return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20';
  };

  const getRelevanceLabel = (score: number) => {
    if (score >= 0.7) return 'Very Relevant';
    if (score >= 0.4) return 'Relevant';
    return 'Somewhat Relevant';
  };

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {events.length} Relevant Events Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Events matched to your profile and interests
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Sort controls */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="relevance">Sort by Relevance</option>
            <option value="date">Sort by Date</option>
            <option value="title">Sort by Title</option>
          </select>

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm">Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Events list */}
      <div className="space-y-4">
        {sortedEvents.map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Event title and relevance */}
                <div className="flex items-start gap-3 mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                    {event.title}
                  </h3>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${getRelevanceColor(event.relevance.score)}`}>
                    {getRelevanceLabel(event.relevance.score)} ({Math.round(event.relevance.score * 100)}%)
                  </div>
                </div>

                {/* Event details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    {event.starts_at && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(event.starts_at)}</span>
                      </div>
                    )}
                    
                    {(event.city || event.country) && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <MapPin className="w-4 h-4" />
                        <span>{[event.city, event.country].filter(Boolean).join(', ')}</span>
                      </div>
                    )}

                    {event.venue && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Building className="w-4 h-4" />
                        <span>{event.venue}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {event.organizer && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Users className="w-4 h-4" />
                        <span>{event.organizer}</span>
                      </div>
                    )}

                    {event.speakers && event.speakers.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Users className="w-4 h-4" />
                        <span>{event.speakers.length} speaker{event.speakers.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}

                    {event.confidence && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <TrendingUp className="w-4 h-4" />
                        <span>{Math.round(event.confidence * 100)}% confidence</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Relevance reasons */}
                {event.relevance.reasons.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Why this event is relevant:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {event.relevance.reasons.slice(0, 3).map((reason, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs rounded-md"
                        >
                          {reason}
                        </span>
                      ))}
                      {event.relevance.reasons.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-md">
                          +{event.relevance.reasons.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Topics */}
                {event.topics && event.topics.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {event.topics.slice(0, 5).map((topic, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-md"
                        >
                          {topic}
                        </span>
                      ))}
                      {event.topics.length > 5 && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-md">
                          +{event.topics.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Description */}
                {event.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {event.description}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <a
                  href={event.source_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <span>View Event</span>
                </a>
                
                {promotionState.promotedEvents.has(event.id) ? (
                  <button
                    onClick={() => {
                      console.log('Toggling promotion results for event:', event.id);
                      togglePromotionResults(event.id);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>{promotionState.showResults.has(event.id) ? 'Hide' : 'Show'} Results</span>
                  </button>
                ) : (
                  <button
                    onClick={() => promoteEvent(event.id)}
                    disabled={promotingEvents.has(event.id)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {promotingEvents.has(event.id) ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Promoting...</span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4" />
                        <span>Promote to Analysis</span>
                      </>
                    )}
                  </button>
                )}
                
                <button
                  onClick={() => toggleDetails(event.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium rounded-lg transition-colors"
                >
                  <span>{showDetails.has(event.id) ? 'Hide' : 'Show'} Details</span>
                </button>
              </div>
            </div>

            {/* Expanded details */}
            {showDetails.has(event.id) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Matched terms */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Matched Terms
                    </h4>
                    <div className="space-y-2">
                      {event.relevance.matchedTerms.industry.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Industry:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {event.relevance.matchedTerms.industry.map((term, idx) => (
                              <span key={idx} className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-xs rounded">
                                {term}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {event.relevance.matchedTerms.icp.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">ICP:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {event.relevance.matchedTerms.icp.map((term, idx) => (
                              <span key={idx} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs rounded">
                                {term}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {event.relevance.matchedTerms.competitors.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Competitors:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {event.relevance.matchedTerms.competitors.map((term, idx) => (
                              <span key={idx} className="px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-xs rounded">
                                {term}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Additional info */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Additional Information
                    </h4>
                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      {event.participating_organizations && event.participating_organizations.length > 0 && (
                        <div>
                          <span className="font-medium">Participating Organizations:</span>
                          <div className="mt-1">
                            {event.participating_organizations.slice(0, 3).join(', ')}
                            {event.participating_organizations.length > 3 && ` +${event.participating_organizations.length - 3} more`}
                          </div>
                        </div>
                      )}
                      
                      {event.sponsors && event.sponsors.length > 0 && (
                        <div>
                          <span className="font-medium">Sponsors:</span>
                          <div className="mt-1">
                            {event.sponsors.slice(0, 3).map((sponsor: any) => sponsor.name).join(', ')}
                            {event.sponsors.length > 3 && ` +${event.sponsors.length - 3} more`}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Promotion Results */}
            {(() => {
              const shouldShow = promotionState.showResults.has(event.id) && promotionState.promotedEvents.has(event.id);
              const promotedData = promotionState.promotedEvents.get(event.id);
              console.log('RENDER: Should show promotion results for event', event.id, ':', shouldShow, {
                checkingEventId: event.id,
                eventIdType: typeof event.id,
                eventIdLength: event.id.length,
                showResults: promotionState.showResults.has(event.id),
                promotedEvents: promotionState.promotedEvents.has(event.id),
                promotedEventData: promotedData,
                hasAnalysisResults: !!promotedData?.analysisResults,
                analysisResultsKeys: promotedData?.analysisResults ? Object.keys(promotedData.analysisResults) : [],
                allPromotedEvents: Array.from(promotionState.promotedEvents.keys()),
                allShowResults: Array.from(promotionState.showResults)
              });
              return shouldShow;
            })() && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
              >
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <h4 className="text-sm font-medium text-green-900 dark:text-green-100">
                      Promotion Results
                    </h4>
                  </div>
                  
                  {promotionState.promotedEvents.get(event.id)?.status === 'success' ? (
                    <div className="space-y-3">
                      <div className="text-sm text-green-800 dark:text-green-200">
                        ✅ Event successfully analyzed!
                      </div>
                      
                      {/* Analysis Results */}
                      {promotionState.promotedEvents.get(event.id)?.analysisResults && (
                        <div className="space-y-3">
                          {/* Event Metadata */}
                          {promotionState.promotedEvents.get(event.id)?.analysisResults?.event && (
                            <div className="bg-white dark:bg-gray-800 rounded-md p-3 border border-gray-200 dark:border-gray-600">
                              <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Event Details</h5>
                              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                                <div><strong>Title:</strong> {promotionState.promotedEvents.get(event.id)?.analysisResults?.event?.title}</div>
                                <div><strong>Date:</strong> {promotionState.promotedEvents.get(event.id)?.analysisResults?.event?.date}</div>
                                <div><strong>Location:</strong> {promotionState.promotedEvents.get(event.id)?.analysisResults?.event?.location}</div>
                                <div><strong>Organizer:</strong> {promotionState.promotedEvents.get(event.id)?.analysisResults?.event?.organizer}</div>
                              </div>
                            </div>
                          )}
                          
                          {/* Speakers */}
                          {promotionState.promotedEvents.get(event.id)?.analysisResults?.speakers && 
                           promotionState.promotedEvents.get(event.id)?.analysisResults?.speakers?.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-md p-3 border border-gray-200 dark:border-gray-600">
                              <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                Speakers Found ({promotionState.promotedEvents.get(event.id)?.analysisResults?.speakers?.length})
                              </h5>
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {promotionState.promotedEvents.get(event.id)?.analysisResults?.speakers?.slice(0, 5).map((speaker: any, index: number) => (
                                  <div key={index} className="text-xs text-gray-600 dark:text-gray-300 border-l-2 border-blue-200 pl-2">
                                    <div className="font-medium">{speaker.name}</div>
                                    {speaker.title && <div className="text-gray-500">{speaker.title}</div>}
                                    {speaker.company && <div className="text-gray-500">{speaker.company}</div>}
                                  </div>
                                ))}
                                {promotionState.promotedEvents.get(event.id)?.analysisResults?.speakers?.length > 5 && (
                                  <div className="text-xs text-gray-500 italic">
                                    ... and {promotionState.promotedEvents.get(event.id)?.analysisResults?.speakers?.length - 5} more speakers
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Crawl Stats */}
                          {promotionState.promotedEvents.get(event.id)?.analysisResults?.crawl_stats && (
                            <div className="bg-white dark:bg-gray-800 rounded-md p-3 border border-gray-200 dark:border-gray-600">
                              <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Analysis Stats</h5>
                              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
                                <div><strong>Pages Crawled:</strong> {promotionState.promotedEvents.get(event.id)?.analysisResults?.crawl_stats?.pages_crawled}</div>
                                <div><strong>Content Length:</strong> {promotionState.promotedEvents.get(event.id)?.analysisResults?.crawl_stats?.total_content_length?.toLocaleString()} chars</div>
                                <div><strong>Speakers Found:</strong> {promotionState.promotedEvents.get(event.id)?.analysisResults?.crawl_stats?.speakers_found}</div>
                                <div><strong>Duration:</strong> {promotionState.promotedEvents.get(event.id)?.analysisResults?.crawl_stats?.crawl_duration_ms}ms</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="text-xs text-green-700 dark:text-green-300">
                        Extraction ID: {promotionState.promotedEvents.get(event.id)?.extractionId}
                      </div>
                      <div className="text-xs text-green-700 dark:text-green-300">
                        Promoted at: {new Date(promotionState.promotedEvents.get(event.id)?.promotedAt).toLocaleString()}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => {
                            // Navigate to events page with promotion context
                            const url = new URL('/events', window.location.origin);
                            url.searchParams.set('promoted', 'true');
                            url.searchParams.set('extractionId', promotionState.promotedEvents.get(event.id)?.extractionId || '');
                            window.location.href = url.toString();
                          }}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md transition-colors"
                        >
                          View in Events
                        </button>
                        <button
                          onClick={() => setPromotionState(prev => {
                            const newShowResults = new Set(prev.showResults);
                            newShowResults.delete(event.id);
                            return {
                              ...prev,
                              showResults: newShowResults
                            };
                          })}
                          className="px-3 py-1 border border-green-600 text-green-600 hover:bg-green-50 text-xs font-medium rounded-md transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-sm text-red-800 dark:text-red-200">
                        ❌ Failed to promote event
                      </div>
                      <div className="text-xs text-red-700 dark:text-red-300">
                        Error: {promotionState.promotedEvents.get(event.id)?.error}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => promoteEvent(event.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors"
                        >
                          Retry
                        </button>
                        <button
                          onClick={() => setPromotionState(prev => {
                            const newShowResults = new Set(prev.showResults);
                            newShowResults.delete(event.id);
                            return {
                              ...prev,
                              showResults: newShowResults
                            };
                          })}
                          className="px-3 py-1 border border-red-600 text-red-600 hover:bg-red-50 text-xs font-medium rounded-md transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Empty state */}
      {events.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No relevant events found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Try adjusting your filters or update your profile for better matches.
          </p>
        </div>
      )}
    </div>
  );
}
