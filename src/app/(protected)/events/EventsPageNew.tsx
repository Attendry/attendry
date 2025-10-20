"use client";

import React, { useEffect, useMemo, useState, useCallback, memo } from "react";
import { PageHeader, PageHeaderActions } from "@/components/Layout/PageHeader";
import { ContentContainer } from "@/components/Layout/PageContainer";
import { EmptyEvents } from "@/components/States/EmptyState";
import { SkeletonList } from "@/components/States/LoadingState";
import { ErrorState } from "@/components/States/ErrorState";
import EventCard from "@/components/EventCard";
import EventsPagination from "@/components/EventsPagination";
import { deriveLocale, toISO2Country } from "@/lib/utils/country";
import { Button } from "@/components/ui/button";
import { Search, Clock } from "lucide-react";
import Link from "next/link";
import { SetupStatusIndicator } from "@/components/SetupStatusIndicator";
import { useRouter } from "next/navigation";
import { useSearchResults, EventRec } from "@/context/SearchResultsContext";
import { ActiveFilters } from "@/components/ActiveFilters";
import ProcessingStatusBar from "@/components/ProcessingStatusBar";

// EventRec type is now imported from SearchResultsContext

const EU = [
  { code: "EU", name: "All Europe" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "GB", name: "United Kingdom" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "SE", name: "Sweden" },
  { code: "PL", name: "Poland" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
];

function todayISO(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

interface EventsPageNewProps {
  initialSavedSet: Set<string>;
}

export default function EventsPageNew({ initialSavedSet }: EventsPageNewProps) {
  // Use SearchResultsContext for global state management
  const { state, actions } = useSearchResults();
  
  // Local UI state for search form
  const [country, setCountry] = useState<string>("EU");
  const [range, setRange] = useState<"next" | "past">("next");
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [from, setFrom] = useState<string>(todayISO());
  const [to, setTo] = useState<string>(todayISO(addDays(new Date(), 7)));
  const [keywords, setKeywords] = useState<string>("");

  const [savedSet, setSavedSet] = useState<Set<string>>(initialSavedSet);
  const [debug, setDebug] = useState<any>(null);
  const [watchlistMatches, setWatchlistMatches] = useState<Map<string, any>>(new Map());
  const [userProfile, setUserProfile] = useState<any>(null);
  const [promotionMessage, setPromotionMessage] = useState<string | null>(null);
  const [processingJobs, setProcessingJobs] = useState<any[]>([]);
  const router = useRouter();

  // Get current page events from context
  const currentPageEvents = actions.getCurrentPageEvents();

  // Poll job status for background processing
  const pollJobStatus = async (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/events/analysis-status?jobId=${jobId}`);
        const status = await response.json();
        
        if (status.success) {
          setProcessingJobs(prev => prev.map(job => 
            job.id === jobId 
              ? { 
                  ...job, 
                  status: status.status, 
                  progress: status.progress || job.progress,
                  message: status.status === 'completed' ? 'Enhancement completed!' : 
                          status.status === 'failed' ? 'Enhancement failed' : job.message,
                  result: status.result,
                  error: status.error,
                  completedAt: status.completedAt ? new Date(status.completedAt) : job.completedAt
                }
              : job
          ));
          
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(pollInterval);
            
            // If completed, trigger a refresh to show enhanced data
            if (status.status === 'completed') {
              setTimeout(() => {
                run(); // Re-run the search to get enhanced data
              }, 1000);
            }
          }
        }
      } catch (error) {
        console.error('Failed to poll job status:', error);
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds
    
    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
  };

  // Load user profile data
  useEffect(() => {
    async function loadUserProfile() {
      try {
        const response = await fetch('/api/profiles/me');
        if (response.ok) {
          const data = await response.json();
          setUserProfile(data.profile);
        }
      } catch (error) {
        console.error('Failed to load user profile:', error);
      }
    }
    loadUserProfile();
  }, []);

  // Handle promotion context from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isPromoted = urlParams.get('promoted') === 'true';
    const extractionId = urlParams.get('extractionId');
    
    if (isPromoted) {
      // Load promoted events
      loadPromotedEvents(extractionId);
      
      // Clean up URL parameters
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('promoted');
      newUrl.searchParams.delete('extractionId');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [actions]);

  const loadPromotedEvents = async (extractionId?: string | null) => {
    try {
      actions.setLoading(true);
      actions.setError(null);
      
      const params = new URLSearchParams();
      if (extractionId) {
        params.set('extractionId', extractionId);
      }
      params.set('limit', '20');
      
      const response = await fetch(`/api/events/promoted?${params}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load promoted events');
      }
      
      const events = data.events || [];
      
      // Store promoted events in context
      actions.setSearchResults(events, {
        keywords: 'Promoted Events',
        country: 'EU',
        from: new Date().toISOString().split('T')[0],
        to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        timestamp: Date.now(),
        userProfile: userProfile ? {
          industryTerms: userProfile.industry_terms || [],
          icpTerms: userProfile.icp_terms || [],
          competitors: userProfile.competitors || [],
        } : undefined,
        profileFilters: userProfile ? {
          includeIndustryMatch: true,
          includeIcpMatch: true,
          includeCompetitorMatch: true,
        } : undefined,
      }, events.length);
      
      // Show success message
      setPromotionMessage(`Successfully loaded ${events.length} promoted event${events.length !== 1 ? 's' : ''}`);
      
      // Clear message after 5 seconds
      setTimeout(() => setPromotionMessage(null), 5000);
      
    } catch (error) {
      actions.setError(error instanceof Error ? error.message : 'Failed to load promoted events');
      console.error('Failed to load promoted events:', error);
    } finally {
      actions.setLoading(false);
    }
  };

  // Keep dates in sync when advanced is OFF - matching existing logic
  useEffect(() => {
    const now = new Date();
    if (range === "next") {
      setFrom(todayISO(now));
      setTo(todayISO(addDays(now, days)));
    } else {
      setFrom(todayISO(addDays(now, -days)));
      setTo(todayISO(now));
    }
  }, [range, days]);

  // Restore search form state from context if available
  useEffect(() => {
    if (state.searchParams) {
      setKeywords(state.searchParams.keywords);
      setCountry(state.searchParams.country);
      setFrom(state.searchParams.from);
      setTo(state.searchParams.to);
    }
  }, [state.searchParams]);

  // Check watchlist matches when events change
  // Temporarily disabled until database migration is applied
  /*
  useEffect(() => {
    if (state.events.length > 0) {
      checkWatchlistMatches(state.events);
    }
  }, [state.events]);

  const checkWatchlistMatches = async (events: any[]) => {
    try {
      const response = await fetch('/api/watchlist/check-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const matchesMap = new Map();
        data.matches.forEach((match: any) => {
          matchesMap.set(match.eventId, match);
        });
        setWatchlistMatches(matchesMap);
      }
    } catch (error) {
      console.warn('Failed to check watchlist matches:', error);
    }
  };
  */

  const q = useMemo(() => keywords.trim(), [keywords]);

  // Mock data for demonstration
  const mockEvents: EventRec[] = [
    {
      id: "1",
      source_url: "https://example.com/event1",
      title: "Tech Conference 2024",
      starts_at: "2024-02-15T09:00:00Z",
      ends_at: "2024-02-15T17:00:00Z",
      city: "Berlin",
      country: "DE",
      organizer: "Tech Events GmbH",
      description: "Annual technology conference featuring the latest innovations in AI, blockchain, and cloud computing.",
      venue: "Berlin Convention Center",
      confidence: 0.95
    },
    {
      id: "2", 
      source_url: "https://example.com/event2",
      title: "Startup Pitch Day",
      starts_at: "2024-02-20T14:00:00Z",
      ends_at: "2024-02-20T18:00:00Z",
      city: "Munich",
      country: "DE",
      organizer: "Startup Hub Munich",
      description: "Join us for an exciting day of startup pitches and networking opportunities.",
      venue: "Munich Innovation Center",
      confidence: 0.88
    }
  ];

  // Advanced search handlers - matching existing architecture

  const handleQuickRange = useCallback((newRange: "next" | "past", dayWindow: 7 | 14 | 30) => {
    setRange(newRange);
    setDays(dayWindow);
    const now = new Date();
    if (newRange === "next") {
      setFrom(todayISO(now));
      setTo(todayISO(addDays(now, dayWindow)));
    } else {
      setFrom(todayISO(addDays(now, -dayWindow)));
      setTo(todayISO(now));
    }
  }, []);

  const handleResetFilters = useCallback(() => {
    setKeywords('');
    handleQuickRange('next', 7);
    setCountry('EU');
    actions.clearResults();
  }, [handleQuickRange, actions]);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (from > to) {
      actions.setError("'From' must be before 'To'");
      return;
    }
    
    actions.setError(null);
    actions.setLoading(true);
    
    try {
      const normalizedCountry = toISO2Country(country) ?? 'EU';
      const locale = deriveLocale(normalizedCountry);

      const res = await fetch(`/api/events/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userText: q,
          country: normalizedCountry,
          dateFrom: from,
          dateTo: to,
          locale,
        }),
      });
      
      let data;
      try {
        data = await res.json();
      } catch (jsonError) {
        // If response is not JSON, it's likely an HTML error page
        const text = await res.text();
        throw new Error(`Server returned non-JSON response: ${res.status} ${res.statusText}`);
      }
      
      if (!res.ok) throw new Error(data?.error || res.statusText);
      
      setDebug(data);
      const events = (data.events || data.items || []).map((e: EventRec) => ({
        ...e,
        source_url: e.source_url || e.link
      }));

      // Check for async enhancement job
      if (data.async_enhancement?.analysis_job_id) {
        const newJob = {
          id: data.async_enhancement.analysis_job_id,
          type: 'events' as const,
          status: 'processing' as const,
          progress: 0,
          message: 'Enhancing events with speaker data...',
          startedAt: new Date()
        };
        
        setProcessingJobs(prev => [...prev, newJob]);
        
        // Start polling for job status
        pollJobStatus(data.async_enhancement.analysis_job_id);
      }

      // Store results in context with user profile data
      actions.setSearchResults(events, {
        keywords: q,
        country: normalizedCountry,
        from,
        to,
        timestamp: Date.now(),
        userProfile: userProfile ? {
          industryTerms: userProfile.industry_terms || [],
          icpTerms: userProfile.icp_terms || [],
          competitors: userProfile.competitors || [],
        } : undefined,
        profileFilters: userProfile ? {
          includeIndustryMatch: true,
          includeIcpMatch: true,
          includeCompetitorMatch: true,
        } : undefined,
      }, events.length);
      
    } catch (err) {
      actions.setError(err instanceof Error ? err.message : "Failed to load events");
      console.error("Search error:", err);
    }
  }

  // Use current page events from context instead of local state
  const filteredEvents = useMemo(() => {
    return currentPageEvents; // Events are already filtered by the API and paginated
  }, [currentPageEvents]);

  const breadcrumbs = [
    { label: "Events" }
  ];

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Discover and manage your event calendar"
        breadcrumbs={breadcrumbs}
        actions={
          <PageHeaderActions
            primary={{
              label: "Search Events",
              onClick: run,
              loading: state.isLoading
            }}
            tertiary={{
              label: 'Clear Filters',
              onClick: handleResetFilters
            }}
          />
        }
      >
        <div className="mb-6">
          <SetupStatusIndicator />
        </div>
        <form onSubmit={run} className="space-y-4">
          {/* Search Input */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                name="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {EU.map(country => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={state.isLoading}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors duration-200"
              >
                {state.isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 0v4a8 8 0 108 8h-4l3.5 3.5L24 12h-4a8 8 0 00-8-8z"></path>
                    </svg>
                    Searching…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Search
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Time Range Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Time Range</label>
              <div className="space-y-3">
                {/* Range Selection (Next/Past) */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleQuickRange('next', days)}
                    className={`px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                      range === "next" 
                        ? "bg-blue-600 text-white shadow-sm" 
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    Next {days} days
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickRange('past', days)}
                    className={`px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                      range === "past" 
                        ? "bg-blue-600 text-white shadow-sm" 
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover-bg-gray-600"
                    }`}
                  >
                    Past {days} days
                  </button>
                </div>
                
                {/* Days Selection */}
                <div className="grid grid-cols-3 gap-2">
                  {[7, 14, 30].map((window) => (
                    <button
                      key={window}
                      type="button"
                      onClick={() => handleQuickRange(range, window as 7 | 14 | 30)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                        days === window
                          ? "bg-green-600 text-white shadow-sm"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      {window} days
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Advanced Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Custom Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <span>Need to adjust your search profile?</span>
          <button
            type="button"
            onClick={() => router.push('/admin')}
            className="text-blue-600 hover:text-blue-500 font-medium"
          >
            Go to settings →
          </button>
        </div>
      </PageHeader>

      {/* Promotion Success Message */}
      {promotionMessage && (
        <div className="px-6 py-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                {promotionMessage}
              </span>
              <button
                onClick={() => setPromotionMessage(null)}
                className="ml-auto text-green-600 hover:text-green-500"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {state.hasResults && state.searchParams && (
        <div className="px-6 py-4">
          <ActiveFilters
            searchParams={state.searchParams}
            onClearFilters={handleResetFilters}
            onModifySearch={() => {
              // Scroll to search form
              const searchForm = document.querySelector('form');
              if (searchForm) {
                searchForm.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            onRefresh={run}
            showTimestamp={true}
            compact={false}
          />
        </div>
      )}

      <ContentContainer>
        <div className="py-6">
          {/* Show search timestamp if we have cached results */}
          {state.hasResults && state.lastSearchTimestamp && (
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Clock className="w-4 h-4" />
              <span>
                Showing results from {new Date(state.lastSearchTimestamp).toLocaleString()}
              </span>
              <button
                onClick={actions.clearResults}
                className="text-blue-600 hover:text-blue-500 font-medium"
              >
                Clear & New Search
              </button>
            </div>
          )}

          {/* Content */}
          {state.isLoading ? (
            <SkeletonList count={3} />
          ) : state.error ? (
            <ErrorState
              title="Failed to load events"
              message={state.error}
              action={{
                label: "Try Again",
                onClick: run
              }}
            />
          ) : filteredEvents.length === 0 ? (
            <EmptyEvents />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {state.pagination.totalResults} event{state.pagination.totalResults !== 1 ? 's' : ''} found
                </h2>
              </div>
              
              <div className="grid gap-4">
                {filteredEvents.map((event) => (
                  <EventCard
                    key={event.id || event.source_url}
                    ev={event as any}
                    initiallySaved={savedSet.has(event.id || event.source_url)}
                    watchlistMatch={watchlistMatches.get(event.id || event.source_url)}
                    onAddToComparison={(event) => {
                      console.log('Add to comparison:', event);
                    }}
                  />
                ))}
              </div>

              {/* Pagination */}
              <EventsPagination className="mt-6" />
            </div>
          )}
        </div>
      </ContentContainer>
      
      {/* Processing Status Bar */}
      <ProcessingStatusBar 
        jobs={processingJobs}
        onJobComplete={(job) => {
          console.log('Job completed:', job);
          // Optionally trigger a refresh when enhancement completes
          if (job.status === 'completed') {
            setTimeout(() => run(), 1000);
          }
        }}
        onRefresh={run}
      />
    </>
  );
}
