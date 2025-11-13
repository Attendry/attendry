/**
 * Search History Component
 * 
 * This component displays and manages user search history
 * with the ability to clear history and re-run searches.
 */

"use client";
import { useState, useEffect, useCallback, memo } from 'react';

/**
 * Search history item
 */
interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  resultCount?: number;
}

/**
 * Search history props
 */
interface SearchHistoryProps {
  onSearchSelect: (query: string) => void;
  onClearHistory: () => void;
  maxItems?: number;
  className?: string;
}

/**
 * Search History Component
 */
const SearchHistory = memo(function SearchHistory({
  onSearchSelect,
  onClearHistory,
  maxItems = 10,
  className = '',
}: SearchHistoryProps) {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load search history from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedHistory = localStorage.getItem('searchHistory');
      if (savedHistory) {
        try {
          const parsedHistory = JSON.parse(savedHistory);
          setHistory(parsedHistory.slice(0, maxItems));
        } catch (error) {
          console.error('Failed to parse search history:', error);
        }
      }
    }
  }, [maxItems]);

  // Handle search selection
  const handleSearchSelect = useCallback((item: SearchHistoryItem) => {
    onSearchSelect(item.query);
  }, [onSearchSelect]);

  // Handle clear history
  const handleClearHistory = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('searchHistory');
    }
    setHistory([]);
    onClearHistory();
  }, [onClearHistory]);

  // Format timestamp
  const formatTimestamp = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }, []);

  if (history.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <h3 className="text-sm font-medium text-slate-900">Recent Searches</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            {isExpanded ? 'Show Less' : 'Show All'}
          </button>
          <button
            onClick={handleClearHistory}
            className="text-sm text-red-600 hover:text-red-700 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* History Items */}
      <div className="p-2">
        {(isExpanded ? history : history.slice(0, 3)).map((item) => (
          <button
            key={item.id}
            onClick={() => handleSearchSelect(item)}
            className="w-full flex items-center justify-between p-2 text-left hover:bg-slate-50 rounded-md transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                {item.query}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-slate-500">
                  {formatTimestamp(item.timestamp)}
                </span>
                {item.resultCount && (
                  <span className="text-xs text-slate-400">
                    • {item.resultCount} results
                  </span>
                )}
              </div>
            </div>
            <svg
              className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
});

export default SearchHistory;
