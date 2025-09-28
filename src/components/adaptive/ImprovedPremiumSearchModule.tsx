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
  Star,
  Sparkles,
  ArrowRight,
  X
} from 'lucide-react';
import { useAdaptive } from '../PremiumAdaptiveDashboard';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';

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
  { code: "at", name: "Austria" },
  { code: "ch", name: "Switzerland" },
  { code: "be", name: "Belgium" },
  { code: "dk", name: "Denmark" },
  { code: "se", name: "Sweden" },
  { code: "no", name: "Norway" },
  { code: "fi", name: "Finland" },
  { code: "pl", name: "Poland" },
  { code: "cz", name: "Czech Republic" },
  { code: "hu", name: "Hungary" },
  { code: "pt", name: "Portugal" },
  { code: "ie", name: "Ireland" },
  { code: "lu", name: "Luxembourg" }
];

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance",
  "Education",
  "Manufacturing",
  "Retail",
  "Energy",
  "Transportation",
  "Media & Entertainment",
  "Real Estate",
  "Consulting",
  "Legal",
  "Marketing & Advertising",
  "Sales",
  "HR & People",
  "General Business"
];

const ImprovedPremiumSearchModule = memo(() => {
  const { updateUserBehavior, userBehavior } = useAdaptive();
  const { recordRender } = usePerformanceMonitor('ImprovedPremiumSearchModule');
  
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
      const response = await fetch('/api/events/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: filters.keywords,
          location: filters.location,
          dateRange: filters.dateRange,
          industry: filters.industry
        })
      });
      
      const data = await response.json();
      setSearchResults(data.events || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [filters, updateUserBehavior, userBehavior]);

  const handleFilterChange = useCallback((key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      location: '',
      dateRange: 'next7',
      industry: '',
      keywords: ''
    });
  }, []);

  const hasActiveFilters = useMemo(() => {
    return filters.location || filters.industry || filters.keywords;
  }, [filters]);

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* AI Suggestion Banner - Improved spacing and typography */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-[#4ADE80]/10 to-[#38BDF8]/10 border border-[#4ADE80]/20 rounded-2xl p-5"
      >
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-[#4ADE80]/20 rounded-xl flex items-center justify-center">
            <Sparkles size={18} className="text-[#4ADE80]" />
          </div>
          <div className="flex-1">
            <p className="text-[#E6E8EC] font-semibold text-sm mb-1">
              AI Suggestion
            </p>
            <p className="text-[#9CA3AF] text-sm font-medium leading-relaxed">
              Based on your search history, try "AI conferences in Berlin" or "Tech meetups next week"
            </p>
          </div>
          <button className="text-[#4ADE80] hover:text-[#4ADE80]/80 transition-colors p-1">
            <ArrowRight size={16} />
          </button>
        </div>
      </motion.div>

      {/* Search Form - Improved spacing and visual hierarchy */}
      <div className="bg-[#1A1F2C] border border-[#2D3344] rounded-2xl p-6">
        <div className="space-y-5">
          {/* Main Search Input - Improved sizing */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#9CA3AF]" size={20} />
            <input
              type="text"
              placeholder="Search for events, conferences, meetups..."
              value={filters.keywords}
              onChange={(e) => handleFilterChange('keywords', e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-[#0B0F1A] border border-[#2D3344] rounded-2xl text-[#E6E8EC] placeholder-[#9CA3AF] focus:border-[#4ADE80] focus:ring-1 focus:ring-[#4ADE80]/20 transition-all duration-150 text-sm font-medium"
            />
          </div>

          {/* Quick Filters - Improved spacing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9CA3AF]" size={16} />
              <select
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 bg-[#0B0F1A] border border-[#2D3344] rounded-xl text-[#E6E8EC] focus:border-[#4ADE80] transition-colors duration-150 text-sm font-medium"
              >
                <option value="">All Locations</option>
                {EU_COUNTRIES.map(country => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9CA3AF]" size={16} />
              <select
                value={filters.dateRange}
                onChange={(e) => handleFilterChange('dateRange', e.target.value as any)}
                className="w-full pl-10 pr-4 py-3.5 bg-[#0B0F1A] border border-[#2D3344] rounded-xl text-[#E6E8EC] focus:border-[#4ADE80] transition-colors duration-150 text-sm font-medium"
              >
                <option value="next7">Next 7 days</option>
                <option value="next14">Next 14 days</option>
                <option value="next30">Next 30 days</option>
                <option value="custom">Custom range</option>
              </select>
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9CA3AF]" size={16} />
              <select
                value={filters.industry}
                onChange={(e) => handleFilterChange('industry', e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 bg-[#0B0F1A] border border-[#2D3344] rounded-xl text-[#E6E8EC] focus:border-[#4ADE80] transition-colors duration-150 text-sm font-medium"
              >
                <option value="">All Industries</option>
                {INDUSTRIES.map(industry => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons - Improved spacing and hierarchy */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-4">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center space-x-2 px-3 py-2 text-[#9CA3AF] hover:text-[#E6E8EC] transition-colors duration-150 rounded-lg hover:bg-[#2D3344]"
                >
                  <X size={16} />
                  <span className="text-sm font-medium">Clear filters</span>
                </button>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="px-4 py-2.5 text-[#9CA3AF] hover:text-[#E6E8EC] transition-colors duration-150 text-sm font-medium rounded-lg hover:bg-[#2D3344]"
              >
                {showAdvanced ? 'Hide' : 'Show'} advanced
              </button>
              
              <motion.button
                onClick={handleSearch}
                disabled={isSearching}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-3.5 bg-[#4ADE80] text-white rounded-xl hover:bg-[#4ADE80]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 flex items-center space-x-2 font-semibold text-sm"
              >
                {isSearching ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    <span>Search Events</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Results - Improved spacing and typography */}
      <div className="flex-1 bg-[#1A1F2C] border border-[#2D3344] rounded-2xl p-6">
        {searchResults.length > 0 ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[#E6E8EC] font-semibold text-lg">
                Search Results
              </h3>
              <span className="text-[#9CA3AF] text-sm font-semibold">
                {searchResults.length} events found
              </span>
            </div>
            
            <div className="grid gap-4">
              {searchResults.slice(0, 5).map((event, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-5 bg-[#0B0F1A] border border-[#2D3344] rounded-xl hover:border-[#4ADE80]/30 transition-colors duration-150"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-[#E6E8EC] font-semibold text-base mb-2 leading-tight">
                        {event.title || 'Sample Event'}
                      </h4>
                      <p className="text-[#9CA3AF] text-sm font-medium mb-3 leading-relaxed">
                        {event.description || 'Event description would appear here...'}
                      </p>
                      <div className="flex items-center space-x-6 text-xs text-[#9CA3AF] font-medium">
                        <div className="flex items-center space-x-1.5">
                          <MapPin size={12} />
                          <span>{event.location || 'Berlin, Germany'}</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <Calendar size={12} />
                          <span>{event.date || 'Dec 15, 2024'}</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <Clock size={12} />
                          <span>{event.time || '10:00 AM'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 ml-6">
                      <button className="p-2.5 hover:bg-[#2D3344] rounded-xl transition-colors duration-150">
                        <Star size={16} className="text-[#9CA3AF] hover:text-[#4ADE80]" />
                      </button>
                      <button className="px-4 py-2 bg-[#4ADE80]/10 text-[#4ADE80] rounded-xl text-sm font-semibold hover:bg-[#4ADE80]/20 transition-colors duration-150">
                        View Details
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#2D3344] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-[#9CA3AF]" />
              </div>
              <h3 className="text-[#E6E8EC] font-semibold text-lg mb-2">
                Ready to discover events?
              </h3>
              <p className="text-[#9CA3AF] text-sm font-medium leading-relaxed max-w-md">
                Use the search form above to find conferences, meetups, and networking opportunities.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

ImprovedPremiumSearchModule.displayName = 'ImprovedPremiumSearchModule';

export { ImprovedPremiumSearchModule };
