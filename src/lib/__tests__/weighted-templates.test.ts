/**
 * Tests for Weighted Templates System
 */

import { buildWeightedQuery, buildWeightedGeminiContext } from '../services/weighted-query-builder';
import { WEIGHTED_INDUSTRY_TEMPLATES } from '../data/weighted-templates';
import { getGeographicSuggestions } from '../data/geographic-suggestions';

describe('Weighted Templates System', () => {
  describe('buildWeightedQuery', () => {
    it('should build query with high industry-specific weight', () => {
      const template = WEIGHTED_INDUSTRY_TEMPLATES['legal-compliance'];
      const userProfile = {
        industry_terms: ['compliance', 'legal tech'],
        icp_terms: ['general counsel'],
        competitors: ['Epiq']
      };

      const result = buildWeightedQuery(template, userProfile, 'DE', 'legal events');

      expect(result.query).toContain('legal');
      expect(result.query).toContain('compliance');
      expect(result.weights.industrySpecificQuery).toBe(8);
      expect(result.negativeFilters.length).toBeGreaterThan(0);
    });

    it('should build query with low cross-industry prevention weight', () => {
      const template = WEIGHTED_INDUSTRY_TEMPLATES['legal-compliance'];
      // Set low cross-industry prevention weight
      template.precision.crossIndustryPrevention.weight = 2;

      const result = buildWeightedQuery(template, null, 'DE', 'legal events');

      expect(result.weights.crossIndustryPrevention).toBe(2);
      expect(result.negativeFilters.length).toBe(0);
    });

    it('should include user profile terms in query', () => {
      const template = WEIGHTED_INDUSTRY_TEMPLATES['legal-compliance'];
      const userProfile = {
        industry_terms: ['compliance', 'legal tech'],
        icp_terms: ['general counsel'],
        competitors: ['Epiq']
      };

      const result = buildWeightedQuery(template, userProfile, 'DE', '');

      expect(result.query).toContain('compliance');
      expect(result.query).toContain('legal tech');
      expect(result.query).toContain('general counsel');
      expect(result.query).toContain('Epiq');
    });
  });

  describe('buildWeightedGeminiContext', () => {
    it('should build context with high industry-specific weight', () => {
      const template = WEIGHTED_INDUSTRY_TEMPLATES['legal-compliance'];
      const userProfile = {
        industry_terms: ['compliance', 'legal tech'],
        icp_terms: ['general counsel'],
        competitors: ['Epiq']
      };

      const context = buildWeightedGeminiContext(template, userProfile, ['https://example.com'], 'DE');

      expect(context).toContain('Legal & Compliance');
      expect(context).toContain('compliance');
      expect(context).toContain('legal tech');
      expect(context).toContain('general counsel');
      expect(context).toContain('Epiq');
    });

    it('should include geographic context for high geographic coverage weight', () => {
      const template = WEIGHTED_INDUSTRY_TEMPLATES['legal-compliance'];
      template.precision.geographicCoverage.weight = 9;

      const context = buildWeightedGeminiContext(template, null, ['https://example.com'], 'DE');

      expect(context).toContain('Berlin');
      expect(context).toContain('München');
      expect(context).toContain('Frankfurt');
    });
  });

  describe('getGeographicSuggestions', () => {
    it('should return suggestions for legal-compliance in Germany', () => {
      const suggestions = getGeographicSuggestions('legal-compliance', 'DE');

      expect(suggestions).toBeDefined();
      expect(suggestions?.country).toBe('DE');
      expect(suggestions?.cities.length).toBeGreaterThan(0);
      expect(suggestions?.regions.length).toBeGreaterThan(0);
      expect(suggestions?.cities[0].name).toBe('Berlin');
    });

    it('should return suggestions for fintech in Germany', () => {
      const suggestions = getGeographicSuggestions('fintech', 'DE');

      expect(suggestions).toBeDefined();
      expect(suggestions?.country).toBe('DE');
      expect(suggestions?.cities[0].name).toBe('Frankfurt'); // Frankfurt is top for fintech
    });

    it('should return null for unsupported industry/country combination', () => {
      const suggestions = getGeographicSuggestions('unsupported-industry', 'DE');

      expect(suggestions).toBeNull();
    });
  });

  describe('Template Structure', () => {
    it('should have all required precision controls', () => {
      const template = WEIGHTED_INDUSTRY_TEMPLATES['legal-compliance'];

      expect(template.precision.industrySpecificQuery).toBeDefined();
      expect(template.precision.crossIndustryPrevention).toBeDefined();
      expect(template.precision.geographicCoverage).toBeDefined();
      expect(template.precision.qualityRequirements).toBeDefined();
      expect(template.precision.eventTypeSpecificity).toBeDefined();
    });

    it('should have weighted negative filters', () => {
      const template = WEIGHTED_INDUSTRY_TEMPLATES['legal-compliance'];

      expect(template.negativeFilters.industries.length).toBeGreaterThan(0);
      expect(template.negativeFilters.topics.length).toBeGreaterThan(0);
      expect(template.negativeFilters.eventTypes.length).toBeGreaterThan(0);
      expect(template.negativeFilters.platforms.length).toBeGreaterThan(0);
    });

    it('should have geographic coverage data', () => {
      const template = WEIGHTED_INDUSTRY_TEMPLATES['legal-compliance'];

      expect(template.geographicCoverage.countries.length).toBeGreaterThan(0);
      expect(template.geographicCoverage.cities.length).toBeGreaterThan(0);
      expect(template.geographicCoverage.regions.length).toBeGreaterThan(0);
    });
  });
});
