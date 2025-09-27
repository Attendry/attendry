/**
 * Trending Events API
 * 
 * This endpoint provides trending events and categories based on
 * user engagement and discovery patterns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { EventData } from '@/lib/types/core';

/**
 * Trending category interface
 */
interface TrendingCategory {
  name: string;
  count: number;
  growth: number;
  events: EventData[];
}

/**
 * Trending response
 */
interface TrendingResponse {
  categories: TrendingCategory[];
  events: EventData[];
  total: number;
}

/**
 * GET /api/events/trending
 */
export async function GET(): Promise<NextResponse<TrendingResponse>> {
  try {
    const supabase = supabaseAdmin();

    // Get recent events from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentEvents } = await supabase
      .from('collected_events')
      .select('*')
      .gte('collected_at', thirtyDaysAgo.toISOString())
      .order('collected_at', { ascending: false })
      .limit(100);

    if (!recentEvents) {
      return NextResponse.json({
        categories: [],
        events: [],
        total: 0,
      });
    }

    // Get events from the previous 30 days for growth calculation
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: previousEvents } = await supabase
      .from('collected_events')
      .select('*')
      .gte('collected_at', sixtyDaysAgo.toISOString())
      .lt('collected_at', thirtyDaysAgo.toISOString());

    // Generate trending categories
    const categories = generateTrendingCategories(recentEvents, previousEvents || []);

    // Get trending events (most recent and popular)
    const trendingEvents = recentEvents.slice(0, 20);

    return NextResponse.json({
      categories,
      events: trendingEvents,
      total: trendingEvents.length,
    });

  } catch (error) {
    console.error('Trending events error:', error);
    return NextResponse.json(
      { categories: [], events: [], total: 0 },
      { status: 500 }
    );
  }
}

/**
 * Generate trending categories based on event data
 */
function generateTrendingCategories(recentEvents: any[], previousEvents: any[]): TrendingCategory[] {
  const categories: TrendingCategory[] = [];

  // Define industry categories
  const industryCategories = [
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
  ];

  // Define event type categories
  const eventTypeCategories = [
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

  // Analyze industry trends
  industryCategories.forEach(industry => {
    const recentCount = recentEvents.filter(event => 
      containsKeyword(event, industry)
    ).length;

    const previousCount = previousEvents.filter(event => 
      containsKeyword(event, industry)
    ).length;

    if (recentCount > 0) {
      const growth = previousCount > 0 
        ? ((recentCount - previousCount) / previousCount) * 100
        : 100;

      const events = recentEvents
        .filter(event => containsKeyword(event, industry))
        .slice(0, 5);

      categories.push({
        name: industry,
        count: recentCount,
        growth,
        events,
      });
    }
  });

  // Analyze event type trends
  eventTypeCategories.forEach(eventType => {
    const recentCount = recentEvents.filter(event => 
      containsKeyword(event, eventType)
    ).length;

    const previousCount = previousEvents.filter(event => 
      containsKeyword(event, eventType)
    ).length;

    if (recentCount > 0) {
      const growth = previousCount > 0 
        ? ((recentCount - previousCount) / previousCount) * 100
        : 100;

      const events = recentEvents
        .filter(event => containsKeyword(event, eventType))
        .slice(0, 5);

      categories.push({
        name: eventType,
        count: recentCount,
        growth,
        events,
      });
    }
  });

  // Sort by growth and count
  return categories
    .sort((a, b) => {
      // First sort by growth (descending)
      if (Math.abs(a.growth - b.growth) > 5) {
        return b.growth - a.growth;
      }
      // Then by count (descending)
      return b.count - a.count;
    })
    .slice(0, 10); // Top 10 categories
}

/**
 * Check if event contains keyword
 */
function containsKeyword(event: any, keyword: string): boolean {
  const text = `${event.title || ''} ${event.description || ''}`.toLowerCase();
  return text.includes(keyword.toLowerCase());
}
