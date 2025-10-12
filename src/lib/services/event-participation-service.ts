/**
 * Event Participation Service
 * 
 * Provides services for detecting and analyzing company participation
 * in events using existing collected_events data and enhanced extraction.
 */

import { supabaseServer } from '@/lib/supabase-server';
import { CompanySearchService } from './company-search-service';

export interface EventParticipation {
  eventId: string;
  title: string;
  date: string;
  venue?: string;
  city?: string;
  country?: string;
  participationType: 'speaker' | 'sponsor' | 'attendee' | 'organizer' | 'partner';
  speakers?: EventSpeaker[];
  confidence: number;
  sourceUrl: string;
  metadata?: {
    industry?: string;
    topics?: string[];
    organizer?: string;
  };
}

export interface EventSpeaker {
  name: string;
  title?: string;
  company: string;
  bio?: string;
  confidence: number;
}

export interface ParticipationSearchResult {
  participations: EventParticipation[];
  totalEvents: number;
  participationTypes: Record<string, number>;
  searchMetadata: {
    searchTime: number;
    sourcesAnalyzed: number;
    lastUpdated: string;
  };
}

export interface CompanyParticipationSummary {
  companyName: string;
  totalEvents: number;
  participationBreakdown: {
    speaker: number;
    sponsor: number;
    attendee: number;
    organizer: number;
    partner: number;
  };
  topEvents: EventParticipation[];
  recentActivity: EventParticipation[];
  industryFocus: string[];
  geographicDistribution: Record<string, number>;
}

/**
 * Event Participation Service
 */
