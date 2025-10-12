/**
 * Company Speaker Service
 * 
 * Provides services for finding and managing company speakers using
 * the existing enhanced content extraction capabilities.
 */

import { supabaseServer } from '@/lib/supabase-server';
import { CompanySearchService } from './company-search-service';

export interface CompanySpeaker {
  id?: string;
  name: string;
  title?: string;
  company: string;
  email?: string;
  linkedinUrl?: string;
  bio?: string;
  events: SpeakerEvent[];
  totalEvents: number;
  latestEventDate?: string;
  confidence: number;
}

export interface SpeakerEvent {
  eventId: string;
  title: string;
  date: string;
  venue?: string;
  city?: string;
  country?: string;
  participationType: 'speaker' | 'keynote' | 'panelist' | 'moderator';
  sourceUrl: string;
  confidence: number;
}

export interface SpeakerSearchResult {
  speakers: CompanySpeaker[];
  totalEvents: number;
  searchMetadata: {
    searchTime: number;
    sourcesAnalyzed: number;
    lastUpdated: string;
  };
}

/**
 * Company Speaker Service
 */
export class CompanySpeakerService {
  /**
   * Find all speakers associated with a company
   */
  static async findCompanySpeakers(
    companyName: string,
    options: {
      timeRange?: { from: string; to: string };
      includeInactive?: boolean;
      minConfidence?: number;
    } = {}
  ): Promise<SpeakerSearchResult> {
    const startTime = Date.now();
    
    try {
      // Search for events with company participation
      const searchResult = await CompanySearchService.searchCompanySpeakers(
        companyName,
        options.timeRange
      );

      // Process and enhance speaker data
      const speakers = await this.processSpeakerData(
        searchResult.speakers,
        companyName,
        options
      );

      // Filter by confidence if specified
      const filteredSpeakers = options.minConfidence 
        ? speakers.filter(s => s.confidence >= options.minConfidence)
        : speakers;

      return {
        speakers: filteredSpeakers,
        totalEvents: searchResult.totalEvents,
        searchMetadata: {
          searchTime: Date.now() - startTime,
          sourcesAnalyzed: searchResult.totalEvents,
          lastUpdated: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[CompanySpeakerService] Failed to find speakers:', error);
      throw new Error(`Speaker search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process and enhance speaker data
   */
  private static async processSpeakerData(
    rawSpeakers: any[],
    companyName: string,
    options: any
  ): Promise<CompanySpeaker[]> {
    const processedSpeakers: CompanySpeaker[] = [];

    for (const rawSpeaker of rawSpeakers) {
      // Calculate confidence based on multiple factors
      const confidence = this.calculateSpeakerConfidence(rawSpeaker, companyName);

      // Skip if confidence is too low
      if (options.minConfidence && confidence < (options.minConfidence || 0)) {
        continue;
      }

      // Enhance speaker data
      const enhancedSpeaker: CompanySpeaker = {
        name: rawSpeaker.name,
        title: rawSpeaker.title,
        company: rawSpeaker.company,
        events: await this.processSpeakerEvents(rawSpeaker.events),
        totalEvents: rawSpeaker.events.length,
        latestEventDate: this.getLatestEventDate(rawSpeaker.events),
        confidence
      };

      // Try to get additional speaker information from database
      const dbSpeaker = await this.getSpeakerFromDatabase(rawSpeaker.name, companyName);
      if (dbSpeaker) {
        enhancedSpeaker.id = dbSpeaker.id;
        enhancedSpeaker.email = dbSpeaker.email;
        enhancedSpeaker.linkedinUrl = dbSpeaker.linkedin_url;
        enhancedSpeaker.bio = dbSpeaker.bio;
      }

      processedSpeakers.push(enhancedSpeaker);
    }

    // Sort by confidence and total events
    return processedSpeakers.sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      return b.totalEvents - a.totalEvents;
    });
  }

  /**
   * Process speaker events
   */
  private static async processSpeakerEvents(rawEvents: any[]): Promise<SpeakerEvent[]> {
    return rawEvents.map(event => ({
      eventId: this.generateEventId(event.url),
      title: event.title,
      date: event.date,
      participationType: this.determineParticipationType(event),
      sourceUrl: event.url,
      confidence: this.calculateEventConfidence(event)
    }));
  }

  /**
   * Calculate speaker confidence score
   */
  private static calculateSpeakerConfidence(speaker: any, companyName: string): number {
    let confidence = 0.5; // Base confidence

    // Company name match quality
    const companyMatch = this.calculateCompanyMatch(speaker.company, companyName);
    confidence += companyMatch * 0.3;

    // Number of events (more events = higher confidence)
    const eventCount = speaker.events.length;
    confidence += Math.min(eventCount * 0.05, 0.2);

    // Title presence (speakers with titles are more likely to be real)
    if (speaker.title && speaker.title.trim().length > 0) {
      confidence += 0.1;
    }

    // Recent activity (more recent = higher confidence)
    const latestDate = this.getLatestEventDate(speaker.events);
    if (latestDate) {
      const daysSinceLatest = (Date.now() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLatest < 365) { // Within last year
        confidence += 0.1;
      }
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
   * Determine participation type from event data
   */
  private static determineParticipationType(event: any): SpeakerEvent['participationType'] {
    const title = (event.title || '').toLowerCase();
    const url = (event.url || '').toLowerCase();

    if (title.includes('keynote') || url.includes('keynote')) {
      return 'keynote';
    }
    if (title.includes('panel') || url.includes('panel')) {
      return 'panelist';
    }
    if (title.includes('moderator') || url.includes('moderator')) {
      return 'moderator';
    }
    return 'speaker';
  }

  /**
   * Calculate event confidence score
   */
  private static calculateEventConfidence(event: any): number {
    let confidence = 0.5; // Base confidence

    // Event title quality
    if (event.title && event.title.trim().length > 10) {
      confidence += 0.2;
    }

    // Date presence
    if (event.date && event.date !== 'Unknown Date') {
      confidence += 0.2;
    }

    // URL quality
    if (event.url && event.url.startsWith('http')) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Get latest event date
   */
  private static getLatestEventDate(events: any[]): string | undefined {
    if (events.length === 0) return undefined;

    const validDates = events
      .map(e => e.date)
      .filter(date => date && date !== 'Unknown Date')
      .map(date => new Date(date))
      .filter(date => !isNaN(date.getTime()));

    if (validDates.length === 0) return undefined;

    return new Date(Math.max(...validDates.map(d => d.getTime()))).toISOString();
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
   * Get speaker from database
   */
  private static async getSpeakerFromDatabase(
    speakerName: string,
    companyName: string
  ): Promise<any | null> {
    try {
      const supabase = await supabaseServer();
      
      // First, find the account
      const { data: account } = await supabase
        .from('accounts')
        .select('id')
        .ilike('name', `%${companyName}%`)
        .single();

      if (!account) return null;

      // Find the speaker
      const { data: speaker } = await supabase
        .from('account_speakers')
        .select('*')
        .eq('account_id', account.id)
        .ilike('speaker_name', `%${speakerName}%`)
        .single();

      return speaker;
    } catch (error) {
      console.warn('[CompanySpeakerService] Failed to get speaker from database:', error);
      return null;
    }
  }

  /**
   * Save speaker to database
   */
  static async saveSpeaker(
    accountId: string,
    speaker: Omit<CompanySpeaker, 'id' | 'events' | 'totalEvents' | 'latestEventDate' | 'confidence'>
  ): Promise<string> {
    try {
      const supabase = await supabaseServer();
      
      const { data, error } = await supabase
        .from('account_speakers')
        .insert({
          account_id: accountId,
          speaker_name: speaker.name,
          speaker_title: speaker.title,
          speaker_company: speaker.company,
          email: speaker.email,
          linkedin_url: speaker.linkedinUrl,
          bio: speaker.bio
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('[CompanySpeakerService] Failed to save speaker:', error);
      throw new Error(`Failed to save speaker: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update speaker in database
   */
  static async updateSpeaker(
    speakerId: string,
    updates: Partial<Omit<CompanySpeaker, 'id' | 'events' | 'totalEvents' | 'latestEventDate' | 'confidence'>>
  ): Promise<void> {
    try {
      const supabase = await supabaseServer();
      
      const { error } = await supabase
        .from('account_speakers')
        .update({
          speaker_name: updates.name,
          speaker_title: updates.title,
          speaker_company: updates.company,
          email: updates.email,
          linkedin_url: updates.linkedinUrl,
          bio: updates.bio
        })
        .eq('id', speakerId);

      if (error) throw error;
    } catch (error) {
      console.error('[CompanySpeakerService] Failed to update speaker:', error);
      throw new Error(`Failed to update speaker: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete speaker from database
   */
  static async deleteSpeaker(speakerId: string): Promise<void> {
    try {
      const supabase = await supabaseServer();
      
      const { error } = await supabase
        .from('account_speakers')
        .delete()
        .eq('id', speakerId);

      if (error) throw error;
    } catch (error) {
      console.error('[CompanySpeakerService] Failed to delete speaker:', error);
      throw new Error(`Failed to delete speaker: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
