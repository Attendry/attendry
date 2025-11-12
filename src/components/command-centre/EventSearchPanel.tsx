'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, X, Loader2, Plus, Settings, CheckCircle2, AlertCircle } from 'lucide-react';
import { deriveLocale, toISO2Country } from '@/lib/utils/country';
import Link from 'next/link';

const EU = [
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

interface Event {
  id?: string;
  title?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  city?: string | null;
  country?: string | null;
  venue?: string | null;
  organizer?: string | null;
  speakers?: any[] | null;
  source_url: string;
  description?: string | null;
}

interface EventSearchPanelProps {
  onSpeakersFound?: (speakers: any[], event: Event) => void;
}

interface UserProfile {
  industry_terms?: string[];
  icp_terms?: string[];
  competitors?: string[];
}

export function EventSearchPanel({ onSpeakersFound }: EventSearchPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  
  // Search form state
  const [keywords, setKeywords] = useState('');
  const [country, setCountry] = useState('EU');
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [from, setFrom] = useState<string>(todayISO());
  const [to, setTo] = useState<string>(todayISO(addDays(new Date(), 7)));

  // Load user profile on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/profiles/me');
        const data = await res.json();
        if (data.success && data.profile) {
          setUserProfile({
            industry_terms: data.profile.industry_terms || [],
            icp_terms: data.profile.icp_terms || [],
            competitors: data.profile.competitors || [],
          });
        }
      } catch (err) {
        console.error('Failed to load user profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    }
    loadProfile();
  }, []);

  // Keep dates in sync
  useEffect(() => {
    const now = new Date();
    setFrom(todayISO(now));
    setTo(todayISO(addDays(now, days)));
  }, [days]);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (from > to) {
      setError("'From' must be before 'To'");
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const normalizedCountry = toISO2Country(country) ?? 'EU';
      const locale = deriveLocale(normalizedCountry);
      const q = keywords.trim() || 'conference';

      const res = await fetch(`/api/events/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userText: q,
          country: normalizedCountry,
          dateFrom: from,
          dateTo: to,
          locale,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);

      const events = (data.events || data.items || []).map((e: Event) => ({
        ...e,
        source_url: e.source_url || e.link || '',
      }));

      setSearchResults(events);
      
      // Log for debugging
      if (events.length === 0) {
        console.log('No events found in search response:', {
          hasEvents: !!data.events,
          eventsLength: data.events?.length,
          hasItems: !!data.items,
          itemsLength: data.items?.length,
          dataKeys: Object.keys(data),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [keywords, country, from, to]);

  const handleQuickSearch = useCallback(() => {
    // Use default settings for quick search
    handleSearch();
  }, [handleSearch]);

  const handleSaveSpeaker = useCallback(async (speaker: any, event: Event) => {
    try {
      // Ensure speaker has required fields
      if (!speaker.name) {
        alert('Speaker name is required');
        return;
      }

      const res = await fetch('/api/profiles/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speaker_data: {
            name: speaker.name,
            title: speaker.title || null,
            org: speaker.org || null,
            email: speaker.email || null,
            linkedin_url: speaker.linkedin_url || null,
            bio: speaker.bio || null,
            profile_url: speaker.profile_url || null,
          },
          enhanced_data: {
            title: speaker.title || null,
            organization: speaker.org || null,
            location: event.city && event.country 
              ? `${event.city}, ${event.country}` 
              : event.city || event.country || null,
            bio: speaker.bio || null,
            social_links: {
              linkedin: speaker.linkedin_url || null,
            },
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          // Already saved - show a subtle message but don't error
          return;
        }
        throw new Error(data?.error || 'Save failed');
      }

      // Notify parent component
      if (onSpeakersFound) {
        onSpeakersFound([speaker], event);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save speaker');
    }
  }, [onSpeakersFound]);

  const hasProfileTerms = (userProfile?.industry_terms?.length || 0) > 0 || (userProfile?.icp_terms?.length || 0) > 0;

  if (isMinimized) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 text-gray-400" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Event Search</h3>
              <p className="text-xs text-gray-500">
                {isSearching 
                  ? 'Searching...' 
                  : searchResults.length > 0 
                    ? `${searchResults.length} events found` 
                    : keywords 
                      ? 'No events found - click to refine search'
                      : hasProfileTerms
                        ? 'Ready to search with your saved terms'
                        : 'Search for events and speakers'}
              </p>
              {!loadingProfile && hasProfileTerms && (
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="text-gray-500">
                    Using {userProfile?.industry_terms?.length || 0} industry, {userProfile?.icp_terms?.length || 0} ICP terms
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleQuickSearch}
              disabled={isSearching}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
            >
              {isSearching ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Search className="h-3 w-3" />
              )}
              {keywords ? 'Search' : 'Go'}
            </button>
            <button
              onClick={() => setIsMinimized(false)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Event Search</h3>
          <p className="text-sm text-gray-600">Search for events and add speakers to your saved profiles</p>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* User Profile Terms Display */}
      {!loadingProfile && (
        <div className={`mb-4 rounded-lg border p-4 ${hasProfileTerms ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {hasProfileTerms ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
                <h4 className="text-sm font-semibold text-gray-900">
                  {hasProfileTerms ? 'Search will use your saved terms' : 'No search terms configured'}
                </h4>
              </div>
              {hasProfileTerms ? (
                <div className="space-y-2 text-xs">
                  {userProfile?.industry_terms && userProfile.industry_terms.length > 0 && (
                    <div>
                      <span className="font-medium text-gray-700">Industry Terms: </span>
                      <span className="text-gray-600">
                        {userProfile.industry_terms.slice(0, 5).join(', ')}
                        {userProfile.industry_terms.length > 5 && ` +${userProfile.industry_terms.length - 5} more`}
                      </span>
                    </div>
                  )}
                  {userProfile?.icp_terms && userProfile.icp_terms.length > 0 && (
                    <div>
                      <span className="font-medium text-gray-700">ICP Terms: </span>
                      <span className="text-gray-600">
                        {userProfile.icp_terms.slice(0, 5).join(', ')}
                        {userProfile.icp_terms.length > 5 && ` +${userProfile.icp_terms.length - 5} more`}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-600">
                  Configure your Industry and ICP terms to improve search relevance. These terms will be automatically included in your searches.
                </p>
              )}
            </div>
            <Link
              href="/admin"
              className="ml-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Settings className="h-3.5 w-3.5" />
              {hasProfileTerms ? 'Edit' : 'Configure'}
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            {EU.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as 7 | 14 | 30)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
          <button
            type="submit"
            disabled={isSearching}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Search
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isSearching && searchResults.length === 0 && !error && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
          <p className="text-sm text-gray-600">
            No events found for your search criteria. Try:
          </p>
          <ul className="mt-2 text-xs text-gray-500 space-y-1">
            <li>• Adjusting your keywords</li>
            <li>• Trying a different country</li>
            <li>• Expanding the date range</li>
          </ul>
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">
              Found {searchResults.length} event{searchResults.length !== 1 ? 's' : ''}
            </h4>
            <button
              onClick={() => {
                setSearchResults([]);
                setKeywords('');
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {searchResults.slice(0, 10).map((event) => (
              <div
                key={event.id || event.source_url}
                className="rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="text-sm font-medium text-gray-900">{event.title || 'Untitled Event'}</h5>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      {event.city && <span>{event.city}</span>}
                      {event.starts_at && (
                        <span>{new Date(event.starts_at).toLocaleDateString()}</span>
                      )}
                      {event.organizer && <span>by {event.organizer}</span>}
                    </div>
                    {event.speakers && event.speakers.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-gray-700">Speakers:</p>
                        {event.speakers.slice(0, 5).map((speaker: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded bg-white px-2 py-1 text-xs"
                          >
                            <span className="text-gray-700">
                              {speaker.name || 'Unknown'}
                              {speaker.title && ` - ${speaker.title}`}
                              {speaker.org && ` (${speaker.org})`}
                            </span>
                            <button
                              onClick={() => handleSaveSpeaker(speaker, event)}
                              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                            >
                              <Plus className="h-3 w-3" />
                              Save
                            </button>
                          </div>
                        ))}
                        {event.speakers.length > 5 && (
                          <p className="text-xs text-gray-500">
                            +{event.speakers.length - 5} more speakers
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-gray-500 italic">No speakers found for this event</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

