/**
 * Company Intelligence AI Service
 * 
 * Extends the OptimizedAIService to provide specialized AI capabilities
 * for company intelligence analysis, including annual reports, intent signals,
 * and competitor analysis.
 */

import { OptimizedAIService } from './optimized-ai-service';
import { UserProfile } from '@/lib/types/core';

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
  // Phase 2B: Insight Scoring
  insightScore?: {
    overallScore: number;
    relevanceScore: number;
    impactScore: number;
    urgencyScore: number;
    confidenceScore: number;
    breakdown: {
      relevance: number;
      impact: number;
      urgency: number;
      confidence: number;
    };
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

      // Phase 2B: Calculate insight score for company intelligence
      result.insightScore = this.calculateCompanyInsightScore(result, request.userProfile);

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

  /**
   * Phase 2B: Calculate insight score for company intelligence
   * Maps company intelligence data to insight scoring factors
   */
  static calculateCompanyInsightScore(
    result: CompanyAnalysisResult,
    userProfile?: UserProfile
  ): CompanyAnalysisResult['insightScore'] {
    // Relevance Score (30%): Based on user profile match and industry alignment
    let relevanceScore = 0.5; // Base score
    if (userProfile) {
      // Check industry alignment
      const companyIndustry = result.companyName.toLowerCase();
      const userIndustries = (userProfile.industry_terms || []).map(t => t.toLowerCase());
      const industryMatch = userIndustries.some(industry => 
        companyIndustry.includes(industry) || industry.includes(companyIndustry)
      );
      if (industryMatch) relevanceScore += 0.2;

      // Check ICP match (if company matches ICP terms)
      const userICP = (userProfile.icp_terms || []).map(t => t.toLowerCase());
      const icpMatch = userICP.some(term => 
        companyIndustry.includes(term) || term.includes(companyIndustry)
      );
      if (icpMatch) relevanceScore += 0.2;

      // Check competitor match (if tracking competitors)
      const competitors = (userProfile.competitors || []).map(c => c.toLowerCase());
      const isCompetitor = competitors.some(comp => 
        companyIndustry.includes(comp) || comp.includes(companyIndustry)
      );
      if (isCompetitor) relevanceScore += 0.1; // Competitors are relevant
    }
    relevanceScore = Math.min(1, relevanceScore);

    // Impact Score (30%): Based on opportunities, trends, and data richness
    let impactScore = 0.5;
    const opportunitiesCount = result.insights.opportunities?.length || 0;
    const trendsCount = result.insights.trends?.length || 0;
    const keyFindingsCount = result.insights.keyFindings?.length || 0;
    
    // More opportunities = higher impact
    if (opportunitiesCount > 0) impactScore += Math.min(0.2, opportunitiesCount * 0.05);
    // More trends = higher impact
    if (trendsCount > 0) impactScore += Math.min(0.15, trendsCount * 0.03);
    // More findings = higher impact
    if (keyFindingsCount > 0) impactScore += Math.min(0.15, keyFindingsCount * 0.03);
    
    // Intent signals have high impact
    if (result.data.intentSignals && result.data.intentSignals.length > 0) {
      const highImpactSignals = result.data.intentSignals.filter(s => s.impact === 'high').length;
      impactScore += Math.min(0.2, highImpactSignals * 0.1);
    }
    
    // Event participation indicates market activity
    if (result.data.eventParticipation && result.data.eventParticipation.length > 0) {
      impactScore += Math.min(0.1, result.data.eventParticipation.length * 0.02);
    }
    
    impactScore = Math.min(1, impactScore);

    // Urgency Score (20%): Based on recency and time sensitivity
    let urgencyScore = 0.5;
    const lastUpdated = new Date(result.metadata.lastUpdated);
    const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    
    // Recent data = higher urgency
    if (daysSinceUpdate < 7) urgencyScore += 0.3;
    else if (daysSinceUpdate < 30) urgencyScore += 0.2;
    else if (daysSinceUpdate < 90) urgencyScore += 0.1;
    
    // Intent signals indicate urgency (hiring, funding, expansion)
    if (result.data.intentSignals && result.data.intentSignals.length > 0) {
      const urgentTypes = ['hiring', 'funding', 'expansion'];
      const urgentSignals = result.data.intentSignals.filter(s => 
        urgentTypes.includes(s.type)
      ).length;
      urgencyScore += Math.min(0.2, urgentSignals * 0.1);
    }
    
    urgencyScore = Math.min(1, urgencyScore);

    // Confidence Score (20%): Based on data quality and source reliability
    let confidenceScore = result.confidence || 0.5; // Use existing confidence as base
    
    // More sources = higher confidence
    const sourcesCount = result.metadata.sourcesAnalyzed || 0;
    if (sourcesCount > 10) confidenceScore += 0.1;
    else if (sourcesCount > 5) confidenceScore += 0.05;
    
    // Annual reports have high confidence
    if (result.data.annualReports && result.data.annualReports.length > 0) {
      confidenceScore += 0.1;
    }
    
    // Event participation data is reliable
    if (result.data.eventParticipation && result.data.eventParticipation.length > 0) {
      confidenceScore += 0.05;
    }
    
    confidenceScore = Math.min(1, confidenceScore);

    // Calculate overall score with weights
    const overallScore = 
      (relevanceScore * 0.3) +
      (impactScore * 0.3) +
      (urgencyScore * 0.2) +
      (confidenceScore * 0.2);

    return {
      overallScore: Math.round(overallScore * 100) / 100,
      relevanceScore: Math.round(relevanceScore * 100) / 100,
      impactScore: Math.round(impactScore * 100) / 100,
      urgencyScore: Math.round(urgencyScore * 100) / 100,
      confidenceScore: Math.round(confidenceScore * 100) / 100,
      breakdown: {
        relevance: relevanceScore,
        impact: impactScore,
        urgency: urgencyScore,
        confidence: confidenceScore
      }
    };
  }
}
