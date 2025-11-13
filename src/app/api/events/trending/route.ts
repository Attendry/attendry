/**
 * Trending Events API
 * 
 * This endpoint provides trending events and categories based on
 * user engagement and discovery patterns. Enhanced with personalized
 * trend analysis and hot topics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { supabaseServer } from '@/lib/supabase-server';
import { EventData, UserProfile } from '@/lib/types/core';
import {
  extractHotTopics,
  identifyEmergingThemes,
  getTrendAnalysis,
  cacheTrendAnalysis,
  filterEventsByUserProfile
} from '@/lib/services/trend-analysis-service';

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
 * Hot topic interface
 */
interface HotTopic {
  topic: string;
  mentionCount: number;
  growthRate: number;
  momentum: number;
  relatedEvents: string[];
  category: string;
  relevanceScore: number;
}

/**
 * Emerging theme interface
 */
interface EmergingTheme {
  theme: string;
  description: string;
  growth: number;
  events: EventData[];
  relevanceScore: number;
}

/**
 * Enhanced trending response
 */
interface TrendingResponse {
  categories: TrendingCategory[];
  events: EventData[];
  total: number;
  hotTopics?: HotTopic[];
  emergingThemes?: EmergingTheme[];
  personalization?: {
    userIndustry: string[];
    filteredEventCount: number;
    totalEventCount: number;
  };
}

/**
 * GET /api/events/trending
 * 
 * Query parameters:
 * - includeHotTopics: boolean - Include hot topics analysis (default: false)
 * - timeWindow: string - Time window for analysis (week/month/quarter, default: month)
 */
export async function GET(req: NextRequest): Promise<NextResponse<TrendingResponse>> {
  try {
    const supabase = supabaseAdmin();
    const { searchParams } = new URL(req.url);
    const includeHotTopics = searchParams.get('includeHotTopics') === 'true';
    const timeWindow = searchParams.get('timeWindow') || 'month';

    // Get user profile for personalization
    let userProfile: UserProfile | null = null;
    try {
      const supabaseServerClient = await supabaseServer();
      const { data: { user } } = await supabaseServerClient.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          userProfile = {
            id: profile.id,
            full_name: profile.full_name,
            company: profile.company,
            competitors: profile.competitors || [],
            icp_terms: profile.icp_terms || [],
            industry_terms: profile.industry_terms || [],
            use_in_basic_search: profile.use_in_basic_search ?? true
          };
        }
      }
    } catch (error) {
      console.warn('Failed to load user profile for trending:', error);
      // Continue without personalization
    }

    // Check cache first
    const cachedResult = await getTrendAnalysis(timeWindow, userProfile || undefined);
    if (cachedResult && !includeHotTopics) {
      // Return cached categories and events (would need to store these too)
      // For now, continue to generate
    }

    // Get recent events based on time window
    const daysBack = timeWindow === 'week' ? 7 : timeWindow === 'quarter' ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const { data: recentEvents } = await supabase
      .from('collected_events')
      .select('*')
      .gte('collected_at', startDate.toISOString())
      .order('collected_at', { ascending: false })
      .limit(200); // Increased limit for better analysis

    if (!recentEvents || recentEvents.length === 0) {
      return NextResponse.json({
        categories: [],
        events: [],
        total: 0,
        hotTopics: [],
        emergingThemes: [],
        personalization: {
          userIndustry: userProfile?.industry_terms || [],
          filteredEventCount: 0,
          totalEventCount: 0
        }
      });
    }

    // Get events from previous period for growth calculation
    const previousStartDate = new Date();
    previousStartDate.setDate(previousStartDate.getDate() - (daysBack * 2));

    const { data: previousEvents } = await supabase
      .from('collected_events')
      .select('*')
      .gte('collected_at', previousStartDate.toISOString())
      .lt('collected_at', startDate.toISOString());

    // Filter events by user profile
    const filteredEvents = filterEventsByUserProfile(recentEvents, userProfile || undefined);
    const totalEventCount = recentEvents.length;
    const filteredEventCount = filteredEvents.length;

    // Generate trending categories
    const categories = generateTrendingCategories(filteredEvents, previousEvents || []);

    // Get trending events (most recent and popular)
    const trendingEvents = filteredEvents.slice(0, 20);

    // Extract hot topics if requested
    let hotTopics: HotTopic[] = [];
    let emergingThemes: EmergingTheme[] = [];
    
    if (includeHotTopics) {
      try {
        hotTopics = await extractHotTopics(filteredEvents, userProfile || undefined);
        emergingThemes = await identifyEmergingThemes(
          filteredEvents,
          previousEvents || [],
          userProfile || undefined
        );

        // Cache the analysis result
        await cacheTrendAnalysis(
          timeWindow,
          {
            hotTopics,
            emergingThemes,
            analyzedEventCount: filteredEvents.length,
            filteredEventCount,
            confidence: 0.8
          },
          userProfile || undefined
        );
      } catch (error) {
        console.error('Failed to extract hot topics:', error);
        // Continue without hot topics
      }
    }

    return NextResponse.json({
      categories,
      events: trendingEvents,
      total: trendingEvents.length,
      hotTopics: includeHotTopics ? hotTopics : undefined,
      emergingThemes: includeHotTopics ? emergingThemes : undefined,
      personalization: {
        userIndustry: userProfile?.industry_terms || [],
        filteredEventCount,
        totalEventCount
      }
    });

  } catch (error) {
    console.error('Trending events error:', error);
    return NextResponse.json(
      { 
        categories: [], 
        events: [], 
        total: 0,
        hotTopics: [],
        emergingThemes: [],
        personalization: {
          userIndustry: [],
          filteredEventCount: 0,
          totalEventCount: 0
        }
      },
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
