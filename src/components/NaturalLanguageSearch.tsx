/**
 * Natural Language Search Component
 * 
 * This component provides natural language processing for search queries
 * with intent recognition and smart query understanding.
 */

"use client";
import { useState, useEffect, useCallback, memo } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import {
  MapPin,
  Calendar,
  Building2,
  User,
  Target,
  Briefcase,
  Settings2,
  ChevronDown,
  Check,
} from "lucide-react";

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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<string[]>(['All Segments']);
  const [selectedRevenue, setSelectedRevenue] = useState<string>('All Tiers');
  const [selectedJourneyStages, setSelectedJourneyStages] = useState<string[]>(['Awareness', 'Evaluation']);
  const [crmSync, setCrmSync] = useState<{ salesforce: boolean; hubspot: boolean }>({ salesforce: false, hubspot: false });

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

  const toggleSegment = useCallback((segment: string) => {
    setSelectedSegments((prev) => {
      if (segment === 'All Segments') {
        return ['All Segments'];
      }
      const cleaned = prev.filter((item) => item !== 'All Segments');
      if (cleaned.includes(segment)) {
        const next = cleaned.filter((item) => item !== segment);
        return next.length === 0 ? ['All Segments'] : next;
      }
      return [...cleaned, segment];
    });
  }, []);

  const toggleJourneyStage = useCallback((stage: string) => {
    setSelectedJourneyStages((prev) => {
      if (prev.includes(stage)) {
        return prev.filter((item) => item !== stage);
      }
      return [...prev, stage];
    });
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

        {/* Advanced Filters Toggle */}
        <div className="flex items-center justify-between mt-3">
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <Settings2 className={`h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-90' : ''}`} />
            Advanced ICP Filters
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
          </button>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Target className="h-3 w-3" /> Segments mapped to CRM personas
            </span>
            <span className="inline-flex items-center gap-1">
              <Briefcase className="h-3 w-3" /> Revenue tiers synced nightly
            </span>
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="mt-3 border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">ICP Segments</h4>
              <div className="flex flex-wrap gap-2">
                {['All Segments', 'Strategic Finance', 'Manufacturing Ops', 'Healthcare Compliance', 'Emerging SaaS'].map((segment) => {
                  const isSelected = selectedSegments.includes(segment);
                  return (
                    <button
                      key={segment}
                      onClick={() => toggleSegment(segment)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        isSelected ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      {segment}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Revenue Tier</h4>
              <div className="flex flex-wrap gap-2">
                {['All Tiers', '>$1B Strategic', '$250M-$1B Growth', '<$250M Emerging'].map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setSelectedRevenue(tier)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedRevenue === tier ? 'bg-purple-100 text-purple-700' : 'bg-white text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {selectedRevenue === tier && <Check className="h-3 w-3" />}
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Journey Stage</h4>
              <div className="flex flex-wrap gap-2">
                {['Awareness', 'Evaluation', 'Consideration', 'Expansion'].map((stage) => {
                  const isSelected = selectedJourneyStages.includes(stage);
                  return (
                    <button
                      key={stage}
                      onClick={() => toggleJourneyStage(stage)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        isSelected ? 'bg-green-100 text-green-700' : 'bg-white text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      {stage}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="font-medium text-gray-700">CRM Sync (mock)</span>
                  <span>Automated nightly sync with Salesforce & HubSpot</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border rounded-md ${
                    crmSync.salesforce ? 'border-blue-500 text-blue-600' : 'border-gray-300 text-gray-600'
                  }`}>
                    <input
                      type="checkbox"
                      checked={crmSync.salesforce}
                      onChange={(e) => setCrmSync((prev) => ({ ...prev, salesforce: e.target.checked }))}
                    />
                    Salesforce (mock)
                  </label>
                  <label className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border rounded-md ${
                    crmSync.hubspot ? 'border-orange-500 text-orange-600' : 'border-gray-300 text-gray-600'
                  }`}>
                    <input
                      type="checkbox"
                      checked={crmSync.hubspot}
                      onChange={(e) => setCrmSync((prev) => ({ ...prev, hubspot: e.target.checked }))}
                    />
                    HubSpot (mock)
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

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
                  <span key={index} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <MapPin className="h-3 w-3" strokeWidth={2} />
                    {loc}
                  </span>
                ))}
                {intent.entities.date?.map((date, index) => (
                  <span key={index} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <Calendar className="h-3 w-3" strokeWidth={2} />
                    {date}
                  </span>
                ))}
                {intent.entities.industry?.map((industry, index) => (
                  <span key={index} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    <Building2 className="h-3 w-3" strokeWidth={2} />
                    {industry}
                  </span>
                ))}
                {intent.entities.speaker?.map((speaker, index) => (
                  <span key={index} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    <User className="h-3 w-3" strokeWidth={2} />
                    {speaker}
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
            'Which strategic finance events unlock C-suite meetings next quarter?',
            'Show EMEA manufacturing summits for $250M-$1B accounts',
            'Find SaaS community events for Awareness-stage leads',
            'List healthcare compliance workshops for evaluation stage prospects',
            'Where are partner-led AI marketing programs for expansion accounts?',
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
