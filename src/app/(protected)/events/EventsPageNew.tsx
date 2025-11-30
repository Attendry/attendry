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
import { Search, Clock, MessageSquare, Keyboard, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { SetupStatusIndicator } from "@/components/SetupStatusIndicator";
import { useRouter } from "next/navigation";
import { useSearchResults, EventRec } from "@/context/SearchResultsContext";
import { ActiveFilters } from "@/components/ActiveFilters";
import { SearchContextBar } from "@/components/SearchContextBar";
import { SearchProgressIndicator } from "@/components/SearchProgressIndicator";
import ProcessingStatusBar from "@/components/ProcessingStatusBar";
import NaturalLanguageSearch from "@/components/NaturalLanguageSearch";
import { SearchIntent } from "@/components/NaturalLanguageSearch";
import { fetchEvents } from "@/lib/search/client";
import { fetchEventsProgressive, type ProgressiveSearchUpdate } from "@/lib/search/progressive-client";
import { toast } from "sonner";
import { formatErrorForToast, getUserFriendlyMessage, CommonErrors } from "@/lib/errors/user-friendly-messages";
import { SearchHistoryDropdown } from "@/components/search/SearchHistoryDropdown";
import { addToSearchHistory, SearchHistoryItem, clearSearchHistory } from "@/lib/search/search-history";
import { QuickEventSearchPanel } from "@/components/search/QuickEventSearchPanel";

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

// Helper function to calculate date ranges from natural language
function calculateDateRange(timeframe: string): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  const to = new Date(today);
  
  switch (timeframe) {
    case 'past-7':
      from.setDate(today.getDate() - 7);
      to.setDate(today.getDate() - 1);
      break;
    case 'past-14':
      from.setDate(today.getDate() - 14);
      to.setDate(today.getDate() - 1);
      break;
    case 'past-30':
      from.setDate(today.getDate() - 30);
      to.setDate(today.getDate() - 1);
      break;
    case 'next-7':
      from.setDate(today.getDate());
      to.setDate(today.getDate() + 7);
      break;
    case 'next-14':
      from.setDate(today.getDate());
      to.setDate(today.getDate() + 14);
      break;
    case 'next-30':
      from.setDate(today.getDate());
      to.setDate(today.getDate() + 30);
      break;
    default:
      from.setDate(today.getDate());
      to.setDate(today.getDate() + 30);
  }
  
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0]
  };
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
  const [searchMode, setSearchMode] = useState<'traditional' | 'natural'>('traditional');
  const [lastIntent, setLastIntent] = useState<SearchIntent | null>(null);
  const [searchProgress, setSearchProgress] = useState<{ stage: number; total: number; message?: string } | null>(null);
  const [boardStatusMap, setBoardStatusMap] = useState<Record<string, { inBoard: boolean; boardItemId: string | null }>>({});
  const [searchAbortController, setSearchAbortController] = useState<AbortController | null>(null);
  const [progressiveSearchStage, setProgressiveSearchStage] = useState<ProgressiveSearchUpdate['stage'] | null>(null);
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'quality'>('relevance');
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const router = useRouter();

  // Get current page events from context
  const currentPageEvents = actions.getCurrentPageEvents();

  // Sort and filter events based on user selection
  const filteredEvents = useMemo(() => {
    const events = [...currentPageEvents]; // Create a copy to avoid mutating
    
    // Apply sorting
    events.sort((a, b) => {
      switch (sortBy) {
        case 'relevance': {
          // Sort by relevance_score (0-100, highest first), then confidence, then date
          const relevanceA = (a as any).relevance_score ?? 0;
          const relevanceB = (b as any).relevance_score ?? 0;
          if (relevanceB !== relevanceA) {
            return relevanceB - relevanceA;
          }
          // Fall through to confidence if relevance scores are equal
          const confA = a.confidence ?? 0;
          const confB = b.confidence ?? 0;
          if (confB !== confA) {
            return confB - confA;
          }
          // Fall through to date if confidence is equal
          const dateA = a.starts_at ? new Date(a.starts_at).getTime() : 0;
          const dateB = b.starts_at ? new Date(b.starts_at).getTime() : 0;
          return dateA - dateB;
        }
          
        case 'date': {
          // Sort by date (upcoming first), then relevance, then confidence
          // Events without dates go to the end
          const dateA = a.starts_at ? new Date(a.starts_at).getTime() : Number.MAX_SAFE_INTEGER;
          const dateB = b.starts_at ? new Date(b.starts_at).getTime() : Number.MAX_SAFE_INTEGER;
          if (dateA !== dateB) {
            return dateA - dateB;
          }
          // Fall through to relevance if dates are equal
          const relA = (a as any).relevance_score ?? 0;
          const relB = (b as any).relevance_score ?? 0;
          if (relB !== relA) {
            return relB - relA;
          }
          // Fall through to confidence
          const confA = a.confidence ?? 0;
          const confB = b.confidence ?? 0;
          return confB - confA;
        }
          
        case 'quality': {
          // Sort by confidence (quality), then relevance, then date
          const qualityA = a.confidence ?? 0;
          const qualityB = b.confidence ?? 0;
          if (qualityB !== qualityA) {
            return qualityB - qualityA;
          }
          // Fall through to relevance
          const relA = (a as any).relevance_score ?? 0;
          const relB = (b as any).relevance_score ?? 0;
          if (relB !== relA) {
            return relB - relA;
          }
          // Fall through to date
          const dateA = a.starts_at ? new Date(a.starts_at).getTime() : 0;
          const dateB = b.starts_at ? new Date(b.starts_at).getTime() : 0;
          return dateA - dateB;
        }
          
        default:
          return 0;
      }
    });
    
    return events;
  }, [currentPageEvents, sortBy]);

  // Batch fetch board status for visible events
  useEffect(() => {
    let cancelled = false;

    const eventUrls = Array.from(
      new Set(
        filteredEvents
          .map((event) => event?.source_url)
          .filter((url): url is string => Boolean(url)),
      ),
    );

    if (eventUrls.length === 0) {
      setBoardStatusMap({});
      return () => {
        cancelled = true;
      };
    }

    async function fetchBoardStatuses() {
      try {
        const response = await fetch('/api/events/board/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventUrls }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch board statuses');
        }

        const data = await response.json();
        if (cancelled) {
          return;
        }

        const results = data?.results || {};
        setBoardStatusMap(() => {
          const next: Record<string, { inBoard: boolean; boardItemId: string | null }> = {};
          eventUrls.forEach((url) => {
            next[url] = results[url] || { inBoard: false, boardItemId: null };
          });
          return next;
        });
      } catch (error) {
        console.error('Failed to fetch board statuses:', error);
        if (cancelled) {
          return;
        }
        setBoardStatusMap((prev) => {
          const next: Record<string, { inBoard: boolean; boardItemId: string | null }> = {};
          eventUrls.forEach((url) => {
            next[url] = prev[url] || { inBoard: false, boardItemId: null };
          });
          return next;
        });
      }
    }

    fetchBoardStatuses();

    return () => {
      cancelled = true;
    };
  }, [filteredEvents]);

  // Callback for EventCard to update status
  const handleBoardStatusChange = useCallback((eventUrl: string, status: { inBoard: boolean; boardItemId: string | null }) => {
    if (!eventUrl) return;
    setBoardStatusMap((prev) => ({
      ...prev,
      [eventUrl]: status,
    }));
  }, []);

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

  // Natural Language Search handler
  const handleNaturalLanguageSearch = useCallback(async (query: string, intent: SearchIntent) => {
    setLastIntent(intent);
    actions.setError(null);
    actions.setLoading(true);
    
    // Initialize progress tracking
    setSearchProgress({ stage: 0, total: 4, message: 'Processing your query...' });

    try {
      // Update progress: Discovering events
      setSearchProgress({ stage: 1, total: 4, message: 'Discovering events...' });
      // Determine country from location entities or use current selection
      let searchCountry = country;
      if (intent.entities.location?.length) {
        const location = intent.entities.location[0].toLowerCase();
        if (location.includes('germany') || location.includes('deutschland')) searchCountry = 'DE';
        else if (location.includes('austria') || location.includes('österreich')) searchCountry = 'AT';
        else if (location.includes('switzerland') || location.includes('schweiz')) searchCountry = 'CH';
        else if (location.includes('france') || location.includes('frankreich')) searchCountry = 'FR';
        else if (location.includes('italy') || location.includes('italien')) searchCountry = 'IT';
        else if (location.includes('spain') || location.includes('spanien')) searchCountry = 'ES';
        else if (location.includes('netherlands') || location.includes('niederlande')) searchCountry = 'NL';
        else if (location.includes('belgium') || location.includes('belgien')) searchCountry = 'BE';
      }

      // Calculate date range based on intent or use current settings
      let dateRange = { from, to };
      if (intent.entities.date?.length) {
        const dateStr = intent.entities.date[0].toLowerCase();
        if (dateStr.includes('past') || dateStr.includes('last')) {
          if (dateStr.includes('7')) dateRange = calculateDateRange('past-7');
          else if (dateStr.includes('14')) dateRange = calculateDateRange('past-14');
          else if (dateStr.includes('30')) dateRange = calculateDateRange('past-30');
        } else if (dateStr.includes('next') || dateStr.includes('upcoming')) {
          if (dateStr.includes('7')) dateRange = calculateDateRange('next-7');
          else if (dateStr.includes('14')) dateRange = calculateDateRange('next-14');
          else if (dateStr.includes('30')) dateRange = calculateDateRange('next-30');
        }
      }

      // Update form state to match natural language search
      setCountry(searchCountry);
      setFrom(dateRange.from);
      setTo(dateRange.to);
      setKeywords(query);

      const normalizedCountry = toISO2Country(searchCountry) ?? 'EU';
      const locale = deriveLocale(normalizedCountry);

      // Update progress: Processing results
      setSearchProgress({ stage: 2, total: 4, message: 'Processing results...' });

      const data = await fetchEvents({
        userText: query || 'conference',
        country: normalizedCountry,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        locale,
        useNaturalLanguage: true // Skip profile enrichment for natural language queries
      });

      // Update progress: Finalizing
      setSearchProgress({ stage: 3, total: 4, message: 'Finalizing results...' });

      const events = (data.events || []).map((e: any) => ({
        ...e,
        id: e.id || e.source_url,
      }));

      actions.setSearchResults(events, {
        keywords: query,
        country: searchCountry,
        from: dateRange.from,
        to: dateRange.to,
        timestamp: Date.now(),
        userProfile: userProfile ? {
          industryTerms: userProfile.industry_terms || [],
          icpTerms: userProfile.icp_terms || [],
          competitors: userProfile.competitors || [],
        } : undefined,
      }, events.length);

      // Save search history
      if (query.trim()) {
        addToSearchHistory({
          query: query,
          filters: {
            country: searchCountry,
            dateFrom: dateRange.from,
            dateTo: dateRange.to,
            keywords: query,
          },
          resultCount: events.length,
        });
      }

      // Complete progress
      setSearchProgress({ stage: 4, total: 4, message: 'Search completed!' });

      toast.success('Search completed', {
        description: `Found ${events.length} event${events.length !== 1 ? 's' : ''}`
      });
      
      // Show info if no results
      if (events.length === 0) {
        const noResults = CommonErrors.noSearchResults(true);
        toast.info('No results found', {
          description: noResults.message
        });
      }
    } catch (err) {
      console.error('Natural language search failed:', err);
      const errorInfo = formatErrorForToast(err, { action: 'search for events' });
      actions.setError(errorInfo.description);
      toast.error(errorInfo.title, {
        description: errorInfo.description,
        action: errorInfo.action
      });
    } finally {
      actions.setLoading(false);
      setSearchProgress(null);
    }
  }, [country, from, to, userProfile, actions]);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (from > to) {
      const dateError = CommonErrors.invalidDateRange();
      actions.setError(dateError.message);
      toast.error('Invalid date range', {
        description: dateError.message
      });
      return;
    }
    
    // Clear NLP intent for traditional searches
    if (searchMode === 'traditional') {
      setLastIntent(null);
    }
    
    // Cancel any existing search
    if (searchAbortController) {
      searchAbortController.abort();
    }
    
    // Create new abort controller for this search
    const abortController = new AbortController();
    setSearchAbortController(abortController);
    
    actions.setError(null);
    actions.setLoading(true);
    setProgressiveSearchStage(null);
    
    // Initialize progress tracking
    setSearchProgress({ stage: 0, total: 4, message: 'Initializing search...' });
    
    try {
      const normalizedCountry = toISO2Country(country) ?? 'EU';
      const locale = deriveLocale(normalizedCountry);
      const q = keywords.trim() || 'conference';

      // Use progressive search
      await fetchEventsProgressive(
        {
          userText: q,
          country: normalizedCountry,
          dateFrom: from,
          dateTo: to,
          locale,
        },
        {
          onUpdate: (update) => {
            setProgressiveSearchStage(update.stage);
            
            // Update progress message based on stage with partial results count
            let progressMessage = update.message || 'Searching...';
            let progressStage = 1;
            const resultsCount = update.totalSoFar || update.events.length;
            
            if (update.stage === 'database') {
              progressStage = 1;
              if (resultsCount > 0) {
                progressMessage = `Found ${resultsCount} event${resultsCount !== 1 ? 's' : ''} in database, searching more sources...`;
              } else {
                progressMessage = update.message || 'Checking database for events...';
              }
            } else if (update.stage === 'cse') {
              progressStage = 2;
              if (resultsCount > 0) {
                progressMessage = `Found ${resultsCount} event${resultsCount !== 1 ? 's' : ''} so far, searching with Google...`;
              } else {
                progressMessage = update.message || 'Searching with Google CSE...';
              }
            } else if (update.stage === 'firecrawl') {
              progressStage = 3;
              if (resultsCount > 0) {
                progressMessage = `Found ${resultsCount} event${resultsCount !== 1 ? 's' : ''} so far, analyzing websites (this may take 30-60 seconds)...`;
              } else {
                progressMessage = update.message || 'Searching with Firecrawl (this may take 30-60 seconds)...';
              }
            } else if (update.stage === 'complete') {
              progressStage = 4;
              if (resultsCount > 0) {
                progressMessage = `Search completed! Found ${resultsCount} event${resultsCount !== 1 ? 's' : ''}`;
              } else {
                progressMessage = update.message || 'Search completed!';
              }
            }
            
            setSearchProgress({ stage: progressStage, total: 4, message: progressMessage });
            
            // Update results as they arrive
            if (update.events.length > 0) {
              const events = update.events.map((e: EventRec) => ({
                ...e,
                source_url: e.source_url || e.link || e.id
              }));
              
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
            }
          },
          onComplete: (allEvents) => {
            const events = allEvents.map((e: EventRec) => ({
              ...e,
              source_url: e.source_url || e.link || e.id
            }));
            
            // Final update with all events
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
            
            // Save search history
            if (q.trim()) {
              addToSearchHistory({
                query: q,
                filters: {
                  country: country,
                  dateFrom: from,
                  dateTo: to,
                  keywords: q,
                },
                resultCount: events.length,
              });
            }
            
            // Complete progress
            setSearchProgress({ stage: 4, total: 4, message: 'Search completed!' });
            
            // Show success message
            if (events.length === 0) {
              const noResults = CommonErrors.noSearchResults(true);
              toast.info('No results found', {
                description: noResults.message
              });
            } else {
              toast.success('Search completed', {
                description: `Found ${events.length} event${events.length !== 1 ? 's' : ''}`
              });
            }
          },
          onError: (error) => {
            console.error("Progressive search error:", error);
            const errorInfo = formatErrorForToast(error, { action: 'search for events' });
            actions.setError(errorInfo.description);
            toast.error(errorInfo.title, {
              description: errorInfo.description,
              action: errorInfo.action
            });
          },
          cancelSignal: abortController.signal,
        });
      
    } catch (err) {
      console.error("Search error:", err);
      const errorInfo = formatErrorForToast(err, { action: 'search for events' });
      actions.setError(errorInfo.description);
      toast.error(errorInfo.title, {
        description: errorInfo.description,
        action: errorInfo.action
      });
    } finally {
      actions.setLoading(false);
      setSearchAbortController(null);
      // Clear progress after a short delay to show completion
      setTimeout(() => {
        setSearchProgress(null);
        setProgressiveSearchStage(null);
      }, 1000);
    }
  }

  const breadcrumbs = [
    { label: "Events" }
  ];

  return (
    <>
      <PageHeader
        title="Speaker Search"
        subtitle="Search for events and discover speakers using natural language or traditional filters"
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
        
        {/* Search Mode Toggle */}
        <div className="mb-4 flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setSearchMode('traditional')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              searchMode === 'traditional'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            Traditional
          </button>
          <button
            type="button"
            onClick={() => setSearchMode('natural')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              searchMode === 'natural'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Natural Language
          </button>
        </div>

        {searchMode === 'natural' ? (
          <div className="space-y-4">
            <NaturalLanguageSearch
              onSearch={handleNaturalLanguageSearch}
              onIntentDetected={(intent) => setLastIntent(intent)}
              placeholder="Ask me anything about events... e.g., 'Find fintech conferences in Germany next month'"
              className="mb-4"
            />
          </div>
        ) : (
          <QuickEventSearchPanel
            defaultCollapsed={false}
            showPinning={false}
            hideResults={true}
            onSearchComplete={(events, searchParams) => {
              // Update SearchResultsContext with the results
              const normalizedCountry = toISO2Country(searchParams.country) ?? 'EU';
              actions.setSearchResults(events, {
                keywords: searchParams.keywords,
                country: normalizedCountry,
                from: searchParams.from,
                to: searchParams.to,
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
              
              // Save to search history
              if (searchParams.keywords.trim()) {
                addToSearchHistory({
                  query: searchParams.keywords,
                  filters: {
                    country: searchParams.country,
                    dateFrom: searchParams.from,
                    dateTo: searchParams.to,
                    keywords: searchParams.keywords,
                  },
                  resultCount: events.length,
                });
              }
            }}
          />
        )}
        
        {/* Legacy form removed - replaced with QuickEventSearchPanel above */}
        {false && (
          <form onSubmit={run} className="space-y-4">
            {/* Search Input */}
            <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  onFocus={() => setShowSearchHistory(true)}
                  onBlur={(e) => {
                    // Delay closing to allow dropdown clicks
                    setTimeout(() => setShowSearchHistory(false), 200);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <SearchHistoryDropdown
                  isOpen={showSearchHistory}
                  onClose={() => setShowSearchHistory(false)}
                  onSelect={(item) => {
                    setKeywords(item.query || '');
                    if (item.filters?.country) {
                      setCountry(item.filters.country);
                    }
                    if (item.filters?.dateFrom) {
                      setFrom(item.filters.dateFrom);
                    }
                    if (item.filters?.dateTo) {
                      setTo(item.filters.dateTo);
                    }
                    setShowSearchHistory(false);
                    // Trigger search after a brief delay to allow state updates
                    setTimeout(() => {
                      const form = document.querySelector('form');
                      if (form) {
                        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                        form.dispatchEvent(submitEvent);
                      }
                    }, 100);
                  }}
                  onClear={() => {
                    clearSearchHistory();
                    setShowSearchHistory(false);
                  }}
                  currentSearch={{
                    query: keywords,
                    filters: {
                      country,
                      dateFrom: from,
                      dateTo: to,
                      keywords,
                    },
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                name="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Time Range</label>
              <div className="space-y-3">
                {/* Range Selection (Next/Past) */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleQuickRange('next', days)}
                    className={`px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                      range === "next" 
                        ? "bg-blue-600 text-white shadow-sm" 
                        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
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
                        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover-bg-slate-600"
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
                          : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Custom Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">From</label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">To</label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
          </form>
        )}
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
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

      {/* Search Context Bar */}
      {state.hasResults && state.searchParams && (
        <div className="px-6 py-4">
          <SearchContextBar
            searchParams={state.searchParams}
            totalResults={state.pagination.totalResults}
            intent={lastIntent}
            isNaturalLanguage={searchMode === 'natural'}
            onClearFilters={handleResetFilters}
            onModifySearch={() => {
              // Scroll to search form
              const searchForm = document.querySelector('form');
              if (searchForm) {
                searchForm.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            onRefresh={run}
          />
        </div>
      )}

      <ContentContainer>
        <div className="py-6">
          {/* Show search timestamp if we have cached results */}
          {state.hasResults && state.lastSearchTimestamp && (
            <div className="mb-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
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

          {/* Search Progress Indicator */}
          {state.isLoading && searchProgress && (
            <div className="mb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <SearchProgressIndicator
                    currentStage={searchProgress.stage}
                    totalStages={searchProgress.total}
                    message={searchProgress.message}
                  />
                  {progressiveSearchStage && currentPageEvents.length > 0 && (
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-3 font-medium">
                      {currentPageEvents.length} result{currentPageEvents.length !== 1 ? 's' : ''} found so far, loading more...
                    </div>
                  )}
                </div>
                {searchAbortController && (
                  <button
                    onClick={() => {
                      searchAbortController?.abort();
                      setSearchAbortController(null);
                      actions.setLoading(false);
                      setSearchProgress(null);
                      setProgressiveSearchStage(null);
                      toast.info('Search cancelled');
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                  >
                    Cancel Search
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          {state.isLoading && !searchProgress ? (
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
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {state.isLoading && currentPageEvents.length > 0
                    ? `${currentPageEvents.length} result${currentPageEvents.length !== 1 ? 's' : ''} found so far, loading more...`
                    : `${state.pagination.totalResults} event${state.pagination.totalResults !== 1 ? 's' : ''} found`}
                </h2>
                <div className="flex items-center gap-3">
                  <label htmlFor="sort-select" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4" />
                    Sort by:
                  </label>
                  <select
                    id="sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'relevance' | 'date' | 'quality')}
                    className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer transition-colors hover:border-slate-400 dark:hover:border-slate-500"
                  >
                    <option value="relevance">Relevance (Best Match)</option>
                    <option value="date">Date (Upcoming First)</option>
                    <option value="quality">Quality (Confidence Score)</option>
                  </select>
                </div>
              </div>
              
              <div className="grid gap-4">
                {filteredEvents.map((event) => (
                  <EventCard
                    key={event.id || event.source_url}
                    ev={event as any}
                    initiallySaved={savedSet.has(event.id || event.source_url)}
                    watchlistMatch={watchlistMatches.get(event.id || event.source_url)}
                    boardStatus={event.source_url ? boardStatusMap[event.source_url] : undefined}
                    onBoardStatusChange={(status) => {
                      if (event.source_url) {
                        handleBoardStatusChange(event.source_url, status);
                      }
                    }}
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
