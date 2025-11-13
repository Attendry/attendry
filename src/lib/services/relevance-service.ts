import { supabaseServer } from '@/lib/supabase-server';

export interface UserProfile {
  id: string;
  full_name?: string;
  company?: string;
  competitors: string[];
  icp_terms: string[];
  industry_terms: string[];
  use_in_basic_search: boolean;
}

export interface EventData {
  id: string;
  title: string;
  starts_at?: string;
  ends_at?: string;
  city?: string;
  country?: string;
  venue?: string;
  organizer?: string;
  description?: string;
  topics?: string[];
  speakers?: any[];
  sponsors?: any[];
  participating_organizations?: string[];
  partners?: string[];
  competitors?: string[];
  confidence?: number;
  data_completeness?: number;
}

export interface RelevanceScore {
  eventId: string;
  score: number;
  reasons: string[];
  matchedTerms: {
    industry: string[];
    icp: string[];
    competitors: string[];
  };
}

export class RelevanceService {
  /**
   * Calculate relevance score for events based on user profile
   */
  static async calculateRelevanceScores(
    events: EventData[],
    userProfile: UserProfile
  ): Promise<RelevanceScore[]> {
    const scores: RelevanceScore[] = [];

    for (const event of events) {
      const score = this.calculateEventRelevance(event, userProfile);
      scores.push(score);
    }

    // Sort by relevance score (highest first)
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate relevance score for a single event
   */
  static calculateEventRelevance(
    event: EventData,
    userProfile: UserProfile
  ): RelevanceScore {
    let totalScore = 0;
    const reasons: string[] = [];
    const matchedTerms = {
      industry: [] as string[],
      icp: [] as string[],
      competitors: [] as string[],
    };

    // 1. Industry Terms Match (40% weight)
    const industryScore = this.calculateIndustryMatch(event, userProfile.industry_terms);
    if (industryScore.score > 0) {
      totalScore += industryScore.score * 0.4;
      reasons.push(...industryScore.reasons);
      matchedTerms.industry.push(...industryScore.matchedTerms);
    }

    // 2. ICP Terms Match (30% weight)
    const icpScore = this.calculateICPMatch(event, userProfile.icp_terms);
    if (icpScore.score > 0) {
      totalScore += icpScore.score * 0.3;
      reasons.push(...icpScore.reasons);
      matchedTerms.icp.push(...icpScore.matchedTerms);
    }

    // 3. Competitor Presence (20% weight)
    const competitorScore = this.calculateCompetitorMatch(event, userProfile.competitors);
    if (competitorScore.score > 0) {
      totalScore += competitorScore.score * 0.2;
      reasons.push(...competitorScore.reasons);
      matchedTerms.competitors.push(...competitorScore.matchedTerms);
    }

    // 4. Data Quality Bonus (10% weight)
    const qualityScore = this.calculateDataQuality(event);
    totalScore += qualityScore * 0.1;
    if (qualityScore > 0.7) {
      reasons.push('High data quality');
    }

    // 5. Recency Bonus (up to 5% bonus)
    const recencyBonus = this.calculateRecencyBonus(event);
    totalScore += recencyBonus;
    if (recencyBonus > 0) {
      reasons.push('Upcoming event');
    }

    return {
      eventId: event.id,
      score: Math.min(totalScore, 1.0), // Cap at 1.0
      reasons,
      matchedTerms,
    };
  }

  /**
   * Calculate industry terms match score
   */
  private static calculateIndustryMatch(
    event: EventData,
    industryTerms: string[]
  ): { score: number; reasons: string[]; matchedTerms: string[] } {
    if (!industryTerms.length) {
      return { score: 0, reasons: [], matchedTerms: [] };
    }

    const reasons: string[] = [];
    const matchedTerms: string[] = [];
    let score = 0;

    // Check event topics
    if (event.topics) {
      for (const topic of event.topics) {
        for (const industryTerm of industryTerms) {
          if (this.isTermMatch(topic, industryTerm)) {
            score += 0.3;
            reasons.push(`Topic matches industry: ${topic}`);
            matchedTerms.push(industryTerm);
          }
        }
      }
    }

    // Check event description
    if (event.description) {
      for (const industryTerm of industryTerms) {
        if (this.isTermMatch(event.description, industryTerm)) {
          score += 0.2;
          reasons.push(`Description mentions: ${industryTerm}`);
          matchedTerms.push(industryTerm);
        }
      }
    }

    // Check event title
    if (event.title) {
      for (const industryTerm of industryTerms) {
        if (this.isTermMatch(event.title, industryTerm)) {
          score += 0.4;
          reasons.push(`Title contains: ${industryTerm}`);
          matchedTerms.push(industryTerm);
        }
      }
    }

    return {
      score: Math.min(score, 1.0),
      reasons,
      matchedTerms: [...new Set(matchedTerms)], // Remove duplicates
    };
  }

  /**
   * Calculate ICP terms match score
   */
  private static calculateICPMatch(
    event: EventData,
    icpTerms: string[]
  ): { score: number; reasons: string[]; matchedTerms: string[] } {
    if (!icpTerms.length) {
      return { score: 0, reasons: [], matchedTerms: [] };
    }

    const reasons: string[] = [];
    const matchedTerms: string[] = [];
    let score = 0;

    // Check event description
    if (event.description) {
      for (const icpTerm of icpTerms) {
        if (this.isTermMatch(event.description, icpTerm)) {
          score += 0.3;
          reasons.push(`Description mentions ICP: ${icpTerm}`);
          matchedTerms.push(icpTerm);
        }
      }
    }

    // Check speakers
    if (event.speakers) {
      for (const speaker of event.speakers) {
        const speakerText = `${speaker.name || ''} ${speaker.org || ''} ${speaker.title || ''}`;
        for (const icpTerm of icpTerms) {
          if (this.isTermMatch(speakerText, icpTerm)) {
            score += 0.2;
            reasons.push(`Speaker matches ICP: ${icpTerm}`);
            matchedTerms.push(icpTerm);
          }
        }
      }
    }

    // Check participating organizations
    if (event.participating_organizations) {
      for (const org of event.participating_organizations) {
        for (const icpTerm of icpTerms) {
          if (this.isTermMatch(org, icpTerm)) {
            score += 0.25;
            reasons.push(`Organization matches ICP: ${icpTerm}`);
            matchedTerms.push(icpTerm);
          }
        }
      }
    }

    return {
      score: Math.min(score, 1.0),
      reasons,
      matchedTerms: [...new Set(matchedTerms)],
    };
  }

  /**
   * Calculate competitor presence score
   */
  private static calculateCompetitorMatch(
    event: EventData,
    competitors: string[]
  ): { score: number; reasons: string[]; matchedTerms: string[] } {
    if (!competitors.length) {
      return { score: 0, reasons: [], matchedTerms: [] };
    }

    const reasons: string[] = [];
    const matchedTerms: string[] = [];
    let score = 0;

    // Check sponsors
    if (event.sponsors) {
      for (const sponsor of event.sponsors) {
        for (const competitor of competitors) {
          if (this.isTermMatch(sponsor.name || '', competitor)) {
            score += 0.4;
            reasons.push(`Competitor is sponsor: ${competitor}`);
            matchedTerms.push(competitor);
          }
        }
      }
    }

    // Check participating organizations
    if (event.participating_organizations) {
      for (const org of event.participating_organizations) {
        for (const competitor of competitors) {
          if (this.isTermMatch(org, competitor)) {
            score += 0.3;
            reasons.push(`Competitor participating: ${competitor}`);
            matchedTerms.push(competitor);
          }
        }
      }
    }

    // Check speakers
    if (event.speakers) {
      for (const speaker of event.speakers) {
        for (const competitor of competitors) {
          if (this.isTermMatch(speaker.org || '', competitor)) {
            score += 0.2;
            reasons.push(`Competitor speaker: ${competitor}`);
            matchedTerms.push(competitor);
          }
        }
      }
    }

    return {
      score: Math.min(score, 1.0),
      reasons,
      matchedTerms: [...new Set(matchedTerms)],
    };
  }

  /**
   * Calculate data quality score
   */
  private static calculateDataQuality(event: EventData): number {
    let qualityScore = 0;

    // Base score from confidence
    if (event.confidence) {
      qualityScore += event.confidence * 0.4;
    }

    // Base score from data completeness
    if (event.data_completeness) {
      qualityScore += event.data_completeness * 0.3;
    }

    // Bonus for having key fields
    if (event.title) qualityScore += 0.1;
    if (event.description) qualityScore += 0.1;
    if (event.speakers && event.speakers.length > 0) qualityScore += 0.05;
    if (event.sponsors && event.sponsors.length > 0) qualityScore += 0.05;

    return Math.min(qualityScore, 1.0);
  }

  /**
   * Calculate recency bonus
   */
  private static calculateRecencyBonus(event: EventData): number {
    if (!event.starts_at) return 0;

    const eventDate = new Date(event.starts_at);
    const now = new Date();
    const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Bonus for events in the next 30 days
    if (daysUntilEvent >= 0 && daysUntilEvent <= 30) {
      return 0.05;
    }

    // Bonus for events in the next 90 days
    if (daysUntilEvent >= 0 && daysUntilEvent <= 90) {
      return 0.02;
    }

    return 0;
  }

  /**
   * Check if a term matches (case-insensitive, partial match)
   */
  private static isTermMatch(text: string, term: string): boolean {
    if (!text || !term) return false;
    
    const normalizedText = text.toLowerCase().trim();
    const normalizedTerm = term.toLowerCase().trim();
    
    // Exact match
    if (normalizedText === normalizedTerm) return true;
    
    // Contains match
    if (normalizedText.includes(normalizedTerm)) return true;
    
    // Word boundary match (more precise)
    const wordBoundaryRegex = new RegExp(`\\b${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return wordBoundaryRegex.test(normalizedText);
  }

  /**
   * Get user profile from database
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const supabase = await supabaseServer();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        full_name: data.full_name,
        company: data.company,
        competitors: data.competitors || [],
        icp_terms: data.icp_terms || [],
        industry_terms: data.industry_terms || [],
        use_in_basic_search: data.use_in_basic_search ?? true,
      };
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }

  /**
   * Get relevant events from collected_events table
   */
  static async getRelevantEvents(
    userId: string,
    limit: number = 50,
    daysAhead: number = 90
  ): Promise<{ events: EventData[]; scores: RelevanceScore[] }> {
    try {
      const supabase = await supabaseServer();
      
      // Get user profile
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) {
        return { events: [], scores: [] };
      }

      // Get upcoming events from collected_events
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      const { data: events, error } = await supabase
        .from('collected_events')
        .select('*')
        .gte('starts_at', new Date().toISOString().split('T')[0])
        .lte('starts_at', futureDate.toISOString().split('T')[0])
        .gte('confidence', 0.5) // Only high-confidence events
        .order('starts_at', { ascending: true })
        .limit(limit * 2); // Get more to filter

      if (error || !events) {
        return { events: [], scores: [] };
      }

      // Calculate relevance scores
      const scores = await this.calculateRelevanceScores(events, userProfile);

      // Filter events with relevance score > 0.1 and return top results
      const relevantEvents = scores
        .filter(score => score.score > 0.1)
        .slice(0, limit)
        .map(score => events.find(event => event.id === score.eventId))
        .filter(Boolean) as EventData[];

      const relevantScores = scores
        .filter(score => score.score > 0.1)
        .slice(0, limit);

      return {
        events: relevantEvents,
        scores: relevantScores,
      };
    } catch (error) {
      console.error('Failed to get relevant events:', error);
      return { events: [], scores: [] };
    }
  }
}
