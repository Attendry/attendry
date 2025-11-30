'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Plus,
  Check,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Globe2,
  CalendarRange,
  Maximize2,
  Minimize2,
  Pin,
  PinOff,
  Linkedin,
} from 'lucide-react';

import { deriveLocale, toISO2Country } from '@/lib/utils/country';
import { EventRec } from '@/context/SearchResultsContext';
import { useSpeakerEnhancement } from '@/lib/hooks/useSpeakerEnhancement';
import { SpeakerData } from '@/lib/types/core';
import { EventIntelligenceQuickView } from '@/components/EventIntelligenceQuickView';
import { toast } from 'sonner';

const QUICK_SEARCH_LOCATIONS = [
  { code: 'EU', name: 'All Europe' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'SE', name: 'Sweden' },
  { code: 'PL', name: 'Poland' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
] as const;

const QUICK_SEARCH_DAY_OPTIONS = [7, 14, 30] as const;

const SUGGESTED_KEYWORDS = [
  { label: 'Compliance', value: 'compliance' },
  { label: 'eDiscovery', value: 'ediscovery' },
  { label: 'Privacy/GDPR', value: 'privacy GDPR' },
  { label: 'Legal Tech', value: 'legal technology' },
  { label: 'Data Protection', value: 'data protection' },
  { label: 'Investigations', value: 'investigations' },
  { label: 'Kartellrecht', value: 'Kartellrecht' },
  { label: 'Wettbewerbsrecht', value: 'Wettbewerbsrecht' },
  { label: 'Datenschutz', value: 'Datenschutz' },
  { label: 'Corporate Counsel', value: 'corporate counsel' },
  { label: 'Risk Management', value: 'risk management' },
  { label: 'Cybersecurity', value: 'cybersecurity' },
] as const;

const QUICK_SEARCH_DEFAULTS = {
  country: 'EU' as typeof QUICK_SEARCH_LOCATIONS[number]['code'],
  range: 'next' as 'next' | 'past',
  days: 14 as (typeof QUICK_SEARCH_DAY_OPTIONS)[number],
  keywords: '',
  selectedKeywordTags: [] as string[],
};

const MAX_SELECTED_TAGS = 3;

const PINNED_SEARCH_KEY = 'attendry_pinned_search';

function loadPinnedSearch(): typeof QUICK_SEARCH_DEFAULTS | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(PINNED_SEARCH_KEY);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    // Backwards compatibility: add selectedKeywordTags if not present
    if (parsed && !Array.isArray(parsed.selectedKeywordTags)) {
      parsed.selectedKeywordTags = [];
    }
    return parsed;
  } catch {
    return null;
  }
}

function savePinnedSearch(config: typeof QUICK_SEARCH_DEFAULTS) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PINNED_SEARCH_KEY, JSON.stringify(config));
  } catch {
    // Ignore localStorage errors
  }
}

function clearPinnedSearch() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PINNED_SEARCH_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

function toDateOnlyString(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

function shiftDate(base: Date, offset: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + offset);
  return next;
}

export interface QuickEventSearchPanelProps {
  onSpeakerSaved?: () => Promise<void> | void;
  defaultCollapsed?: boolean;
  showPinning?: boolean;
  className?: string;
  onSearchComplete?: (events: EventRec[], searchParams: {
    keywords: string;
    country: string;
    from: string;
    to: string;
  }) => void;
  hideResults?: boolean; // If true, don't show results in the panel (for use with external result display)
}

type EventSpeaker = {
  name?: string;
  title?: string | null;
  org?: string | null;
  organization?: string | null;
  company?: string | null;
  profile_url?: string | null;
  linkedin?: string | null;
  email?: string | null;
  [key: string]: unknown;
};

function getSpeakerSignature(speaker: EventSpeaker): string | null {
  if (!speaker) return null;
  const profileLink = (speaker.profile_url || speaker.linkedin || '').toString().trim().toLowerCase();
  if (profileLink) {
    return profileLink;
  }
  const name = (speaker.name || '').trim().toLowerCase();
  if (!name) {
    return null;
  }
  const organization = (
    speaker.org ||
    speaker.organization ||
    speaker.company ||
    speaker.title ||
    ''
  )
    .toString()
    .trim()
    .toLowerCase();

  return organization ? `${name}__${organization}` : name;
}

