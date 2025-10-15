"use client";

import React, { useEffect, useMemo, useState, useCallback, memo } from "react";
import { PageHeader, PageHeaderActions } from "@/components/Layout/PageHeader";
import { ContentContainer } from "@/components/Layout/PageContainer";
import { EmptyEvents } from "@/components/States/EmptyState";
import { SkeletonList } from "@/components/States/LoadingState";
import { ErrorState } from "@/components/States/ErrorState";
import EventCard from "@/components/EventCard";
import { deriveLocale, toISO2Country } from "@/lib/utils/country";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

type EventRec = {
  id?: string;
  source_url: string;
  link?: string;
  title: string;
  starts_at?: string | null;
  ends_at?: string | null;
  city?: string | null;
  country?: string | null;
  organizer?: string | null;
  speakers?: any[] | null;
  description?: string | null;
  venue?: string | null;
  location?: string | null;
  confidence?: number | null;
  confidence_reason?: string | null;
  pipeline_metadata?: any | null;
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

interface EventsPageNewProps {
  initialSavedSet: Set<string>;
}

export default function EventsPageNew({ initialSavedSet }: EventsPageNewProps) {
  // Events search state - matching existing architecture
  const [country, setCountry] = useState<string>("EU");
  const [range, setRange] = useState<"next" | "past">("next");
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [from, setFrom] = useState<string>(todayISO());
  const [to, setTo] = useState<string>(todayISO(addDays(new Date(), 7)));
  const [keywords, setKeywords] = useState<string>("");

  const [events, setEvents] = useState<EventRec[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSet, setSavedSet] = useState<Set<string>>(initialSavedSet);
  const [debug, setDebug] = useState<any>(null);

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
  }, [handleQuickRange]);
  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (from > to) {
      setError("'From' must be before 'To'");
      return;
    }
    setError("");
    setLoading(true);
    setEvents([]);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setDebug(data);
      setEvents((data.events || data.items || []).map((e: EventRec) => ({
        ...e,
        source_url: e.source_url || e.link
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredEvents = useMemo(() => {
    return events; // Events are already filtered by the API
  }, [events]);

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
              loading
            }}
            tertiary={{
              label: 'Clear Filters',
              onClick: handleResetFilters
            }}
          />
        }
      >
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
                disabled={loading}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors duration-200"
              >
                {loading ? (
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
      </PageHeader>

      <ContentContainer>
        <div className="py-6">
          {/* Content */}
          {loading ? (
            <SkeletonList count={3} />
          ) : error ? (
            <ErrorState
              title="Failed to load events"
              message={error}
              action={{
                label: "Try Again",
                onClick: handleRefresh
              }}
            />
          ) : filteredEvents.length === 0 ? (
            <EmptyEvents />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} found
                </h2>
              </div>
              
              <div className="grid gap-4">
                {filteredEvents.map((event) => (
                  <EventCard
                    key={event.id || event.source_url}
                    ev={event as any}
                    initiallySaved={savedSet.has(event.id || event.source_url)}
                    onAddToComparison={(event) => {
                      console.log('Add to comparison:', event);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </ContentContainer>
    </>
  );
}
