/**
 * Event Prioritization Stage
 * 
 * LLM-based scoring and filtering of discovered URLs
 */

import { EventCandidate, EventPipelineConfig, PrioritizationScore, PrioritizationError } from './types';
import { logger } from '@/utils/logger';
import { parseEventDate } from '@/search/date';

// Import country bias function from fallback
function getCountrySpecificBias(country: string): { searchTerms: string; locationContext?: string } | null {
  const countryUpper = country.toUpperCase();
  
  const biasConfig: Record<string, { searchTerms: string; locationContext?: string }> = {
    'DE': { searchTerms: 'Germany Deutschland Berlin Munich Frankfurt Hamburg Cologne Stuttgart Düsseldorf Leipzig' },
    'FR': { searchTerms: 'France Paris Lyon Marseille Toulouse Nice Nantes' },
    'GB': { searchTerms: 'United Kingdom UK England Scotland Wales London Manchester Birmingham Glasgow Edinburgh' },
    'ES': { searchTerms: 'Spain España Madrid Barcelona Valencia Seville Bilbao' },
    'IT': { searchTerms: 'Italy Italia Rome Milan Naples Turin Florence Venice' },
    'NL': { searchTerms: 'Netherlands Nederland Amsterdam Rotterdam The Hague Utrecht' },
    'AT': { searchTerms: 'Austria Österreich Vienna Wien Salzburg Innsbruck Graz' },
    'CH': { searchTerms: 'Switzerland Schweiz Zurich Geneva Basel Bern Lausanne' },
    'BE': { searchTerms: 'Belgium Belgique Brussels Bruxelles Antwerp Ghent Bruges' },
    'DK': { searchTerms: 'Denmark Danmark Copenhagen København Aarhus Odense' },
    'SE': { searchTerms: 'Sweden Sverige Stockholm Gothenburg Göteborg Malmö' },
    'NO': { searchTerms: 'Norway Norge Oslo Bergen Trondheim' },
    'FI': { searchTerms: 'Finland Suomi Helsinki Tampere Turku' },
    'PL': { searchTerms: 'Poland Polska Warsaw Warszawa Krakow Gdansk Wroclaw' },
    'CZ': { searchTerms: 'Czech Republic Czechia Praha Prague Brno Ostrava' },
    'HU': { searchTerms: 'Hungary Magyarország Budapest Debrecen Szeged' },
    'SK': { searchTerms: 'Slovakia Slovensko Bratislava Kosice' },
    'SI': { searchTerms: 'Slovenia Slovenija Ljubljana Maribor' },
    'HR': { searchTerms: 'Croatia Hrvatska Zagreb Split Dubrovnik' },
    'BG': { searchTerms: 'Bulgaria България София София Plovdiv Varna' },
    'RO': { searchTerms: 'Romania România Bucharest București Cluj Timisoara' },
    'EE': { searchTerms: 'Estonia Eesti Tallinn Tartu' },
    'LV': { searchTerms: 'Latvia Latvija Riga Daugavpils' },
    'LT': { searchTerms: 'Lithuania Lietuva Vilnius Kaunas Klaipeda' },
    'MT': { searchTerms: 'Malta Valletta Sliema' },
    'CY': { searchTerms: 'Cyprus Κύπρος Nicosia Λευκωσία Limassol' },
    'IE': { searchTerms: 'Ireland Éire Dublin Cork Galway' },
    'PT': { searchTerms: 'Portugal Lisbon Lisboa Porto Coimbra' }
  };
  
  return biasConfig[countryUpper] || null;
}

export class EventPrioritizer {
  constructor(
    private config: EventPipelineConfig,
    private geminiService: any
  ) {}

  setThresholdForDegradedMode(isDegraded: boolean): void {
    // WHY: Lower prioritization threshold when Firecrawl is degraded to avoid dropping all candidates
    this.config.thresholds.prioritization = isDegraded ? 0.3 : 0.5;
  }

