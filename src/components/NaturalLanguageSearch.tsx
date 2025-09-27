/**
 * Natural Language Search Component
 * 
 * This component provides natural language processing for search queries
 * with intent recognition and smart query understanding.
 */

"use client";
import { useState, useEffect, useCallback, memo } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';

/**
 * Search intent interface
 */
interface SearchIntent {
  type: 'event_search' | 'location_search' | 'date_search' | 'industry_search' | 'speaker_search';
  confidence: number;
  entities: {
    location?: string[];
    date?: string[];
    industry?: string[];
    speaker?: string[];
    keywords?: string[];
  };
  originalQuery: string;
  processedQuery: string;
}

/**
 * Natural Language Search Component
 */
const NaturalLanguageSearch = memo(function NaturalLanguageSearch({
  onSearch,
  onIntentDetected,
  placeholder = 'Ask me anything about events...',
  className = '',
}: {
  onSearch: (query: string, intent: SearchIntent) => void;
  onIntentDetected?: (intent: SearchIntent) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [intent, setIntent] = useState<SearchIntent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Debounced query for NLP processing
  const debouncedQuery = useDebounce(query, 500);

  // Process natural language query
  useEffect(() => {
    if (debouncedQuery.trim()) {
      processNaturalLanguageQuery(debouncedQuery);
    } else {
      setIntent(null);
      setSuggestions([]);
    }
  }, [debouncedQuery]);

  // Process natural language query
  const processNaturalLanguageQuery = useCallback(async (query: string) => {
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/search/nlp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const data = await response.json();
        setIntent(data.intent);
        setSuggestions(data.suggestions || []);
        
        if (onIntentDetected) {
          onIntentDetected(data.intent);
        }
      }
    } catch (error) {
      console.error('Failed to process natural language query:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [onIntentDetected]);

  // Handle search submission
  const handleSearch = useCallback(() => {
    if (query.trim() && intent) {
      onSearch(query, intent);
    }
  }, [query, intent, onSearch]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setQuery(suggestion);
  }, []);

  // Get intent icon
  const getIntentIcon = useCallback((intentType: string) => {
    const icons = {
      event_search: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      location_search: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      date_search: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      industry_search: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      speaker_search: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    };
    return icons[intentType as keyof typeof icons] || icons.event_search;
  }, []);

  // Get intent label
  const getIntentLabel = useCallback((intentType: string) => {
    const labels = {
      event_search: 'Event Search',
      location_search: 'Location Search',
      date_search: 'Date Search',
      industry_search: 'Industry Search',
      speaker_search: 'Speaker Search',
    };
    return labels[intentType as keyof typeof labels] || 'Search';
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="flex items-center bg-white border border-gray-300 rounded-lg shadow-sm">
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-l-lg"
            />
            
            {/* Processing indicator */}
            {isProcessing && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
          
          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={!query.trim() || !intent}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-r-lg hover:bg-blue-700 disabled:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Search
          </button>
        </div>

        {/* Intent Detection */}
        {intent && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="p-1 bg-blue-100 rounded">
                {getIntentIcon(intent.type)}
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  {getIntentLabel(intent.type)} ({(intent.confidence * 100).toFixed(0)}% confidence)
                </p>
                <p className="text-xs text-blue-700">
                  Processed: "{intent.processedQuery}"
                </p>
              </div>
            </div>
            
            {/* Extracted entities */}
            {Object.keys(intent.entities).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {intent.entities.location?.map((loc, index) => (
                  <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    📍 {loc}
                  </span>
                ))}
                {intent.entities.date?.map((date, index) => (
                  <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    📅 {date}
                  </span>
                ))}
                {intent.entities.industry?.map((industry, index) => (
                  <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    🏢 {industry}
                  </span>
                ))}
                {intent.entities.speaker?.map((speaker, index) => (
                  <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    👤 {speaker}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionSelect(suggestion)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-gray-900">{suggestion}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Example queries */}
      <div className="mt-4">
        <p className="text-sm text-gray-600 mb-2">Try asking:</p>
        <div className="flex flex-wrap gap-2">
          {[
            'Show me legal conferences in Munich next month',
            'Find FinTech events in London',
            'What events are happening in December?',
            'Find speakers from Google',
            'Show me compliance training workshops',
          ].map((example, index) => (
            <button
              key={index}
              onClick={() => setQuery(example)}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export default NaturalLanguageSearch;
