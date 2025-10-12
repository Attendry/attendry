/**
 * Pipeline Fallback Integration
 * 
 * Integration with existing search system and graceful fallback handling
 */

import { EventCandidate, EventPipelineConfig, PipelineContext } from './types';
import { EventPipeline } from './orchestrator';
import { isNewPipelineEnabled, getPipelineConfig } from './config';
import { logger } from '@/utils/logger';

export class PipelineFallback {
  constructor(
    private newPipeline: EventPipeline,
    private legacySearch: any
  ) {}

  async search(context: PipelineContext): Promise<any> {
    const useNewPipeline = isNewPipelineEnabled();
    
    if (useNewPipeline) {
      try {
        logger.info({ message: '[fallback] Using new pipeline',
          query: context.query,
          country: context.country
        });
        
        const result = await this.newPipeline.process(context);
        return this.convertToLegacyFormat(result);
      } catch (error) {
        logger.error({ message: '[fallback] New pipeline failed, returning empty result',
          error: (error as any).message,
          query: context.query,
          country: context.country
        });
        
        // Return empty result instead of falling back to legacy search
        // to avoid Supabase dependency issues
        return {
          events: [],
          provider: 'new_pipeline',
          count: 0,
          pipeline_metrics: {
            totalCandidates: 0,
            prioritizedCandidates: 0,
            parsedCandidates: 0,
            extractedCandidates: 0,
            publishedCandidates: 0,
            rejectedCandidates: 0,
            failedCandidates: 0,
            totalDuration: 0,
            averageConfidence: 0,
            sourceBreakdown: {}
          },
          logs: [{
            stage: 'error',
            message: 'New pipeline failed',
            error: (error as any).message,
            timestamp: new Date().toISOString()
          }]
        };
      }
    } else {
      logger.info({ message: '[fallback] Using legacy search',
        query: context.query,
        country: context.country
      });
      
      return await this.legacySearch(context.query, context.country);
    }
  }

  private convertToLegacyFormat(pipelineResult: {
    candidates: EventCandidate[];
    publishedEvents: any[];
    metrics: any;
    logs: any[];
  }): any {
    const { candidates, publishedEvents, metrics, logs } = pipelineResult;
    
    // Use published events if available (Phase 3), otherwise convert candidates
    let events;
    
    if (publishedEvents && publishedEvents.length > 0) {
      // Use published events directly (Phase 3)
      events = publishedEvents;
    } else {
      // Fallback to converting candidates (Phase 1 & 2)
      const config = getPipelineConfig();
      const qualityCandidates = candidates.filter(candidate => {
        // Use extractResult if available (Phase 2), otherwise fall back to parseResult
        const result = candidate.extractResult || candidate.parseResult;
        return result && 
               result.confidence >= config.thresholds.confidence &&
               (candidate.status === 'extracted' || candidate.status === 'parsed');
      });
      
      // Convert to legacy format
      events = qualityCandidates.map(candidate => {
        // Use extractResult if available (Phase 2), otherwise fall back to parseResult
        const result = candidate.extractResult || candidate.parseResult;
        
        return {
          id: candidate.id,
          title: result?.title || 'Event',
          source_url: candidate.url,
          description: result?.description,
          starts_at: result?.date,
          location: result?.location,
          venue: result?.venue,
          speakers: result?.speakers?.map(name => ({
            name,
            title: null,
            org: null,
            bio: null,
            confidence: 0.5
          })) || [],
          confidence: result?.confidence || 0.5,
          confidence_reason: 'new_pipeline',
          // Additional pipeline metadata
          pipeline_metadata: {
            source: candidate.source,
            priorityScore: candidate.priorityScore,
            parseMethod: result?.parseMethod,
            evidence: result?.evidence?.length || 0,
            processingTime: candidate.metadata.processingTime,
            // Phase 2 specific metadata
            llmEnhanced: candidate.extractResult?.llmEnhanced || false,
            schemaValidated: candidate.extractResult?.schemaValidated || false,
            enhancementNotes: result?.enhancementNotes
          }
        };
      });
    }
    
    return {
      events,
      provider: 'new_pipeline',
      count: events.length,
      pipeline_metrics: {
        totalCandidates: metrics.totalCandidates,
        prioritizedCandidates: metrics.prioritizedCandidates,
        parsedCandidates: metrics.parsedCandidates,
        extractedCandidates: metrics.extractedCandidates,
        publishedCandidates: metrics.publishedCandidates,
        averageConfidence: metrics.averageConfidence,
        sourceBreakdown: metrics.sourceBreakdown
      },
      logs: logs.map(log => ({
        stage: log.stage,
        duration: log.duration,
        timestamp: log.timestamp,
        ...log
      }))
    };
  }
}