interface DashboardSpeakerItemProps {
  speaker: EventSpeaker;
  speakerForEnhancement: SpeakerData;
  speakerKey: string;
  organization: string;
  profileLink: string | null;
  appearsMultiple: boolean;
  duplicateEventsCount: number;
  savedFromOtherEvent: boolean;
  savedHere: boolean;
  isSaving: boolean;
  onSave: () => void;
}

function DashboardSpeakerItem({
  speaker,
  speakerForEnhancement,
  speakerKey,
  organization,
  profileLink,
  appearsMultiple,
  duplicateEventsCount,
  savedFromOtherEvent,
  savedHere,
  isSaving,
  onSave,
}: DashboardSpeakerItemProps) {
  const [showEnhanced, setShowEnhanced] = useState(false);
  
  const {
    enhancedSpeaker,
    enhancing,
    enhancementError,
    cached,
    enhanceSpeaker,
    hasEnhancedData,
  } = useSpeakerEnhancement(speakerForEnhancement);

  const handleEnhance = async () => {
    if (!enhancedSpeaker && !enhancing) {
      await enhanceSpeaker();
    }
    setShowEnhanced(!showEnhanced);
  };

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 font-medium text-slate-900">{speaker.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="truncate">
            {[speaker.title, organization].filter(Boolean).join(' · ') || 'Role pending'}
          </span>
          {appearsMultiple && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">
              <Sparkles className="h-3 w-3" />
              {duplicateEventsCount === 1
                ? 'Also in 1 other event'
                : `Also in ${duplicateEventsCount} other events`}
            </span>
          )}
          {savedFromOtherEvent && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
              Saved elsewhere
            </span>
          )}
        </div>
        
        {/* Enhanced Information */}
        {showEnhanced && enhancedSpeaker && hasEnhancedData && (
          <div className="mt-3 space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs">
            {enhancedSpeaker.bio && (
              <p className="text-slate-700 line-clamp-2">{enhancedSpeaker.bio}</p>
            )}
            {enhancedSpeaker.expertise_areas && enhancedSpeaker.expertise_areas.length > 0 && (
              <div>
                <span className="font-medium text-slate-700">Expertise: </span>
                <span className="text-slate-600">
                  {enhancedSpeaker.expertise_areas.slice(0, 3).join(', ')}
                  {enhancedSpeaker.expertise_areas.length > 3 && ` +${enhancedSpeaker.expertise_areas.length - 3} more`}
                </span>
              </div>
            )}
            {enhancedSpeaker.location && (
              <div className="text-slate-600">
                <span className="font-medium">Location: </span>
                {enhancedSpeaker.location}
              </div>
            )}
            {enhancedSpeaker.social_links?.linkedin && (
              <a
                href={enhancedSpeaker.social_links.linkedin}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                <Linkedin className="h-3 w-3" />
                LinkedIn Profile
              </a>
            )}
          </div>
        )}
        
        {enhancing && (
          <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Enhancing profile...</span>
          </div>
        )}
        {enhancementError && (
          <div className="mt-2 text-xs text-red-600">
            Enhancement failed: {enhancementError}
          </div>
        )}
      </div>
      
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
        <button
          type="button"
          onClick={handleEnhance}
          disabled={enhancing}
          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
          title={enhancing ? "Enhancing..." : hasEnhancedData ? "Show enhanced details" : "Enhance profile with AI"}
        >
          {enhancing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {hasEnhancedData && !enhancing ? 'Details' : 'Enhance'}
        </button>
        
        {savedHere || savedFromOtherEvent ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
              savedFromOtherEvent
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            ✓ Saved
          </span>
        ) : (
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-slate-100 whitespace-nowrap"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Save speaker
          </button>
        )}
        {profileLink && (
          <a
            href={profileLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 whitespace-nowrap"
          >
            <Linkedin className="h-3.5 w-3.5" />
            Profile
          </a>
        )}
      </div>
    </li>
  );
}

