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
import {
  calculateTrendSignificance,
  filterSignificantTrends,
  type TrendSignificance
} from '@/lib/services/statistical-analysis-service';
import {
  generateTrendRecommendations,
  type Recommendation
} from '@/lib/services/recommendation-engine';
import {
  filterInsightsByScore,
  sortInsightsByScore
} from '@/lib/services/insight-scoring-service';

/**
 * Trending category interface
 */
interface TrendingCategory {
  name: string;
  count: number;
  growth: number;
  events: EventData[];
  significance?: TrendSignificance;
  significanceScore?: number; // 0-1, higher = more significant
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
  recommendations?: Recommendation[]; // Phase 2A: Trend-based recommendations
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
 * - minScore: number - Minimum insight score (0-1) to filter results (default: 0, no filter)
 * - sortBy: string - Sort order: 'score', 'relevance', 'impact', 'urgency', 'confidence', 'growth', 'count' (default: 'score')
 */
export async function GET(req: NextRequest): Promise<NextResponse<TrendingResponse>> {
  try {
    const supabase = supabaseAdmin();
    const { searchParams } = new URL(req.url);
    const includeHotTopics = searchParams.get('includeHotTopics') === 'true';
    const timeWindow = searchParams.get('timeWindow') || 'month';
    const minScoreParam = searchParams.get('minScore');
    const minScore = minScoreParam ? parseFloat(minScoreParam) : 0; // Default: no filter
    const sortBy = searchParams.get('sortBy') || 'score'; // Default: sort by score

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

    // Generate trending categories with statistical significance
    const categories = generateTrendingCategories(
      filteredEvents,
      previousEvents || [],
      filteredEvents.length,
      previousEvents?.length || 0
    );

    // Get trending events (most recent and popular)
    const trendingEvents = filteredEvents.slice(0, 20);

    // Extract hot topics if requested
    let hotTopics: HotTopic[] = [];
    let emergingThemes: EmergingTheme[] = [];
    let recommendations: Recommendation[] = [];
    
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

    // Phase 2A: Generate trend-based recommendations
    try {
      const trendRecommendations: Recommendation[] = [];
      
      // Generate recommendations for each significant category
      for (const category of categories.slice(0, 5)) { // Top 5 categories
        if (category.significanceScore && category.significanceScore > 0.4) {
          const categoryEvents = category.events || [];
          const trendRecs = await generateTrendRecommendations(
            {
              category: category.name,
              growthRate: category.growth / 100, // Convert percentage to decimal
              momentum: category.significanceScore,
              events: categoryEvents
            },
            userProfile || undefined
          );
          trendRecommendations.push(...trendRecs);
        }
      }

      // Generate recommendations for hot topics
      if (hotTopics.length > 0) {
        for (const topic of hotTopics.slice(0, 3)) { // Top 3 hot topics
          const topicEvents = filteredEvents.filter(event => 
            topic.relatedEvents.includes(event.source_url)
          );
          const topicRecs = await generateTrendRecommendations(
            {
              category: topic.category || topic.topic,
              growthRate: topic.growthRate / 100,
              momentum: topic.momentum,
              events: topicEvents
            },
            userProfile || undefined
          );
          trendRecommendations.push(...topicRecs);
        }
      }

      // Sort recommendations by priority
      recommendations = trendRecommendations.sort((a, b) => b.priority - a.priority).slice(0, 10); // Top 10
    } catch (error) {
      console.error('Failed to generate trend recommendations:', error);
      // Continue without recommendations
    }

    // Phase 2B: Apply minScore filter and sortBy to results
    let filteredCategories = categories;
    let filteredHotTopics = hotTopics;
    let filteredEmergingThemes = emergingThemes;
    let filteredEvents = trendingEvents;

    // Filter categories by insight score (if available in future, for now filter by significance)
    if (minScore > 0) {
      filteredCategories = categories.filter(cat => {
        // Use significance score as proxy for insight score if available
        const score = cat.significanceScore || 0.5;
        return score >= minScore;
      });
    }

    // Filter and sort hot topics by insight score
    if (includeHotTopics && hotTopics.length > 0) {
      if (minScore > 0) {
        filteredHotTopics = hotTopics.filter(topic => {
          const score = topic.insightScore?.overallScore || 
                       ((topic.momentum || 0) * (topic.relevanceScore || 0) * (topic.validationScore || 0.5));
          return score >= minScore;
        });
      }

      // Sort hot topics
      filteredHotTopics = filteredHotTopics.sort((a, b) => {
        if (sortBy === 'score') {
          const scoreA = a.insightScore?.overallScore || 
                        ((a.momentum || 0) * (a.relevanceScore || 0) * (a.validationScore || 0.5));
          const scoreB = b.insightScore?.overallScore || 
                        ((b.momentum || 0) * (b.relevanceScore || 0) * (b.validationScore || 0.5));
          return scoreB - scoreA;
        } else if (sortBy === 'relevance') {
          return (b.relevanceScore || 0) - (a.relevanceScore || 0);
        } else if (sortBy === 'impact') {
          return (b.momentum || 0) - (a.momentum || 0);
        } else if (sortBy === 'growth') {
          return (b.growthRate || 0) - (a.growthRate || 0);
        }
        return 0;
      });
    }

    // Filter and sort emerging themes
    if (includeHotTopics && emergingThemes.length > 0) {
      if (minScore > 0) {
        filteredEmergingThemes = emergingThemes.filter(theme => {
          const score = theme.insightScore?.overallScore || (theme.growth / 100);
          return score >= minScore;
        });
      }

      // Sort emerging themes
      filteredEmergingThemes = filteredEmergingThemes.sort((a, b) => {
        if (sortBy === 'score') {
          const scoreA = a.insightScore?.overallScore || (a.growth / 100);
          const scoreB = b.insightScore?.overallScore || (b.growth / 100);
          return scoreB - scoreA;
        } else if (sortBy === 'relevance') {
          return (b.relevanceScore || 0) - (a.relevanceScore || 0);
        } else if (sortBy === 'growth') {
          return b.growth - a.growth;
        }
        return 0;
      });
    }

    // Sort categories
    if (sortBy === 'score' || sortBy === 'significance') {
      filteredCategories = filteredCategories.sort((a, b) => {
        const scoreA = a.significanceScore || 0;
        const scoreB = b.significanceScore || 0;
        return scoreB - scoreA;
      });
    } else if (sortBy === 'growth') {
      filteredCategories = filteredCategories.sort((a, b) => b.growth - a.growth);
    } else if (sortBy === 'count') {
      filteredCategories = filteredCategories.sort((a, b) => b.count - a.count);
    }

    return NextResponse.json({
      categories: filteredCategories,
      events: filteredEvents,
      total: filteredEvents.length,
      hotTopics: includeHotTopics ? filteredHotTopics : undefined,
      emergingThemes: includeHotTopics ? filteredEmergingThemes : undefined,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
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
        recommendations: [],
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
 * Generate trending categories based on event data with statistical significance
 */
function generateTrendingCategories(
  recentEvents: any[],
  previousEvents: any[],
  currentTotal: number,
  previousTotal: number
): TrendingCategory[] {
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

  // Build previous period map for significance testing
  const previousMap = new Map<string, { count: number; total: number }>();
  industryCategories.forEach(cat => {
    const count = previousEvents.filter(e => containsKeyword(e, cat)).length;
    if (count > 0) {
      previousMap.set(cat, { count, total: previousTotal });
    }
  });
  eventTypeCategories.forEach(cat => {
    const count = previousEvents.filter(e => containsKeyword(e, cat)).length;
    if (count > 0) {
      previousMap.set(cat, { count, total: previousTotal });
    }
  });

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

      // Calculate statistical significance
      const significance = calculateTrendSignificance(
        recentCount,
        previousCount,
        currentTotal,
        previousTotal
      );

      categories.push({
        name: industry,
        count: recentCount,
        growth,
        events,
        significance: significance || undefined,
        significanceScore: significance?.significanceScore
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

      // Calculate statistical significance
      const significance = calculateTrendSignificance(
        recentCount,
        previousCount,
        currentTotal,
        previousTotal
      );

      categories.push({
        name: eventType,
        count: recentCount,
        growth,
        events,
        significance: significance || undefined,
        significanceScore: significance?.significanceScore
      });
    }
  });

  // Filter by significance and sort
  // Only show trends with significance score > 0.3 (moderate significance threshold)
  const significantCategories = categories.filter(cat => 
    !cat.significanceScore || cat.significanceScore > 0.3
  );

  // Sort by significance score (if available), then by growth, then by count
  return significantCategories
    .sort((a, b) => {
      // First sort by significance score (descending)
      if (a.significanceScore && b.significanceScore) {
        if (Math.abs(a.significanceScore - b.significanceScore) > 0.1) {
          return b.significanceScore - a.significanceScore;
        }
      } else if (a.significanceScore) {
        return -1; // a has significance, b doesn't
      } else if (b.significanceScore) {
        return 1; // b has significance, a doesn't
      }
      
      // Then by growth (descending)
      if (Math.abs(a.growth - b.growth) > 5) {
        return b.growth - a.growth;
      }
      // Finally by count (descending)
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
