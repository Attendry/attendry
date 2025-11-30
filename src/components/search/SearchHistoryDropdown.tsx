'use client';

import { useState, useEffect, useRef } from 'react';
import { Clock, X, Search, Star, Bookmark, Loader2 } from 'lucide-react';
import { getSearchHistory, removeFromSearchHistory, SearchHistoryItem } from '@/lib/search/search-history';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface SavedSearch {
  id: string;
  name: string;
  query?: string;
  filters?: {
    country?: string;
    dateFrom?: string;
    dateTo?: string;
    keywords?: string;
  };
  is_pinned: boolean;
  last_run_at?: string;
  run_count: number;
}

interface SearchHistoryDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: SearchHistoryItem) => void;
  onClear?: () => void;
  currentSearch?: {
    query?: string;
    filters?: {
      country?: string;
      dateFrom?: string;
      dateTo?: string;
      keywords?: string;
    };
  };
}

export function SearchHistoryDropdown({ 
  isOpen, 
  onClose, 
  onSelect,
  onClear,
  currentSearch
}: SearchHistoryDropdownProps) {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadingSavedSearches, setLoadingSavedSearches] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setHistory(getSearchHistory());
      loadSavedSearches();
    }
  }, [isOpen]);

  const loadSavedSearches = async () => {
    setLoadingSavedSearches(true);
    try {
      const response = await fetch('/api/saved-searches');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSavedSearches(data.searches || []);
        }
      }
    } catch (error) {
      console.error('Failed to load saved searches:', error);
    } finally {
      setLoadingSavedSearches(false);
    }
  };

  const handleSaveSearch = async () => {
    if (!saveName.trim() || !currentSearch) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName.trim(),
          query: currentSearch.query,
          filters: currentSearch.filters,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save search');
      }

      toast.success('Search saved', {
        description: `"${saveName.trim()}" has been saved`,
      });

      setShowSaveDialog(false);
      setSaveName('');
      loadSavedSearches();
    } catch (error) {
      console.error('Failed to save search:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save search';
      setSaveError(errorMessage);
      toast.error('Failed to save search', {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectSavedSearch = (saved: SavedSearch) => {
    const historyItem: SearchHistoryItem = {
      id: saved.id,
      query: saved.query || '',
      filters: saved.filters,
      timestamp: saved.last_run_at ? new Date(saved.last_run_at).getTime() : Date.now(),
    };
    onSelect(historyItem);
    
    // Record the run
    fetch(`/api/saved-searches?id=${saved.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: saved.id,
        last_run_at: new Date().toISOString(),
        run_count: saved.run_count + 1,
      }),
    }).catch(console.error);
  };

  const handleDeleteSavedSearch = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this saved search?')) return;

    try {
      const response = await fetch(`/api/saved-searches?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadSavedSearches();
      }
    } catch (error) {
      console.error('Failed to delete saved search:', error);
    }
  };

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

  if (!isOpen) {
    return null;
  }

  const hasContent = savedSearches.length > 0 || history.length > 0;

  if (!hasContent && !currentSearch) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full z-50 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg"
    >
      <div className="max-h-96 overflow-y-auto">
        {/* Save Current Search */}
        {currentSearch && currentSearch.query && (
          <div className="border-b border-slate-200 px-4 py-2">
            <button
              onClick={() => setShowSaveDialog(true)}
              className="flex w-full items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Bookmark className="h-4 w-4" />
              Save this search
            </button>
          </div>
        )}

        {/* Saved Searches Section */}
        {loadingSavedSearches ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
            Loading saved searches...
          </div>
        ) : savedSearches.length > 0 && (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 bg-slate-50">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-slate-700">Saved Searches</span>
              </div>
            </div>
            <div className="py-2">
              {savedSearches.map((saved) => (
                <button
                  key={saved.id}
                  onClick={() => handleSelectSavedSearch(saved)}
                  className="group flex w-full items-center justify-between px-4 py-2 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {saved.is_pinned ? (
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                      ) : (
                        <Bookmark className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {saved.name}
                      </span>
                    </div>
                    {saved.query && (
                      <div className="ml-6 mt-1 text-xs text-slate-500 truncate">
                        {saved.query}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDeleteSavedSearch(e, saved.id)}
                    className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-200 rounded"
                    aria-label="Delete saved search"
                  >
                    <X className="h-4 w-4 text-slate-400" />
                  </button>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Recent Searches Section */}
        {history.length > 0 && (
          <>
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

      {/* Save Search Dialog */}
      {showSaveDialog && (
        <>
          <div 
            className="fixed inset-0 z-[60] bg-black/50"
            onClick={() => {
              setShowSaveDialog(false);
              setSaveName('');
              setSaveError(null);
            }}
          />
          <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
            <div 
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Save Search</h3>
              <input
                type="text"
                placeholder="Enter a name for this search..."
                value={saveName}
                onChange={(e) => {
                  setSaveName(e.target.value);
                  setSaveError(null);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2"
                autoFocus
                disabled={isSaving}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSaving && saveName.trim()) {
                    handleSaveSearch();
                  } else if (e.key === 'Escape') {
                    setShowSaveDialog(false);
                    setSaveName('');
                    setSaveError(null);
                  }
                }}
              />
              {saveError && (
                <p className="text-sm text-red-600 mb-2">{saveError}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setSaveName('');
                    setSaveError(null);
                  }}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSearch}
                  disabled={!saveName.trim() || isSaving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

