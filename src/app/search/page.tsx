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
import EventCard from '@/components/EventCard';
import { fetchEvents } from '@/lib/search/client';

// Helper function to calculate date ranges
function calculateDateRange(timeframe: string): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  const to = new Date(today);
  
  switch (timeframe) {
    case 'past-7':
      from.setDate(today.getDate() - 7);
      to.setDate(today.getDate() - 1);
      break;
    case 'past-14':
      from.setDate(today.getDate() - 14);
      to.setDate(today.getDate() - 1);
      break;
    case 'past-30':
      from.setDate(today.getDate() - 30);
      to.setDate(today.getDate() - 1);
      break;
    case 'next-7':
      from.setDate(today.getDate());
      to.setDate(today.getDate() + 7);
      break;
    case 'next-14':
      from.setDate(today.getDate());
      to.setDate(today.getDate() + 14);
      break;
    case 'next-30':
      from.setDate(today.getDate());
      to.setDate(today.getDate() + 30);
      break;
    default:
      // Default to next 30 days
      from.setDate(today.getDate());
      to.setDate(today.getDate() + 30);
  }
  
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0]
  };
}

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
      // Determine country from location entities or default to DE
      let country = 'DE';
      if (intent.entities.location?.length) {
        const location = intent.entities.location[0].toLowerCase();
        if (location.includes('germany') || location.includes('deutschland')) country = 'DE';
        else if (location.includes('austria') || location.includes('österreich')) country = 'AT';
        else if (location.includes('switzerland') || location.includes('schweiz')) country = 'CH';
        else if (location.includes('france') || location.includes('frankreich')) country = 'FR';
        else if (location.includes('italy') || location.includes('italien')) country = 'IT';
        else if (location.includes('spain') || location.includes('spanien')) country = 'ES';
        else if (location.includes('netherlands') || location.includes('niederlande')) country = 'NL';
        else if (location.includes('belgium') || location.includes('belgien')) country = 'BE';
      }

      // Calculate date range based on intent or default to next 30 days
      let dateRange = calculateDateRange('next-30');
      if (intent.entities.date?.length) {
        const dateStr = intent.entities.date[0].toLowerCase();
        if (dateStr.includes('past') || dateStr.includes('last')) {
          if (dateStr.includes('7')) dateRange = calculateDateRange('past-7');
          else if (dateStr.includes('14')) dateRange = calculateDateRange('past-14');
          else if (dateStr.includes('30')) dateRange = calculateDateRange('past-30');
        } else if (dateStr.includes('next') || dateStr.includes('upcoming')) {
          if (dateStr.includes('7')) dateRange = calculateDateRange('next-7');
          else if (dateStr.includes('14')) dateRange = calculateDateRange('next-14');
          else if (dateStr.includes('30')) dateRange = calculateDateRange('next-30');
        }
      }

      const data = await fetchEvents({
        userText: query || 'conference',
        country,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        locale: 'de'
      });

      setSearchResults(data.events || []);
      success('Search completed', `Found ${(data.events || []).length} results`);
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
                <EventCard 
                  key={event.id || event.source_url || index} 
                  ev={event}
                />
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
