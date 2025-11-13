/**
 * Event Insights Service
 * 
 * Aggregates insights from multiple sources for events
 */

import { supabaseServer } from '@/lib/supabase-server';
import { EventParticipationService } from './event-participation-service';
import { RelevanceService } from './relevance-service';
import { EventInsightsResponse, AttendeeInsight, TrendInsight, PositioningRecommendation } from '@/lib/types/event-board';
import { EventData } from '@/lib/types/core';
import { UserProfile } from './relevance-service';

export class EventInsightsService {
  /**
   * Get comprehensive insights for an event
   */
  static async getEventInsights(
    eventId: string,
    userId: string
  ): Promise<EventInsightsResponse> {
    const supabase = await supabaseServer();

    let event: any = null;

    // First, check if eventId is a board item ID
    const { data: boardItem } = await supabase
      .from('user_event_board')
      .select('event_id, event_url, event_data')
      .eq('id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (boardItem) {
      // We have a board item - try to get event from collected_events first
      if (boardItem.event_id) {
        const { data: collectedEvent } = await supabase
          .from('collected_events')
          .select('*')
          .eq('id', boardItem.event_id)
          .maybeSingle();
        
        if (collectedEvent) {
          event = collectedEvent;
        }
      }
      
      // If not found in collected_events, use event_data from board
      if (!event && boardItem.event_data) {
        event = boardItem.event_data;
      }
      
      // If still not found, try to find by event_url
      if (!event && boardItem.event_url) {
        const { data: eventByUrl } = await supabase
          .from('collected_events')
          .select('*')
          .eq('source_url', boardItem.event_url)
          .maybeSingle();
        
        if (eventByUrl) {
          event = eventByUrl;
        }
      }
    } else {
      // Not a board item ID - try to find event directly
      
      // Check if this is an optimized event ID (format: optimized_{timestamp}_{index})
      const isOptimizedId = eventId.startsWith('optimized_');
      
      if (isOptimizedId) {
        // For optimized IDs, try to find in board by event_url or event_data
        // First, try to find board item that might have this event
        const { data: boardItems } = await supabase
          .from('user_event_board')
          .select('event_id, event_url, event_data')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (boardItems?.event_data) {
          // Check if event_data has a matching ID or URL
          const eventData = boardItems.event_data as any;
          if (eventData.id === eventId || eventData.source_url) {
            event = eventData;
          }
        }
        
        // If still not found, try to find by URL pattern
        // Optimized events typically have source_url in their metadata
        if (!event) {
          // Try to extract URL from optimized ID or search board items
          const { data: allBoardItems } = await supabase
            .from('user_event_board')
            .select('event_data')
            .eq('user_id', userId);
          
          if (allBoardItems) {
            for (const item of allBoardItems) {
              const eventData = item.event_data as any;
              if (eventData && (eventData.id === eventId || eventData.source_url)) {
                event = eventData;
                break;
              }
            }
          }
        }
      } else {
        // Regular UUID or URL - try to find event directly
        // First try as UUID in collected_events
        const { data: eventById } = await supabase
          .from('collected_events')
          .select('*')
          .eq('id', eventId)
          .maybeSingle();
        
        if (eventById) {
          event = eventById;
        } else {
          // Try as source_url
          const { data: eventByUrl } = await supabase
            .from('collected_events')
            .select('*')
            .eq('source_url', eventId)
            .maybeSingle();
          
          if (eventByUrl) {
            event = eventByUrl;
          }
        }
      }
    }

    if (!event) {
      console.error('[EventInsightsService] Event not found for eventId:', eventId);
      throw new Error('Event not found');
    }

    console.log('[EventInsightsService] Found event:', {
      eventId: event.id || eventId,
      title: event.title,
      hasDescription: !!event.description,
      hasTopics: !!(event.topics && event.topics.length > 0),
      hasSpeakers: !!(event.speakers && event.speakers.length > 0),
      source: boardItem ? 'board_item' : 'collected_events'
    });

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Transform event to EventData format
    const eventData: EventData = {
      id: event.id,
      title: event.title,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      city: event.city,
      country: event.country,
      venue: event.venue,
      organizer: event.organizer,
      description: event.description,
      topics: event.topics || [],
      speakers: event.speakers || [],
      sponsors: event.sponsors || [],
      participating_organizations: event.participating_organizations || [],
      partners: event.partners || [],
      competitors: event.competitors || [],
      confidence: event.confidence || undefined,
    };

    // Get attendees
    const attendees = this.extractAttendees(event);

    // Get trends
    const trends = this.extractTrends(event);

    // Get positioning recommendations
    const positioning = await this.getPositioningRecommendations(eventData, profile);

    return {
      attendees,
      trends,
      positioning
    };
  }

