import { supabaseServer } from '@/lib/supabase-server';

export interface WatchlistItem {
  id: string;
  kind: 'attendee' | 'company';
  label: string;
  ref_id: string;
  created_at: string;
}

export interface EventData {
  id: string;
  title: string;
  organizer?: string;
  sponsors?: Array<{ name: string; [key: string]: any }>;
  speakers?: Array<{ name: string; org?: string; [key: string]: any }>;
  participating_organizations?: string[];
  partners?: string[];
  competitors?: string[];
  source_url?: string;
}

export interface WatchlistMatch {
  eventId: string;
  hasMatch: boolean;
  matchedEntities: Array<{
    watchlistItem: WatchlistItem;
    matchType: 'organizer' | 'sponsor' | 'speaker' | 'participant' | 'partner' | 'competitor';
    matchedValue: string;
    confidence: number;
  }>;
  totalMatches: number;
}

export class WatchlistMatcher {
  /**
   * Check if events contain any watchlisted entities
   */
  static async checkEventsAgainstWatchlist(
    userId: string,
    events: EventData[]
  ): Promise<WatchlistMatch[]> {
    try {
      // Get user's watchlist
      const watchlist = await this.getUserWatchlist(userId);
      if (!watchlist.length) {
        return events.map(event => ({
          eventId: event.id,
          hasMatch: false,
          matchedEntities: [],
          totalMatches: 0,
        }));
      }

      // Check each event against watchlist
      const matches: WatchlistMatch[] = [];
      
      for (const event of events) {
        const match = this.checkEventAgainstWatchlist(event, watchlist);
        matches.push(match);
      }

      return matches;
    } catch (error) {
      console.error('Failed to check events against watchlist:', error);
      return events.map(event => ({
        eventId: event.id,
        hasMatch: false,
        matchedEntities: [],
        totalMatches: 0,
      }));
    }
  }

  /**
   * Check a single event against watchlist
   */
  private static checkEventAgainstWatchlist(
    event: EventData,
    watchlist: WatchlistItem[]
  ): WatchlistMatch {
    const matchedEntities: WatchlistMatch['matchedEntities'] = [];

    for (const watchlistItem of watchlist) {
      // Check organizer
      if (event.organizer) {
        const organizerMatch = this.calculateMatch(event.organizer, watchlistItem);
        if (organizerMatch.confidence > 0.7) {
          matchedEntities.push({
            watchlistItem,
            matchType: 'organizer',
            matchedValue: event.organizer,
            confidence: organizerMatch.confidence,
          });
        }
      }

      // Check sponsors
      if (event.sponsors) {
        for (const sponsor of event.sponsors) {
          if (sponsor.name) {
            const sponsorMatch = this.calculateMatch(sponsor.name, watchlistItem);
            if (sponsorMatch.confidence > 0.7) {
              matchedEntities.push({
                watchlistItem,
                matchType: 'sponsor',
                matchedValue: sponsor.name,
                confidence: sponsorMatch.confidence,
              });
            }
          }
        }
      }

      // Check speakers
      if (event.speakers) {
        for (const speaker of event.speakers) {
          // Check speaker name
          if (speaker.name) {
            const speakerNameMatch = this.calculateMatch(speaker.name, watchlistItem);
            if (speakerNameMatch.confidence > 0.7) {
              matchedEntities.push({
                watchlistItem,
                matchType: 'speaker',
                matchedValue: speaker.name,
                confidence: speakerNameMatch.confidence,
              });
            }
          }

          // Check speaker organization
          if (speaker.org) {
            const speakerOrgMatch = this.calculateMatch(speaker.org, watchlistItem);
            if (speakerOrgMatch.confidence > 0.7) {
              matchedEntities.push({
                watchlistItem,
                matchType: 'speaker',
                matchedValue: speaker.org,
                confidence: speakerOrgMatch.confidence,
              });
            }
          }
        }
      }

      // Check participating organizations
      if (event.participating_organizations) {
        for (const org of event.participating_organizations) {
          const orgMatch = this.calculateMatch(org, watchlistItem);
          if (orgMatch.confidence > 0.7) {
            matchedEntities.push({
              watchlistItem,
              matchType: 'participant',
              matchedValue: org,
              confidence: orgMatch.confidence,
            });
          }
        }
      }

      // Check partners
      if (event.partners) {
        for (const partner of event.partners) {
          const partnerMatch = this.calculateMatch(partner, watchlistItem);
          if (partnerMatch.confidence > 0.7) {
            matchedEntities.push({
              watchlistItem,
              matchType: 'partner',
              matchedValue: partner,
              confidence: partnerMatch.confidence,
            });
          }
        }
      }

      // Check competitors
      if (event.competitors) {
        for (const competitor of event.competitors) {
          const competitorMatch = this.calculateMatch(competitor, watchlistItem);
          if (competitorMatch.confidence > 0.7) {
            matchedEntities.push({
              watchlistItem,
              matchType: 'competitor',
              matchedValue: competitor,
              confidence: competitorMatch.confidence,
            });
          }
        }
      }
    }

    // Remove duplicate matches (same watchlist item, same matched value)
    const uniqueMatches = matchedEntities.filter((match, index, array) => {
      return array.findIndex(m => 
        m.watchlistItem.id === match.watchlistItem.id && 
        m.matchedValue === match.matchedValue
      ) === index;
    });

    return {
      eventId: event.id,
      hasMatch: uniqueMatches.length > 0,
      matchedEntities: uniqueMatches,
      totalMatches: uniqueMatches.length,
    };
  }

