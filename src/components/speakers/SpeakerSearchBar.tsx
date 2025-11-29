"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { SpeakerSearchResult } from "@/lib/services/speaker-search-service";

interface SpeakerSearchBarProps {
  onResultSelect?: (result: SpeakerSearchResult) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SpeakerSearchBar({
  onResultSelect,
  placeholder = "Search speakers by name, organization, or topic...",
  className = "",
  autoFocus = false,
}: SpeakerSearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpeakerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  async function performSearch(searchQuery: string) {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/speakers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          limit: 10,
        }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      setResults(data.results || []);
      setShowResults(true);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(result: SpeakerSearchResult) {
    if (onResultSelect) {
      onResultSelect(result);
    } else {
      // Navigate to speaker profile or search page
      router.push(`/speakers?speakerKey=${result.speaker_key || result.id}`);
    }
    setShowResults(false);
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < results.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowResults(false);
      setQuery("");
    }
  }

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
        {query && !loading && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setShowResults(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-background border rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={`${result.source}-${result.id}`}
              onClick={() => handleSelect(result)}
              className={`w-full text-left px-4 py-3 hover:bg-muted transition-colors ${
                index === selectedIndex ? "bg-muted" : ""
              } ${index !== results.length - 1 ? "border-b" : ""}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{result.name}</div>
                  {result.org && (
                    <div className="text-sm text-muted-foreground truncate">
                      {result.org}
                    </div>
                  )}
                  {result.title && (
                    <div className="text-xs text-muted-foreground truncate">
                      {result.title}
                    </div>
                  )}
                </div>
                <div className="ml-2 flex items-center gap-2">
                  {result.events && result.events.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {result.events.length} event{result.events.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  <span className="text-xs px-2 py-1 bg-muted rounded">
                    {result.source.replace("_", " ")}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && query && !loading && results.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-background border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
          No speakers found
        </div>
      )}
    </div>
  );
}

