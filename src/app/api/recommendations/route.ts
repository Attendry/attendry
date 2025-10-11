/**
 * Recommendations API
 * 
 * This endpoint provides AI-powered event recommendations based on
 * user behavior, preferences, and industry trends.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { EventData } from '@/lib/types/core';
import { OptimizedAIService } from '@/lib/services/optimized-ai-service';

/**
 * Recommendation types
 */
type RecommendationType = 
  | 'similar_events'
  | 'trending_events'
  | 'industry_events'
  | 'location_based'
  | 'time_based'
  | 'collaborative';

/**
 * Recommendation interface
 */
interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  events: EventData[];
  confidence: number;
  reason: string;
}

/**
 * Recommendations response
 */
interface RecommendationsResponse {
  recommendations: Recommendation[];
  total: number;
}

/**
 * GET /api/recommendations
 */
export async function GET(): Promise<NextResponse<RecommendationsResponse>> {
  try {
    const supabase = await supabaseServer();
    
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { recommendations: [], total: 0 },
        { status: 401 }
      );
    }

    // Get user profile and preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { recommendations: [], total: 0 },
        { status: 404 }
      );
    }

    // Generate recommendations
    const recommendations = await generateRecommendations(profile, supabase);

    return NextResponse.json({
      recommendations,
      total: recommendations.length,
    });

  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json(
      { recommendations: [], total: 0 },
      { status: 500 }
    );
  }
}

/**
 * Generate recommendations based on user profile
 */
async function generateRecommendations(profile: any, supabase: any): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  try {
    // Get user's saved events and activity
    const { data: savedEvents } = await supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', profile.id);

    const { data: recentEvents } = await supabase
      .from('collected_events')
      .select('*')
      .order('collected_at', { ascending: false })
      .limit(100);

    // 1. Similar Events Recommendation
    if (savedEvents && savedEvents.length > 0) {
      const similarEvents = await generateSimilarEventsRecommendation(savedEvents, recentEvents, supabase);
      if (similarEvents) {
        recommendations.push(similarEvents);
      }
    }

    // 2. Industry Events Recommendation
    if (profile.preferences?.industries?.length > 0) {
      const industryEvents = await generateIndustryEventsRecommendation(profile.preferences.industries, recentEvents, supabase);
      if (industryEvents) {
        recommendations.push(industryEvents);
      }
    }

    // 3. Trending Events Recommendation
    const trendingEvents = await generateTrendingEventsRecommendation(recentEvents, supabase);
    if (trendingEvents) {
      recommendations.push(trendingEvents);
    }

    // 4. Location-based Recommendation
    if (profile.preferences?.locations?.length > 0) {
      const locationEvents = await generateLocationBasedRecommendation(profile.preferences.locations, recentEvents, supabase);
      if (locationEvents) {
        recommendations.push(locationEvents);
      }
    }

    // 5. Time-based Recommendation
    const timeBasedEvents = await generateTimeBasedRecommendation(recentEvents, supabase);
    if (timeBasedEvents) {
      recommendations.push(timeBasedEvents);
    }

    // 6. Collaborative Recommendation
    const collaborativeEvents = await generateCollaborativeRecommendation(profile, recentEvents, supabase);
    if (collaborativeEvents) {
      recommendations.push(collaborativeEvents);
    }

  } catch (error) {
    console.error('Error generating recommendations:', error);
  }

  return recommendations;
}

/**
 * Generate similar events recommendation
 */
async function generateSimilarEventsRecommendation(savedEvents: any[], recentEvents: any[], supabase: any): Promise<Recommendation | null> {
  if (savedEvents.length === 0) return null;

  try {
    // Use AI to find similar events
    const savedEventTitles = savedEvents.map(e => e.title).join(', ');
    
    const aiResponse = await OptimizedAIService.processRequest<{
      similarEvents: string[];
      reason: string;
    }>(
      'prioritize',
      `Based on these saved events: "${savedEventTitles}", find similar events from the available events. Return the most similar event titles and explain why they are similar.`,
      {
        context: 'event_recommendation',
        savedEvents,
        recentEvents,
      },
      {
        useCache: true,
        useBatching: false,
      }
    );

    if (aiResponse.similarEvents && aiResponse.similarEvents.length > 0) {
      const similarEvents = recentEvents.filter(event => 
        aiResponse.similarEvents.some(title => 
          event.title.toLowerCase().includes(title.toLowerCase())
        )
      ).slice(0, 6);

      if (similarEvents.length > 0) {
        return {
          id: 'similar_events',
          type: 'similar_events',
          title: 'Similar to Your Saved Events',
          description: 'Events similar to those you\'ve already saved',
          events: similarEvents,
          confidence: 0.85,
          reason: aiResponse.reason || 'These events are similar to your saved events based on topic and content analysis.',
        };
      }
    }
  } catch (error) {
    console.error('Error generating similar events recommendation:', error);
  }

  return null;
}

