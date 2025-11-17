"use client";

import React from 'react';
import { CheckCircle2, MapPin, Calendar, Building2, Tag, Sparkles } from 'lucide-react';

export interface MatchReason {
  type: 'location' | 'date' | 'industry' | 'keyword' | 'speaker' | 'organizer';
  value: string;
  confidence?: number;
}

export interface RelevanceIndicatorProps {
  matchReasons?: MatchReason[];
  highlightedKeywords?: string[];
  confidence?: number;
  searchQuery?: string;
  className?: string;
  compact?: boolean;
}

const matchTypeConfig = {
  location: { icon: MapPin, label: 'Location', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400' },
  date: { icon: Calendar, label: 'Date', color: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400' },
  industry: { icon: Building2, label: 'Industry', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400' },
  keyword: { icon: Tag, label: 'Keyword', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400' },
  speaker: { icon: Sparkles, label: 'Speaker', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400' },
  organizer: { icon: Building2, label: 'Organizer', color: 'text-slate-600 bg-slate-50 dark:bg-slate-700 dark:text-slate-300' },
};

export function RelevanceIndicator({
  matchReasons = [],
  highlightedKeywords = [],
  confidence,
  searchQuery,
  className = '',
  compact = false
}: RelevanceIndicatorProps) {
  if (matchReasons.length === 0 && highlightedKeywords.length === 0 && !confidence) {
    return null;
  }

  // Get confidence label
  const getConfidenceLabel = (conf: number): { label: string; color: string } => {
    if (conf >= 0.9) return { label: 'Excellent match', color: 'text-green-600 dark:text-green-400' };
    if (conf >= 0.7) return { label: 'Good match', color: 'text-blue-600 dark:text-blue-400' };
    if (conf >= 0.5) return { label: 'Relevant', color: 'text-amber-600 dark:text-amber-400' };
    return { label: 'Possible match', color: 'text-slate-600 dark:text-slate-400' };
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 flex-wrap ${className}`}>
        {confidence !== undefined && (
          <span className={`text-xs font-medium ${getConfidenceLabel(confidence).color}`}>
            {getConfidenceLabel(confidence).label}
          </span>
        )}
        {matchReasons.slice(0, 2).map((reason, index) => {
          const config = matchTypeConfig[reason.type];
          const Icon = config.icon;
          return (
            <span
              key={index}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color}`}
            >
              <Icon className="w-3 h-3" />
              {reason.value}
            </span>
          );
        })}
        {matchReasons.length > 2 && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            +{matchReasons.length - 2} more
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-2 mb-3">
        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
            Why this event matches
          </h4>
          {confidence !== undefined && (
            <p className={`text-xs font-medium ${getConfidenceLabel(confidence).color} mb-2`}>
              {getConfidenceLabel(confidence).label}
              {confidence < 1 && ` (${Math.round(confidence * 100)}% confidence)`}
            </p>
          )}
        </div>
      </div>

      {/* Match Reasons */}
      {matchReasons.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
            Matches your search because:
          </p>
          <div className="flex flex-wrap gap-2">
            {matchReasons.map((reason, index) => {
              const config = matchTypeConfig[reason.type];
              const Icon = config.icon;
              return (
                <div
                  key={index}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${config.color}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="font-medium">{config.label}:</span>
                  <span>{reason.value}</span>
                  {reason.confidence !== undefined && reason.confidence < 1 && (
                    <span className="text-xs opacity-75">
                      ({Math.round(reason.confidence * 100)}%)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Highlighted Keywords */}
      {highlightedKeywords.length > 0 && searchQuery && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
            Keywords found:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {highlightedKeywords.map((keyword, index) => (
              <span
                key={index}
                className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-medium"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper function to extract match reasons from event data and search params
 */
export function extractMatchReasons(
  event: {
    city?: string | null;
    country?: string | null;
    starts_at?: string | null;
    topics?: string[] | null;
    organizer?: string | null;
    speakers?: Array<{ name?: string }> | null;
  },
  searchParams?: {
    keywords?: string;
    country?: string;
    from?: string;
    to?: string;
  }
): MatchReason[] {
  const reasons: MatchReason[] = [];

  // Location match
  if (searchParams?.country && event.country) {
    if (event.country.toLowerCase() === searchParams.country.toLowerCase() || 
        searchParams.country === 'EU') {
      const location = [event.city, event.country].filter(Boolean).join(', ');
      if (location) {
        reasons.push({ type: 'location', value: location, confidence: 0.9 });
      }
    }
  }

  // Date match
  if (searchParams?.from && searchParams?.to && event.starts_at) {
    const eventDate = new Date(event.starts_at);
    const fromDate = new Date(searchParams.from);
    const toDate = new Date(searchParams.to);
    
    if (eventDate >= fromDate && eventDate <= toDate) {
      reasons.push({ 
        type: 'date', 
        value: eventDate.toLocaleDateString(), 
        confidence: 0.8 
      });
    }
  }

  // Keyword match (simple check - could be enhanced)
  if (searchParams?.keywords && event.topics) {
    const keywords = searchParams.keywords.toLowerCase().split(/\s+/);
    const matchingTopics = event.topics.filter(topic => 
      keywords.some(keyword => topic.toLowerCase().includes(keyword))
    );
    if (matchingTopics.length > 0) {
      reasons.push({ 
        type: 'keyword', 
        value: matchingTopics[0], 
        confidence: 0.7 
      });
    }
  }

  // Organizer match
  if (event.organizer) {
    reasons.push({ type: 'organizer', value: event.organizer, confidence: 0.6 });
  }

  return reasons;
}

/**
 * Helper function to highlight keywords in text
 */
export function highlightKeywords(
  text: string,
  keywords: string[]
): Array<{ text: string; highlight: boolean }> {
  if (keywords.length === 0) return [{ text, highlight: false }];
  
  const lowerText = text.toLowerCase();
  const lowerKeywords = keywords.map(k => k.toLowerCase());
  
  // Find all keyword positions
  const positions: Array<{ start: number; end: number }> = [];
  lowerKeywords.forEach(keyword => {
    let index = 0;
    while ((index = lowerText.indexOf(keyword, index)) !== -1) {
      positions.push({ start: index, end: index + keyword.length });
      index += keyword.length;
    }
  });
  
  // Sort and merge overlapping positions
  positions.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  positions.forEach(pos => {
    const last = merged[merged.length - 1];
    if (!last || pos.start > last.end) {
      merged.push(pos);
    } else {
      last.end = Math.max(last.end, pos.end);
    }
  });
  
  // Build result with highlighted segments
  const result: Array<{ text: string; highlight: boolean }> = [];
  let lastIndex = 0;
  
  merged.forEach(pos => {
    if (pos.start > lastIndex) {
      result.push({ text: text.substring(lastIndex, pos.start), highlight: false });
    }
    result.push({ text: text.substring(pos.start, pos.end), highlight: true });
    lastIndex = pos.end;
  });
  
  if (lastIndex < text.length) {
    result.push({ text: text.substring(lastIndex), highlight: false });
  }
  
  return result.length > 0 ? result : [{ text, highlight: false }];
}

