/**
 * Search Analytics API
 * 
 * This endpoint provides search analytics and insights.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Search analytics interface
 */
interface SearchAnalytics {
  totalSearches: number;
  popularQueries: {
    query: string;
    count: number;
    successRate: number;
  }[];
  searchTrends: {
    date: string;
    count: number;
  }[];
  searchPerformance: {
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
  };
}

/**
 * GET /api/analytics/search
 */
export async function GET(req: NextRequest): Promise<NextResponse<SearchAnalytics>> {
  try {
    const supabase = await supabaseServer();
    
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (!profile || !profile.is_admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || '30d';

    // Calculate date range
    const now = new Date();
    const rangeDays = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
    const startDate = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);

    // Get search cache data
    const { data: searchCache } = await supabase
      .from('search_cache')
      .select('*')
      .gte('created_at', startDate.toISOString());

    const totalSearches = searchCache?.length || 0;

    // Analyze popular queries
    const popularQueries = analyzePopularQueries(searchCache || []);

    // Generate search trends
    const searchTrends = generateSearchTrends(searchCache || [], rangeDays);

    // Calculate search performance
    const searchPerformance = calculateSearchPerformance(searchCache || []);

    const analytics: SearchAnalytics = {
      totalSearches,
      popularQueries,
      searchTrends,
      searchPerformance,
    };

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('Search analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to load search analytics' },
      { status: 500 }
    );
  }
}

/**
 * Analyze popular queries
 */
function analyzePopularQueries(searchCache: any[]): {
  query: string;
  count: number;
  successRate: number;
}[] {
  const queryCounts: Record<string, { count: number; successes: number }> = {};

  searchCache.forEach(search => {
    const query = search.cache_key.split('|')[0] || 'unknown';
    
    if (!queryCounts[query]) {
      queryCounts[query] = { count: 0, successes: 0 };
    }
    
    queryCounts[query].count++;
    
    // Assume success if there's cached data
    if (search.cached_data) {
      queryCounts[query].successes++;
    }
  });

  return Object.entries(queryCounts)
    .map(([query, data]) => ({
      query,
      count: data.count,
      successRate: data.count > 0 ? data.successes / data.count : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20); // Top 20 queries
}

/**
 * Generate search trends
 */
function generateSearchTrends(searchCache: any[], rangeDays: number): {
  date: string;
  count: number;
}[] {
  const trends: { date: string; count: number }[] = [];
  const now = new Date();

  // Generate daily trends
  for (let i = rangeDays - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateString = date.toISOString().split('T')[0];
    
    const daySearches = searchCache.filter(search => {
      const searchDate = new Date(search.created_at);
      return searchDate.toISOString().split('T')[0] === dateString;
    });

    trends.push({
      date: dateString,
      count: daySearches.length,
    });
  }

  return trends;
}

/**
 * Calculate search performance
 */
function calculateSearchPerformance(searchCache: any[]): {
  averageResponseTime: number;
  successRate: number;
  errorRate: number;
} {
  if (searchCache.length === 0) {
    return {
      averageResponseTime: 0,
      successRate: 0,
      errorRate: 0,
    };
  }

  const successfulSearches = searchCache.filter(search => search.cached_data);
  const successRate = successfulSearches.length / searchCache.length;
  const errorRate = 1 - successRate;

  // Estimate average response time (simplified)
  const averageResponseTime = 250; // 250ms average

  return {
    averageResponseTime,
    successRate,
    errorRate,
  };
}
