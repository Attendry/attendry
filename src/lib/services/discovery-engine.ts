/**
 * PHASE 0: Proactive Discovery Engine
 * 
 * Background service that proactively discovers events based on user profiles,
 * matches speakers to target accounts/ICP with confidence scoring, and creates
 * opportunities for users to review.
 * 
 * This runs in "shadow mode" during Phase 0 - it discovers and stores opportunities
 * but doesn't alert users yet, allowing us to validate matching accuracy.
 */

import { supabaseServer } from '@/lib/supabase-server';
import { SearchService } from './search-service';
import { normalizeOrg, orgSimilarity } from '@/lib/utils/org-normalizer';
import { levenshteinSimilarity } from '@/lib/utils/levenshtein';
import { TemporalIntelligenceEngine } from './temporal-intelligence-engine';
import { CriticalAlertsService } from './critical-alerts-service';
import { CostOptimizationService } from './cost-optimization-service';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface DiscoveryProfile {
  id: string;
  user_id: string;
  industries: string[];
  event_types: string[];
  regions: string[];
  date_range_days: number;
  target_titles: string[];
  target_companies: string[];
  competitors: string[];
  discovery_frequency: 'hourly' | 'daily' | 'weekly';
  min_relevance_score: number;
  enable_critical_alerts: boolean;
}

export interface EventData {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  city: string | null;
  country: string | null;
  venue: string | null;
  organizer: string | null;
  description: string | null;
  topics: string[] | null;
  speakers: any; // JSONB - Array of { name, org, title, ... }
  source_url: string;
}

export interface SpeakerInfo {
  name: string;
  org?: string;
  title?: string;
  [key: string]: any;
}

export interface AccountConnection {
  account_name: string;
  account_id?: string;
  confidence_score: number; // 0-100
  verification_source: 'exact_match' | 'domain_match' | 'linkedin_verified' | 'fuzzy_match';
  speakers: Array<{
    name: string;
    title: string;
    match_reason: string;
  }>;
}

export interface OpportunitySignals {
  target_accounts_attending: number;
  icp_matches: number;
  competitor_presence: boolean;
  account_connections: AccountConnection[];
}

export interface Opportunity {
  id?: string;
  user_id: string;
  event_id: string;
  signals: OpportunitySignals;
  relevance: {
    score: number; // 0-100
    reasons: string[];
    signal_strength: 'strong' | 'medium' | 'weak';
  };
  status: 'new' | 'viewed' | 'saved' | 'actioned' | 'dismissed';
  dismissal_reason?: 'not_icp' | 'irrelevant_event' | 'already_know' | 'bad_match';
  discovery_method: 'profile_match' | 'account_match' | 'watchlist_match' | 'smart_backfill';
  created_at?: string;
}

export interface DiscoveryResult {
  eventsDiscovered: number;
  opportunitiesCreated: number;
  highSignalOpportunities: number;
  durationMs: number;
}

export interface CompanyMatchResult {
  matched: boolean;
  confidence: number; // 0-100
  source: 'exact_match' | 'domain_match' | 'linkedin_verified' | 'fuzzy_match';
  matchedCompany: string;
}

// ============================================================================
// Discovery Engine Class
// ============================================================================

