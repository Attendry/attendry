/**
 * Event Analytics API
 * 
 * This endpoint provides event analytics and insights.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Event analytics interface
 */
interface EventAnalytics {
  totalEvents: number;
  eventsCollected: number;
  eventsProcessed: number;
  eventCategories: {
    category: string;
    count: number;
    percentage: number;
  }[];
  eventTrends: {
    date: string;
    count: number;
  }[];
}

/**
 * GET /api/analytics/events
 */
export async function GET(req: NextRequest): Promise<NextResponse<EventAnalytics>> {
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

    // Get all events
    const { data: allEvents } = await supabase
      .from('collected_events')
      .select('*');

    const totalEvents = allEvents?.length || 0;

    // Get events collected within the range
    const { data: collectedEvents } = await supabase
      .from('collected_events')
      .select('*')
      .gte('collected_at', startDate.toISOString());

    const eventsCollected = collectedEvents?.length || 0;

    // Get processed events
    const { data: processedEvents } = await supabase
      .from('collected_events')
      .select('*')
      .eq('processed', true);

    const eventsProcessed = processedEvents?.length || 0;

    // Analyze event categories
    const eventCategories = analyzeEventCategories(collectedEvents || []);

    // Generate event trends
    const eventTrends = generateEventTrends(collectedEvents || [], rangeDays);

    const analytics: EventAnalytics = {
      totalEvents,
      eventsCollected,
      eventsProcessed,
      eventCategories,
      eventTrends,
    };

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('Event analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to load event analytics' },
      { status: 500 }
    );
  }
}

/**
 * Analyze event categories
 */
function analyzeEventCategories(events: any[]): {
  category: string;
  count: number;
  percentage: number;
}[] {
  const categories = [
    'Legal & Compliance',
    'FinTech',
    'Healthcare',
    'Technology',
    'Finance',
    'Insurance',
    'Banking',
    'Regulatory',
    'Risk Management',
    'Data Protection',
    'Cybersecurity',
    'ESG',
    'Governance',
    'Conference',
    'Summit',
    'Workshop',
    'Seminar',
    'Webinar',
    'Training',
    'Certification',
    'Networking',
    'Exhibition',
    'Forum',
    'Symposium',
    'Masterclass',
    'Bootcamp',
  ];

  const categoryCounts: Record<string, number> = {};

  events.forEach(event => {
    const eventText = `${event.title || ''} ${event.description || ''}`.toLowerCase();
    
    categories.forEach(category => {
      if (eventText.includes(category.toLowerCase())) {
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      }
    });
  });

  const totalEvents = events.length;
  const categoryAnalytics = Object.entries(categoryCounts)
    .map(([category, count]) => ({
      category,
      count,
      percentage: totalEvents > 0 ? (count / totalEvents) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 categories

  return categoryAnalytics;
}

/**
 * Generate event trends
 */
function generateEventTrends(events: any[], rangeDays: number): {
  date: string;
  count: number;
}[] {
  const trends: { date: string; count: number }[] = [];
  const now = new Date();

  // Generate daily trends
  for (let i = rangeDays - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateString = date.toISOString().split('T')[0];
    
    const dayEvents = events.filter(event => {
      const eventDate = new Date(event.collected_at);
      return eventDate.toISOString().split('T')[0] === dateString;
    });

    trends.push({
      date: dateString,
      count: dayEvents.length,
    });
  }

  return trends;
}
