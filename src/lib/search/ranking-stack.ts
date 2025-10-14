/**
 * Ranking Stack: Retrieve → Rerank → Generate
 * 
 * Implements reranker-first architecture with cross-encoder support
 */

export interface SearchCandidate {
  url: string;
  title: string;
  snippet: string;
  content?: string;
  metadata?: Record<string, any>;
}

export interface RankingFeatures {
  lexicalScore: number;
  recencyScore: number;
  authorityScore: number;
  geoMatchScore: number;
  schemaScore: number;
  topicMatchScore: number;
}

export interface RankingResult {
  candidate: SearchCandidate;
  features: RankingFeatures;
  finalScore: number;
  rank: number;
}

export interface RerankerConfig {
  weights: {
    lexical: number;
    recency: number;
    authority: number;
    geo: number;
    schema: number;
    topic: number;
  };
  thresholds: {
    minScore: number;
    maxCandidates: number;
  };
}

/**
 * Default ranking configuration
 */
const DEFAULT_RERANKER_CONFIG: RerankerConfig = {
  weights: {
    lexical: 0.25,
    recency: 0.20,
    authority: 0.20,
    geo: 0.15,
    schema: 0.10,
    topic: 0.10
  },
  thresholds: {
    minScore: 0.3,
    maxCandidates: 10
  }
};

/**
 * Cross-Encoder Reranker Interface
 */
export interface CrossEncoderReranker {
  name: string;
  rank(query: string, candidates: SearchCandidate[]): Promise<Array<{ candidate: SearchCandidate; score: number }>>;
  isAvailable(): Promise<boolean>;
}

/**
 * Lexical Reranker (Fallback)
 */
export class LexicalReranker implements CrossEncoderReranker {
  name = 'lexical';

  async rank(query: string, candidates: SearchCandidate[]): Promise<Array<{ candidate: SearchCandidate; score: number }>> {
    const queryTerms = this.tokenize(query.toLowerCase());
    
    return candidates.map(candidate => {
      const titleTerms = this.tokenize(candidate.title.toLowerCase());
      const snippetTerms = this.tokenize(candidate.snippet.toLowerCase());
      const contentTerms = candidate.content ? this.tokenize(candidate.content.toLowerCase()) : [];
      
      const allTerms = [...titleTerms, ...snippetTerms, ...contentTerms];
      
      // Calculate TF-IDF-like score
      let score = 0;
      for (const queryTerm of queryTerms) {
        const termCount = allTerms.filter(term => term === queryTerm).length;
        const totalTerms = allTerms.length;
        if (totalTerms > 0) {
          score += termCount / totalTerms;
        }
      }
      
      // Normalize by query length
      score = score / queryTerms.length;
      
      return { candidate, score };
    });
  }

  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }

  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2);
  }
}

/**
 * Feature-Based Reranker
 */
export class FeatureBasedReranker {
  private config: RerankerConfig;
  private crossEncoder?: CrossEncoderReranker;

  constructor(config: RerankerConfig = DEFAULT_RERANKER_CONFIG, crossEncoder?: CrossEncoderReranker) {
    this.config = config;
    this.crossEncoder = crossEncoder;
  }

  /**
   * Rerank candidates using feature scoring
   */
  async rerank(query: string, candidates: SearchCandidate[], country: string): Promise<RankingResult[]> {
    // Step 1: Get cross-encoder scores if available
    let crossEncoderScores: Array<{ candidate: SearchCandidate; score: number }> = [];
    
    if (this.crossEncoder && await this.crossEncoder.isAvailable()) {
      try {
        crossEncoderScores = await this.crossEncoder.rank(query, candidates);
      } catch (error) {
        console.warn('Cross-encoder failed, falling back to lexical:', error);
        const lexicalReranker = new LexicalReranker();
        crossEncoderScores = await lexicalReranker.rank(query, candidates);
      }
    } else {
      const lexicalReranker = new LexicalReranker();
      crossEncoderScores = await lexicalReranker.rank(query, candidates);
    }

    // Step 2: Calculate additional features
    const results: RankingResult[] = [];
    
    for (const { candidate, score: lexicalScore } of crossEncoderScores) {
      const features = await this.calculateFeatures(candidate, query, country);
      const finalScore = this.calculateFinalScore(features, lexicalScore);
      
      if (finalScore >= this.config.thresholds.minScore) {
        results.push({
          candidate,
          features,
          finalScore,
          rank: 0 // Will be set after sorting
        });
      }
    }

    // Step 3: Sort by final score and assign ranks
    results.sort((a, b) => b.finalScore - a.finalScore);
    results.forEach((result, index) => {
      result.rank = index + 1;
    });

    // Step 4: Limit results
    return results.slice(0, this.config.thresholds.maxCandidates);
  }

