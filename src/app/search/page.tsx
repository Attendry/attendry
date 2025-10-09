/**
 * Natural Language Search Page
 * 
 * This page provides natural language search functionality
 * with intent recognition and smart query understanding.
 */

"use client";
import { useState, useCallback } from 'react';
import NaturalLanguageSearch from '@/components/NaturalLanguageSearch';
import { SearchIntent } from '@/components/NaturalLanguageSearch';
import { useToast, ToastContainer } from '@/components/Toast';

export default function SearchPage() {
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastIntent, setLastIntent] = useState<SearchIntent | null>(null);
  const { toasts, success, error, removeToast } = useToast();

  // Handle search
  const handleSearch = useCallback(async (query: string, intent: SearchIntent) => {
    setIsSearching(true);
    setLastIntent(intent);

    try {
      // Build search parameters based on intent
      const searchParams = new URLSearchParams();
      searchParams.set('q', query);

      if (intent.entities.location?.length) {
        searchParams.set('location', intent.entities.location.join(','));
      }

      if (intent.entities.date?.length) {
        searchParams.set('date', intent.entities.date.join(','));
      }

      if (intent.entities.industry?.length) {
        searchParams.set('industry', intent.entities.industry.join(','));
      }

      // Call the appropriate search endpoint based on intent
      let endpoint = '/api/events/search';
      if (intent.type === 'speaker_search') {
        endpoint = '/api/events/speakers';
      }

      const response = await fetch(`${endpoint}?${searchParams.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.events || data.items || []);
        success('Search completed', `Found ${(data.events || data.items || []).length} results`);
      } else {
        error('Search failed', 'Unable to retrieve search results');
      }
    } catch (err) {
      console.error('Search failed:', err);
      error('Search failed', 'An error occurred while searching');
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle intent detection
  const handleIntentDetected = useCallback((intent: SearchIntent) => {
    console.log('Intent detected:', intent);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Natural Language Search</h1>
          <p className="text-gray-600">Ask me anything about events in natural language</p>
        </div>

        <NaturalLanguageSearch
          onSearch={handleSearch}
          onIntentDetected={handleIntentDetected}
          className="mb-8"
        />

        {/* Search Results */}
        {isSearching && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Searching...</p>
          </div>
        )}

        {!isSearching && searchResults.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Search Results ({searchResults.length})
              </h2>
              {lastIntent && (
                <div className="text-sm text-gray-600">
                  Intent: {lastIntent.type} ({(lastIntent.confidence * 100).toFixed(0)}% confidence)
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((event, index) => (
                <div key={event.id || index} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{event.title}</h3>
                  
                  {event.starts_at && (
                    <div className="flex items-center space-x-2 mb-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm text-gray-600">
                        {new Date(event.starts_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {(event.city || event.country) && (
                    <div className="flex items-center space-x-2 mb-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm text-gray-600">
                        {[event.city, event.country].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <a
                      href={event.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      View Event
                    </a>
                    <button 
                      onClick={() => success('Event saved', 'Added to your watchlist')}
                      className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isSearching && searchResults.length === 0 && lastIntent && (
          <div className="border border-dashed border-gray-300 rounded-lg p-10 text-center space-y-4 bg-white">
            <h3 className="text-lg font-semibold text-gray-900">No high-confidence matches for this combination</h3>
            <p className="text-sm text-gray-600 max-w-xl mx-auto">
              Upload a refined target account list or adjust ICP filters to surface broader results. You can also sync mock CRM data to personalize recommendations.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                Upload accounts (mock)
              </button>
              <button className="px-4 py-2 bg-white border border-gray-300 text-sm text-gray-700 rounded-md hover:bg-gray-100 transition-colors">
                Invite marketing partner
              </button>
              <button className="px-4 py-2 bg-white border border-gray-300 text-sm text-gray-700 rounded-md hover:bg-gray-100 transition-colors">
                Watch 2-min walkthrough
              </button>
            </div>
          </div>
        )}
      </div>
      
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