  /**
   * Calculate match confidence between a value and watchlist item
   */
  private static calculateMatch(
    value: string,
    watchlistItem: WatchlistItem
  ): { confidence: number; matchType: string } {
    if (!value || !watchlistItem.label) {
      return { confidence: 0, matchType: 'none' };
    }

    const normalizedValue = value.toLowerCase().trim();
    const normalizedLabel = watchlistItem.label.toLowerCase().trim();
    const normalizedRefId = watchlistItem.ref_id.toLowerCase().trim();

    // Exact match with label
    if (normalizedValue === normalizedLabel) {
      return { confidence: 1.0, matchType: 'exact_label' };
    }

    // Exact match with ref_id
    if (normalizedValue === normalizedRefId) {
      return { confidence: 1.0, matchType: 'exact_ref_id' };
    }

    // Contains match with label
    if (normalizedValue.includes(normalizedLabel) || normalizedLabel.includes(normalizedValue)) {
      return { confidence: 0.9, matchType: 'contains_label' };
    }

    // Contains match with ref_id
    if (normalizedValue.includes(normalizedRefId) || normalizedRefId.includes(normalizedValue)) {
      return { confidence: 0.9, matchType: 'contains_ref_id' };
    }

    // Word boundary match with label
    const labelWords = normalizedLabel.split(/\s+/);
    const valueWords = normalizedValue.split(/\s+/);
    
    let wordMatches = 0;
    for (const labelWord of labelWords) {
      if (labelWord.length > 2) { // Ignore short words
        for (const valueWord of valueWords) {
          if (valueWord.includes(labelWord) || labelWord.includes(valueWord)) {
            wordMatches++;
            break;
          }
        }
      }
    }

    if (wordMatches > 0) {
      const wordMatchRatio = wordMatches / Math.max(labelWords.length, valueWords.length);
      return { confidence: wordMatchRatio * 0.8, matchType: 'word_match' };
    }

    // Fuzzy match using Levenshtein distance for short strings
    if (normalizedValue.length <= 50 && normalizedLabel.length <= 50) {
      const distance = this.levenshteinDistance(normalizedValue, normalizedLabel);
      const maxLength = Math.max(normalizedValue.length, normalizedLabel.length);
      const similarity = 1 - (distance / maxLength);
      
      if (similarity > 0.8) {
        return { confidence: similarity * 0.7, matchType: 'fuzzy' };
      }
    }

    return { confidence: 0, matchType: 'none' };
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get user's watchlist from database
   */
  private static async getUserWatchlist(userId: string): Promise<WatchlistItem[]> {
    try {
      const supabase = await supabaseServer();
      const { data, error } = await supabase
        .from('watchlists')
        .select('*')
        .eq('owner', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to get user watchlist:', error);
        return [];
      }

      return (data || []).map(item => ({
        id: item.id,
        kind: item.kind as 'attendee' | 'company',
        label: item.label || '',
        ref_id: item.ref_id || '',
        created_at: item.created_at,
      }));
    } catch (error) {
      console.error('Failed to get user watchlist:', error);
      return [];
    }
  }

  /**
   * Get watchlist matches for a single event
   */
  static async getEventWatchlistMatches(
    userId: string,
    event: EventData
  ): Promise<WatchlistMatch> {
    const matches = await this.checkEventsAgainstWatchlist(userId, [event]);
    return matches[0] || {
      eventId: event.id,
      hasMatch: false,
      matchedEntities: [],
      totalMatches: 0,
    };
  }

  /**
   * Get summary of watchlist matches across multiple events
   */
  static async getWatchlistMatchesSummary(
    userId: string,
    events: EventData[]
  ): Promise<{
    totalEvents: number;
    eventsWithMatches: number;
    totalMatches: number;
    matchTypes: Record<string, number>;
    topMatchedEntities: Array<{ entity: string; count: number }>;
  }> {
    const matches = await this.checkEventsAgainstWatchlist(userId, events);
    
    const eventsWithMatches = matches.filter(m => m.hasMatch).length;
    const totalMatches = matches.reduce((sum, m) => sum + m.totalMatches, 0);
    
    const matchTypes: Record<string, number> = {};
    const entityCounts: Record<string, number> = {};
    
    for (const match of matches) {
      for (const entity of match.matchedEntities) {
        matchTypes[entity.matchType] = (matchTypes[entity.matchType] || 0) + 1;
        entityCounts[entity.matchedValue] = (entityCounts[entity.matchedValue] || 0) + 1;
      }
    }
    
    const topMatchedEntities = Object.entries(entityCounts)
      .map(([entity, count]) => ({ entity, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      totalEvents: events.length,
      eventsWithMatches,
      totalMatches,
      matchTypes,
      topMatchedEntities,
    };
  }
}
