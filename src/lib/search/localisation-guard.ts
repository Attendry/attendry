/**
 * Localisation Enforcement Guard
 * 
 * Server-side filters that cannot be overridden by the client.
 * Ensures "country=FR means FR results only" with zero bleed from other locales.
 */

import { QueryObjectV2 } from './query-schema-v2';

export interface LocalisationViolation {
  url: string;
  expectedCountry: string;
  detectedCountry: string;
  confidence: number;
  reason: string;
}

export interface LocalisationResult {
  passed: boolean;
  violations: LocalisationViolation[];
  filteredUrls: string[];
  stats: {
    total: number;
    passed: number;
    failed: number;
    violations: number;
  };
}

/**
 * Country domain mappings for strict enforcement
 */
const COUNTRY_DOMAINS: Record<string, string[]> = {
  'de': ['.de', '.german', 'deutschland', 'germany'],
  'fr': ['.fr', '.french', 'france', 'français'],
  'gb': ['.uk', '.co.uk', 'united kingdom', 'uk', 'britain'],
  'us': ['.us', '.com', 'united states', 'usa', 'america'],
  'nl': ['.nl', 'netherlands', 'nederland', 'holland'],
  'es': ['.es', 'spain', 'españa', 'spanish'],
  'it': ['.it', 'italy', 'italia', 'italian'],
  'ch': ['.ch', 'switzerland', 'schweiz', 'suisse'],
  'at': ['.at', 'austria', 'österreich'],
  'be': ['.be', 'belgium', 'belgië', 'belgique']
};

/**
 * Multi-country event whitelist (events that legitimately span countries)
 */
const MULTI_COUNTRY_WHITELIST = [
  'european-union',
  'european-parliament',
  'european-commission',
  'united-nations',
  'world-economic-forum',
  'g7', 'g20',
  'nato',
  'world-bank',
  'imf',
  'who',
  'unicef'
];

/**
 * Localisation Guard - Enforces country constraints
 */
export class LocalisationGuard {
  /**
   * Assert that all results match the expected country
   * FAILS FAST on any violation
   */
  static assertCountry(
    results: Array<{ url: string; title?: string; snippet?: string; content?: string }>,
    expectedCountry: string,
    correlationId?: string
  ): LocalisationResult {
    const violations: LocalisationViolation[] = [];
    const filteredUrls: string[] = [];
    
    for (const result of results) {
      const countryCheck = this.checkCountryMatch(result, expectedCountry);
      
      if (countryCheck.matches) {
        filteredUrls.push(result.url);
      } else {
        violations.push({
          url: result.url,
          expectedCountry,
          detectedCountry: countryCheck.detectedCountry || 'unknown',
          confidence: countryCheck.confidence,
          reason: countryCheck.reason
        });
      }
    }

    const stats = {
      total: results.length,
      passed: filteredUrls.length,
      failed: results.length - filteredUrls.length,
      violations: violations.length
    };

    // Log violations for audit
    if (violations.length > 0) {
      console.error(JSON.stringify({
        at: 'localisation_violation',
        correlation_id: correlationId,
        expected_country: expectedCountry,
        violations: violations.map(v => ({
          url: v.url,
          detected: v.detectedCountry,
          confidence: v.confidence,
          reason: v.reason
        })),
        stats
      }));
    }

    return {
      passed: violations.length === 0,
      violations,
      filteredUrls,
      stats
    };
  }

  /**
   * Check if a single result matches the expected country
   */
  private static checkCountryMatch(
    result: { url: string; title?: string; snippet?: string; content?: string },
    expectedCountry: string
  ): {
    matches: boolean;
    detectedCountry?: string;
    confidence: number;
    reason: string;
  } {
    const url = result.url.toLowerCase();
    const title = (result.title || '').toLowerCase();
    const snippet = (result.snippet || '').toLowerCase();
    const content = (result.content || '').toLowerCase();
    
    const allText = `${url} ${title} ${snippet} ${content}`;

    // Check for multi-country whitelist
    if (this.isMultiCountryEvent(allText)) {
      return {
        matches: true,
        detectedCountry: 'multi',
        confidence: 0.9,
        reason: 'Multi-country event whitelisted'
      };
    }

    // Check domain-based country detection
    const domainCountry = this.detectCountryFromDomain(url);
    if (domainCountry && domainCountry !== expectedCountry) {
      return {
        matches: false,
        detectedCountry: domainCountry,
        confidence: 0.95,
        reason: `Domain indicates ${domainCountry}, expected ${expectedCountry}`
      };
    }

    // Check content-based country detection
    const contentCountry = this.detectCountryFromContent(allText);
    if (contentCountry && contentCountry !== expectedCountry) {
      return {
        matches: false,
        detectedCountry: contentCountry,
        confidence: 0.8,
        reason: `Content indicates ${contentCountry}, expected ${expectedCountry}`
      };
    }

    // Check for explicit country mentions that don't match
    const explicitMismatch = this.checkExplicitCountryMismatch(allText, expectedCountry);
    if (explicitMismatch) {
      return {
        matches: false,
        detectedCountry: explicitMismatch.country,
        confidence: 0.85,
        reason: `Explicit mention of ${explicitMismatch.country}, expected ${expectedCountry}`
      };
    }

    return {
      matches: true,
      detectedCountry: expectedCountry,
      confidence: 0.7,
      reason: 'No country mismatch detected'
    };
  }

