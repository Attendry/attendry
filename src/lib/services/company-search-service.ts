/**
 * Company Search Service
 * 
 * Extends the existing SearchService to provide specialized search capabilities
 * for company intelligence, including annual reports, intent signals, and
 * competitor analysis.
 */

import { SearchService, SearchConfig, EventRec } from './search-service';
import { CompanyIntelligenceAI, CompanyAnalysisRequest } from './company-intelligence-ai-service';

export interface CompanySearchConfig {
  companyName: string;
  domain?: string;
  searchType: 'annual_reports' | 'intent_signals' | 'competitor_analysis' | 'event_participation';
  country?: string;
  timeRange?: {
    from: string;
    to: string;
  };
  maxResults?: number;
}

export interface CompanySearchResult {
  companyName: string;
  searchType: string;
  results: {
    searchResults: EventRec[];
    aiAnalysis: any;
    prioritizedUrls: string[];
    confidence: number;
  };
  metadata: {
    searchTime: number;
    sourcesFound: number;
    lastUpdated: string;
  };
}

/**
 * Company Search Service
 */
export class CompanySearchService extends SearchService {
  /**
   * Search for company intelligence data
   */
  static async searchCompanyIntelligence(
    config: CompanySearchConfig
  ): Promise<CompanySearchResult> {
    const startTime = Date.now();
    
    try {
      // Build company-specific search queries
      const queries = this.buildCompanyQueries(config);
      
      // Execute searches using existing infrastructure
      const searchResults = await Promise.all(
        queries.map(query => 
          SearchService.runEventDiscovery({
            q: query,
            country: config.country || 'DE',
            from: config.timeRange?.from || this.getDefaultTimeRange().from,
            to: config.timeRange?.to || this.getDefaultTimeRange().to,
            provider: 'firecrawl' // Use primary provider
          })
        )
      );

      // Merge and deduplicate results
      const mergedResults = this.mergeSearchResults(searchResults);
      
      // Prioritize URLs using AI
      const urls = mergedResults
        .filter(r => r && r.source_url)
        .map(r => r.source_url);
      
      const prioritizedUrls = urls.length > 0 
        ? await this.prioritizeCompanyUrls(urls, config.companyName, config.searchType)
        : { prioritizedUrls: [], scores: {} };

      // Perform AI analysis
      const aiAnalysis = await this.performAIAnalysis(config, mergedResults);

      return {
        companyName: config.companyName,
        searchType: config.searchType,
        results: {
          searchResults: mergedResults.slice(0, config.maxResults || 50),
          aiAnalysis,
          prioritizedUrls: prioritizedUrls.prioritizedUrls,
          confidence: this.calculateOverallConfidence(mergedResults, aiAnalysis)
        },
        metadata: {
          searchTime: Date.now() - startTime,
          sourcesFound: mergedResults.length,
          lastUpdated: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[CompanySearchService] Search failed:', error);
      throw new Error(`Company search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build company-specific search queries
   */
  private static buildCompanyQueries(config: CompanySearchConfig): string[] {
    const { companyName, domain, searchType } = config;
    const queries: string[] = [];

    switch (searchType) {
      case 'annual_reports':
        queries.push(
          `"${companyName}" (annual report OR "annual report" OR "financial results" OR "earnings report")`,
          `"${companyName}" (investor relations OR "investor relations" OR "financial statements")`,
          domain ? `site:${domain} (annual report OR financial results OR investor relations)` : '',
          `"${companyName}" (SEC filing OR "10-K" OR "10-Q" OR "8-K")`
        );
        break;

      case 'intent_signals':
        queries.push(
          `"${companyName}" (hiring OR "job posting" OR "careers" OR "we're hiring")`,
          `"${companyName}" (funding OR "series" OR "investment" OR "venture capital")`,
          `"${companyName}" (partnership OR "strategic partnership" OR "collaboration")`,
          `"${companyName}" (expansion OR "new office" OR "opening" OR "launch")`,
          `"${companyName}" (technology OR "digital transformation" OR "AI" OR "automation")`
        );
        break;

      case 'competitor_analysis':
        queries.push(
          `"${companyName}" competitors OR "alternatives to ${companyName}"`,
          `"${companyName}" vs OR "${companyName}" comparison`,
          `"${companyName}" market share OR "competitive landscape"`,
          `"${companyName}" industry analysis OR "market analysis"`
        );
        break;

      case 'event_participation':
        queries.push(
          `"${companyName}" (speaker OR "keynote" OR "presentation" OR "panel")`,
          `"${companyName}" (sponsor OR "sponsorship" OR "exhibitor")`,
          `"${companyName}" (conference OR "summit" OR "event" OR "webinar")`,
          `"${companyName}" (thought leadership OR "industry expert")`
        );
        break;
    }

    // Filter out empty queries and add domain-specific queries if available
    const filteredQueries = queries.filter(q => q.trim().length > 0);
    
    if (domain) {
      filteredQueries.push(`site:${domain} "${companyName}"`);
    }

    return filteredQueries;
  }

  /**
   * Merge search results from multiple queries
   */
  private static mergeSearchResults(searchResults: any[]): EventRec[] {
    const merged: EventRec[] = [];
    const seenUrls = new Set<string>();

    for (const result of searchResults) {
      if (result && result.events && Array.isArray(result.events)) {
        for (const event of result.events) {
          if (event && event.source_url && !seenUrls.has(event.source_url)) {
            seenUrls.add(event.source_url);
            merged.push(event);
          }
        }
      }
    }

    // Sort by confidence and date
    return merged.sort((a, b) => {
      const confidenceA = a.confidence || 0;
      const confidenceB = b.confidence || 0;
      if (confidenceA !== confidenceB) {
        return confidenceB - confidenceA;
      }
      
      // Secondary sort by date (newer first)
      const dateA = a.starts_at ? new Date(a.starts_at).getTime() : 0;
      const dateB = b.starts_at ? new Date(b.starts_at).getTime() : 0;
      return dateB - dateA;
    });
  }

  /**
   * Prioritize company URLs using AI
   */
  private static async prioritizeCompanyUrls(
    urls: string[],
    companyName: string,
    searchType: CompanySearchConfig['searchType']
  ): Promise<{ prioritizedUrls: string[]; scores: Record<string, number> }> {
    if (urls.length === 0) {
      return { prioritizedUrls: [], scores: {} };
    }

    try {
      return await CompanyIntelligenceAI.prioritizeCompanyUrls(
        urls,
        companyName,
        searchType
      );
    } catch (error) {
      console.warn('[CompanySearchService] AI prioritization failed, using fallback:', error);
      // Fallback: return URLs in original order with default scores
      return {
        prioritizedUrls: urls,
        scores: urls.reduce((acc, url) => ({ ...acc, [url]: 0.5 }), {})
      };
    }
  }

  /**
   * Perform AI analysis on search results
   */
  private static async performAIAnalysis(
    config: CompanySearchConfig,
    searchResults: EventRec[]
  ): Promise<any> {
    try {
      const analysisRequest: CompanyAnalysisRequest = {
        companyName: config.companyName,
        domain: config.domain,
        searchType: config.searchType,
        context: {
          industry: this.inferIndustry(searchResults),
          country: config.country,
          timeRange: config.timeRange?.from && config.timeRange?.to 
            ? `${config.timeRange.from} to ${config.timeRange.to}`
            : undefined
        }
      };

      return await CompanyIntelligenceAI.analyzeCompanyData(analysisRequest);
    } catch (error) {
      console.warn('[CompanySearchService] AI analysis failed:', error);
      // Return basic analysis
      return {
        companyName: config.companyName,
        analysisType: config.searchType,
        confidence: 0.3,
        insights: {
          keyFindings: ['Analysis incomplete due to AI service error'],
          trends: [],
          opportunities: [],
          risks: []
        },
        data: {},
        metadata: {
          sourcesAnalyzed: searchResults.length,
          lastUpdated: new Date().toISOString(),
          processingTime: 0
        }
      };
    }
  }

  /**
   * Calculate overall confidence score
   */
  private static calculateOverallConfidence(
    searchResults: EventRec[],
    aiAnalysis: any
  ): number {
    const searchConfidence = searchResults.length > 0 
      ? searchResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / searchResults.length
      : 0;
    
    const aiConfidence = aiAnalysis?.confidence || 0;
    
    // Weighted average: 60% search confidence, 40% AI confidence
    return Math.round((searchConfidence * 0.6 + aiConfidence * 0.4) * 100) / 100;
  }

  /**
   * Infer industry from search results
   */
  private static inferIndustry(searchResults: EventRec[]): string | undefined {
    const industryKeywords = {
      'technology': ['software', 'tech', 'digital', 'AI', 'automation', 'cloud'],
      'finance': ['financial', 'banking', 'fintech', 'investment', 'capital'],
      'healthcare': ['health', 'medical', 'pharma', 'biotech', 'clinical'],
      'legal': ['legal', 'law', 'compliance', 'regulatory', 'litigation'],
      'manufacturing': ['manufacturing', 'industrial', 'production', 'supply chain'],
      'retail': ['retail', 'e-commerce', 'consumer', 'shopping', 'commerce']
    };

    const content = searchResults
      .map(r => `${r.title || ''} ${r.description || ''}`)
      .join(' ')
      .toLowerCase();

    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        return industry;
      }
    }

    return undefined;
  }

  /**
   * Get default time range for searches
   */
  private static getDefaultTimeRange(): { from: string; to: string } {
    const to = new Date();
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1); // Last year

    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0]
    };
  }

  /**
   * Search for company speakers across events
   */
  static async searchCompanySpeakers(
    companyName: string,
    timeRange?: { from: string; to: string }
  ): Promise<{
    speakers: Array<{
      name: string;
      title?: string;
      company: string;
      events: Array<{
        title: string;
        date: string;
        url: string;
        participationType: string;
      }>;
    }>;
    totalEvents: number;
  }> {
    const config: CompanySearchConfig = {
      companyName,
      searchType: 'event_participation',
      timeRange: timeRange || this.getDefaultTimeRange()
    };

    const result = await this.searchCompanyIntelligence(config);
    
    // Extract speakers from search results
    const speakerMap = new Map<string, any>();
    let totalEvents = 0;

    for (const event of result.results.searchResults) {
      if (event.speakers) {
        totalEvents++;
        for (const speaker of event.speakers) {
          if (speaker.org && this.isCompanyMatch(speaker.org, companyName)) {
            const speakerKey = speaker.name.toLowerCase();
            
            if (!speakerMap.has(speakerKey)) {
              speakerMap.set(speakerKey, {
                name: speaker.name,
                title: speaker.title,
                company: speaker.org,
                events: []
              });
            }
            
            speakerMap.get(speakerKey).events.push({
              title: event.title || 'Unknown Event',
              date: event.starts_at || 'Unknown Date',
              url: event.source_url,
              participationType: 'speaker'
            });
          }
        }
      }
    }

    return {
      speakers: Array.from(speakerMap.values()),
      totalEvents
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
}