export class DiscoveryEngine {
  /**
   * Main discovery loop (runs on schedule)
   * 
   * @param userId User ID to run discovery for
   * @returns Discovery result with statistics
   */
  static async runDiscovery(userId: string): Promise<DiscoveryResult> {
    const startTime = Date.now();
    
    console.log(JSON.stringify({
      at: 'discovery_engine_start',
      userId,
      timestamp: new Date().toISOString()
    }));

    try {
      // 1. Get discovery profile
      const profile = await this.getDiscoveryProfile(userId);
      if (!profile) {
        console.log(JSON.stringify({
          at: 'discovery_engine_no_profile',
          userId,
          error: 'No discovery profile found'
        }));
        return {
          eventsDiscovered: 0,
          opportunitiesCreated: 0,
          highSignalOpportunities: 0,
          durationMs: Date.now() - startTime
        };
      }

      // 2. Build search query from profile
      const query = this.buildProfileQuery(profile);
      
      // 3. Run search (using existing SearchService)
      const events = await this.searchEvents(query, profile);
      
      // 4. Enrich events with speaker data (already in events, but validate)
      const enrichedEvents = await this.enrichSpeakers(events);
      
      // 5. Match speakers to user's accounts/ICP with CONFIDENCE SCORING
      const opportunities = await this.matchToProfile(enrichedEvents, profile);
      
      // 6. Score relevance
      const scoredOpportunities = await this.scoreRelevance(opportunities, profile);
      
      // 7. Store opportunities with temporal intelligence and critical alerts
      await this.storeOrAlert(userId, scoredOpportunities, profile, false);
      
      // 8. Log discovery run
      const durationMs = Date.now() - startTime;
      await this.logDiscoveryRun(userId, profile.id, {
        query,
        eventsDiscovered: events.length,
        opportunitiesCreated: scoredOpportunities.length,
        highSignalOpportunities: scoredOpportunities.filter(o => o.relevance.score >= 70).length,
        durationMs
      });

      console.log(JSON.stringify({
        at: 'discovery_engine_complete',
        userId,
        eventsDiscovered: events.length,
        opportunitiesCreated: scoredOpportunities.length,
        highSignalOpportunities: scoredOpportunities.filter(o => o.relevance.score >= 70).length,
        durationMs
      }));

      return {
        eventsDiscovered: events.length,
        opportunitiesCreated: scoredOpportunities.length,
        highSignalOpportunities: scoredOpportunities.filter(o => o.relevance.score >= 70).length,
        durationMs
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      console.error(JSON.stringify({
        at: 'discovery_engine_error',
        userId,
        error: error instanceof Error ? error.message : String(error),
        durationMs
      }));
      
      // Log failed run
      const profile = await this.getDiscoveryProfile(userId);
      if (profile) {
        await this.logDiscoveryRun(userId, profile.id, {
          query: '',
          eventsDiscovered: 0,
          opportunitiesCreated: 0,
          highSignalOpportunities: 0,
          durationMs,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      }

      throw error;
    }
  }

  /**
   * Get discovery profile for user
   */
  private static async getDiscoveryProfile(userId: string): Promise<DiscoveryProfile | null> {
    try {
      const supabase = await supabaseServer();
      const { data, error } = await supabase
        .from('user_discovery_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        user_id: data.user_id,
        industries: data.industries || [],
        event_types: data.event_types || [],
        regions: data.regions || [],
        date_range_days: data.date_range_days || 90,
        target_titles: data.target_titles || [],
        target_companies: data.target_companies || [],
        competitors: data.competitors || [],
        discovery_frequency: data.discovery_frequency || 'daily',
        min_relevance_score: data.min_relevance_score || 50,
        enable_critical_alerts: data.enable_critical_alerts ?? true
      };
    } catch (error) {
      console.error('[discovery-engine] Error getting discovery profile:', error);
      return null;
    }
  }

  /**
   * Build search query from discovery profile
   */
  private static buildProfileQuery(profile: DiscoveryProfile): string {
    // Combine industries, event types, and regions into a search query
    const terms: string[] = [];

    // Add industries
    if (profile.industries.length > 0) {
      terms.push(...profile.industries);
    }

    // Add event types
    if (profile.event_types.length > 0) {
      terms.push(...profile.event_types.map(t => `${t} conference`));
    } else {
      // Default event types if none specified
      terms.push('conference', 'summit', 'event');
    }

    // Combine into query
    const query = terms.join(' ');

    return query || 'conference event';
  }

  /**
   * Search for events using existing SearchService with cost optimization
   */
  private static async searchEvents(
    query: string,
    profile: DiscoveryProfile
  ): Promise<EventData[]> {
    try {
      // Calculate date range
      const today = new Date();
      const fromDate = today.toISOString().split('T')[0];
      const toDate = new Date(today.getTime() + profile.date_range_days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      // Use first region or default
      const country = profile.regions.length > 0 ? profile.regions[0] : '';

      // Check shared cache first (cost optimization)
      const cacheKey = `${query}|${country}|${fromDate}|${toDate}`;
      const cachedResults = await CostOptimizationService.getCachedResults(cacheKey, country);
      
      if (cachedResults) {
        console.log('[discovery-engine] Cache hit for query:', query);
        return cachedResults;
      }

      // Use existing SearchService
      const searchResult = await SearchService.runEventDiscovery({
        q: query,
        country,
        from: fromDate,
        to: toDate,
        provider: 'cse'
      });

      // Convert to EventData format
      const events: EventData[] = (searchResult.events || []).map((event: any) => ({
        id: event.id || '',
        title: event.title || '',
        starts_at: event.starts_at || null,
        ends_at: event.ends_at || null,
        city: event.city || null,
        country: event.country || null,
        venue: event.venue || null,
        organizer: event.organizer || null,
        description: event.description || null,
        topics: event.topics || null,
        speakers: event.speakers || [],
        source_url: event.source_url || event.url || ''
      }));

      // Cache results for future use (cost optimization)
      await CostOptimizationService.cacheResults(cacheKey, country, events);

      return events;
    } catch (error) {
      console.error('[discovery-engine] Error searching events:', error);
      return [];
    }
  }

  /**
   * Enrich events with speaker data (validate speakers are present)
   */
  private static async enrichSpeakers(events: EventData[]): Promise<EventData[]> {
    // Speakers are already in events from search, but we validate here
    // In future, we could enrich with additional speaker data
    return events.filter(event => {
      // Only include events with speakers
      const speakers = Array.isArray(event.speakers) ? event.speakers : [];
      return speakers.length > 0;
    });
  }

  /**
   * Match speakers to user's profile with Confidence Scoring
   */
  private static async matchToProfile(
    events: EventData[],
    profile: DiscoveryProfile
  ): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];

    for (const event of events) {
      const signals: OpportunitySignals = {
        target_accounts_attending: 0,
        icp_matches: 0,
        competitor_presence: false,
        account_connections: []
      };

      const speakers = Array.isArray(event.speakers) ? event.speakers : [];
      
      // Track matched accounts to avoid duplicates
      const matchedAccounts = new Map<string, AccountConnection>();

      // Check each speaker
      for (const speaker of speakers) {
        const speakerInfo: SpeakerInfo = {
          name: speaker.name || '',
          org: speaker.org || speaker.organization || '',
          title: speaker.title || ''
        };

        // Match to target companies (Watchlist)
        if (speakerInfo.org && profile.target_companies.length > 0) {
          const companyMatch = this.matchCompany(speakerInfo.org, profile.target_companies);
          
          if (companyMatch.matched) {
            const accountName = companyMatch.matchedCompany;
            
            // Get or create account connection
            let accountConn = matchedAccounts.get(accountName);
            if (!accountConn) {
              accountConn = {
                account_name: accountName,
                confidence_score: companyMatch.confidence,
                verification_source: companyMatch.source,
                speakers: []
              };
              matchedAccounts.set(accountName, accountConn);
              signals.target_accounts_attending++;
            }

            // Add speaker to account connection
            accountConn.speakers.push({
              name: speakerInfo.name,
              title: speakerInfo.title || '',
              match_reason: 'Target account'
            });
          }
        }

        // Match to ICP (target titles)
        if (speakerInfo.title && profile.target_titles.length > 0) {
          const titleMatch = this.matchTitle(speakerInfo.title, profile.target_titles);
          if (titleMatch) {
            signals.icp_matches++;
          }
        }

        // Check for competitors
        if (speakerInfo.org && profile.competitors.length > 0) {
          const competitorMatch = this.matchCompany(speakerInfo.org, profile.competitors);
          if (competitorMatch.matched) {
            signals.competitor_presence = true;
          }
        }
      }

      // Convert matched accounts map to array
      signals.account_connections = Array.from(matchedAccounts.values());

      // Only create opportunity if there are signals above threshold
      if (signals.target_accounts_attending > 0 || signals.icp_matches > 0) {
        opportunities.push({
          user_id: profile.user_id,
          event_id: event.id,
          signals,
          relevance: {
            score: 0, // Will be calculated in scoreRelevance
            reasons: [],
            signal_strength: 'weak'
          },
          status: 'new',
          discovery_method: signals.target_accounts_attending > 0 ? 'watchlist_match' : 'profile_match'
        });
      }
    }

    return opportunities;
  }

  /**
   * Match company with confidence scoring
   */
  private static matchCompany(
    speakerCompany: string,
    targetCompanies: string[]
  ): CompanyMatchResult {
    if (!speakerCompany || targetCompanies.length === 0) {
      return { matched: false, confidence: 0, source: 'fuzzy_match', matchedCompany: '' };
    }

    const normalizedSpeakerCompany = normalizeOrg(speakerCompany).toLowerCase();

    // Try exact match first
    for (const targetCompany of targetCompanies) {
      const normalizedTarget = normalizeOrg(targetCompany).toLowerCase();
      
      if (normalizedSpeakerCompany === normalizedTarget) {
        return {
          matched: true,
          confidence: 100,
          source: 'exact_match',
          matchedCompany: targetCompany
        };
      }
    }

    // Try domain match (extract domain from company name)
    // This is a simplified check - in production, you'd extract actual domains
    const speakerWords = normalizedSpeakerCompany.split(/\s+/);
    for (const targetCompany of targetCompanies) {
      const normalizedTarget = normalizeOrg(targetCompany).toLowerCase();
      const targetWords = normalizedTarget.split(/\s+/);
      
      // Check if key words match (domain-like matching)
      const matchingWords = speakerWords.filter(w => 
        targetWords.some(tw => tw.includes(w) || w.includes(tw))
      );
      
      if (matchingWords.length >= 2) {
        return {
          matched: true,
          confidence: 90,
          source: 'domain_match',
          matchedCompany: targetCompany
        };
      }
    }

    // Try fuzzy match using org similarity
    let bestMatch: { company: string; similarity: number } | null = null;
    
    for (const targetCompany of targetCompanies) {
      const similarity = orgSimilarity(speakerCompany, targetCompany);
      if (similarity > 0.8 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { company: targetCompany, similarity };
      }
    }

    if (bestMatch && bestMatch.similarity > 0.8) {
      return {
        matched: true,
        confidence: Math.round(bestMatch.similarity * 80), // 0.8 similarity = 64% confidence
        source: 'fuzzy_match',
        matchedCompany: bestMatch.company
      };
    }

    // Try Levenshtein similarity for very similar names
    for (const targetCompany of targetCompanies) {
      const similarity = levenshteinSimilarity(
        normalizedSpeakerCompany,
        normalizeOrg(targetCompany).toLowerCase()
      );
      
      if (similarity > 0.85) {
        return {
          matched: true,
          confidence: Math.round(similarity * 70), // 0.85 similarity = 59% confidence
          source: 'fuzzy_match',
          matchedCompany: targetCompany
        };
      }
    }

    return { matched: false, confidence: 0, source: 'fuzzy_match', matchedCompany: '' };
  }

  /**
   * Match title to ICP
   */
  private static matchTitle(speakerTitle: string, targetTitles: string[]): boolean {
    if (!speakerTitle || targetTitles.length === 0) return false;

    const normalizedTitle = speakerTitle.toLowerCase();

    for (const targetTitle of targetTitles) {
      const normalizedTarget = targetTitle.toLowerCase();
      
      // Exact match
      if (normalizedTitle === normalizedTarget) return true;
      
      // Contains match
      if (normalizedTitle.includes(normalizedTarget) || normalizedTarget.includes(normalizedTitle)) {
        return true;
      }
      
      // Word match (check if key words from target title appear in speaker title)
      const targetWords = normalizedTarget.split(/\s+/).filter(w => w.length > 3);
      const matchingWords = targetWords.filter(w => normalizedTitle.includes(w));
      
      if (matchingWords.length >= targetWords.length * 0.5) {
        return true;
      }
    }

    return false;
  }

  /**
   * Score relevance of opportunities
   */
  private static async scoreRelevance(
    opportunities: Opportunity[],
    profile: DiscoveryProfile
  ): Promise<Opportunity[]> {
    return opportunities.map(opp => {
      let score = 0;
      const reasons: string[] = [];

      // Base score from account matches
      if (opp.signals.target_accounts_attending > 0) {
        const avgConfidence = opp.signals.account_connections.reduce(
          (sum, ac) => sum + ac.confidence_score,
          0
        ) / opp.signals.account_connections.length;

        score += Math.min(60, avgConfidence * 0.6); // Up to 60 points for account matches
        reasons.push(`${opp.signals.target_accounts_attending} target account(s) attending`);
      }

      // Add score for ICP matches
      if (opp.signals.icp_matches > 0) {
        score += Math.min(30, opp.signals.icp_matches * 5); // Up to 30 points for ICP matches
        reasons.push(`${opp.signals.icp_matches} ICP match(es)`);
      }

      // Bonus for high confidence matches
      const highConfidenceMatches = opp.signals.account_connections.filter(
        ac => ac.confidence_score >= 90
      ).length;
      if (highConfidenceMatches > 0) {
        score += Math.min(10, highConfidenceMatches * 2); // Up to 10 bonus points
        reasons.push(`${highConfidenceMatches} high-confidence match(es)`);
      }

      // Determine signal strength
      let signalStrength: 'strong' | 'medium' | 'weak' = 'weak';
      if (score >= 70) signalStrength = 'strong';
      else if (score >= 50) signalStrength = 'medium';

      opp.relevance = {
        score: Math.min(100, Math.round(score)),
        reasons,
        signal_strength: signalStrength
      };

      return opp;
    });
  }

  /**
   * Store opportunities or trigger Critical Alert
   */
  private static async storeOrAlert(
    userId: string,
    opportunities: Opportunity[],
    profile: DiscoveryProfile,
    shadowMode: boolean = false
  ): Promise<void> {
    const supabase = await supabaseServer();

    for (const opp of opportunities) {
      // Only store if relevance score meets minimum threshold
      if (opp.relevance.score < profile.min_relevance_score) {
        continue;
      }

      try {
        // Upsert opportunity
        const { error } = await supabase
          .from('user_opportunities')
          .upsert({
            user_id: opp.user_id,
            event_id: opp.event_id,
            target_accounts_attending: opp.signals.target_accounts_attending,
            icp_matches: opp.signals.icp_matches,
            competitor_presence: opp.signals.competitor_presence,
            account_connections: opp.signals.account_connections,
            relevance_score: opp.relevance.score,
            relevance_reasons: opp.relevance.reasons,
            signal_strength: opp.relevance.signal_strength,
            status: opp.status,
            discovery_method: opp.discovery_method,
            last_enriched_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,event_id'
          });

        if (error) {
          console.error('[discovery-engine] Error storing opportunity:', error);
          continue;
        }

        // Send critical alerts for high-confidence watchlist matches
        if (!shadowMode) {
          const hasHighConfidenceWatchlist = opp.signals.account_connections.some(
            ac => ac.confidence_score > 80
          );

          if (hasHighConfidenceWatchlist && profile.enable_critical_alerts) {
            // Get event details for alert (non-blocking)
            supabase
              .from('collected_events')
              .select('title, starts_at')
              .eq('id', opp.event_id)
              .single()
              .then(({ data: event }) => {
                if (event) {
                  CriticalAlertsService.sendCriticalAlert({
                    userId,
                    opportunity: opp,
                    eventTitle: event.title,
                    eventDate: event.starts_at,
                    matchedAccounts: opp.signals.account_connections
                      .filter(ac => ac.confidence_score > 80)
                      .map(ac => ({
                        account_name: ac.account_name,
                        confidence_score: ac.confidence_score,
                        speakers: ac.speakers
                      }))
                  }).catch(err => {
                    console.error('[discovery-engine] Error sending critical alert:', err);
                  });
                }
              })
              .catch(err => {
                console.error('[discovery-engine] Error fetching event for alert:', err);
              });
          }
        }
      } catch (error) {
        console.error('[discovery-engine] Exception storing opportunity:', error);
      }
    }
  }

  /**
   * Log discovery run to database
   */
  private static async logDiscoveryRun(
    userId: string,
    profileId: string,
    details: {
      query: string;
      eventsDiscovered: number;
      opportunitiesCreated: number;
      highSignalOpportunities: number;
      durationMs: number;
      status?: 'success' | 'partial' | 'failed';
      errorMessage?: string;
    }
  ): Promise<void> {
    try {
      const supabase = await supabaseServer();
      const { error } = await supabase
        .from('discovery_run_logs')
        .insert({
          user_id: userId,
          profile_id: profileId,
          query_used: details.query,
          events_discovered: details.eventsDiscovered,
          opportunities_created: details.opportunitiesCreated,
          opportunities_high_signal: details.highSignalOpportunities,
          duration_ms: details.durationMs,
          status: details.status || 'success',
          error_message: details.errorMessage || null
        });

      if (error) {
        console.error('[discovery-engine] Error logging discovery run:', error);
      }
    } catch (error) {
      console.error('[discovery-engine] Exception logging discovery run:', error);
    }
  }
}

