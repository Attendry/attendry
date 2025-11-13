'use client';

import { motion } from 'framer-motion';
import { useState, useCallback, memo, useMemo } from 'react';
import { 
  Search, 
  MapPin, 
  Calendar, 
  Filter,
  Clock,
  Globe,
  TrendingUp,
  Star
} from 'lucide-react';
import { useAdaptive } from '../AdaptiveDashboard';
import { SuggestionBanner } from '../SuggestionBanner';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { fetchEvents } from '@/lib/search/client';

interface SearchFilters {
  location: string;
  dateRange: 'next7' | 'next14' | 'next30' | 'custom';
  industry: string;
  keywords: string;
}

const EU_COUNTRIES = [
  { code: "", name: "All Europe" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "nl", name: "Netherlands" },
  { code: "gb", name: "United Kingdom" },
  { code: "es", name: "Spain" },
  { code: "it", name: "Italy" },
  { code: "se", name: "Sweden" },
  { code: "pl", name: "Poland" },
  { code: "be", name: "Belgium" },
  { code: "ch", name: "Switzerland" },
];

const INDUSTRIES = [
  "Legal & Compliance",
  "FinTech",
  "Healthcare",
  "Technology",
  "Marketing",
  "Sales",
  "HR & People",
  "General Business"
];

