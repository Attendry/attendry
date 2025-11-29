'use client';

import { useState, useEffect, useRef } from 'react';
import { Clock, X, Search } from 'lucide-react';
import { getSearchHistory, removeFromSearchHistory, SearchHistoryItem } from '@/lib/search/search-history';
import { useRouter } from 'next/navigation';

interface SearchHistoryDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: SearchHistoryItem) => void;
  onClear?: () => void;
}

export function SearchHistoryDropdown({ 
  isOpen, 
  onClose, 
  onSelect,
  onClear 
}: SearchHistoryDropdownProps) {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setHistory(getSearchHistory());
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const handleSelect = (item: SearchHistoryItem) => {
    onSelect(item);
    onClose();
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeFromSearchHistory(id);
    setHistory(getSearchHistory());
  };

  const handleClearAll = () => {
    if (confirm('Clear all search history?')) {
      if (onClear) {
        onClear();
      }
      setHistory([]);
    }
  };

  if (!isOpen || history.length === 0) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full z-50 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg"
    >
      <div className="max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Recent Searches</span>
          </div>
          <button
            onClick={handleClearAll}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Clear all
          </button>
        </div>
        
        <div className="py-2">
          {history.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className="group flex w-full items-center justify-between px-4 py-2 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-900 truncate">
                    {item.query || 'No query'}
                  </span>
                </div>
                {item.filters && (
                  <div className="ml-6 mt-1 flex flex-wrap gap-1">
                    {item.filters.country && (
                      <span className="text-xs text-slate-500">
                        {item.filters.country}
                      </span>
                    )}
                    {item.filters.dateFrom && item.filters.dateTo && (
                      <span className="text-xs text-slate-500">
                        {new Date(item.filters.dateFrom).toLocaleDateString()} - {new Date(item.filters.dateTo).toLocaleDateString()}
                      </span>
                    )}
                    {item.resultCount !== undefined && (
                      <span className="text-xs text-slate-500">
                        {item.resultCount} results
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => handleRemove(e, item.id)}
                className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-200 rounded"
                aria-label="Remove from history"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

