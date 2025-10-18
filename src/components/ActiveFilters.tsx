"use client";

import React from 'react';
import { Filter, Clock, RefreshCw } from 'lucide-react';
import { FilterChip } from './FilterChip';
import { SearchParams } from '@/context/SearchResultsContext';

interface ActiveFiltersProps {
  searchParams: SearchParams | null;
  onClearFilters: () => void;
  onModifySearch: () => void;
  onRefresh?: () => void;
  showTimestamp?: boolean;
  compact?: boolean;
  className?: string;
}

export function ActiveFilters({ 
  searchParams, 
  onClearFilters, 
  onModifySearch, 
  onRefresh,
  showTimestamp = true, 
  compact = false,
  className = '' 
}: ActiveFiltersProps) {
  if (!searchParams) return null;

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const formatDateRange = (from: string, to: string): string => {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const now = new Date();
    
    // Check if it's a relative range
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

  const timeAgo = showTimestamp ? formatTimeAgo(searchParams.timestamp) : null;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-sm text-slate-600 ${className}`}>
        <Filter className="w-4 h-4" />
        <span>Filters:</span>
        {searchParams.keywords && (
          <span className="font-medium">"{searchParams.keywords}"</span>
        )}
        {searchParams.country && searchParams.country !== 'EU' && (
          <span>in {searchParams.country}</span>
        )}
        <span>{formatDateRange(searchParams.from, searchParams.to)}</span>
        {timeAgo && (
          <span className="text-slate-400">({timeAgo})</span>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-medium text-blue-900">Active Search Filters</h3>
          {timeAgo && (
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <Clock className="w-3 h-3" />
              <span>{timeAgo}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          )}
          <button
            onClick={onModifySearch}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            Modify Search
          </button>
          <button
            onClick={onClearFilters}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-2 flex-wrap">
        {searchParams.keywords && (
          <FilterChip 
            label="Keywords" 
            value={searchParams.keywords}
            onRemove={() => {
              // For now, just clear all filters since we don't have individual filter removal
              onClearFilters();
            }}
          />
        )}
        {searchParams.country && searchParams.country !== 'EU' && (
          <FilterChip 
            label="Country" 
            value={searchParams.country}
            onRemove={() => {
              onClearFilters();
            }}
          />
        )}
        <FilterChip 
          label="Date Range" 
          value={formatDateRange(searchParams.from, searchParams.to)}
          onRemove={() => {
            onClearFilters();
          }}
        />
        
        {/* Profile-based filters */}
        {searchParams.userProfile?.icpTerms && searchParams.userProfile.icpTerms.length > 0 && (
          <FilterChip 
            label="ICP Terms" 
            value={searchParams.userProfile.icpTerms.slice(0, 2).join(', ') + (searchParams.userProfile.icpTerms.length > 2 ? '...' : '')}
            onRemove={() => {
              onClearFilters();
            }}
          />
        )}
        {searchParams.userProfile?.industryTerms && searchParams.userProfile.industryTerms.length > 0 && (
          <FilterChip 
            label="Industry" 
            value={searchParams.userProfile.industryTerms.slice(0, 2).join(', ') + (searchParams.userProfile.industryTerms.length > 2 ? '...' : '')}
            onRemove={() => {
              onClearFilters();
            }}
          />
        )}
        {searchParams.userProfile?.competitors && searchParams.userProfile.competitors.length > 0 && (
          <FilterChip 
            label="Competitors" 
            value={searchParams.userProfile.competitors.slice(0, 2).join(', ') + (searchParams.userProfile.competitors.length > 2 ? '...' : '')}
            onRemove={() => {
              onClearFilters();
            }}
          />
        )}
      </div>
    </div>
  );
}
