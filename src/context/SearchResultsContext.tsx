"use client";

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

// Types
export interface EventRec {
  id?: string;
  source_url: string;
  link?: string;
  title: string;
  starts_at?: string | null;
  ends_at?: string | null;
  city?: string | null;
  country?: string | null;
  organizer?: string | null;
  speakers?: any[] | null;
  description?: string | null;
  venue?: string | null;
  location?: string | null;
  confidence?: number | null;
  confidence_reason?: string | null;
  pipeline_metadata?: any | null;
}

export interface SearchParams {
  keywords: string;
  country: string;
  from: string;
  to: string;
  timestamp: number;
  userProfile?: {
    industryTerms: string[];
    icpTerms: string[];
    competitors: string[];
  };
  profileFilters?: {
    includeIndustryMatch: boolean;
    includeIcpMatch: boolean;
    includeCompetitorMatch: boolean;
  };
}

export interface PaginationState {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalResults: number;
}

export interface SearchResultsState {
  events: EventRec[];
  searchParams: SearchParams | null;
  pagination: PaginationState;
  isLoading: boolean;
  error: string | null;
  lastSearchTimestamp: number | null;
  hasResults: boolean;
}

// Actions
type SearchResultsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SEARCH_RESULTS'; payload: { events: EventRec[]; searchParams: SearchParams; totalResults: number } }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'CLEAR_RESULTS' }
  | { type: 'RESTORE_FROM_STORAGE'; payload: SearchResultsState };

// Initial state
const initialState: SearchResultsState = {
  events: [],
  searchParams: null,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,
    totalResults: 0,
  },
  isLoading: false,
  error: null,
  lastSearchTimestamp: null,
  hasResults: false,
};

// Reducer
function searchResultsReducer(state: SearchResultsState, action: SearchResultsAction): SearchResultsState {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
        error: action.payload ? state.error : null,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'SET_SEARCH_RESULTS':
      const { events, searchParams, totalResults } = action.payload;
      const totalPages = Math.ceil(totalResults / state.pagination.pageSize);
      
      return {
        ...state,
        events,
        searchParams,
        pagination: {
          ...state.pagination,
          currentPage: 1,
          totalPages,
          totalResults,
        },
        isLoading: false,
        error: null,
        lastSearchTimestamp: Date.now(),
        hasResults: events.length > 0,
      };

    case 'SET_PAGE':
      return {
        ...state,
        pagination: {
          ...state.pagination,
          currentPage: action.payload,
        },
      };

    case 'CLEAR_RESULTS':
      return {
        ...initialState,
        pagination: state.pagination, // Keep page size preference
      };

    case 'RESTORE_FROM_STORAGE':
      return action.payload;

    default:
      return state;
  }
}

// Context
const SearchResultsContext = createContext<{
  state: SearchResultsState;
  dispatch: React.Dispatch<SearchResultsAction>;
  actions: {
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setSearchResults: (events: EventRec[], searchParams: SearchParams, totalResults: number) => void;
    setPage: (page: number) => void;
    clearResults: () => void;
    getCurrentPageEvents: () => EventRec[];
    canGoToPreviousPage: () => boolean;
    canGoToNextPage: () => boolean;
    goToPreviousPage: () => void;
    goToNextPage: () => void;
  };
} | null>(null);

// Storage key
const STORAGE_KEY = 'attendry_search_results';

// Provider component
export function SearchResultsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(searchResultsReducer, initialState);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsedState = JSON.parse(stored);
          // Only restore if data is less than 24 hours old
          if (parsedState.lastSearchTimestamp && (Date.now() - parsedState.lastSearchTimestamp) < 24 * 60 * 60 * 1000) {
            dispatch({ type: 'RESTORE_FROM_STORAGE', payload: parsedState });
          }
        }
      } catch (error) {
        console.warn('Failed to restore search results from localStorage:', error);
      }
    }
  }, []);

  // Save to localStorage whenever state changes (except loading states)
  useEffect(() => {
    if (typeof window !== 'undefined' && state.hasResults && !state.isLoading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.warn('Failed to save search results to localStorage:', error);
      }
    }
  }, [state]);

  // Action creators
  const actions = {
    setLoading: (loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    },

    setError: (error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    },

    setSearchResults: (events: EventRec[], searchParams: SearchParams, totalResults: number) => {
      dispatch({ type: 'SET_SEARCH_RESULTS', payload: { events, searchParams, totalResults } });
    },

    setPage: (page: number) => {
      dispatch({ type: 'SET_PAGE', payload: page });
    },

    clearResults: () => {
      dispatch({ type: 'CLEAR_RESULTS' });
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    },

    getCurrentPageEvents: (): EventRec[] => {
      const { currentPage, pageSize } = state.pagination;
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      return state.events.slice(startIndex, endIndex);
    },

    canGoToPreviousPage: (): boolean => {
      return state.pagination.currentPage > 1;
    },

    canGoToNextPage: (): boolean => {
      return state.pagination.currentPage < state.pagination.totalPages;
    },

    goToPreviousPage: () => {
      if (actions.canGoToPreviousPage()) {
        actions.setPage(state.pagination.currentPage - 1);
      }
    },

    goToNextPage: () => {
      if (actions.canGoToNextPage()) {
        actions.setPage(state.pagination.currentPage + 1);
      }
    },
  };

  return (
    <SearchResultsContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </SearchResultsContext.Provider>
  );
}

// Hook to use the context
export function useSearchResults() {
  const context = useContext(SearchResultsContext);
  if (!context) {
    throw new Error('useSearchResults must be used within a SearchResultsProvider');
  }
  return context;
}

// Utility hook for pagination
export function usePagination() {
  const { state, actions } = useSearchResults();
  
  return {
    currentPage: state.pagination.currentPage,
    totalPages: state.pagination.totalPages,
    totalResults: state.pagination.totalResults,
    pageSize: state.pagination.pageSize,
    hasResults: state.hasResults,
    canGoToPreviousPage: actions.canGoToPreviousPage(),
    canGoToNextPage: actions.canGoToNextPage(),
    goToPreviousPage: actions.goToPreviousPage,
    goToNextPage: actions.goToNextPage,
    setPage: actions.setPage,
    getCurrentPageEvents: actions.getCurrentPageEvents,
  };
}