  /**
   * Calculate ranking features for a candidate
   */
  private async calculateFeatures(candidate: SearchCandidate, query: string, country: string): Promise<RankingFeatures> {
    return {
      lexicalScore: await this.calculateLexicalScore(candidate, query),
      recencyScore: this.calculateRecencyScore(candidate),
      authorityScore: this.calculateAuthorityScore(candidate),
      geoMatchScore: this.calculateGeoMatchScore(candidate, country),
      schemaScore: this.calculateSchemaScore(candidate),
      topicMatchScore: this.calculateTopicMatchScore(candidate, query)
    };
  }

  /**
   * Calculate lexical relevance score
   */
  private async calculateLexicalScore(candidate: SearchCandidate, query: string): Promise<number> {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const title = candidate.title.toLowerCase();
    const snippet = candidate.snippet.toLowerCase();
    const content = candidate.content?.toLowerCase() || '';
    
    let score = 0;
    
    // Title matches weighted higher
    for (const term of queryTerms) {
      if (title.includes(term)) score += 0.4;
      if (snippet.includes(term)) score += 0.3;
      if (content.includes(term)) score += 0.1;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate recency score based on publication date
   */
  private calculateRecencyScore(candidate: SearchCandidate): number {
    // Extract date from metadata or URL
    const dateStr = candidate.metadata?.publishedDate || candidate.metadata?.lastModified;
    
    if (!dateStr) return 0.5; // Neutral if no date
    
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const daysDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      
      // Score decreases with age
      if (daysDiff <= 7) return 1.0;
      if (daysDiff <= 30) return 0.8;
      if (daysDiff <= 90) return 0.6;
      if (daysDiff <= 365) return 0.4;
      return 0.2;
    } catch {
      return 0.5;
    }
  }

  /**
   * Calculate authority score based on domain
   */
  private calculateAuthorityScore(candidate: SearchCandidate): number {
    try {
      const url = new URL(candidate.url);
      const domain = url.hostname.toLowerCase();
      
      // Official domains
      if (domain.endsWith('.gov') || domain.endsWith('.edu')) return 1.0;
      if (domain.endsWith('.org')) return 0.9;
      
      // Known authoritative domains
      const authoritativeDomains = [
        'eventbrite.com', 'meetup.com', 'linkedin.com', 'facebook.com',
        'conference.com', 'summit.com', 'workshop.com'
      ];
      
      if (authoritativeDomains.some(auth => domain.includes(auth))) return 0.8;
      
      // HTTPS bonus
      if (url.protocol === 'https:') return 0.7;
      
      return 0.5; // Default score
    } catch {
      return 0.5;
    }
  }

  /**
   * Calculate geo-match score
   */
  private calculateGeoMatchScore(candidate: SearchCandidate, country: string): number {
    const url = candidate.url.toLowerCase();
    const title = candidate.title.toLowerCase();
    const snippet = candidate.snippet.toLowerCase();
    const content = candidate.content?.toLowerCase() || '';
    
    const allText = `${url} ${title} ${snippet} ${content}`;
    
    // Country-specific indicators
    const countryIndicators: Record<string, string[]> = {
      'de': ['.de', 'germany', 'deutschland', 'german'],
      'fr': ['.fr', 'france', 'français', 'french'],
      'gb': ['.uk', '.co.uk', 'united kingdom', 'uk', 'britain'],
      'us': ['.us', 'united states', 'usa', 'america'],
      'nl': ['.nl', 'netherlands', 'nederland', 'dutch'],
      'es': ['.es', 'spain', 'españa', 'spanish'],
      'it': ['.it', 'italy', 'italia', 'italian'],
      'ch': ['.ch', 'switzerland', 'schweiz', 'swiss'],
      'at': ['.at', 'austria', 'österreich'],
      'be': ['.be', 'belgium', 'belgië', 'belgian']
    };
    
    const indicators = countryIndicators[country.toLowerCase()] || [];
    let score = 0;
    
    for (const indicator of indicators) {
      if (allText.includes(indicator)) {
        score += indicator.startsWith('.') ? 0.3 : 0.1; // Domain indicators weighted higher
      }
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate schema score (structured data presence)
   */
  private calculateSchemaScore(candidate: SearchCandidate): number {
    const content = candidate.content || '';
    
    // Check for structured data indicators
    const schemaIndicators = [
      'json-ld', 'microdata', 'rdfa',
      'event', 'organization', 'person',
      'startdate', 'enddate', 'location',
      'speaker', 'agenda', 'schedule'
    ];
    
    let score = 0;
    for (const indicator of schemaIndicators) {
      if (content.toLowerCase().includes(indicator)) {
        score += 0.1;
      }
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate topic match score
   */
  private calculateTopicMatchScore(candidate: SearchCandidate, query: string): number {
    const queryLower = query.toLowerCase();
    const title = candidate.title.toLowerCase();
    const snippet = candidate.snippet.toLowerCase();
    
    // Event-related terms
    const eventTerms = [
      'conference', 'summit', 'workshop', 'seminar', 'meeting',
      'event', 'forum', 'symposium', 'exhibition', 'expo',
      'webinar', 'training', 'course', 'session', 'panel'
    ];
    
    let score = 0;
    
    // Check for event terms in query and content
    for (const term of eventTerms) {
      if (queryLower.includes(term) && (title.includes(term) || snippet.includes(term))) {
        score += 0.2;
      }
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate final weighted score
   */
  private calculateFinalScore(features: RankingFeatures, lexicalScore: number): number {
    return (
      lexicalScore * this.config.weights.lexical +
      features.recencyScore * this.config.weights.recency +
      features.authorityScore * this.config.weights.authority +
      features.geoMatchScore * this.config.weights.geo +
      features.schemaScore * this.config.weights.schema +
      features.topicMatchScore * this.config.weights.topic
    );
  }
}

/**
 * Ranking Stack Orchestrator
 */
export class RankingStack {
  private reranker: FeatureBasedReranker;
  private crossEncoder?: CrossEncoderReranker;

  constructor(crossEncoder?: CrossEncoderReranker) {
    this.crossEncoder = crossEncoder;
    this.reranker = new FeatureBasedReranker(DEFAULT_RERANKER_CONFIG, crossEncoder);
  }

  /**
   * Execute full ranking pipeline: Retrieve → Rerank → Generate
   */
  async execute(
    query: string,
    candidates: SearchCandidate[],
    country: string,
    maxResults: number = 10
  ): Promise<{
    rankedResults: RankingResult[];
    stats: {
      totalCandidates: number;
      rankedCandidates: number;
      rerankerUsed: string;
      processingTimeMs: number;
    };
  }> {
    const startTime = Date.now();
    
    // Step 1: Retrieve (candidates already provided)
    console.log(`Ranking ${candidates.length} candidates for query: ${query}`);
    
    // Step 2: Rerank
    const rankedResults = await this.reranker.rerank(query, candidates, country);
    
    // Step 3: Limit results
    const finalResults = rankedResults.slice(0, maxResults);
    
    const processingTime = Date.now() - startTime;
    
    return {
      rankedResults: finalResults,
      stats: {
        totalCandidates: candidates.length,
        rankedCandidates: finalResults.length,
        rerankerUsed: this.crossEncoder?.name || 'lexical',
        processingTimeMs: processingTime
      }
    };
  }

  /**
   * Update ranking weights for tuning
   */
  updateWeights(weights: Partial<RerankerConfig['weights']>): void {
    this.reranker = new FeatureBasedReranker({
      ...DEFAULT_RERANKER_CONFIG,
      weights: { ...DEFAULT_RERANKER_CONFIG.weights, ...weights }
    }, this.crossEncoder);
  }
}