const SearchModule = memo(() => {
  const { theme, updateUserBehavior, userBehavior } = useAdaptive();
  const { recordRender } = usePerformanceMonitor('SearchModule');
  
  // Record render for performance monitoring
  recordRender();
  const [filters, setFilters] = useState<SearchFilters>({
    location: '',
    dateRange: 'next7',
    industry: '',
    keywords: ''
  });
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSearch = useCallback(async () => {
    setIsSearching(true);
    updateUserBehavior({ 
      searchCount: userBehavior.searchCount + 1,
      searchHistory: [...userBehavior.searchHistory, filters.keywords].slice(-10)
    });

    try {
      // Calculate date range
      const today = new Date();
      let from: string, to: string;
      
      switch (filters.dateRange) {
        case 'next7':
          from = today.toISOString().split('T')[0];
          to = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'next14':
          from = today.toISOString().split('T')[0];
          to = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'next30':
          from = today.toISOString().split('T')[0];
          to = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        default:
          from = today.toISOString().split('T')[0];
          to = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      const data = await fetchEvents({
        userText: filters.keywords || 'conference',
        country: filters.location || null,
        dateFrom: from,
        dateTo: to,
        locale: 'de',
        location: filters.location || null,
      });

      setSearchResults(data.events || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [filters, updateUserBehavior, userBehavior]);

  const handleEventClick = useCallback(() => {
    updateUserBehavior({ eventClicks: userBehavior.eventClicks + 1 });
  }, [updateUserBehavior, userBehavior]);

  const getSuggestion = () => {
    if (userBehavior.searchHistory.length > 0) {
      return `You've searched for "${userBehavior.searchHistory[userBehavior.searchHistory.length - 1]}" recently. Try exploring trending events in that area?`;
    }
    if (userBehavior.preferredLocations.length > 0) {
      return `Based on your preferences, you might be interested in events in ${userBehavior.preferredLocations[0]}.`;
    }
    return "Try searching for 'compliance conference' or 'legal tech meetup' to discover relevant events.";
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              Event Search
            </h2>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Find conferences, meetups, and networking opportunities
            </p>
          </div>
        </div>

        {/* AI Suggestion */}
        <SuggestionBanner
          suggestion={getSuggestion()}
          onAccept={() => {
            if (userBehavior.searchHistory.length > 0) {
              setFilters(prev => ({ ...prev, keywords: userBehavior.searchHistory[userBehavior.searchHistory.length - 1] }));
            }
          }}
        />
      </div>

      {/* Search Form */}
      <div className={`p-6 rounded-lg border mb-6 ${
        theme === 'dark'
          ? 'bg-slate-800 border-slate-700'
          : theme === 'high-contrast'
          ? 'bg-slate-900 border-slate-600'
          : 'bg-white border-slate-200'
      }`}>
        <div className="space-y-4">
          {/* Keywords */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Search Keywords
            </label>
            <div className="relative">
              <Search 
                size={20} 
                className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`} 
              />
              <input
                type="text"
                value={filters.keywords}
                onChange={(e) => setFilters(prev => ({ ...prev, keywords: e.target.value }))}
                placeholder="compliance, legal tech..."
                className={`w-full pl-10 pr-4 py-3 rounded-lg border transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500'
                    : theme === 'high-contrast'
                    ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-400 focus:border-blue-400'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500 focus:border-blue-500'
                }`}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>

          {/* Location and Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Location
              </label>
              <div className="relative">
                <MapPin 
                  size={16} 
                  className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                  }`} 
                />
                <select
                  value={filters.location}
                  onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-700 border-slate-600 text-white focus:border-blue-500'
                      : theme === 'high-contrast'
                      ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-400'
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                >
                  {EU_COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Time Range
              </label>
              <div className="relative">
                <Calendar 
                  size={16} 
                  className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                  }`} 
                />
                <select
                  value={filters.dateRange}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value as any }))}
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-700 border-slate-600 text-white focus:border-blue-500'
                      : theme === 'high-contrast'
                      ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-400'
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                >
                  <option value="next7">Next 7 days</option>
                  <option value="next14">Next 14 days</option>
                  <option value="next30">Next 30 days</option>
                </select>
              </div>
            </div>
          </div>

          {/* Advanced Options Toggle */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              <Filter size={16} />
              {showAdvanced ? 'Hide Advanced' : 'Advanced Options'}
            </button>
          </div>

          {/* Advanced Options */}
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t pt-4"
            >
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Industry Focus
                </label>
                <select
                  value={filters.industry}
                  onChange={(e) => setFilters(prev => ({ ...prev, industry: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-700 border-slate-600 text-white focus:border-blue-500'
                      : theme === 'high-contrast'
                      ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-400'
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                >
                  <option value="">All Industries</option>
                  {INDUSTRIES.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}

          {/* Search Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSearch}
            disabled={isSearching}
            className={`w-full py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              theme === 'dark'
                ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white'
                : theme === 'high-contrast'
                ? 'bg-blue-500 hover:bg-blue-600 disabled:bg-blue-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white'
            }`}
          >
            {isSearching ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Searching...
              </>
            ) : (
              <>
                <Search size={20} />
                Search Events
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto">
        {searchResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Found {searchResults.length} Events
              </h3>
              <div className={`text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                <Clock size={16} className="inline mr-1" />
                {new Date().toLocaleTimeString()}
              </div>
            </div>

            <div className="space-y-3">
              {searchResults.slice(0, 10).map((event, index) => (
                <motion.div
                  key={event.source_url || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={handleEventClick}
                  className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                    theme === 'dark'
                      ? 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                      : theme === 'high-contrast'
                      ? 'bg-slate-900 border-slate-600 hover:bg-slate-800'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-medium mb-2 line-clamp-2 ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}>
                        {event.title || 'Untitled Event'}
                      </h4>
                      
                      <div className="flex items-center space-x-4 text-sm">
                        {event.starts_at && (
                          <div className={`flex items-center space-x-1 ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            <Calendar size={14} />
                            <span>{new Date(event.starts_at).toLocaleDateString()}</span>
                          </div>
                        )}
                        
                        {(event.city || event.country) && (
                          <div className={`flex items-center space-x-1 ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            <MapPin size={14} />
                            <span>{[event.city, event.country].filter(Boolean).join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        className={`p-2 rounded-lg transition-colors ${
                          theme === 'dark'
                            ? 'hover:bg-slate-700 text-slate-400'
                            : 'hover:bg-slate-100 text-slate-500'
                        }`}
                      >
                        <Star size={16} />
                      </button>
                      <a
                        href={event.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          theme === 'dark'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : theme === 'high-contrast'
                            ? 'bg-blue-500 hover:bg-blue-600 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        View
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {!isSearching && searchResults.length === 0 && (
          <div className="text-center py-12">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'
            }`}>
              <Search 
                size={32} 
                className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} 
              />
            </div>
            <h3 className={`text-lg font-medium mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              Ready to discover events?
            </h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Use the search form above to find conferences, meetups, and networking opportunities.
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

SearchModule.displayName = 'SearchModule';

export { SearchModule };