  /**
   * Extract attendee insights from event data
   */
  private static extractAttendees(event: any): AttendeeInsight[] {
    const attendees: AttendeeInsight[] = [];

    // Extract speakers
    if (event.speakers && Array.isArray(event.speakers)) {
      event.speakers.forEach((speaker: any) => {
        if (speaker && speaker.name) {
          attendees.push({
            name: speaker.name,
            company: speaker.org || speaker.company,
            role: 'speaker',
            title: speaker.title,
            confidence: speaker.confidence || 0.8
          });
        }
      });
    }

    // Extract sponsors
    if (event.sponsors && Array.isArray(event.sponsors)) {
      event.sponsors.forEach((sponsor: any) => {
        const name = typeof sponsor === 'string' ? sponsor : sponsor?.name;
        if (name) {
          attendees.push({
            name: name,
            company: typeof sponsor === 'object' ? sponsor.company : undefined,
            role: 'sponsor',
            confidence: 0.9
          });
        }
      });
    }

    // Extract participating organizations
    if (event.participating_organizations && Array.isArray(event.participating_organizations)) {
      event.participating_organizations.forEach((org: string) => {
        attendees.push({
          name: org,
          company: org,
          role: 'attendee',
          confidence: 0.7
        });
      });
    }

    return attendees;
  }

  /**
   * Extract trend insights from event data
   */
  private static extractTrends(event: any): TrendInsight[] {
    const trends: TrendInsight[] = [];

    // Industry trend
    if (event.industry) {
      trends.push({
        type: 'industry',
        label: event.industry,
        value: 1,
        description: `Event in ${event.industry} industry`
      });
    }

    // Event type trend
    const eventText = `${event.title || ''} ${event.description || ''}`.toLowerCase();
    const eventTypes = ['conference', 'summit', 'workshop', 'seminar', 'webinar', 'exhibition'];
    for (const type of eventTypes) {
      if (eventText.includes(type)) {
        trends.push({
          type: 'event_type',
          label: type.charAt(0).toUpperCase() + type.slice(1),
          value: 1,
          description: `${type} type event`
        });
        break;
      }
    }

    // Geographic trend
    if (event.country) {
      trends.push({
        type: 'geographic',
        label: event.country,
        value: 1,
        description: `Event in ${event.country}`
      });
    }

    // Temporal trend
    if (event.starts_at) {
      const eventDate = new Date(event.starts_at);
      const now = new Date();
      const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntil > 0 && daysUntil <= 90) {
        trends.push({
          type: 'temporal',
          label: 'Upcoming',
          value: daysUntil,
          description: `Event in ${daysUntil} days`
        });
      }
    }

    return trends;
  }

  /**
   * Get positioning recommendations
   */
  private static async getPositioningRecommendations(
    eventData: EventData,
    profile: UserProfile | null
  ): Promise<PositioningRecommendation[]> {
    const positioning: PositioningRecommendation[] = [];

    if (profile) {
      // Calculate relevance score
      const relevanceScore = RelevanceService.calculateEventRelevance(eventData, profile);

      // Generate recommendations based on relevance
      if (relevanceScore.score > 0.7) {
        positioning.push({
          action: 'sponsor',
          score: relevanceScore.score,
          reasoning: relevanceScore.reasons,
          opportunity: 'high'
        });
      } else if (relevanceScore.score > 0.5) {
        positioning.push({
          action: 'speak',
          score: relevanceScore.score,
          reasoning: relevanceScore.reasons,
          opportunity: 'medium'
        });
      } else {
        positioning.push({
          action: 'attend',
          score: relevanceScore.score,
          reasoning: relevanceScore.reasons,
          opportunity: 'low'
        });
      }

      // Check for competitor presence
      if (eventData.competitors && eventData.competitors.length > 0) {
        const competitorMatches = (profile.competitors || []).filter(c => 
          eventData.competitors?.some(ec => 
            ec.toLowerCase().includes(c.toLowerCase()) || 
            c.toLowerCase().includes(ec.toLowerCase())
          )
        );

        if (competitorMatches.length > 0) {
          positioning.push({
            action: 'network',
            score: 0.8,
            reasoning: [`Competitors ${competitorMatches.join(', ')} are attending`],
            opportunity: 'high'
          });
        }
      }
    } else {
      // Default recommendation if no profile
      positioning.push({
        action: 'attend',
        score: 0.5,
        reasoning: ['Complete your profile for personalized recommendations'],
        opportunity: 'medium'
      });
    }

    return positioning;
  }
}