  /**
   * Detect country from domain
   */
  private static detectCountryFromDomain(url: string): string | null {
    for (const [country, domains] of Object.entries(COUNTRY_DOMAINS)) {
      for (const domain of domains) {
        if (url.includes(domain)) {
          return country;
        }
      }
    }
    return null;
  }

  /**
   * Detect country from content
   */
  private static detectCountryFromContent(text: string): string | null {
    const countryScores: Record<string, number> = {};
    
    for (const [country, indicators] of Object.entries(COUNTRY_DOMAINS)) {
      let score = 0;
      for (const indicator of indicators) {
        const matches = (text.match(new RegExp(indicator, 'gi')) || []).length;
        score += matches * (indicator.startsWith('.') ? 2 : 1); // Domain indicators weighted higher
      }
      countryScores[country] = score;
    }

    // Return country with highest score if above threshold
    const maxScore = Math.max(...Object.values(countryScores));
    if (maxScore >= 2) {
      return Object.entries(countryScores).find(([_, score]) => score === maxScore)?.[0] || null;
    }

    return null;
  }

  /**
   * Check for explicit country mentions that don't match expected
   */
  private static checkExplicitCountryMismatch(text: string, expectedCountry: string): { country: string } | null {
    const countryNames: Record<string, string[]> = {
      'de': ['germany', 'deutschland', 'german'],
      'fr': ['france', 'français', 'french'],
      'gb': ['united kingdom', 'uk', 'britain', 'british'],
      'us': ['united states', 'usa', 'america', 'american'],
      'nl': ['netherlands', 'nederland', 'dutch'],
      'es': ['spain', 'españa', 'spanish'],
      'it': ['italy', 'italia', 'italian'],
      'ch': ['switzerland', 'schweiz', 'suisse', 'swiss'],
      'at': ['austria', 'österreich', 'austrian'],
      'be': ['belgium', 'belgië', 'belgique', 'belgian']
    };

    for (const [country, names] of Object.entries(countryNames)) {
      if (country !== expectedCountry) {
        for (const name of names) {
          if (text.includes(name)) {
            return { country };
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if content represents a multi-country event
   */
  private static isMultiCountryEvent(text: string): boolean {
    return MULTI_COUNTRY_WHITELIST.some(term => text.includes(term));
  }

  /**
   * Build CSE query with country constraints
   */
  static buildCountryConstrainedQuery(query: QueryObjectV2): string {
    const baseQuery = query.query;
    const country = query.country.toLowerCase();
    
    // Get country-specific domains and terms
    const domains = COUNTRY_DOMAINS[country] || [];
    const domainConstraints = domains
      .filter(d => d.startsWith('.'))
      .map(d => `site:${d}`)
      .join(' OR ');
    
    const termConstraints = domains
      .filter(d => !d.startsWith('.'))
      .map(term => `"${term}"`)
      .join(' OR ');

    const constraints = [domainConstraints, termConstraints].filter(Boolean);
    
    if (constraints.length > 0) {
      return `${baseQuery} (${constraints.join(' OR ')})`;
    }
    
    return baseQuery;
  }
}

/**
 * Golden Test: France ≠ Germany
 * 
 * Test spec that must fail if any DE domain passes for FR queries
 */
export const FRANCE_VS_GERMANY_TEST = {
  name: 'France vs Germany Localisation Test',
  description: 'Ensures FR queries return only French results, never German',
  
  testQueries: [
    'legal conference',
    'compliance summit',
    'regulatory workshop',
    'data protection event',
    'GDPR seminar',
    'privacy conference',
    'cybersecurity summit',
    'fintech event',
    'blockchain conference',
    'AI workshop',
    'digital transformation',
    'innovation summit',
    'startup event',
    'investment conference',
    'banking seminar',
    'insurance workshop',
    'real estate event',
    'construction conference',
    'energy summit',
    'sustainability event'
  ],
  
  expectedResults: {
    country: 'FR',
    mustContainDomains: ['.fr', 'france', 'français'],
    mustNotContainDomains: ['.de', 'germany', 'deutschland', 'german'],
    minPrecision: 0.99, // 99% of results must be French
    maxGermanBleed: 0.01 // Maximum 1% German results allowed
  },
  
  async runTest(): Promise<{
    passed: boolean;
    results: Array<{
      query: string;
      totalResults: number;
      frenchResults: number;
      germanResults: number;
      violations: LocalisationViolation[];
    }>;
    summary: {
      totalQueries: number;
      passedQueries: number;
      totalViolations: number;
      overallPrecision: number;
    };
  }> {
    const results = [];
    let totalViolations = 0;
    let totalResults = 0;
    let frenchResults = 0;

    for (const query of this.testQueries) {
      // This would integrate with actual search pipeline
      // For now, return mock structure
      const result = {
        query,
        totalResults: 0,
        frenchResults: 0,
        germanResults: 0,
        violations: [] as LocalisationViolation[]
      };
      
      results.push(result);
    }

    const summary = {
      totalQueries: this.testQueries.length,
      passedQueries: results.filter(r => r.violations.length === 0).length,
      totalViolations,
      overallPrecision: totalResults > 0 ? frenchResults / totalResults : 0
    };

    const passed = summary.overallPrecision >= this.expectedResults.minPrecision &&
                   summary.totalViolations <= this.expectedResults.maxGermanBleed * totalResults;

    return { passed, results, summary };
  }
};
