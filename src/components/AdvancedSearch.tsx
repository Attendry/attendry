/**
 * Advanced Search Component
 * 
 * This component provides advanced search functionality with autocomplete,
 * filtering options, and real-time search capabilities.
 */

"use client";
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';

/**
 * Search suggestion interface
 */
interface SearchSuggestion {
  id: string;
  text: string;
  type: 'query' | 'location' | 'industry' | 'topic';
  popularity?: number;
}

/**
 * Search filter interface
 */
interface SearchFilter {
  dateRange: {
    from: string;
    to: string;
  };
  location: string[];
  industry: string[];
  eventType: string[];
  priceRange: {
    min: number;
    max: number;
  };
}

/**
 * Advanced search props
 */
interface AdvancedSearchProps {
  onSearch: (query: string, filters: SearchFilter) => void;
  onSuggestionSelect: (suggestion: SearchSuggestion) => void;
  initialQuery?: string;
  initialFilters?: Partial<SearchFilter>;
  placeholder?: string;
  className?: string;
}

/**
 * Advanced Search Component
 */
const AdvancedSearch = memo(function AdvancedSearch({
  onSearch,
  onSuggestionSelect,
  initialQuery = '',
  initialFilters = {},
  placeholder = 'Search for events...',
  className = '',
}: AdvancedSearchProps) {
  // State management
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilter>({
    dateRange: { from: '', to: '' },
    location: [],
    industry: [],
    eventType: [],
    priceRange: { min: 0, max: 1000 },
    ...initialFilters,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Debounced query for API calls
  const debouncedQuery = useDebounce(query, 300);

  // Load search history from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedHistory = localStorage.getItem('searchHistory');
      if (savedHistory) {
        setSearchHistory(JSON.parse(savedHistory));
      }
    }
  }, []);

  // Save search history
  const saveSearchHistory = useCallback((searchTerm: string) => {
    if (searchTerm.trim() && !searchHistory.includes(searchTerm)) {
      const newHistory = [searchTerm, ...searchHistory.slice(0, 9)]; // Keep last 10
      setSearchHistory(newHistory);
      if (typeof window !== 'undefined') {
        localStorage.setItem('searchHistory', JSON.stringify(newHistory));
      }
    }
  }, [searchHistory]);

  // Fetch search suggestions
  const fetchSuggestions = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/search/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchTerm }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle query changes
  useEffect(() => {
    if (debouncedQuery) {
      fetchSuggestions(debouncedQuery);
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery, fetchSuggestions]);

  // Handle search submission
  const handleSearch = useCallback(() => {
    if (query.trim()) {
      saveSearchHistory(query);
      onSearch(query, filters);
      setShowSuggestions(false);
    }
  }, [query, filters, onSearch, saveSearchHistory]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    onSuggestionSelect(suggestion);
    setShowSuggestions(false);
  }, [onSuggestionSelect]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }, [handleSearch]);

  // Filter change handlers
  const handleFilterChange = useCallback((filterType: keyof SearchFilter, value: any) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value,
    }));
  }, []);

  // Memoized suggestions list
  const suggestionsList = useMemo(() => {
    const allSuggestions = [
      ...suggestions,
      ...searchHistory.map(term => ({
        id: `history-${term}`,
        text: term,
        type: 'query' as const,
      })),
    ];

    return allSuggestions.slice(0, 10);
  }, [suggestions, searchHistory]);

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="flex items-center bg-white border border-slate-300 rounded-lg shadow-sm">
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              className="w-full px-4 py-3 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-l-lg"
            />
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
          
          {/* Search button */}
          <button
            onClick={handleSearch}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-r-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Search
          </button>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestionsList.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestionsList.map((suggestion) => (
              <button
                key={suggestion.id}
                onClick={() => handleSuggestionSelect(suggestion)}
                className="w-full px-4 py-3 text-left hover:bg-slate-50 focus:outline-none focus:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-900">{suggestion.text}</span>
                  <span className="text-xs text-slate-500 capitalize">
                    {suggestion.type}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Advanced Filters */}
      <div className="mt-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center text-sm text-slate-600 hover:text-slate-800 transition-colors"
        >
          <svg
            className={`w-4 h-4 mr-2 transition-transform ${showFilters ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Advanced Filters
        </button>

        {showFilters && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Date Range
                </label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={filters.dateRange.from}
                    onChange={(e) => handleFilterChange('dateRange', {
                      ...filters.dateRange,
                      from: e.target.value,
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="date"
                    value={filters.dateRange.to}
                    onChange={(e) => handleFilterChange('dateRange', {
                      ...filters.dateRange,
                      to: e.target.value,
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  placeholder="Enter location..."
                  value={filters.location.join(', ')}
                  onChange={(e) => handleFilterChange('location', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Industry */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Industry
                </label>
                <select
                  multiple
                  value={filters.industry}
                  onChange={(e) => handleFilterChange('industry', Array.from(e.target.selectedOptions, option => option.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="legal-compliance">Legal & Compliance</option>
                  <option value="fintech">FinTech</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="technology">Technology</option>
                  <option value="finance">Finance</option>
                </select>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setFilters({
                  dateRange: { from: '', to: '' },
                  location: [],
                  industry: [],
                  eventType: [],
                  priceRange: { min: 0, max: 1000 },
                })}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
                Clear Filters
              </button>
              <button
                onClick={handleSearch}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default AdvancedSearch;