  async prioritize(candidates: EventCandidate[], targetCountry?: string | null): Promise<EventCandidate[]> {
    const startTime = Date.now();
    const originalThreshold = this.config.thresholds.prioritization;

    if (candidates.length <= 3) {
      this.setThresholdForDegradedMode(true);
      logger.warn({ message: '[prioritize] Degraded mode enabled due to limited candidate pool', candidateCount: candidates.length });
    }

    logger.info({ message: '[prioritize] Starting prioritization', 
      totalCandidates: candidates.length,
      threshold: this.config.thresholds.prioritization
    });
    
    const prioritized: EventCandidate[] = [];
    
    try {
      // Process in larger batches for better performance
      const batchSize = 8; // Increased from 5 to 8 for better performance
      for (let i = 0; i < candidates.length; i += batchSize) {
        const batch = candidates.slice(i, i + batchSize);
        const batchResults = await this.processBatch(batch, targetCountry);
        prioritized.push(...batchResults);
        
        // Further reduced delay between batches for better performance
        if (i + batchSize < candidates.length) {
          await new Promise(resolve => setTimeout(resolve, 300)); // Reduced from 500ms to 300ms
        }
      }
      
      const duration = Date.now() - startTime;
      logger.info({ message: '[prioritize] Prioritization completed',
        totalCandidates: candidates.length,
        prioritizedCandidates: prioritized.length,
        rejectedCandidates: candidates.length - prioritized.length,
        duration,
        averageScore: prioritized.length > 0 
          ? prioritized.reduce((sum, c) => sum + (c.priorityScore || 0), 0) / prioritized.length 
          : 0
      });
      
      return prioritized;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ message: '[prioritize] Prioritization failed', error: (error as any).message, duration });
      throw new PrioritizationError(`Prioritization failed: ${(error as any).message}`, undefined, error as Error);
    } finally {
      this.config.thresholds.prioritization = originalThreshold;
    }
  }

  private async processBatch(candidates: EventCandidate[], targetCountry?: string | null): Promise<EventCandidate[]> {
    const prioritized: EventCandidate[] = [];
    
    for (const candidate of candidates) {
      try {
        const score = await this.scoreCandidate(candidate, targetCountry);
        candidate.priorityScore = score.overall;
        candidate.metadata.stageTimings.prioritization = Date.now() - candidate.metadata.processingTime;
        
        if (score.overall >= this.config.thresholds.prioritization) {
          candidate.status = 'prioritized';
          prioritized.push(candidate);
          
          logger.info({ message: '[prioritize] Candidate prioritized',
            url: candidate.url,
            score: score.overall,
            hasContent: !!candidate.metadata?.scrapedContent,
            breakdown: {
              is_event: score.is_event,
              has_agenda: score.has_agenda,
              has_speakers: score.has_speakers,
              is_recent: score.is_recent,
              is_relevant: score.is_relevant
            }
          });
        } else {
          candidate.status = 'rejected';
          
          logger.info({ message: '[prioritize] Candidate rejected',
            url: candidate.url,
            score: score.overall,
            threshold: this.config.thresholds.prioritization,
            hasContent: !!candidate.metadata?.scrapedContent,
            breakdown: {
              is_event: score.is_event,
              has_agenda: score.has_agenda,
              has_speakers: score.has_speakers,
              is_recent: score.is_recent,
              is_relevant: score.is_relevant
            }
          });
        }
      } catch (error) {
        logger.error({ message: '[prioritize] Failed to score candidate',
          url: candidate.url,
          error: (error as any).message
        });
        candidate.status = 'failed';
      }
    }
    
    return prioritized;
  }

  private async scoreCandidate(candidate: EventCandidate, targetCountry?: string | null): Promise<PrioritizationScore> {
    const normalizedDate = this.normalizeCandidateDate(candidate);
    
    // Check if we have scraped content for content-based evaluation
    const hasContent = candidate.metadata?.scrapedContent;
    
    if (hasContent) {
      return this.scoreCandidateWithContent(candidate, targetCountry);
    } else {
      return this.scoreCandidateUrlOnly(candidate, targetCountry);
    }
  }

  private async scoreCandidateWithContent(candidate: EventCandidate, targetCountry?: string | null): Promise<PrioritizationScore> {
    const normalizedDate = this.normalizeCandidateDate(candidate);
    const content = candidate.metadata?.scrapedContent || '';
    const title = candidate.metadata?.title || '';
    const description = candidate.metadata?.description || '';
    
    // Build country-specific context for prioritization
    let countryContext = '';
    if (targetCountry && targetCountry !== 'EU' && targetCountry !== '') {
      const countryBias = getCountrySpecificBias(targetCountry);
      if (countryBias) {
        countryContext = `\n\nCOUNTRY CONTEXT: This search is specifically for events in ${targetCountry}. Prioritize events that are clearly located in ${targetCountry} or mention ${countryBias.searchTerms.split(' ').slice(0, 3).join(', ')}.`;
      }
    }
    
    const prompt = `You are a JSON-only response system. You must respond with valid JSON only, no other text.

Analyze this event page content for relevance and score it (0-1):
URL: ${candidate.url}
Title: ${title}
Description: ${description}
Content: ${content.substring(0, 2000)}${countryContext}

Rate on these criteria:
- is_event: Is this an actual event page (conference, workshop, summit, etc.)? (0-1)
- has_agenda: Does the content contain agenda/program information, schedule, or session details? (0-1)
- has_speakers: Does the content list speakers, presenters, or keynotes? (0-1)
- is_recent: Is this for a current/future event (not past events)? (0-1)
- is_relevant: Does it match compliance, legal, or regulatory themes? (0-1)
${targetCountry && targetCountry !== 'EU' && targetCountry !== '' ? '- is_country_relevant: Does this event appear to be in the target country or region? (0-1)' : ''}

Be thorough in your analysis. Look for:
- Event dates, venues, registration information
- Speaker names, bios, or speaker lists
- Agenda items, session titles, or program schedules
- Event type indicators (conference, workshop, summit, etc.)
- Location mentions and country relevance

RESPOND WITH JSON ONLY - NO OTHER TEXT:
{"is_event": 0.9, "has_agenda": 0.7, "has_speakers": 0.8, "is_recent": 0.9, "is_relevant": 0.8${targetCountry && targetCountry !== 'EU' && targetCountry !== '' ? ', "is_country_relevant": 0.9' : ''}, "overall": 0.82}`;
    
    try {
      const response = await this.geminiService.generateContent(prompt);
      
      // Enhanced JSON parsing with fallback
      let scores;
      try {
        scores = JSON.parse(response);
      } catch (parseError) {
        // Try to extract JSON from response if it's wrapped in text
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          scores = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`Invalid JSON response: ${response.substring(0, 100)}...`);
        }
      }
      
      // Validate response structure
      if (!this.isValidScoreResponse(scores)) {
        throw new Error('Invalid score response structure');
      }
      
      const hasCountryRelevance = targetCountry && targetCountry !== 'EU' && targetCountry !== '' && scores.is_country_relevant !== undefined;
      const hasDate = Boolean(normalizedDate);
      const withinRange = hasDate ? this.isWithinRange(normalizedDate) : true;

      const baseIsRecent = typeof scores.is_recent === 'number' ? scores.is_recent : 0;
      let adjustedIsRecent = baseIsRecent;

      if (!hasDate) {
        adjustedIsRecent = Math.min(adjustedIsRecent, 0.3);
      }

      if (hasDate && !withinRange) {
        adjustedIsRecent = 0;
      }

      const germanLocaleSignals = this.containsGermanLocaleSignals(candidate);
      const cityBonus = this.detectCityTokens(candidate, targetCountry);

      const weightedOverall = hasCountryRelevance ? (
        scores.is_event * 0.22 +
        scores.has_agenda * 0.18 +
        scores.has_speakers * 0.14 +
        adjustedIsRecent * 0.18 +
        scores.is_relevant * 0.08 +
        (scores.is_country_relevant || 0) * 0.1 +
        germanLocaleSignals * 0.05 +
        cityBonus * 0.05
      ) : (
        scores.is_event * 0.28 +
        scores.has_agenda * 0.22 +
        scores.has_speakers * 0.18 +
        adjustedIsRecent * 0.18 +
        scores.is_relevant * 0.09 +
        germanLocaleSignals * 0.03 +
        cityBonus * 0.02
      );

      const overallPenalty = hasDate ? 1 : 0.85;
      const adjustedOverall = (hasDate && !withinRange) ? 0 : Math.round(weightedOverall * overallPenalty * 100) / 100;

      return {
        ...scores,
        is_recent: adjustedIsRecent,
        overall: adjustedOverall
      };
    } catch (error) {
      logger.error({ message: '[prioritize] LLM scoring failed',
        url: candidate.url,
        error: (error as any).message
      });
      
      // Fallback scoring based on URL patterns
      return this.fallbackScoring(candidate);
    }
  }

  private async scoreCandidateUrlOnly(candidate: EventCandidate, targetCountry?: string | null): Promise<PrioritizationScore> {
    const normalizedDate = this.normalizeCandidateDate(candidate);
    
    // Build country-specific context for prioritization
    let countryContext = '';
    if (targetCountry && targetCountry !== 'EU' && targetCountry !== '') {
      const countryBias = getCountrySpecificBias(targetCountry);
      if (countryBias) {
        countryContext = `\n\nCOUNTRY CONTEXT: This search is specifically for events in ${targetCountry}. Prioritize events that are clearly located in ${targetCountry} or mention ${countryBias.searchTerms.split(' ').slice(0, 3).join(', ')}.`;
      }
    }
    
    const prompt = `You are a JSON-only response system. You must respond with valid JSON only, no other text.

Analyze this URL for event relevance and score it (0-1):
URL: ${candidate.url}${countryContext}

Rate on these criteria:
- is_event: Is this an actual event page (not just a company page, blog post, or general info)? (0-1)
- has_agenda: Does it contain agenda/program information, schedule, or session details? (0-1)
- has_speakers: Does it list speakers, presenters, or keynotes? (0-1)
- is_recent: Is this for a current/future event (not past events)? (0-1)
- is_relevant: Does it match compliance, legal, or regulatory themes? (0-1)
${targetCountry && targetCountry !== 'EU' && targetCountry !== '' ? '- is_country_relevant: Does this event appear to be in the target country or region? (0-1)' : ''}

Be strict in scoring. Only give high scores (0.8+) to clearly relevant event pages.
${targetCountry && targetCountry !== 'EU' && targetCountry !== '' ? 'Give higher scores to events that are clearly in the target country.' : ''}

RESPOND WITH JSON ONLY - NO OTHER TEXT:
{"is_event": 0.9, "has_agenda": 0.7, "has_speakers": 0.8, "is_recent": 0.9, "is_relevant": 0.8${targetCountry && targetCountry !== 'EU' && targetCountry !== '' ? ', "is_country_relevant": 0.9' : ''}, "overall": 0.82}`;
    
    try {
      // For URL-only analysis, use fallback scoring more often since LLM is too strict
      // Only use LLM for URLs that clearly look like events
      const url = candidate.url.toLowerCase();
      const isLikelyEvent = url.includes('conference') || url.includes('summit') || 
                           url.includes('event') || url.includes('workshop') || 
                           url.includes('seminar') || url.includes('exhibition');
      
      if (!isLikelyEvent) {
        logger.info({ message: '[prioritize] Using fallback scoring for non-event URL',
          url: candidate.url,
          reason: 'URL does not contain event indicators'
        });
        return this.fallbackScoring(candidate);
      }
      
      const response = await this.geminiService.generateContent(prompt);
      
      // Enhanced JSON parsing with fallback
      let scores;
      try {
        scores = JSON.parse(response);
      } catch (parseError) {
        // Try to extract JSON from response if it's wrapped in text
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          scores = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`Invalid JSON response: ${response.substring(0, 100)}...`);
        }
      }
      
      // Validate response structure
      if (!this.isValidScoreResponse(scores)) {
        throw new Error('Invalid score response structure');
      }
      
      const hasCountryRelevance = targetCountry && targetCountry !== 'EU' && targetCountry !== '' && scores.is_country_relevant !== undefined;
      const hasDate = Boolean(normalizedDate);
      const withinRange = hasDate ? this.isWithinRange(normalizedDate) : true;

      const baseIsRecent = typeof scores.is_recent === 'number' ? scores.is_recent : 0;
      let adjustedIsRecent = baseIsRecent;

      if (!hasDate) {
        adjustedIsRecent = Math.min(adjustedIsRecent, 0.3);
      }

      if (hasDate && !withinRange) {
        adjustedIsRecent = 0;
      }

      const germanLocaleSignals = this.containsGermanLocaleSignals(candidate);
      const cityBonus = this.detectCityTokens(candidate, targetCountry);

      const weightedOverall = hasCountryRelevance ? (
        scores.is_event * 0.22 +
        scores.has_agenda * 0.18 +
        scores.has_speakers * 0.14 +
        adjustedIsRecent * 0.18 +
        scores.is_relevant * 0.08 +
        (scores.is_country_relevant || 0) * 0.1 +
        germanLocaleSignals * 0.05 +
        cityBonus * 0.05
      ) : (
        scores.is_event * 0.28 +
        scores.has_agenda * 0.22 +
        scores.has_speakers * 0.18 +
        adjustedIsRecent * 0.18 +
        scores.is_relevant * 0.09 +
        germanLocaleSignals * 0.03 +
        cityBonus * 0.02
      );

      const overallPenalty = hasDate ? 1 : 0.85;
      const adjustedOverall = (hasDate && !withinRange) ? 0 : Math.round(weightedOverall * overallPenalty * 100) / 100;

      return {
        ...scores,
        is_recent: adjustedIsRecent,
        overall: adjustedOverall
      };
    } catch (error) {
      logger.error({ message: '[prioritize] LLM scoring failed',
        url: candidate.url,
        error: (error as any).message
      });
      
      // Fallback scoring based on URL patterns
      return this.fallbackScoring(candidate);
    }
  }

  private isValidScoreResponse(scores: any): scores is PrioritizationScore {
    return (
      typeof scores === 'object' &&
      typeof scores.is_event === 'number' &&
      typeof scores.has_agenda === 'number' &&
      typeof scores.has_speakers === 'number' &&
      typeof scores.is_recent === 'number' &&
      typeof scores.is_relevant === 'number' &&
      scores.is_event >= 0 && scores.is_event <= 1 &&
      scores.has_agenda >= 0 && scores.has_agenda <= 1 &&
      scores.has_speakers >= 0 && scores.has_speakers <= 1 &&
      scores.is_recent >= 0 && scores.is_recent <= 1 &&
      scores.is_relevant >= 0 && scores.is_relevant <= 1
    );
  }

  private fallbackScoring(candidate: EventCandidate): PrioritizationScore {
    const url = candidate.url.toLowerCase();
    const normalizedDate = this.normalizeCandidateDate(candidate);
    const germanSignal = this.containsGermanLocaleSignals(candidate);
    const cityBonus = this.detectCityTokens(candidate);
    
    // Enhanced fallback scoring based on enhanced orchestrator approach
    let is_event = 0.4; // Higher base score for any URL
    let has_agenda = 0.3;
    let has_speakers = 0.3;
    let is_recent = normalizedDate ? 0.4 : 0.2;
    let is_relevant = 0.5;
    
    // Event type indicators (more generous scoring)
    if (url.includes('conference') || url.includes('summit') || url.includes('event') || 
        url.includes('workshop') || url.includes('seminar') || url.includes('exhibition')) {
      is_event = 0.8;
    }
    
    // Agenda/program indicators
    if (url.includes('agenda') || url.includes('program') || url.includes('schedule') || 
        url.includes('session') || url.includes('track')) {
      has_agenda = 0.7;
    }
    
    // Speaker indicators
    if (url.includes('speaker') || url.includes('presenter') || url.includes('keynote') || 
        url.includes('faculty') || url.includes('panel')) {
      has_speakers = 0.7;
    }
    
    // Date relevance
    if (normalizedDate) {
      const diffDays = (new Date(normalizedDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      is_recent = diffDays >= -30 && diffDays <= 365 ? 0.8 : 0.4;
    }
    
    // Industry relevance (more generous)
    if (url.includes('compliance') || url.includes('legal') || url.includes('regulation') || 
        url.includes('business') || url.includes('tech') || url.includes('data') || 
        url.includes('security') || url.includes('privacy')) {
      is_relevant = 0.8;
    }
    
    // Country relevance bonus
    let countryBonus = 0;
    if (url.includes('.de') || url.includes('germany') || url.includes('deutschland') || 
        url.includes('berlin') || url.includes('münchen') || url.includes('frankfurt')) {
      countryBonus = 0.2;
    }
    
    const overall = (
      is_event * 0.25 +
      has_agenda * 0.2 +
      has_speakers * 0.15 +
      is_recent * 0.15 +
      is_relevant * 0.15 +
      germanSignal * 0.05 +
      cityBonus * 0.03 +
      countryBonus
    );
    
    logger.warn({ message: '[prioritize] Using fallback scoring',
      url: candidate.url,
      reason: 'LLM scoring failed'
    });
    
    return {
      is_event,
      has_agenda,
      has_speakers,
      is_recent,
      is_relevant,
      overall: Math.min(Math.round(overall * 100) / 100, 1.0)
    };
  }

  private normalizeCandidateDate(candidate: EventCandidate): string | null {
    const raw = candidate.extractResult?.startISO ?? candidate.parseResult?.startISO ?? candidate.dateISO ?? candidate.parseResult?.date ?? null;
    if (!raw) return null;
    const parsed = parseEventDate(raw);
    return parsed.startISO ?? null;
  }

  private isWithinRange(startISO: string): boolean {
    if (!startISO) return false;
    const date = new Date(startISO);
    if (Number.isNaN(date.getTime())) return false;
    const diffDays = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays >= -30 && diffDays <= 365;
  }

  private containsGermanLocaleSignals(candidate: EventCandidate): number {
    const text = [candidate.url, candidate.parseResult?.description, candidate.extractResult?.description]
      .filter(Boolean)
      .join(' ') 
      .toLowerCase();
    if (!text) return 0;
    const germanMonths = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
    const langMatch = text.includes('lang=de') || text.includes('sprache deutsch');
    const monthMatch = germanMonths.some((month) => text.includes(month));
    if (langMatch && monthMatch) return 1;
    if (langMatch || monthMatch) return 0.6;
    return 0;
  }

  private detectCityTokens(candidate: EventCandidate, targetCountry?: string | null): number {
    if (targetCountry && targetCountry.toUpperCase() !== 'DE') return 0;
    const text = [candidate.url, candidate.parseResult?.location, candidate.extractResult?.location, candidate.parseResult?.title]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!text) return 0;
    const cities = ['berlin', 'münchen', 'munich', 'frankfurt', 'hamburg', 'köln', 'cologne', 'stuttgart', 'düsseldorf', 'leipzig', 'hannover', 'nürnberg'];
    const hits = cities.filter((city) => text.includes(city)).length;
    if (hits >= 2) return 1;
    if (hits === 1) return 0.6;
    return 0;
  }
}
