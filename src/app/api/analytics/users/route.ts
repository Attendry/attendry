/**
 * User Analytics API
 * 
 * This endpoint provides user analytics and behavior insights.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * User analytics interface
 */
interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  userGrowth: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  userEngagement: {
    averageSessionTime: number;
    pageViews: number;
    bounceRate: number;
  };
}

/**
 * GET /api/analytics/users
 */
export async function GET(req: NextRequest): Promise<NextResponse<UserAnalytics>> {
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

    // Get all users
    const { data: allUsers } = await supabase
      .from('profiles')
      .select('*');

    const totalUsers = allUsers?.length || 0;

    // Get active users (users who signed in within the range)
    const { data: activeUsers } = await supabase
      .from('profiles')
      .select('*')
      .gte('last_sign_in_at', startDate.toISOString());

    const activeUsersCount = activeUsers?.length || 0;

    // Get new users (users created within the range)
    const { data: newUsers } = await supabase
      .from('profiles')
      .select('*')
      .gte('created_at', startDate.toISOString());

    const newUsersCount = newUsers?.length || 0;

    // Calculate user growth
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dailyGrowth = allUsers?.filter(user => 
      new Date(user.created_at) > oneDayAgo
    ).length || 0;

    const weeklyGrowth = allUsers?.filter(user => 
      new Date(user.created_at) > oneWeekAgo
    ).length || 0;

    const monthlyGrowth = allUsers?.filter(user => 
      new Date(user.created_at) > oneMonthAgo
    ).length || 0;

    // Calculate user engagement (simplified)
    const userEngagement = {
      averageSessionTime: 1800, // 30 minutes in seconds
      pageViews: totalUsers * 15, // Estimated page views per user
      bounceRate: 0.35, // 35% bounce rate
    };

    const analytics: UserAnalytics = {
      totalUsers,
      activeUsers: activeUsersCount,
      newUsers: newUsersCount,
      userGrowth: {
        daily: dailyGrowth,
        weekly: weeklyGrowth,
        monthly: monthlyGrowth,
      },
      userEngagement,
    };

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('User analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to load user analytics' },
      { status: 500 }
    );
  }
}
