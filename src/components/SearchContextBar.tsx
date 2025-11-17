"use client";

import React from 'react';
import { Search, Sparkles, Filter, X, Info, TrendingUp } from 'lucide-react';
import { SearchParams } from '@/context/SearchResultsContext';
import { SearchIntent } from '@/components/NaturalLanguageSearch';
import { FilterChip } from './FilterChip';

interface SearchContextBarProps {
  searchParams: SearchParams | null;
  totalResults: number;
  intent?: SearchIntent | null;
  isNaturalLanguage?: boolean;
  onClearFilters: () => void;
  onModifySearch: () => void;
  onRefresh?: () => void;
  className?: string;
}

export function SearchContextBar({
  searchParams,
  totalResults,
  intent,
  isNaturalLanguage = false,
  onClearFilters,
  onModifySearch,
  onRefresh,
  className = ''
}: SearchContextBarProps) {
  if (!searchParams) return null;

  // Format query interpretation
  const getQueryInterpretation = (): string => {
    if (isNaturalLanguage && intent) {
      const parts: string[] = [];
      
      if (intent.entities.location?.length) {
        parts.push(`in ${intent.entities.location[0]}`);
      }
      if (intent.entities.date?.length) {
        parts.push(intent.entities.date[0]);
      }
      if (intent.entities.industry?.length) {
        parts.push(`${intent.entities.industry.join(', ')} events`);
      }
      if (intent.entities.keywords?.length) {
        parts.push(`matching "${intent.entities.keywords.join(', ')}"`);
      }
      
      if (parts.length > 0) {
        return `Found ${totalResults} event${totalResults !== 1 ? 's' : ''} ${parts.join(', ')}`;
      }
      
      return `Found ${totalResults} event${totalResults !== 1 ? 's' : ''} matching "${intent.originalQuery}"`;
    }
    
    // Traditional search interpretation
    const parts: string[] = [];
    if (searchParams.keywords) {
      parts.push(`"${searchParams.keywords}"`);
    }
    if (searchParams.country && searchParams.country !== 'EU') {
      parts.push(`in ${searchParams.country}`);
    }
    
    if (parts.length > 0) {
      return `Found ${totalResults} event${totalResults !== 1 ? 's' : ''} matching ${parts.join(' ')}`;
    }
    
    return `Found ${totalResults} event${totalResults !== 1 ? 's' : ''}`;
  };

  // Format date range
  const formatDateRange = (from: string, to: string): string => {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const now = new Date();
    
    const fromTime = fromDate.getTime();
    const toTime = toDate.getTime();
    const nowTime = now.getTime();
    
    // If from is today and to is within 7 days, show relative format
    if (fromTime >= nowTime - 24 * 60 * 60 * 1000 && toTime <= nowTime + 7 * 24 * 60 * 60 * 1000) {
      const daysDiff = Math.ceil((toTime - fromTime) / (1000 * 60 * 60 * 24));
      if (fromTime <= nowTime) {
        return `Next ${daysDiff} days`;
      } else {
        return `In ${daysDiff} days`;
      }
    }
    
    // Otherwise show date range
    return `${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`;
  };

  // Get result quality indicator
  const getQualityIndicator = (): { label: string; color: string } | null => {
    if (totalResults === 0) {
      return { label: 'No results', color: 'text-slate-500' };
    }
    if (totalResults < 5) {
      return { label: 'Few results', color: 'text-amber-600' };
    }
    if (totalResults < 20) {
      return { label: 'Good match', color: 'text-green-600' };
    }
    return { label: 'Many results', color: 'text-blue-600' };
  };

  const qualityIndicator = getQualityIndicator();
  const queryInterpretation = getQueryInterpretation();

  return (
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 border border-blue-200 dark:border-slate-700 rounded-lg p-4 shadow-sm ${className}`}>
      {/* Header with query interpretation */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isNaturalLanguage ? (
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <Search className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            )}
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {queryInterpretation}
            </h3>
            {qualityIndicator && (
              <span className={`text-xs font-medium ${qualityIndicator.color}`}>
                ({qualityIndicator.label})
              </span>
            )}
          </div>
          
          {/* NLP Intent and Entities */}
          {isNaturalLanguage && intent && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Info className="w-3 h-3" />
                <span className="font-medium">Intent:</span>
                <span className="capitalize">{intent.type.replace('_', ' ')}</span>
                <span className="text-slate-400">({Math.round(intent.confidence * 100)}% confidence)</span>
              </div>
              
              {Object.keys(intent.entities).length > 0 && (
                <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-medium">Extracted:</span>
                  {intent.entities.location && intent.entities.location.length > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                      Location: {intent.entities.location.join(', ')}
                    </span>
                  )}
                  {intent.entities.date && intent.entities.date.length > 0 && (
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                      Date: {intent.entities.date.join(', ')}
                    </span>
                  )}
                  {intent.entities.industry && intent.entities.industry.length > 0 && (
                    <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                      Industry: {intent.entities.industry.join(', ')}
                    </span>
                  )}
                  {intent.entities.keywords && intent.entities.keywords.length > 0 && (
                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
                      Keywords: {intent.entities.keywords.join(', ')}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 ml-4">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-md transition-colors"
            >
              <TrendingUp className="w-3 h-3" />
              Refresh
            </button>
          )}
          <button
            onClick={onModifySearch}
            className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-md transition-colors"
          >
            Refine Search
          </button>
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors"
          >
            <X className="w-3 h-3" />
            Clear All
          </button>
        </div>
      </div>
      
      {/* Active Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
          <Filter className="w-3 h-3" />
          <span className="font-medium">
            Active filters
            {(() => {
              const filterCount = [
                searchParams.keywords,
                searchParams.country && searchParams.country !== 'EU',
                searchParams.userProfile?.icpTerms?.length,
                searchParams.userProfile?.industryTerms?.length,
                searchParams.userProfile?.competitors?.length
              ].filter(Boolean).length + 1; // +1 for date range
              return filterCount > 0 ? ` (${filterCount})` : '';
            })()}
            :
          </span>
        </div>
        
        {searchParams.keywords && (
          <FilterChip 
            label="Keywords" 
            value={searchParams.keywords}
            onRemove={onClearFilters}
          />
        )}
        {searchParams.country && searchParams.country !== 'EU' && (
          <FilterChip 
            label="Country" 
            value={searchParams.country}
            onRemove={onClearFilters}
          />
        )}
        <FilterChip 
          label="Date Range" 
          value={formatDateRange(searchParams.from, searchParams.to)}
          onRemove={onClearFilters}
        />
        
        {/* Profile-based filters */}
        {searchParams.userProfile?.icpTerms && searchParams.userProfile.icpTerms.length > 0 && (
          <FilterChip 
            label="ICP Terms" 
            value={searchParams.userProfile.icpTerms.slice(0, 2).join(', ') + (searchParams.userProfile.icpTerms.length > 2 ? '...' : '')}
            onRemove={onClearFilters}
          />
        )}
        {searchParams.userProfile?.industryTerms && searchParams.userProfile.industryTerms.length > 0 && (
          <FilterChip 
            label="Industry" 
            value={searchParams.userProfile.industryTerms.slice(0, 2).join(', ') + (searchParams.userProfile.industryTerms.length > 2 ? '...' : '')}
            onRemove={onClearFilters}
          />
        )}
        {searchParams.userProfile?.competitors && searchParams.userProfile.competitors.length > 0 && (
          <FilterChip 
            label="Competitors" 
            value={searchParams.userProfile.competitors.slice(0, 2).join(', ') + (searchParams.userProfile.competitors.length > 2 ? '...' : '')}
            onRemove={onClearFilters}
          />
        )}
      </div>
    </div>
  );
}