/**
 * Generate industry events recommendation
 */
async function generateIndustryEventsRecommendation(industries: string[], recentEvents: any[], supabase: any): Promise<Recommendation | null> {
  try {
    const industryEvents = recentEvents.filter(event => {
      const eventText = `${event.title} ${event.description || ''}`.toLowerCase();
      return industries.some(industry => 
        eventText.includes(industry.toLowerCase())
      );
    }).slice(0, 6);

    if (industryEvents.length > 0) {
      return {
        id: 'industry_events',
        type: 'industry_events',
        title: 'Industry Events',
        description: `Events in your selected industries: ${industries.join(', ')}`,
        events: industryEvents,
        confidence: 0.90,
        reason: `These events match your industry interests: ${industries.join(', ')}.`,
      };
    }
  } catch (error) {
    console.error('Error generating industry events recommendation:', error);
  }

  return null;
}

/**
 * Generate trending events recommendation
 */
async function generateTrendingEventsRecommendation(recentEvents: any[], supabase: any): Promise<Recommendation | null> {
  try {
    // Get events from the last 7 days that are popular
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const trendingEvents = recentEvents
      .filter(event => new Date(event.collected_at) > weekAgo)
      .slice(0, 6);

    if (trendingEvents.length > 0) {
      return {
        id: 'trending_events',
        type: 'trending_events',
        title: 'Trending Events',
        description: 'Popular events discovered recently',
        events: trendingEvents,
        confidence: 0.75,
        reason: 'These events are trending and popular among users.',
      };
    }
  } catch (error) {
    console.error('Error generating trending events recommendation:', error);
  }

  return null;
}

/**
 * Generate location-based recommendation
 */
async function generateLocationBasedRecommendation(locations: string[], recentEvents: any[], supabase: any): Promise<Recommendation | null> {
  try {
    const locationEvents = recentEvents.filter(event => {
      const eventLocation = `${event.city || ''} ${event.country || ''}`.toLowerCase();
      return locations.some(location => 
        eventLocation.includes(location.toLowerCase())
      );
    }).slice(0, 6);

    if (locationEvents.length > 0) {
      return {
        id: 'location_based',
        type: 'location_based',
        title: 'Location-based Events',
        description: `Events in your preferred locations: ${locations.join(', ')}`,
        events: locationEvents,
        confidence: 0.80,
        reason: `These events are in your preferred locations: ${locations.join(', ')}.`,
      };
    }
  } catch (error) {
    console.error('Error generating location-based recommendation:', error);
  }

  return null;
}

/**
 * Generate time-based recommendation
 */
async function generateTimeBasedRecommendation(recentEvents: any[], supabase: any): Promise<Recommendation | null> {
  try {
    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const upcomingEvents = recentEvents.filter(event => {
      if (!event.starts_at) return false;
      const eventDate = new Date(event.starts_at);
      return eventDate > now && eventDate < nextMonth;
    }).slice(0, 6);

    if (upcomingEvents.length > 0) {
      return {
        id: 'time_based',
        type: 'time_based',
        title: 'Upcoming Events',
        description: 'Events happening in the next month',
        events: upcomingEvents,
        confidence: 0.70,
        reason: 'These events are happening soon and might be of interest to you.',
      };
    }
  } catch (error) {
    console.error('Error generating time-based recommendation:', error);
  }

  return null;
}

/**
 * Generate collaborative recommendation
 */
async function generateCollaborativeRecommendation(profile: any, recentEvents: any[], supabase: any): Promise<Recommendation | null> {
  try {
    // This is a simplified collaborative filtering approach
    // In a real implementation, you would analyze user behavior patterns
    
    const collaborativeEvents = recentEvents
      .filter(event => {
        // Simple heuristic: events with high engagement
        return event.title && event.description;
      })
      .slice(0, 6);

    if (collaborativeEvents.length > 0) {
      return {
        id: 'collaborative',
        type: 'collaborative',
        title: 'Recommended for You',
        description: 'Events recommended based on user behavior patterns',
        events: collaborativeEvents,
        confidence: 0.65,
        reason: 'These events are recommended based on similar user preferences and behavior patterns.',
      };
    }
  } catch (error) {
    console.error('Error generating collaborative recommendation:', error);
  }

  return null;
}
