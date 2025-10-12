/**
 * Company Intelligence AI Service
 * 
 * Extends the OptimizedAIService to provide specialized AI capabilities
 * for company intelligence analysis, including annual reports, intent signals,
 * and competitor analysis.
 */

import { OptimizedAIService } from './optimized-ai-service';

export interface CompanyAnalysisRequest {
  companyName: string;
  domain?: string;
  searchType: 'annual_reports' | 'intent_signals' | 'competitor_analysis' | 'event_participation';
  context?: {
    industry?: string;
    country?: string;
    timeRange?: string;
  };
}

export interface CompanyAnalysisResult {
  companyName: string;
  analysisType: string;
  confidence: number;
  insights: {
    keyFindings: string[];
    trends: string[];
    opportunities: string[];
    risks: string[];
  };
  data: {
    annualReports?: AnnualReportData[];
    intentSignals?: IntentSignalData[];
    competitorActivity?: CompetitorData[];
    eventParticipation?: EventParticipationData[];
  };
  metadata: {
    sourcesAnalyzed: number;
    lastUpdated: string;
    processingTime: number;
  };
}

export interface AnnualReportData {
  year: string;
  title: string;
  url: string;
  keyMetrics: {
    revenue?: string;
    growth?: string;
    employees?: string;
    marketCap?: string;
  };
  strategicInitiatives: string[];
  riskFactors: string[];
  confidence: number;
}

export interface IntentSignalData {
  type: 'hiring' | 'funding' | 'partnership' | 'expansion' | 'technology' | 'compliance';
  title: string;
  description: string;
  url: string;
  date: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
}

export interface CompetitorData {
  competitorName: string;
  activityType: string;
  description: string;
  url: string;
  date: string;
  relevance: number;
}

export interface EventParticipationData {
  eventTitle: string;
  eventDate: string;
  participationType: 'speaker' | 'sponsor' | 'attendee' | 'organizer';
  speakerName?: string;
  speakerTitle?: string;
  eventUrl: string;
  confidence: number;
}

/**
 * Company Intelligence AI Service
 */
