/**
 * Search History Management
 * Stores and retrieves recent searches for quick access
 */

export interface SearchHistoryItem {
  id: string;
  query: string;
  filters?: {
    country?: string;
    dateFrom?: string;
    dateTo?: string;
    keywords?: string;
  };
  resultCount?: number;
  timestamp: number;
}

const SEARCH_HISTORY_KEY = 'attendry_search_history';
const MAX_HISTORY_ITEMS = 10;

/**
 * Get search history from localStorage
 */
export function getSearchHistory(): SearchHistoryItem[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!stored) return [];
    
    const history = JSON.parse(stored) as SearchHistoryItem[];
    // Sort by timestamp (newest first) and limit
    return history
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_HISTORY_ITEMS);
  } catch (error) {
    console.error('Failed to load search history:', error);
    return [];
  }
}

/**
 * Add search to history
 */
export function addToSearchHistory(item: Omit<SearchHistoryItem, 'id' | 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const history = getSearchHistory();
    
    // Check if similar search already exists (same query and filters)
    const existingIndex = history.findIndex(h => 
      h.query === item.query &&
      JSON.stringify(h.filters) === JSON.stringify(item.filters)
    );
    
    // Remove if exists (will be re-added at top)
    if (existingIndex >= 0) {
      history.splice(existingIndex, 1);
    }
    
    // Add new item at the beginning
    const newItem: SearchHistoryItem = {
      id: `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...item,
      timestamp: Date.now(),
    };
    
    history.unshift(newItem);
    
    // Keep only last MAX_HISTORY_ITEMS
    const limited = history.slice(0, MAX_HISTORY_ITEMS);
    
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(limited));
  } catch (error) {
    console.error('Failed to save search history:', error);
  }
}

/**
 * Clear search history
 */
export function clearSearchHistory(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (error) {
    console.error('Failed to clear search history:', error);
  }
}

/**
 * Remove specific search from history
 */
export function removeFromSearchHistory(id: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const history = getSearchHistory();
    const filtered = history.filter(h => h.id !== id);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove from search history:', error);
  }
}