export function QuickEventSearchPanel({ 
  onSpeakerSaved,
  defaultCollapsed = true,
  showPinning = true,
  className = '',
  onSearchComplete,
  hideResults = false
}: QuickEventSearchPanelProps) {
  const [config, setConfig] = useState(QUICK_SEARCH_DEFAULTS);
  const [isPinned, setIsPinned] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [results, setResults] = useState<EventRec[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  const [searchProgress, setSearchProgress] = useState<{ stage: number; message: string } | null>(null);
  const [savingSpeakerId, setSavingSpeakerId] = useState<string | null>(null);
  const [speakerStatus, setSpeakerStatus] = useState<Record<string, 'saved' | 'error'>>({});
  const [savedSignatures, setSavedSignatures] = useState<Record<string, 'saved'>>({});
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [boardStatus, setBoardStatus] = useState<Record<string, 'saved' | 'saving'>>({});

  // Load pinned search on mount
  useEffect(() => {
    if (showPinning) {
      const pinned = loadPinnedSearch();
      if (pinned) {
        setConfig(pinned);
        setIsPinned(true);
      }
    }
  }, [showPinning]);

  // Keyword tag selection handlers
  const toggleKeywordTag = useCallback((value: string) => {
    setConfig(prev => {
      const currentTags = prev.selectedKeywordTags || [];
      if (currentTags.includes(value)) {
        // Remove if already selected
        return {
          ...prev,
          selectedKeywordTags: currentTags.filter(v => v !== value)
        };
      } else if (currentTags.length < MAX_SELECTED_TAGS) {
        // Add if under limit
        return {
          ...prev,
          selectedKeywordTags: [...currentTags, value]
        };
      }
      // At max, do nothing
      return prev;
    });
  }, []);

  const removeKeywordTag = useCallback((value: string) => {
    setConfig(prev => ({
      ...prev,
      selectedKeywordTags: (prev.selectedKeywordTags || []).filter(v => v !== value)
    }));
  }, []);

  const prioritizedResults = useMemo(() => {
    const withSpeakers = results.filter(
      (event) => Array.isArray(event.speakers) && (event.speakers as EventSpeaker[]).length > 0,
    );
    if (withSpeakers.length > 0) {
      return withSpeakers;
    }
    return results;
  }, [results]);

  const speakerOccurrences = useMemo(() => {
    const map = new Map<string, Set<string>>();
    prioritizedResults.forEach((event) => {
      const eventKey = event.id || event.source_url;
      if (!eventKey) return;
      const eventSpeakers = Array.isArray(event.speakers) ? (event.speakers as EventSpeaker[]) : [];
      eventSpeakers.forEach((speaker) => {
        const signature = getSpeakerSignature(speaker);
        if (!signature) return;
        if (!map.has(signature)) {
          map.set(signature, new Set());
        }
        map.get(signature)!.add(eventKey);
      });
    });
    return map;
  }, [prioritizedResults]);

  const resultsToShow = useMemo(() => prioritizedResults.slice(0, 5), [prioritizedResults]);

  const locationLabel = useMemo(
    () => QUICK_SEARCH_LOCATIONS.find((location) => location.code === config.country)?.name ?? 'All Europe',
    [config.country],
  );

  const dateRangeSummary = useMemo(() => {
    const now = new Date();
    if (config.range === 'next') {
      return {
        from: toDateOnlyString(now),
        to: toDateOnlyString(shiftDate(now, config.days)),
      };
    }
    return {
      from: toDateOnlyString(shiftDate(now, -config.days)),
      to: toDateOnlyString(now),
    };
  }, [config.range, config.days]);

  const updateConfig = (partial: Partial<typeof config>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const handlePinSearch = useCallback(() => {
    if (showPinning) {
      savePinnedSearch(config);
      setIsPinned(true);
    }
  }, [config, showPinning]);

  const handleUnpinSearch = useCallback(() => {
    if (showPinning) {
      clearPinnedSearch();
      setIsPinned(false);
    }
  }, [showPinning]);

  const runSearch = useCallback(async () => {
    const now = new Date();
    const from =
      config.range === 'next'
        ? toDateOnlyString(now)
        : toDateOnlyString(shiftDate(now, -config.days));
    const to =
      config.range === 'next'
        ? toDateOnlyString(shiftDate(now, config.days))
        : toDateOnlyString(now);

    setLoading(true);
    setError(null);
    setSpeakerStatus({});
    setSearchProgress({ stage: 0, message: 'Preparing search...' });
    
    try {
      // Update progress: Discovering events
      setSearchProgress({ stage: 1, message: 'Discovering events...' });
      
      // Smart combination of free-text keywords and selected tags with deduplication
      const freeTextKeywords = config.keywords.trim();
      const selectedTags = config.selectedKeywordTags || [];
      
      // Smart deduplication: combine and remove duplicates (case-insensitive)
      const freeTextTerms = freeTextKeywords.toLowerCase().split(/\s+/).filter(Boolean);
      const tagTerms = selectedTags.map(t => t.toLowerCase());
      const allTerms = [...freeTextTerms, ...tagTerms];
      const uniqueTermsLower = [...new Set(allTerms)];
      
      // Map back to original casing from selected tags where possible
      const combinedKeywords = uniqueTermsLower.map(term => {
        // Find original casing from selected tags
        const originalTag = selectedTags.find(t => t.toLowerCase() === term);
        if (originalTag) return originalTag;
        // Find original casing from free text
        const originalFreeText = freeTextKeywords.split(/\s+/).find(t => t.toLowerCase() === term);
        return originalFreeText || term;
      }).join(' ');

      const normalizedCountry = toISO2Country(config.country) ?? 'EU';
      const locale = deriveLocale(normalizedCountry);
      
      // Update progress: Processing results
      setSearchProgress({ stage: 2, message: 'Processing results...' });
      
      const response = await fetch('/api/events/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userText: combinedKeywords,
          country: normalizedCountry,
          dateFrom: from,
          dateTo: to,
          locale,
        }),
      });

      let payload: any;
      try {
        payload = await response.json();
      } catch {
        const text = await response.text();
        throw new Error(text || 'Search service returned an unreadable response');
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Search failed');
      }

      const rawEvents: EventRec[] = (payload.events || payload.items || []) as EventRec[];
      const normalizedEvents = rawEvents
        .map((event) => ({
          source_url: event.source_url || event.link || '',
          title: event.title || event.source_url || 'Untitled Event',
          starts_at: event.starts_at ?? null,
          ends_at: event.ends_at ?? null,
          city: event.city ?? null,
          country: event.country ?? null,
          organizer: event.organizer ?? null,
          speakers: Array.isArray(event.speakers) ? event.speakers : [],
          description: event.description ?? null,
          venue: event.venue ?? null,
          location: event.location ?? null,
          confidence: event.confidence ?? null,
          confidence_reason: event.confidence_reason ?? null,
          pipeline_metadata: event.pipeline_metadata ?? null,
          id: event.id,
        }))
        .filter((event) => !!event.source_url);

      // Update progress: Finalizing
      setSearchProgress({ stage: 3, message: 'Finalizing...' });

      setResults(normalizedEvents);
      setLastRunAt(Date.now());
      
      // Call onSearchComplete callback if provided (for integration with SearchResultsContext)
      if (onSearchComplete) {
        onSearchComplete(normalizedEvents, {
          keywords: combinedKeywords,
          country: normalizedCountry,
          from,
          to,
        });
      }
      
      // Complete progress
      setSearchProgress({ stage: 4, message: 'Complete' });
      setTimeout(() => setSearchProgress(null), 500);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : 'Search failed');
      setSearchProgress(null);
    } finally {
      setLoading(false);
    }
  }, [config]);

  const buildSpeakerKey = useCallback((event: EventRec, speaker: EventSpeaker, index: number) => {
    const eventKey = event.id || event.source_url;
    const base =
      speaker.profile_url ||
      speaker.linkedin ||
      speaker.email ||
      speaker.name ||
      `speaker-${index}`;
    return `${eventKey}:${base}`;
  }, []);

  const handleSaveSpeaker = useCallback(
    async (event: EventRec, speaker: EventSpeaker, key: string) => {
      if (!speaker?.name) {
        toast.warning("Cannot save speaker", {
          description: "Speaker name is required to save a profile"
        });
        return;
      }
      const signature = getSpeakerSignature(speaker);
      if (signature && savedSignatures[signature] === 'saved') {
        setSpeakerStatus((prev) => ({ ...prev, [key]: 'saved' }));
        return;
      }
      setSavingSpeakerId(key);
      try {
        const response = await fetch('/api/profiles/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            speaker_data: speaker,
            enhanced_data: speaker,
            metadata: {
              saved_from: 'quick-event-search',
              event_source_url: event.source_url,
              event_title: event.title,
            },
          }),
        });
        let payload: any = {};
        try {
          payload = await response.json();
        } catch {
          payload = {};
        }
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to save speaker');
        }
        setSpeakerStatus((prev) => ({ ...prev, [key]: 'saved' }));
        if (signature) {
          setSavedSignatures((prev) => ({ ...prev, [signature]: 'saved' }));
        }
        if (onSpeakerSaved) {
          await Promise.resolve(onSpeakerSaved());
        }
        toast.success("Speaker saved", {
          description: `${speaker.name} has been saved to your profiles`
        });
      } catch (err) {
        setSpeakerStatus((prev) => ({ ...prev, [key]: 'error' }));
        toast.error("Failed to save speaker", {
          description: err instanceof Error ? err.message : 'An error occurred. Please try again.'
        });
      } finally {
        setSavingSpeakerId(null);
      }
    },
    [onSpeakerSaved, savedSignatures],
  );

  const handleAddEventToBoard = useCallback(
    async (event: EventRec) => {
      const eventKey = event.id || event.source_url;
      if (boardStatus[eventKey] === 'saved' || boardStatus[eventKey] === 'saving') {
        return;
      }

      setBoardStatus((prev) => ({ ...prev, [eventKey]: 'saving' }));
      try {
        // Validate UUID format
        const isValidUUID = (str: string | undefined): boolean => {
          if (!str) return false;
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return uuidRegex.test(str);
        };

        const eventId = event.id && isValidUUID(event.id) ? event.id : undefined;

        const response = await fetch('/api/events/board/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId,
            eventUrl: event.source_url,
            eventData: event,
            columnStatus: 'interested',
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          if (response.status === 401) {
            toast.error("Authentication required", {
              description: "Please log in to add events to your board.",
              action: {
                label: "Log in",
                onClick: () => {
                  if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                  }
                }
              }
            });
            return;
          }
          throw new Error(data.error || 'Failed to add to board');
        }

        // Also add to watchlist
        try {
          await fetch('/api/watchlist/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: 'event',
              label: event.title,
              ref_id: event.source_url,
            }),
          });
        } catch {
          // Don't fail if watchlist add fails
        }

        setBoardStatus((prev) => ({ ...prev, [eventKey]: 'saved' }));
        toast.success("Event added to board", {
          description: "You can manage it from your Events Board"
        });
      } catch (err) {
        setBoardStatus((prev) => ({ ...prev, [eventKey]: undefined }));
        toast.error("Failed to add to board", {
          description: err instanceof Error ? err.message : 'An error occurred. Please try again.'
        });
      }
    },
    [boardStatus],
  );

  const formatDisplayDate = useCallback((value?: string | null) => {
    if (!value) return 'Date TBD';
    try {
      return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return value;
    }
  }, []);

  return (
    <div className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`} data-tour="quick-search">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Event Discovery</h2>
            {showPinning && isPinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                <Pin className="h-3 w-3" />
                Pinned
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {showPinning && isPinned 
              ? 'Your default search is ready. Just hit Go!' 
              : 'Run your go-to search and save speakers without leaving this page.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showPinning && (
            <>
              {isPinned ? (
                <button
                  type="button"
                  onClick={handleUnpinSearch}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                  title="Unpin this search"
                >
                  <PinOff className="h-3.5 w-3.5" />
                  Unpin
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePinSearch}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  title="Pin this search as your default"
                >
                  <Pin className="h-3.5 w-3.5" />
                  Pin
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
            aria-label={collapsed ? 'Expand event discovery panel' : 'Collapse event discovery panel'}
          >
            {collapsed ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="space-y-5 px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-slate-700">Focus keywords</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={config.keywords}
                  onChange={(event) => updateConfig({ keywords: event.target.value })}
                  placeholder="e.g. legal operations, privacy, fintech"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
            <div className="flex flex-row items-center gap-3 md:w-auto">
              <button
                type="button"
                onClick={() => void runSearch()}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Go
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdvanced((prev) => !prev);
                  // If pinned and closing advanced, update the pin with current settings
                  if (showPinning && isPinned && showAdvanced) {
                    handlePinSearch();
                  }
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {showAdvanced ? (
                  <>
                    {showPinning && isPinned ? 'Update & Close' : 'Hide options'}
                    <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Refine
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
              <Globe2 className="h-3.5 w-3.5" />
              {locationLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
              <CalendarRange className="h-3.5 w-3.5" />
              {config.range === 'next' ? `Next ${config.days} days` : `Past ${config.days} days`}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
              {dateRangeSummary.from} → {dateRangeSummary.to}
            </span>
            {lastRunAt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                Refreshed {new Date(lastRunAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {showAdvanced && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Location</label>
                <select
                  value={config.country}
                  onChange={(event) => updateConfig({ country: event.target.value as typeof QUICK_SEARCH_DEFAULTS.country })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {QUICK_SEARCH_LOCATIONS.map((location) => (
                    <option key={location.code} value={location.code}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Time frame</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['next', 'past'] as const).map((rangeOption) => {
                    const isActive = config.range === rangeOption;
                    return (
                      <button
                        key={rangeOption}
                        type="button"
                        onClick={() => updateConfig({ range: rangeOption })}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {rangeOption === 'next' ? 'Upcoming' : 'Look back'}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Days</label>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_SEARCH_DAY_OPTIONS.map((option) => {
                    const isActive = config.days === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => updateConfig({ days: option })}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {showAdvanced && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Quick Keywords</label>
                  <p className="text-xs text-slate-500">Select up to 3 keywords to enhance your search</p>
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {config.selectedKeywordTags?.length || 0}/{MAX_SELECTED_TAGS}
                </span>
              </div>
              
              {/* Selected Tags Display */}
              {config.selectedKeywordTags && config.selectedKeywordTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {config.selectedKeywordTags.map((tagValue) => {
                    const keyword = SUGGESTED_KEYWORDS.find(k => k.value === tagValue);
                    return (
                      <span
                        key={tagValue}
                        className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700"
                      >
                        <Check className="h-3 w-3" />
                        {keyword?.label || tagValue}
                        <button
                          type="button"
                          onClick={() => removeKeywordTag(tagValue)}
                          className="ml-0.5 rounded-full hover:bg-blue-200 transition"
                          aria-label={`Remove ${keyword?.label || tagValue}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              
              {/* Keyword Selection Buttons */}
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_KEYWORDS.map((keyword) => {
                  const isSelected = config.selectedKeywordTags?.includes(keyword.value);
                  const isDisabled = !isSelected && (config.selectedKeywordTags?.length || 0) >= MAX_SELECTED_TAGS;
                  
                  return (
                    <button
                      key={keyword.value}
                      type="button"
                      onClick={() => toggleKeywordTag(keyword.value)}
                      disabled={isDisabled}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500 text-white shadow-sm hover:bg-blue-600'
                          : isDisabled
                          ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                      }`}
                      title={
                        isSelected 
                          ? `Remove ${keyword.label}` 
                          : isDisabled 
                          ? 'Maximum 3 keywords selected' 
                          : `Add ${keyword.label}`
                      }
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      {keyword.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Minimalist Status Bar */}
          {loading && searchProgress && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200 truncate">
                    {searchProgress.message}
                  </p>
                  <div className="mt-1.5 w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-300 ease-out rounded-full"
                      style={{ width: `${(searchProgress.stage / 4) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {loading && !searchProgress && (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-sm text-slate-600">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" />
              Gathering events…
            </div>
          )}

          {!loading && !error && resultsToShow.length === 0 && !lastRunAt && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              Configure your defaults and tap <span className="font-medium text-slate-800">Go</span> to fetch fresh events.
            </div>
          )}

          {!loading && !error && resultsToShow.length === 0 && lastRunAt && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
              No events matched the current filter. Try widening the time frame or adding broader keywords.
            </div>
          )}

          {!hideResults && !loading && resultsToShow.length > 0 && (
            <div className="space-y-4">
              {resultsToShow.map((event) => {
                const eventKey = event.id || event.source_url;
                const speakers = Array.isArray(event.speakers) ? (event.speakers as EventSpeaker[]) : [];
                const isExpanded = expandedEvents[eventKey] || false;
                const hasMoreSpeakers = speakers.length > 3;
                const displaySpeakers = isExpanded ? speakers : speakers.slice(0, 3);
                return (
                  <div key={eventKey} className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <a
                          href={event.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="line-clamp-2 text-base font-semibold text-slate-900 hover:text-blue-600"
                        >
                          {event.title}
                        </a>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          <span>{formatDisplayDate(event.starts_at)}</span>
                          {event.city || event.country ? <span>{[event.city, event.country].filter(Boolean).join(', ')}</span> : null}
                          {event.organizer && <span className="text-slate-500">Hosted by {event.organizer}</span>}
                        </div>
                      </div>
                      <div className="mt-1 flex flex-shrink-0 items-center gap-2 sm:mt-0">
                        <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700">
                          {speakers.length > 0 ? `${speakers.length} speaker${speakers.length === 1 ? '' : 's'}` : 'Speaker data pending'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddEventToBoard(event)}
                          disabled={boardStatus[eventKey] === 'saved' || boardStatus[eventKey] === 'saving'}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                            boardStatus[eventKey] === 'saved'
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                          title={boardStatus[eventKey] === 'saved' ? 'Already in board' : 'Add to Events Board'}
                        >
                          {boardStatus[eventKey] === 'saving' ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Adding…
                            </>
                          ) : boardStatus[eventKey] === 'saved' ? (
                            <>
                              <Check className="h-3 w-3" />
                              In Board
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3" />
                              Add to Board
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    {displaySpeakers.length > 0 && (
                      <ul className="mt-4 space-y-2">
                        {displaySpeakers.map((speaker, index) => {
                          const speakerKey = buildSpeakerKey(event, speaker, index);
                          const status = speakerStatus[speakerKey];
                          const isSaving = savingSpeakerId === speakerKey;
                          const organization = speaker.org || speaker.organization || speaker.company || '';
                          const profileLink = speaker.linkedin || speaker.profile_url || null;
                          const signature = getSpeakerSignature(speaker);
                          const duplicateEventsCount = signature ? Math.max((speakerOccurrences.get(signature)?.size || 0) - 1, 0) : 0;
                          const appearsMultiple = duplicateEventsCount > 0;
                          const signatureSaved = signature ? savedSignatures[signature] === 'saved' : false;
                          const savedHere = status === 'saved';
                          const savedFromOtherEvent = signatureSaved && !savedHere;
                          
                          // Convert EventSpeaker to SpeakerData for enhancement
                          const speakerForEnhancement: SpeakerData = {
                            name: speaker.name || '',
                            title: speaker.title || undefined,
                            org: organization || undefined,
                            profile_url: speaker.profile_url || undefined,
                            linkedin_url: speaker.linkedin || undefined,
                            email: speaker.email || undefined,
                          };
                          
                          return (
                            <DashboardSpeakerItem
                              key={speakerKey}
                              speaker={speaker}
                              speakerForEnhancement={speakerForEnhancement}
                              speakerKey={speakerKey}
                              organization={organization}
                              profileLink={profileLink}
                              appearsMultiple={appearsMultiple}
                              duplicateEventsCount={duplicateEventsCount}
                              savedFromOtherEvent={savedFromOtherEvent}
                              savedHere={savedHere}
                              isSaving={isSaving}
                              onSave={() => void handleSaveSpeaker(event, speaker, speakerKey)}
                            />
                          );
                        })}
                      </ul>
                    )}
                    {hasMoreSpeakers && (
                      <button
                        type="button"
                        onClick={() => setExpandedEvents((prev) => ({ ...prev, [eventKey]: !isExpanded }))}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Show less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Show all {speakers.length} speakers
                          </>
                        )}
                      </button>
                    )}
                    {/* Event Intelligence Quick View */}
                    <div className="mt-4">
                      <EventIntelligenceQuickView
                        event={event as any}
                        onViewFull={() => {
                          const eventId = event.source_url || event.id;
                          if (eventId) {
                            window.location.href = `/events/${encodeURIComponent(eventId)}`;
                          }
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {prioritizedResults.length > resultsToShow.length && (
                <div className="text-xs text-slate-600">
                  Showing top {resultsToShow.length} of {prioritizedResults.length} curated events. Visit{' '}
                  <Link href="/events" className="font-medium text-blue-600 hover:text-blue-700">
                    full search workspace
                  </Link>{' '}
                  to review everything.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