export class CompanyIntelligenceAI {
  /**
   * Analyze company data using AI
   */
  static async analyzeCompanyData(
    request: CompanyAnalysisRequest
  ): Promise<CompanyAnalysisResult> {
    const startTime = Date.now();
    
    try {
      const prompt = this.buildAnalysisPrompt(request);
      const data = {
        companyName: request.companyName,
        domain: request.domain,
        searchType: request.searchType,
        context: request.context
      };

      const result = await OptimizedAIService.processRequest<CompanyAnalysisResult>(
        'extract',
        prompt,
        data,
        { 
          useBatching: true, 
          useCache: true,
          priority: 1 // High priority for company intelligence
        }
      );

      // Add metadata
      result.metadata = {
        sourcesAnalyzed: this.estimateSourcesAnalyzed(request),
        lastUpdated: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };

      return result;
    } catch (error) {
      console.error('[CompanyIntelligenceAI] Analysis failed:', error);
      throw new Error(`Company analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Prioritize company-related URLs
   */
  static async prioritizeCompanyUrls(
    urls: string[],
    companyName: string,
    searchType: CompanyAnalysisRequest['searchType']
  ): Promise<{ prioritizedUrls: string[]; scores: Record<string, number> }> {
    const prompt = this.buildPrioritizationPrompt(companyName, searchType);
    const data = { urls, companyName, searchType };

    return await OptimizedAIService.processRequest(
      'prioritize',
      prompt,
      data,
      { useBatching: true, useCache: true }
    );
  }

  /**
   * Extract company information from content
   */
  static async extractCompanyInfo(
    content: string,
    companyName: string,
    contentType: 'annual_report' | 'news_article' | 'press_release' | 'event_page'
  ): Promise<{
    keyInformation: string[];
    metrics: Record<string, string>;
    insights: string[];
    confidence: number;
  }> {
    const prompt = this.buildExtractionPrompt(companyName, contentType);
    const data = { content, companyName, contentType };

    return await OptimizedAIService.processRequest(
      'extract',
      prompt,
      data,
      { useBatching: true, useCache: true }
    );
  }

  /**
   * Analyze competitor activity
   */
  static async analyzeCompetitorActivity(
    companyName: string,
    competitorData: any[]
  ): Promise<{
    competitiveLandscape: string[];
    marketTrends: string[];
    opportunities: string[];
    threats: string[];
    confidence: number;
  }> {
    const prompt = this.buildCompetitorAnalysisPrompt(companyName);
    const data = { companyName, competitorData };

    return await OptimizedAIService.processRequest(
      'extract',
      prompt,
      data,
      { useBatching: true, useCache: true }
    );
  }

  /**
   * Build analysis prompt based on request type
   */
  private static buildAnalysisPrompt(request: CompanyAnalysisRequest): string {
    const { companyName, searchType, context } = request;
    
    const basePrompt = `Analyze ${companyName} for ${searchType.replace('_', ' ')}.`;
    
    switch (searchType) {
      case 'annual_reports':
        return `${basePrompt} Focus on:
- Financial performance and key metrics
- Strategic initiatives and business direction
- Risk factors and challenges
- Growth opportunities
- Market position and competitive advantages

Provide structured analysis with confidence scores for each finding.`;

      case 'intent_signals':
        return `${basePrompt} Identify and analyze:
- Hiring patterns and job postings
- Funding rounds and investment activity
- Partnership announcements
- Technology adoption and digital transformation
- Expansion plans and new market entries
- Compliance and regulatory activities

Rate each signal by impact (high/medium/low) and confidence.`;

      case 'competitor_analysis':
        return `${basePrompt} Analyze:
- Competitive positioning
- Market share and performance
- Strategic moves and initiatives
- Technology investments
- Partnership strategies
- Market opportunities and threats

Provide competitive landscape insights.`;

      case 'event_participation':
        return `${basePrompt} Analyze:
- Speaking engagements and thought leadership
- Sponsorship and marketing activities
- Industry presence and networking
- Content and messaging themes
- Target audience engagement

Identify participation patterns and strategic focus areas.`;

      default:
        return `${basePrompt} Provide comprehensive analysis with key insights, trends, opportunities, and risks.`;
    }
  }

  /**
   * Build prioritization prompt
   */
  private static buildPrioritizationPrompt(
    companyName: string, 
    searchType: CompanyAnalysisRequest['searchType']
  ): string {
    return `Prioritize these URLs for ${searchType} analysis of ${companyName}.

Rate each URL from 0-100 based on:
- Relevance to ${companyName}
- Content quality and depth
- Recency and timeliness
- Source credibility
- Information richness

Return prioritized URLs with scores.`;
  }

  /**
   * Build extraction prompt
   */
  private static buildExtractionPrompt(
    companyName: string, 
    contentType: string
  ): string {
    return `Extract key information about ${companyName} from this ${contentType}.

Focus on:
- Key facts and metrics
- Strategic information
- Business insights
- Financial data (if applicable)
- Market positioning

Provide structured extraction with confidence scores.`;
  }

  /**
   * Build competitor analysis prompt
   */
  private static buildCompetitorAnalysisPrompt(companyName: string): string {
    return `Analyze competitive landscape for ${companyName} based on competitor data.

Provide insights on:
- Competitive positioning
- Market trends and opportunities
- Strategic threats and risks
- Industry dynamics
- Growth opportunities

Return structured competitive analysis.`;
  }

  /**
   * Estimate number of sources analyzed
   */
  private static estimateSourcesAnalyzed(request: CompanyAnalysisRequest): number {
    // This is a rough estimate based on typical search results
    const baseSources = 20;
    const multiplier = request.searchType === 'competitor_analysis' ? 1.5 : 1;
    return Math.round(baseSources * multiplier);
  }
}