export class EventParticipationService {
  /**
   * Find all events where a company participates
   */
  static async findAccountInEvents(
    companyName: string,
    options: {
      timeRange?: { from: string; to: string };
      participationTypes?: EventParticipation['participationType'][];
      minConfidence?: number;
      limit?: number;
    } = {}
  ): Promise<ParticipationSearchResult> {
    const startTime = Date.now();
    
    try {
      // Search for events with company participation
      const searchResult = await CompanySearchService.searchCompanyIntelligence({
        companyName,
        searchType: 'event_participation',
        timeRange: options.timeRange
      });

      // Process and analyze participation data
      const participations = await this.processParticipationData(
        searchResult.results.searchResults,
        companyName,
        options
      );

      // Calculate participation type breakdown
      const participationTypes = this.calculateParticipationBreakdown(participations);

      return {
        participations: participations.slice(0, options.limit || 100),
        totalEvents: participations.length,
        participationTypes,
        searchMetadata: {
          searchTime: Date.now() - startTime,
          sourcesAnalyzed: searchResult.results.searchResults.length,
          lastUpdated: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[EventParticipationService] Failed to find events:', error);
      throw new Error(`Event participation search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process participation data from search results
   */
  private static async processParticipationData(
    events: any[],
    companyName: string,
    options: any
  ): Promise<EventParticipation[]> {
    const participations: EventParticipation[] = [];

    for (const event of events) {
      const participation = await this.analyzeEventParticipation(event, companyName);
      
      if (participation) {
        // Filter by participation types if specified
        if (options.participationTypes && 
            !options.participationTypes.includes(participation.participationType)) {
          continue;
        }

        // Filter by confidence if specified
        if (options.minConfidence && participation.confidence < options.minConfidence) {
          continue;
        }

        participations.push(participation);
      }
    }

    // Sort by confidence and date
    return participations.sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }

  /**
   * Analyze a single event for company participation
   */
  private static async analyzeEventParticipation(
    event: any,
    companyName: string
  ): Promise<EventParticipation | null> {
    const participationTypes: EventParticipation['participationType'][] = [];
    const speakers: EventSpeaker[] = [];
    let confidence = 0;

    // Check speaker participation
    if (event.speakers && Array.isArray(event.speakers)) {
      for (const speaker of event.speakers) {
        if (speaker.org && this.isCompanyMatch(speaker.org, companyName)) {
          participationTypes.push('speaker');
          speakers.push({
            name: speaker.name,
            title: speaker.title,
            company: speaker.org,
            bio: speaker.bio,
            confidence: this.calculateSpeakerConfidence(speaker, companyName)
          });
          confidence += 0.4; // High confidence for speaker match
        }
      }
    }

    // Check sponsor participation
    if (event.sponsors && Array.isArray(event.sponsors)) {
      for (const sponsor of event.sponsors) {
        if (this.isCompanyMatch(sponsor, companyName)) {
          participationTypes.push('sponsor');
          confidence += 0.3;
        }
      }
    }

    // Check participating organizations
    if (event.participating_organizations && Array.isArray(event.participating_organizations)) {
      for (const org of event.participating_organizations) {
        if (this.isCompanyMatch(org, companyName)) {
          participationTypes.push('attendee');
          confidence += 0.2;
        }
      }
    }

    // Check partners
    if (event.partners && Array.isArray(event.partners)) {
      for (const partner of event.partners) {
        if (this.isCompanyMatch(partner, companyName)) {
          participationTypes.push('partner');
          confidence += 0.25;
        }
      }
    }

    // Check organizer
    if (event.organizer && this.isCompanyMatch(event.organizer, companyName)) {
      participationTypes.push('organizer');
      confidence += 0.35;
    }

    // Check description for company mentions
    if (event.description) {
      const descriptionMatch = this.analyzeDescriptionMention(event.description, companyName);
      if (descriptionMatch.confidence > 0.3) {
        if (!participationTypes.includes(descriptionMatch.type)) {
          participationTypes.push(descriptionMatch.type);
        }
        confidence += descriptionMatch.confidence * 0.2;
      }
    }

    // Only return if we found some participation
    if (participationTypes.length === 0 || confidence < 0.1) {
      return null;
    }

    // Determine primary participation type
    const primaryType = this.determinePrimaryParticipationType(participationTypes);

    return {
      eventId: event.id || this.generateEventId(event.source_url),
      title: event.title || 'Unknown Event',
      date: event.starts_at || new Date().toISOString(),
      venue: event.venue,
      city: event.city,
      country: event.country,
      participationType: primaryType,
      speakers: speakers.length > 0 ? speakers : undefined,
      confidence: Math.min(confidence, 1.0),
      sourceUrl: event.source_url,
      metadata: {
        industry: event.industry,
        topics: event.topics,
        organizer: event.organizer
      }
    };
  }

  /**
   * Check if a company name matches (fuzzy matching)
   */
  private static isCompanyMatch(orgName: string, companyName: string): boolean {
    const normalize = (name: string) => 
      name.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

    const normalizedOrg = normalize(orgName);
    const normalizedCompany = normalize(companyName);

    // Exact match
    if (normalizedOrg === normalizedCompany) {
      return true;
    }

    // Partial match (company name is contained in org name)
    if (normalizedOrg.includes(normalizedCompany) || normalizedCompany.includes(normalizedOrg)) {
      return true;
    }

    // Check for common variations
    const companyWords = normalizedCompany.split(' ');
    const orgWords = normalizedOrg.split(' ');
    
    // If most words match, consider it a match
    const matchingWords = companyWords.filter(word => 
      orgWords.some(orgWord => orgWord.includes(word) || word.includes(orgWord))
    );
    
    return matchingWords.length >= Math.ceil(companyWords.length * 0.7);
  }

  /**
   * Calculate speaker confidence score
   */
  private static calculateSpeakerConfidence(speaker: any, companyName: string): number {
    let confidence = 0.5; // Base confidence

    // Company name match quality
    const companyMatch = this.calculateCompanyMatch(speaker.org, companyName);
    confidence += companyMatch * 0.3;

    // Title presence
    if (speaker.title && speaker.title.trim().length > 0) {
      confidence += 0.1;
    }

    // Bio presence
    if (speaker.bio && speaker.bio.trim().length > 20) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate company name match quality
   */
  private static calculateCompanyMatch(orgName: string, companyName: string): number {
    const normalize = (name: string) => 
      name.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

    const normalizedOrg = normalize(orgName);
    const normalizedCompany = normalize(companyName);

    // Exact match
    if (normalizedOrg === normalizedCompany) {
      return 1.0;
    }

    // Partial match
    if (normalizedOrg.includes(normalizedCompany) || normalizedCompany.includes(normalizedOrg)) {
      return 0.8;
    }

    // Word-based match
    const companyWords = normalizedCompany.split(' ');
    const orgWords = normalizedOrg.split(' ');
    
    const matchingWords = companyWords.filter(word => 
      orgWords.some(orgWord => orgWord.includes(word) || word.includes(orgWord))
    );
    
    return matchingWords.length / companyWords.length;
  }

  /**
   * Analyze description for company mentions
   */
  private static analyzeDescriptionMention(
    description: string,
    companyName: string
  ): { type: EventParticipation['participationType']; confidence: number } {
    const desc = description.toLowerCase();
    const company = companyName.toLowerCase();

    // Check for various participation indicators
    if (desc.includes('keynote') && desc.includes(company)) {
      return { type: 'speaker', confidence: 0.8 };
    }
    if (desc.includes('sponsor') && desc.includes(company)) {
      return { type: 'sponsor', confidence: 0.7 };
    }
    if (desc.includes('organizer') && desc.includes(company)) {
      return { type: 'organizer', confidence: 0.6 };
    }
    if (desc.includes('partner') && desc.includes(company)) {
      return { type: 'partner', confidence: 0.5 };
    }
    if (desc.includes(company)) {
      return { type: 'attendee', confidence: 0.3 };
    }

    return { type: 'attendee', confidence: 0 };
  }

  /**
   * Determine primary participation type
   */
  private static determinePrimaryParticipationType(
    types: EventParticipation['participationType'][]
  ): EventParticipation['participationType'] {
    // Priority order: speaker > organizer > sponsor > partner > attendee
    const priority = {
      speaker: 5,
      organizer: 4,
      sponsor: 3,
      partner: 2,
      attendee: 1
    };

    return types.reduce((primary, current) => 
      priority[current] > priority[primary] ? current : primary
    );
  }

  /**
   * Calculate participation type breakdown
   */
  private static calculateParticipationBreakdown(
    participations: EventParticipation[]
  ): Record<string, number> {
    const breakdown: Record<string, number> = {
      speaker: 0,
      sponsor: 0,
      attendee: 0,
      organizer: 0,
      partner: 0
    };

    for (const participation of participations) {
      breakdown[participation.participationType]++;
    }

    return breakdown;
  }

  /**
   * Generate event ID from URL
   */
  private static generateEventId(url: string): string {
    try {
      const urlObj = new URL(url);
      return `event_${urlObj.hostname}_${urlObj.pathname.replace(/[^a-zA-Z0-9]/g, '_')}`;
    } catch {
      return `event_${url.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
  }

  /**
   * Get company participation summary
   */
  static async getCompanyParticipationSummary(
    companyName: string,
    timeRange?: { from: string; to: string }
  ): Promise<CompanyParticipationSummary> {
    const result = await this.findAccountInEvents(companyName, { timeRange });

    // Calculate breakdown
    const participationBreakdown = {
      speaker: result.participationTypes.speaker || 0,
      sponsor: result.participationTypes.sponsor || 0,
      attendee: result.participationTypes.attendee || 0,
      organizer: result.participationTypes.organizer || 0,
      partner: result.participationTypes.partner || 0
    };

    // Get top events (highest confidence)
    const topEvents = result.participations.slice(0, 10);

    // Get recent activity (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const recentActivity = result.participations.filter(p => 
      new Date(p.date) >= sixMonthsAgo
    ).slice(0, 5);

    // Analyze industry focus
    const industryFocus = this.analyzeIndustryFocus(result.participations);

    // Analyze geographic distribution
    const geographicDistribution = this.analyzeGeographicDistribution(result.participations);

    return {
      companyName,
      totalEvents: result.totalEvents,
      participationBreakdown,
      topEvents,
      recentActivity,
      industryFocus,
      geographicDistribution
    };
  }

  /**
   * Analyze industry focus from events
   */
  private static analyzeIndustryFocus(participations: EventParticipation[]): string[] {
    const industryCounts: Record<string, number> = {};

    for (const participation of participations) {
      if (participation.metadata?.industry) {
        industryCounts[participation.metadata.industry] = 
          (industryCounts[participation.metadata.industry] || 0) + 1;
      }
    }

    return Object.entries(industryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([industry]) => industry);
  }

  /**
   * Analyze geographic distribution
   */
  private static analyzeGeographicDistribution(
    participations: EventParticipation[]
  ): Record<string, number> {
    const countryCounts: Record<string, number> = {};

    for (const participation of participations) {
      if (participation.country) {
        countryCounts[participation.country] = 
          (countryCounts[participation.country] || 0) + 1;
      }
    }

    return countryCounts;
  }
}
