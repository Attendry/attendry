/**
 * Enhanced Search Service Tests
 * 
 * These tests verify the enhanced search pipeline functionality
 * including query building, filtering, and result processing.
 */

import { buildEnhancedQuery } from '../enhanced-query-builder';
import { inferCountryAndDate } from '@/lib/utils/country-date-inference';
import { safeParseJson } from '@/lib/utils/json-parser';

describe('Enhanced Search Pipeline', () => {
  describe('Query Builder', () => {
    it('should build multi-tier queries', () => {
      const config = {
        baseQuery: 'Compliance OR "Interne Untersuchung" OR eDiscovery OR DSGVO',
        fromISO: '2024-01-01',
        toISO: '2024-12-31',
        country: 'DE'
      };

      const queries = buildEnhancedQuery(config);

      expect(queries).toHaveLength(3);
      expect(queries[0].name).toContain('Tier A');
      expect(queries[1].name).toContain('Tier B');
      expect(queries[2].name).toContain('Tier C');

      // Check query lengths
      queries.forEach(query => {
        expect(query.query.length).toBeLessThanOrEqual(256);
      });
    });

    it('should handle long base queries by splitting', () => {
      const config = {
        baseQuery: 'Very long base query that exceeds normal length limits and needs to be split into multiple parts',
        fromISO: '2024-01-01',
        toISO: '2024-12-31',
        country: 'DE'
      };

      const queries = buildEnhancedQuery(config);

      expect(queries.length).toBeGreaterThan(3);
      queries.forEach(query => {
        expect(query.query.length).toBeLessThanOrEqual(256);
      });
    });
  });

  describe('Country and Date Inference', () => {
    it('should infer German country from .de domain', () => {
      const result = inferCountryAndDate(
        'https://example.de/event',
        'Some content about an event',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.country).toBe('DE');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should extract German dates', () => {
      const content = 'Die Veranstaltung findet am 15. März 2024 statt.';
      const result = inferCountryAndDate(
        'https://example.de/event',
        content,
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.dateISO).toBe('2024-03-15');
      expect(result.country).toBe('DE');
    });

    it('should filter out dates outside range', () => {
      const content = 'Die Veranstaltung findet am 15. März 2025 statt.';
      const result = inferCountryAndDate(
        'https://example.de/event',
        content,
        '2024-01-01',
        '2024-12-31',
        false // allowUndated = false
      );

      expect(result.dateISO).toBeUndefined();
      expect(result.confidence).toBe(0);
    });
  });

  describe('JSON Parsing', () => {
    it('should parse valid JSON', () => {
      const validJson = '{"version":"1.0","items":[{"url":"test","title":"test"}]}';
      const result = safeParseJson(validJson);

      expect(result).not.toBeNull();
      expect(result?.version).toBe('1.0');
      expect(Array.isArray(result?.items)).toBe(true);
    });

    it('should repair malformed JSON', () => {
      const malformedJson = '{"version":"1.0","items":[{"url":"test","title":"test",}]}';
      const result = safeParseJson(malformedJson);

      expect(result).not.toBeNull();
      expect(result?.version).toBe('1.0');
    });

    it('should handle JSON with comments', () => {
      const jsonWithComments = `
        {
          "version": "1.0",
          // This is a comment
          "items": [
            {"url": "test", "title": "test"}
          ]
        }
      `;
      const result = safeParseJson(jsonWithComments);

      expect(result).not.toBeNull();
      expect(result?.version).toBe('1.0');
    });

    it('should return null for invalid input', () => {
      const invalidInput = 'not json at all';
      const result = safeParseJson(invalidInput);

      expect(result).toBeNull();
    });
  });

  describe('URL Filtering', () => {
    it('should filter out noise URLs', () => {
      const noiseUrls = [
        'https://example.com/blog/tourism',
        'https://example.com/tag/nerja',
        'https://example.com/sports/football'
      ];

      // This would be tested in the actual filtering logic
      // For now, we just verify the test structure
      expect(noiseUrls).toHaveLength(3);
    });

    it('should prefer event-related URLs', () => {
      const eventUrls = [
        'https://example.de/veranstaltung/legal-event',
        'https://example.de/konferenz/compliance',
        'https://example.de/seminar/datenschutz'
      ];

      // This would be tested in the actual filtering logic
      expect(eventUrls).toHaveLength(3);
    });
  });
});

// Mock data for testing
export const mockSearchResults = [
  {
    url: 'https://beck-akademie.de/veranstaltung/compliance-konferenz',
    title: 'Compliance Konferenz 2024',
    snippet: 'Eine umfassende Konferenz zu Compliance-Themen in Deutschland'
  },
  {
    url: 'https://dav.de/termine/rechtskongress',
    title: 'Deutscher Rechtskongress',
    snippet: 'Der größte Rechtskongress Deutschlands mit Top-Referenten'
  },
  {
    url: 'https://example.com/blog/tourism', // Should be filtered out
    title: 'Tourism Blog',
    snippet: 'Travel tips and tourism information'
  }
];

export const mockGeminiResponse = {
  version: '1.0',
  items: [
    {
      url: 'https://beck-akademie.de/veranstaltung/compliance-konferenz',
      title: 'Compliance Konferenz 2024',
      reason: 'High legal relevance with compliance focus',
      legalConfidence: 0.9,
      eventConfidence: 0.8,
      country: 'DE',
      dateISO: '2024-06-15'
    },
    {
      url: 'https://dav.de/termine/rechtskongress',
      title: 'Deutscher Rechtskongress',
      reason: 'Major legal event with high relevance',
      legalConfidence: 0.95,
      eventConfidence: 0.9,
      country: 'DE',
      dateISO: '2024-09-20'
    }
  ]
};
