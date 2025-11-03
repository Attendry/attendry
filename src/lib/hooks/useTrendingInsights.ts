import { useCallback, useEffect, useRef, useState } from 'react';
import { EventData } from '@/lib/types/core';

export interface TrendingCategory {
  name: string;
  count: number;
  growth: number;
  events: EventData[];
}

interface UseTrendingInsightsReturn {
  categories: TrendingCategory[];
  events: EventData[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTrendingInsights(): UseTrendingInsightsReturn {
  const [categories, setCategories] = useState<TrendingCategory[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/events/trending', {
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load trending insights');
      }

      setCategories(data.categories || []);
      setEvents(data.events || []);
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') {
        return;
      }
      setError((err as Error).message || 'Failed to load trending insights');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchData]);

  const refresh = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  return {
    categories,
    events,
    loading,
    error,
    refresh,
  };
}


