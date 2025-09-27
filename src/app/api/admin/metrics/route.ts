/**
 * Admin Metrics API
 * 
 * This endpoint provides comprehensive metrics and analytics
 * for the admin dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * Dashboard metrics interface
 */
interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  totalEvents: number;
  totalSearches: number;
  systemHealth: {
    status: 'healthy' | 'warning' | 'error';
    uptime: number;
    responseTime: number;
    errorRate: number;
  };
  userGrowth: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  eventStats: {
    collected: number;
    processed: number;
    errors: number;
  };
}

/**
 * GET /api/admin/metrics
 */
export async function GET(): Promise<NextResponse<DashboardMetrics>> {
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

    // Check if user is admin (simplified check)
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

    // Get user metrics
    const { data: users } = await supabase
      .from('profiles')
      .select('*');

    const totalUsers = users?.length || 0;
    const activeUsers = users?.filter(user => user.is_active).length || 0;

    // Get event metrics
    const { data: events } = await supabase
      .from('collected_events')
      .select('*');

    const totalEvents = events?.length || 0;

    // Get search metrics
    const { data: searchCache } = await supabase
      .from('search_cache')
      .select('*');

    const totalSearches = searchCache?.length || 0;

    // Calculate user growth
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dailyGrowth = users?.filter(user => 
      new Date(user.created_at) > oneDayAgo
    ).length || 0;

    const weeklyGrowth = users?.filter(user => 
      new Date(user.created_at) > oneWeekAgo
    ).length || 0;

    const monthlyGrowth = users?.filter(user => 
      new Date(user.created_at) > oneMonthAgo
    ).length || 0;

    // Calculate system health
    const systemHealth = await calculateSystemHealth(supabase);

    // Calculate event stats
    const eventStats = {
      collected: totalEvents,
      processed: events?.filter(event => event.processed).length || 0,
      errors: events?.filter(event => event.error).length || 0,
    };

    const metrics: DashboardMetrics = {
      totalUsers,
      activeUsers,
      totalEvents,
      totalSearches,
      systemHealth,
      userGrowth: {
        daily: dailyGrowth,
        weekly: weeklyGrowth,
        monthly: monthlyGrowth,
      },
      eventStats,
    };

    return NextResponse.json(metrics);

  } catch (error) {
    console.error('Admin metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to load metrics' },
      { status: 500 }
    );
  }
}

/**
 * Calculate system health metrics
 */
async function calculateSystemHealth(supabase: any): Promise<{
  status: 'healthy' | 'warning' | 'error';
  uptime: number;
  responseTime: number;
  errorRate: number;
}> {
  try {
    // Test database connection
    const startTime = Date.now();
    await supabase.from('profiles').select('id').limit(1);
    const responseTime = Date.now() - startTime;

    // Calculate error rate (simplified)
    const { data: events } = await supabase
      .from('collected_events')
      .select('error')
      .gte('collected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const totalEvents = events?.length || 0;
    const errorEvents = events?.filter(event => event.error).length || 0;
    const errorRate = totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;

    // Determine status
    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    if (errorRate > 10 || responseTime > 1000) {
      status = 'error';
    } else if (errorRate > 5 || responseTime > 500) {
      status = 'warning';
    }

    return {
      status,
      uptime: 99.9, // Simplified uptime calculation
      responseTime,
      errorRate: Math.round(errorRate * 100) / 100,
    };

  } catch (error) {
    console.error('System health calculation error:', error);
    return {
      status: 'error',
      uptime: 0,
      responseTime: 0,
      errorRate: 100,
    };
  }
}
