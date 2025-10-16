import { describe, it, expect } from '@jest/globals';
import { buildEffectiveQuery, buildDeEventQuery } from '@/search/query';
import { getCountryContext } from '@/lib/utils/country';

describe('Query Builder', () => {
  describe('buildEffectiveQuery', () => {
    it('should build query without country context', () => {
      const result = buildEffectiveQuery({
        baseQuery: 'legal conference',
        userText: 'legal conference'
      });
      expect(result).toBe('(legal conference)');
    });

    it('should use userText when provided', () => {
      const result = buildEffectiveQuery({
        baseQuery: 'legal conference',
        userText: 'compliance event'
      });
      expect(result).toBe('(compliance event)');
    });

    it('should build country-aware query for FR', () => {
      const ctx = getCountryContext('FR');
      const result = buildEffectiveQuery({
        baseQuery: 'legal conference',
        userText: 'legal conference',
        countryContext: ctx
      });
      
      // Should contain French bias
      expect(result).toContain('site:.fr');
      expect(result).toContain('"in France"');
      expect(result).toContain('"en France"');
      expect(result).toContain('France');
      expect(result).toContain('Paris');
      
      // Should NOT contain German bias
      expect(result).not.toContain('site:.de');
      expect(result).not.toContain('"in Germany"');
      expect(result).not.toContain('"in Deutschland"');
      expect(result).not.toContain('Germany');
      expect(result).not.toContain('Berlin');
    });

    it('should build country-aware query for DE', () => {
      const ctx = getCountryContext('DE');
      const result = buildEffectiveQuery({
        baseQuery: 'legal conference',
        userText: 'legal conference',
        countryContext: ctx
      });
      
      // Should contain German bias
      expect(result).toContain('site:.de');
      expect(result).toContain('"in Germany"');
      expect(result).toContain('"in Deutschland"');
      expect(result).toContain('Germany');
      expect(result).toContain('Berlin');
      
      // Should NOT contain French bias
      expect(result).not.toContain('site:.fr');
      expect(result).not.toContain('"in France"');
      expect(result).not.toContain('"en France"');
      expect(result).not.toContain('France');
      expect(result).not.toContain('Paris');
    });

    it('should include negative sites in query', () => {
      const ctx = getCountryContext('FR');
      const result = buildEffectiveQuery({
        baseQuery: 'legal conference',
        userText: 'legal conference',
        countryContext: ctx
      });
      
      expect(result).toContain('-reddit');
      expect(result).toContain('-forum');
    });

    it('should respect maxLen parameter', () => {
      const ctx = getCountryContext('FR');
      const result = buildEffectiveQuery({
        baseQuery: 'legal conference',
        userText: 'legal conference',
        countryContext: ctx,
        maxLen: 50
      });
      
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('should handle complex userText with parentheses', () => {
      const result = buildEffectiveQuery({
        baseQuery: 'legal conference',
        userText: '(legal AND compliance) OR (regulatory AND event)'
      });
      const normalized = result.replace(/^\(+/, '(').replace(/\)+$/, ')');
      expect(normalized).toBe('(legal AND compliance) OR (regulatory AND event)');
    });

    it('should handle empty userText', () => {
      const result = buildEffectiveQuery({
        baseQuery: 'legal conference',
        userText: ''
      });
      expect(result).toBe('(legal conference)');
    });

    it('should handle null userText', () => {
      const result = buildEffectiveQuery({
        baseQuery: 'legal conference',
        userText: null as any
      });
      expect(result).toBe('(legal conference)');
    });
  });
});

describe('buildDeEventQuery', () => {
  it('should produce lean DE event query without duplicated negatives', () => {
    const query = buildDeEventQuery();
    const negativeBlock = '-reddit -Mumsnet -forum';
    const occurrences = query.split(negativeBlock).length - 1;
    expect(occurrences).toBe(1);
  });

  it('should keep query length under 400 characters', () => {
    const query = buildDeEventQuery();
    expect(query.length).toBeLessThan(400);
  });
});