// Factory function to create pipeline with fallback
export async function createPipelineWithFallback(): Promise<PipelineFallback> {
  const config = getPipelineConfig();
  
  // Import services dynamically to avoid circular dependencies
  const { cseSearch } = await import('@/services/search/cseService');
  const { firecrawlSearch } = await import('@/services/search/firecrawlService');
  const { GeminiService } = await import('@/lib/services/gemini-service');
  
  // Create service wrappers that match the DiscoveryService interface
  const cseService = {
    search: async (params: { q: string; country: string; limit?: number }) => {
      const result = await cseSearch({ baseQuery: params.q, userText: params.q, crCountry: `country${params.country}` });
      return {
        items: result.items.map((item: any) => ({
          url: item.url,
          title: item.title,
          description: item.snippet
        }))
      };
    }
  };
  
  const firecrawlService = {
    search: async (params: { q: string; country: string; limit?: number }) => {
      const result = await firecrawlSearch({ baseQuery: params.q, userText: params.q, location: params.country });
      return {
        items: result.items.map((item: any) => ({
          url: item.url,
          title: item.title,
          description: item.snippet
        }))
      };
    }
  };
  
  const geminiService = {
    generateContent: async (prompt: string) => {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY not configured");
      }

      const modelPath = process.env.GEMINI_MODEL_PATH || 'v1beta/models/gemini-2.0-flash:generateContent';
      const response = await fetch(`https://generativelanguage.googleapis.com/${modelPath}?key=${apiKey}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API failed: ${response.status} ${response.statusText}`);
      }

      const rawText = await response.text();
      const data = JSON.parse(rawText) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error("No content in Gemini response");
      }
      
      // Extract JSON from markdown if present
      let jsonContent = content.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      return jsonContent;
    }
  };
  
  // Create new pipeline
  const newPipeline = new EventPipeline(
    config,
    cseService,
    firecrawlService,
    geminiService
  );
  
  // Create legacy search wrapper
  const legacySearch = async (query: string, country: string) => {
    // Import and use existing enhanced orchestrator as fallback
    const { executeEnhancedSearch } = await import('@/common/search/enhanced-orchestrator');
    return await executeEnhancedSearch({
      userText: query,
      country,
      dateFrom: null,
      dateTo: null,
      locale: 'de'
    });
  };
  
  return new PipelineFallback(newPipeline, legacySearch);
}

// Main entry point for the new pipeline
export async function executeNewPipeline(args: {
  userText: string;
  country: string;
  dateFrom?: string;
  dateTo?: string;
  locale?: string;
}): Promise<any> {
  const pipelineWithFallback = await createPipelineWithFallback();
  
  // Build query using the same logic as enhanced orchestrator
  let effectiveQuery = args.userText;
  
  // If userText is empty, use baseQuery from config (same as enhanced orchestrator)
  if (!effectiveQuery || effectiveQuery.trim() === '') {
    try {
      const { loadActiveConfig } = await import('@/common/search/config');
      const { buildSearchQuery } = await import('@/common/search/queryBuilder');
      
      const cfg = await loadActiveConfig();
      const baseQuery = cfg.baseQuery;
      const excludeTerms = cfg.excludeTerms || '';
      
      // Build query using the same logic as enhanced orchestrator
      effectiveQuery = buildSearchQuery({ baseQuery, userText: '', excludeTerms });
      
      logger.info({ message: '[executeNewPipeline] Using baseQuery for empty userText', 
        baseQuery: effectiveQuery.substring(0, 100) + '...' 
      });
    } catch (error) {
      logger.warn({ message: '[executeNewPipeline] Failed to load config, using fallback query', 
        error: (error as any).message 
      });
      // Fallback to a basic legal compliance query
      effectiveQuery = 'legal compliance conference event summit workshop';
    }
  }
  
  const context: PipelineContext = {
    query: effectiveQuery,
    country: args.country,
    dateFrom: args.dateFrom,
    dateTo: args.dateTo,
    locale: args.locale || 'de',
    startTime: new Date(),
    config: getPipelineConfig()
  };
  
  return await pipelineWithFallback.search(context);
}
