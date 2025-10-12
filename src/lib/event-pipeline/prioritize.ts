/**
 * Event Prioritization Stage
 * 
 * LLM-based scoring and filtering of discovered URLs
 */

import { EventCandidate, EventPipelineConfig, PrioritizationScore, PrioritizationError } from './types';
import { logger } from '@/utils/logger';

export class EventPrioritizer {
  constructor(
    private config: EventPipelineConfig,
    private geminiService: any
  ) {}

  async prioritize(candidates: EventCandidate[]): Promise<EventCandidate[]> {
    const startTime = Date.now();
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
        const batchResults = await this.processBatch(batch);
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
    }
  }

  private async processBatch(candidates: EventCandidate[]): Promise<EventCandidate[]> {
    const prioritized: EventCandidate[] = [];
    
    for (const candidate of candidates) {
      try {
        const score = await this.scoreCandidate(candidate);
        candidate.priorityScore = score.overall;
        candidate.metadata.stageTimings.prioritization = Date.now() - candidate.metadata.processingTime;
        
        if (score.overall >= this.config.thresholds.prioritization) {
          candidate.status = 'prioritized';
          prioritized.push(candidate);
          
          logger.info({ message: '[prioritize] Candidate prioritized',
            url: candidate.url,
            score: score.overall,
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
            threshold: this.config.thresholds.prioritization
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

  private async scoreCandidate(candidate: EventCandidate): Promise<PrioritizationScore> {
    const prompt = `
      Analyze this URL for event relevance and score it (0-1):
      URL: ${candidate.url}
      
      Rate on these criteria:
      - is_event: Is this an actual event page (not just a company page, blog post, or general info)? (0-1)
      - has_agenda: Does it contain agenda/program information, schedule, or session details? (0-1)
      - has_speakers: Does it list speakers, presenters, or keynotes? (0-1)
      - is_recent: Is this for a current/future event (not past events)? (0-1)
      - is_relevant: Does it match compliance, legal, or regulatory themes? (0-1)
      
      Be strict in scoring. Only give high scores (0.8+) to clearly relevant event pages.
      
      Return JSON only: {"is_event": 0.9, "has_agenda": 0.7, "has_speakers": 0.8, "is_recent": 0.9, "is_relevant": 0.8, "overall": 0.82}
    `;
    
    try {
      const response = await this.geminiService.generateContent(prompt);
      const scores = JSON.parse(response);
      
      // Validate response structure
      if (!this.isValidScoreResponse(scores)) {
        throw new Error('Invalid score response structure');
      }
      
      // Calculate weighted overall score
      const overall = (
        scores.is_event * 0.3 +      // Most important - must be an event
        scores.has_agenda * 0.25 +   // Important - shows it's a real event
        scores.has_speakers * 0.2 +  // Important - shows quality
        scores.is_recent * 0.15 +    // Important - must be current
        scores.is_relevant * 0.1     // Less important - we can filter later
      );
      
      return {
        ...scores,
        overall: Math.round(overall * 100) / 100 // Round to 2 decimal places
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
    
    // Simple heuristic scoring based on URL patterns
    let is_event = 0.5;
    let has_agenda = 0.3;
    let has_speakers = 0.3;
    let is_recent = 0.5;
    let is_relevant = 0.5;
    
    // Event indicators
    if (url.includes('conference') || url.includes('summit') || url.includes('event')) {
      is_event = 0.8;
    }
    if (url.includes('agenda') || url.includes('program') || url.includes('schedule')) {
      has_agenda = 0.7;
    }
    if (url.includes('speaker') || url.includes('presenter')) {
      has_speakers = 0.7;
    }
    
    // Recent indicators
    if (url.includes('2025') || url.includes('2024')) {
      is_recent = 0.8;
    }
    
    // Relevance indicators
    if (url.includes('compliance') || url.includes('legal') || url.includes('regulation')) {
      is_relevant = 0.8;
    }
    
    const overall = (is_event * 0.3 + has_agenda * 0.25 + has_speakers * 0.2 + is_recent * 0.15 + is_relevant * 0.1);
    
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
      overall: Math.round(overall * 100) / 100
    };
  }
}
