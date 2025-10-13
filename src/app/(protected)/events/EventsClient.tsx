"use client";
import React, { useEffect, useMemo, useState, useCallback, memo } from "react";
import EventCard from "@/components/EventCard";
import { SetupStatusIndicator } from "@/components/SetupStatusIndicator";
import AdvancedSearch from "@/components/AdvancedSearch";
import SearchHistory from "@/components/SearchHistory";
import { deriveLocale, toISO2Country } from "@/lib/utils/country";

type EventRec = {
  id?: string;
  source_url: string;
  link?: string; // Alternative field name
  title: string;
  starts_at?: string | null;
  ends_at?: string | null;
  city?: string | null;
  country?: string | null;
  organizer?: string | null;
  speakers?: any[] | null; // Speaker data from pipeline
  description?: string | null; // Event description
  venue?: string | null; // Event venue
  location?: string | null; // Event location
  confidence?: number | null; // Confidence score
  confidence_reason?: string | null; // Confidence reason
  pipeline_metadata?: any | null; // Pipeline metadata
};

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

const EventsClient = memo(function EventsClient({ initialSavedSet }: { initialSavedSet: Set<string> }) {
  
  // Events search state
  const [country, setCountry] = useState<string>("EU");
  const [range, setRange] = useState<"next" | "past">("next");
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [advanced, setAdvanced] = useState(false);
  const [from, setFrom] = useState<string>(todayISO());
  const [to, setTo] = useState<string>(todayISO(addDays(new Date(), 7)));
  const [keywords, setKeywords] = useState<string>("");
  const [useAdvancedSearch, setUseAdvancedSearch] = useState(false);

  const [events, setEvents] = useState<EventRec[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [debug, setDebug] = useState<any>(null);
  const showDebug = useMemo(() => {
    if (typeof window === 'undefined') return process.env.NODE_ENV !== 'production';
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('debug') === '1') return true;
    }
    return process.env.NODE_ENV !== 'production';
  }, []);

  // Keep dates in sync when advanced is OFF
  useEffect(() => {
    if (!advanced) {
      const now = new Date();
      if (range === "next") {
        setFrom(todayISO(now));
        setTo(todayISO(addDays(now, days)));
      } else {
        setFrom(todayISO(addDays(now, -days)));
        setTo(todayISO(now));
      }
    }
  }, [range, days, advanced]);

  const q = useMemo(() => keywords.trim(), [keywords]);

  // Advanced search handlers
  const handleAdvancedSearch = useCallback((query: string, filters: any) => {
    setKeywords(query);
    if (filters.dateRange.from) setFrom(filters.dateRange.from);
    if (filters.dateRange.to) setTo(filters.dateRange.to);
    if (filters.location.length > 0) {
      // Use first location as country for now
      const location = filters.location[0];
      const euCountry = EU.find(c => c.name.toLowerCase().includes(location.toLowerCase()));
      if (euCountry) setCountry(euCountry.code);
    }
    run();
  }, []);

  const handleSuggestionSelect = useCallback((suggestion: any) => {
    setKeywords(suggestion.text);
  }, []);

  const handleSearchHistorySelect = useCallback((query: string) => {
    setKeywords(query);
    run();
  }, []);

  const handleClearSearchHistory = useCallback(() => {
    // History is cleared in the SearchHistory component
  }, []);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (from > to) {
      setErr("'From' must be before 'To'");
      return;
    }
    setErr("");
    setLoading(true);
    setEvents([]);
    try {
      const normalizedCountry = toISO2Country(country) ?? 'EU';
      const locale = deriveLocale(normalizedCountry);

      const res = await fetch(`/api/events/run${showDebug ? '?debug=1' : ''}` , {
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
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setDebug(data);
      setEvents((data.events || data.items || []).map((e: EventRec) => ({
        source_url: e.source_url || e.link,
        title: e.title || e.source_url || "Untitled",
        starts_at: e.starts_at ?? null,
        ends_at: e.ends_at ?? null,
        city: e.city ?? null,
        country: e.country ?? null,
        organizer: e.organizer ?? null,
        speakers: e.speakers ?? null, // ✅ Include speakers from pipeline
        description: e.description ?? null, // ✅ Include description
        venue: e.venue ?? null, // ✅ Include venue
        location: e.location ?? null, // ✅ Include location
        confidence: e.confidence ?? null, // ✅ Include confidence
        confidence_reason: e.confidence_reason ?? null, // ✅ Include confidence reason
        pipeline_metadata: e.pipeline_metadata ?? null, // ✅ Include pipeline metadata
      })));
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      setErr(error || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            Discover Events
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Find conferences, meetups, and networking opportunities tailored to your interests
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={run} className="max-w-4xl mx-auto">
          {/* Setup Status Indicator */}
          <div className="mb-6">
            <SetupStatusIndicator />
          </div>
          
          {/* Main Search Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm hover:shadow-md transition-shadow duration-200 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-slate-900">Find Events</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                >
                  {EU.map((c) => (
                    <option key={c.code || "all"} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Time Range</label>
                <div className="space-y-3">
                  {/* Range Selection (Next/Past) */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRange("next")}
                      className={`px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                        range === "next" 
                          ? "bg-blue-600 text-white shadow-sm" 
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      Next {days} days
                    </button>
                    <button
                      type="button"
                      onClick={() => setRange("past")}
                      className={`px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                        range === "past" 
                          ? "bg-blue-600 text-white shadow-sm" 
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      Past {days} days
                    </button>
                  </div>
                  
                  {/* Days Selection */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDays(7)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                        days === 7 
                          ? "bg-green-600 text-white shadow-sm" 
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      7 days
                    </button>
                    <button
                      type="button"
                      onClick={() => setDays(14)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                        days === 14 
                          ? "bg-green-600 text-white shadow-sm" 
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      14 days
                    </button>
                    <button
                      type="button"
                      onClick={() => setDays(30)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                        days === 30 
                          ? "bg-green-600 text-white shadow-sm" 
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      30 days
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Search Toggle */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setAdvanced(!advanced)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
              >
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${advanced ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                {advanced ? 'Hide Advanced Options' : 'Advanced Search Options'}
              </button>
              {advanced && (
                <span className="text-sm text-slate-500">Customize your search</span>
              )}
            </div>

            {/* Advanced Search Section - Collapsible */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
              advanced ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="border-t border-slate-200 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                    <input 
                      type="date" 
                      value={from} 
                      onChange={(e) => setFrom(e.target.value)} 
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                    <input 
                      type="date" 
                      value={to} 
                      onChange={(e) => setTo(e.target.value)} 
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">Search</label>
                    <button
                      type="button"
                      onClick={() => setUseAdvancedSearch(!useAdvancedSearch)}
                      className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      {useAdvancedSearch ? 'Use Simple Search' : 'Use Advanced Search'}
                    </button>
                  </div>
                  
                  {useAdvancedSearch ? (
                    <AdvancedSearch
                      onSearch={handleAdvancedSearch}
                      onSuggestionSelect={handleSuggestionSelect}
                      initialQuery={keywords}
                      placeholder="Search for events with advanced filters..."
                      className="mb-4"
                    />
                  ) : (
                    <input 
                      type="text" 
                      value={keywords} 
                      onChange={(e) => setKeywords(e.target.value)} 
                      placeholder="e.g. compliance, ediscovery, forensics, legal tech"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}
                  
                  {!useAdvancedSearch && (
                    <p className="text-sm text-slate-500 mt-2">Separate multiple keywords with commas for more targeted results</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-200">
              <button 
                type="submit" 
                disabled={loading} 
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Searching...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search Events
                  </>
                )}
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setCountry("");
                  setRange("next");
                  setDays(7);
                  setAdvanced(false);
                  setKeywords("");
                  setEvents([]);
                  setErr("");
                  setDebug(null);
                }}
                className="px-6 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-lg transition-colors duration-200"
              >
                Reset
              </button>
            </div>

            {/* Error Display */}
            {err && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{err}</p>
              </div>
            )}

            {/* Helpful Tips */}
            <div className="mt-4 text-xs text-slate-500 space-y-1">
              <p>💡 Works even without API keys (returns demo events)</p>
              <p>📍 Current location: &quot;{country || "All Europe"}&quot;</p>
            </div>
          </div>
        </form>

        {/* Debug Info - Collapsible */}
        {showDebug && debug && (
          <div className="max-w-6xl mx-auto mb-8">
            <details className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <summary className="px-6 py-4 bg-slate-50 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors duration-200">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium text-slate-700">Search Pipeline Debug</span>
                </div>
              </summary>
              <div className="p-6">
                <pre className="text-xs text-slate-600 whitespace-pre-wrap break-all bg-slate-50 p-4 rounded-lg overflow-auto max-h-96">
                  {JSON.stringify(debug, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        )}

        {/* Search History */}
        {!loading && events.length === 0 && !debug && (
          <div className="max-w-6xl mx-auto mb-8">
            <SearchHistory
              onSearchSelect={handleSearchHistorySelect}
              onClearHistory={handleClearSearchHistory}
              className="max-w-md mx-auto"
            />
          </div>
        )}

        {/* Results Section */}
        <div className="max-w-6xl mx-auto">
          {/* Empty State */}
          {!loading && events.length === 0 && !debug && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Ready to discover events?</h3>
              <p className="text-slate-600 mb-6">Use the search controls above to find conferences, meetups, and networking opportunities.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">Select a location</span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">Choose time range</span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">Add keywords (optional)</span>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">Click Search</span>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 text-slate-600">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="font-medium">Searching for events...</span>
                </div>
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
                    <div className="h-4 bg-slate-200 rounded mb-3"></div>
                    <div className="h-3 bg-slate-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && events.length > 0 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Found {events.length} Events</h2>
                  <p className="text-slate-600 mt-1">
                    {country ? `in ${EU.find(c => c.code === country)?.name || country}` : 'across Europe'}
                    {range === 'next' ? ` (next ${days} days)` : ` (past ${days} days)`}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden sm:inline">Last updated: {new Date().toLocaleTimeString()}</span>
                  <span className="sm:hidden">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>
              <div className="grid gap-6">
                {events.map((ev: EventRec) => (
                  <EventCard key={ev.source_url} ev={ev} initiallySaved={initialSavedSet.has(ev.source_url)} />
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
});

export default EventsClient;
