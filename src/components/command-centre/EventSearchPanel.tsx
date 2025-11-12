'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Loader2, Calendar, MapPin, ExternalLink, X, Check, Tag, Users } from 'lucide-react';
import { deriveLocale, toISO2Country } from '@/lib/utils/country';

interface EventSearchPanelProps {
  onSaveSpeaker?: (event: any) => void;
}

interface UserProfile {
  industry_terms?: string[];
  icp_terms?: string[];
  competitors?: string[];
}

interface SearchEvent {
  id: string;
  source_url: string;
  title: string;
  starts_at?: string;
  ends_at?: string;
  city?: string;
  country?: string;
  organizer?: string;
  description?: string;
  venue?: string;
  confidence?: number;
}

const EU_COUNTRIES = [
  { code: 'EU', name: 'All Europe' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
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

export function EventSearchPanel({ onSaveSpeaker }: EventSearchPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileDetails, setShowProfileDetails] = useState(false);

  // Search form state
  const [keywords, setKeywords] = useState('');
  const [country, setCountry] = useState('EU');
  const [days, setDays] = useState(7);

  // Load user profile on mount
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

  // Pre-configured quick search
  const handleQuickSearch = useCallback(async () => {
    setIsSearching(true);
    setError(null);
    
    try {
      const now = new Date();
      const from = todayISO(now);
      const to = todayISO(addDays(now, 7));
      const normalizedCountry = toISO2Country(country) ?? 'EU';
      const locale = deriveLocale(normalizedCountry);

      const res = await fetch('/api/events/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userText: keywords || '',
          country: normalizedCountry,
          dateFrom: from,
          dateTo: to,
          locale,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || 'Search failed');
      }

      const data = await res.json();
      const events = (data.events || data.items || []).map((e: any) => ({
        ...e,
        source_url: e.source_url || e.link,
      }));

      setSearchResults(events);
      setIsExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search events');
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [keywords, country]);

  const handleSaveEvent = useCallback((event: SearchEvent) => {
    if (onSaveSpeaker) {
      onSaveSpeaker(event);
    }
    setSavedEventIds(prev => new Set([...prev, event.id || event.source_url]));
  }, [onSaveSpeaker]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Header with Quick Search */}
      <div className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">Event Search</h2>
              <p className="text-sm text-gray-600">Find and save speakers from upcoming events</p>
              
              {/* Search Profile Visualization */}
              {userProfile && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowProfileDetails(!showProfileDetails)}
                    className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    Search uses your profile targeting
                    <ChevronDown className={`h-3 w-3 transition-transform ${showProfileDetails ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showProfileDetails && (
                    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                      {userProfile.industry_terms && userProfile.industry_terms.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Tag className="h-3 w-3 text-blue-600" />
                            <span className="text-xs font-medium text-gray-700">Industry Terms:</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {userProfile.industry_terms.slice(0, 5).map((term, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs"
                              >
                                {term}
                              </span>
                            ))}
                            {userProfile.industry_terms.length > 5 && (
                              <span className="text-xs text-gray-500">
                                +{userProfile.industry_terms.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {userProfile.icp_terms && userProfile.icp_terms.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Users className="h-3 w-3 text-green-600" />
                            <span className="text-xs font-medium text-gray-700">Target Roles (ICP):</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {userProfile.icp_terms.slice(0, 5).map((term, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-100 text-green-800 text-xs"
                              >
                                {term}
                              </span>
                            ))}
                            {userProfile.icp_terms.length > 5 && (
                              <span className="text-xs text-gray-500">
                                +{userProfile.icp_terms.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="pt-1 border-t border-gray-200">
                        <a
                          href="/admin"
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Manage search profile →
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>

          {/* Quick Search Bar */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Keywords (optional)"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {EU_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleQuickSearch}
                disabled={isSearching}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Go
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <X className="h-4 w-4" />
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Search Results */}
      {isExpanded && searchResults.length > 0 && (
        <div className="border-t border-gray-200 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Found {searchResults.length} event{searchResults.length !== 1 ? 's' : ''}
            </h3>
            <button
              onClick={() => {
                setSearchResults([]);
                setSavedEventIds(new Set());
              }}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Clear results
            </button>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {searchResults.map((event) => {
              const isSaved = savedEventIds.has(event.id || event.source_url);
              return (
                <div
                  key={event.id || event.source_url}
                  className="rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 mb-1 truncate">
                        {event.title}
                      </h4>
                      
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-2">
                        {event.starts_at && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(event.starts_at).toLocaleDateString()}
                          </div>
                        )}
                        {event.city && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.city}
                            {event.country && `, ${event.country}`}
                          </div>
                        )}
                      </div>

                      {event.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {event.description}
                        </p>
                      )}

                      {event.organizer && (
                        <p className="mt-1 text-xs text-gray-500">
                          Organized by {event.organizer}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {isSaved ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 text-xs font-medium rounded-lg cursor-not-allowed"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Saved
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSaveEvent(event)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Save
                        </button>
                      )}
                      <a
                        href={event.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State when expanded but no results */}
      {isExpanded && searchResults.length === 0 && !isSearching && (
        <div className="border-t border-gray-200 p-6">
          <div className="text-center py-8 text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p className="text-sm">No results yet. Click "Go" to search for events.</p>
          </div>
        </div>
      )}
    </div>
  );
}

