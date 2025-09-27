/**
 * System Analytics API
 * 
 * This endpoint provides system performance and resource analytics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * System analytics interface
 */
interface SystemAnalytics {
  performance: {
    averageResponseTime: number;
    uptime: number;
    errorRate: number;
  };
  resourceUsage: {
    cpu: number;
    memory: number;
    storage: number;
  };
  apiUsage: {
    endpoint: string;
    requests: number;
    averageResponseTime: number;
    errorRate: number;
  }[];
}

/**
 * GET /api/analytics/system
 */
export async function GET(req: NextRequest): Promise<NextResponse<SystemAnalytics>> {
  try {
    const supabase = createServerComponentClient({ cookies });
    
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

    // Get system performance data
    const performance = await calculateSystemPerformance(supabase, startDate);

    // Get resource usage data
    const resourceUsage = await calculateResourceUsage();

    // Get API usage data
    const apiUsage = await calculateAPIUsage(supabase, startDate);

    const analytics: SystemAnalytics = {
      performance,
      resourceUsage,
      apiUsage,
    };

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('System analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to load system analytics' },
      { status: 500 }
    );
  }
}

/**
 * Calculate system performance
 */
async function calculateSystemPerformance(supabase: any, startDate: Date): Promise<{
  averageResponseTime: number;
  uptime: number;
  errorRate: number;
}> {
  try {
    // Test database response time
    const startTime = Date.now();
    await supabase.from('profiles').select('id').limit(1);
    const responseTime = Date.now() - startTime;

    // Get error events from the date range
    const { data: errorEvents } = await supabase
      .from('collected_events')
      .select('error')
      .gte('collected_at', startDate.toISOString());

    const totalEvents = errorEvents?.length || 0;
    const errorEvents = errorEvents?.filter(event => event.error).length || 0;
    const errorRate = totalEvents > 0 ? errorEvents / totalEvents : 0;

    return {
      averageResponseTime: responseTime,
      uptime: 99.9, // Simplified uptime calculation
      errorRate,
    };

  } catch (error) {
    console.error('System performance calculation error:', error);
    return {
      averageResponseTime: 0,
      uptime: 0,
      errorRate: 1,
    };
  }
}

/**
 * Calculate resource usage
 */
async function calculateResourceUsage(): Promise<{
  cpu: number;
  memory: number;
  storage: number;
}> {
  // Simplified resource usage calculation
  // In a real implementation, you would get this from your hosting provider
  return {
    cpu: 45, // 45% CPU usage
    memory: 62, // 62% memory usage
    storage: 78, // 78% storage usage
  };
}

/**
 * Calculate API usage
 */
async function calculateAPIUsage(supabase: any, startDate: Date): Promise<{
  endpoint: string;
  requests: number;
  averageResponseTime: number;
  errorRate: number;
}[]> {
  // Get search cache data to estimate API usage
  const { data: searchCache } = await supabase
      .from('search_cache')
      .select('*')
      .gte('created_at', startDate.toISOString());

  const totalSearches = searchCache?.length || 0;

  // Simulate API usage data
  const apiUsage = [
    {
      endpoint: '/api/events/search',
      requests: Math.floor(totalSearches * 0.4),
      averageResponseTime: 250,
      errorRate: 0.02,
    },
    {
      endpoint: '/api/events/run',
      requests: Math.floor(totalSearches * 0.3),
      averageResponseTime: 1200,
      errorRate: 0.05,
    },
    {
      endpoint: '/api/events/collect',
      requests: Math.floor(totalSearches * 0.2),
      averageResponseTime: 800,
      errorRate: 0.03,
    },
    {
      endpoint: '/api/events/extract',
      requests: Math.floor(totalSearches * 0.1),
      averageResponseTime: 1500,
      errorRate: 0.08,
    },
  ];

  return apiUsage;
}
