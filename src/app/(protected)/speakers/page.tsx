"use client";

import React, { useState, useEffect } from "react";
import { SpeakerSearchBar } from "@/components/speakers/SpeakerSearchBar";
import { SpeakerResultCard } from "@/components/speakers/SpeakerResultCard";
import { SpeakerSearchFilters } from "@/components/speakers/SpeakerSearchFilters";
import { SpeakerSearchResult, SpeakerSearchOptions } from "@/lib/services/speaker-search-service";
import { Loader2, Search, Filter, X } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function SpeakersPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [name, setName] = useState(searchParams.get("name") || "");
  const [results, setResults] = useState<SpeakerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Partial<SpeakerSearchOptions>>({
    org: searchParams.get("org") || undefined,
    title: searchParams.get("title") || undefined,
    topic: searchParams.get("topic") || undefined,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  });

  useEffect(() => {
    const speakerKey = searchParams.get("speakerKey");
    if (speakerKey) {
      // Load specific speaker
      loadSpeakerHistory(speakerKey);
    } else if (query || name || Object.values(filters).some(Boolean)) {
      performSearch();
    }
  }, []);

  async function performSearch() {
    if (!query && !name && !Object.values(filters).some(Boolean)) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchOptions: SpeakerSearchOptions = {
        query: query || undefined,
        name: name || undefined,
        ...filters,
        limit: pagination.limit,
        offset: pagination.offset,
      };

      const response = await fetch("/api/speakers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchOptions),
      });

      if (!response.ok) {
        if (response.status === 429) {
          const data = await response.json();
          throw new Error(data.error || "Rate limit exceeded. Please try again later.");
        }
        throw new Error("Search failed");
      }

      const data = await response.json();
      setResults(data.results || []);
      setPagination({
        total: data.pagination?.total || 0,
        limit: data.pagination?.limit || 50,
        offset: data.pagination?.offset || 0,
        hasMore: data.pagination?.hasMore || false,
      });
    } catch (err: any) {
      setError(err.message || "Failed to search speakers");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadSpeakerHistory(speakerKey: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/speakers/search?speakerKey=${speakerKey}&limit=20`);
      if (!response.ok) throw new Error("Failed to load speaker history");

      const data = await response.json();
      // Transform history into search results format
      if (data.history) {
        // This would need to be adapted based on the actual response format
        setResults([]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load speaker history");
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(newFilters: Partial<SpeakerSearchOptions>) {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, offset: 0 }));
  }

  function handleClearFilters() {
    setFilters({});
    setPagination((prev) => ({ ...prev, offset: 0 }));
  }

  function handleLoadMore() {
    setPagination((prev) => ({
      ...prev,
      offset: prev.offset + prev.limit,
    }));
  }

  useEffect(() => {
    if (pagination.offset === 0) {
      performSearch();
    } else {
      // Load more results
      performSearch();
    }
  }, [filters, pagination.offset]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Speaker Search</h1>
        <p className="text-muted-foreground">
          Search for speakers across all events, contacts, and profiles
        </p>
      </div>

      <div className="mb-6">
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <SpeakerSearchBar
              placeholder="Search by name, organization, or topic..."
              onResultSelect={(result) => {
                // Navigate to speaker details or show in modal
                console.log("Selected:", result);
              }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${
              showFilters ? "bg-primary text-primary-foreground" : ""
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="border rounded-lg p-4 bg-muted/50">
            <SpeakerSearchFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              onClear={handleClearFilters}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          {error}
        </div>
      )}

      {loading && pagination.offset === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : results.length > 0 ? (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            Found {pagination.total} speaker{pagination.total !== 1 ? "s" : ""}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.map((result) => (
              <SpeakerResultCard
                key={`${result.source}-${result.id}`}
                result={result}
                showSimilarity={!!name || !!query}
              />
            ))}
          </div>
          {pagination.hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-6 py-2 border rounded-lg hover:bg-muted disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                ) : (
                  <Search className="h-4 w-4 inline mr-2" />
                )}
                Load More
              </button>
            </div>
          )}
        </>
      ) : !loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No speakers found. Try adjusting your search or filters.</p>
        </div>
      ) : null}
    </div>
  );
}

