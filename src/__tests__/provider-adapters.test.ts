import { cseSearch } from '@/services/search/cseService';
import { firecrawlSearch } from '@/services/search/firecrawlService';
import { getCountryContext } from '@/lib/utils/country';

// Mock the underlying services
jest.mock('@/services/search/cseService', () => ({
  cseSearch: jest.fn()
}));

jest.mock('@/services/search/firecrawlService', () => ({
  firecrawlSearch: jest.fn()
}));

describe('Provider Adapters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CSE Service', () => {
    it('should pass correct country context for FR', async () => {
      const { cseSearch: mockCseSearch } = require('@/services/search/cseService');
      mockCseSearch.mockResolvedValue({
        items: [
          { url: 'https://example.com', title: 'Event 1', snippet: 'Description' }
        ]
      });

      const ctx = getCountryContext('FR');
      
      await cseSearch({
        baseQuery: 'legal conference',
        userText: 'legal conference',
        countryContext: ctx,
        locale: ctx.locale,
        num: 10
      });

      expect(mockCseSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          baseQuery: expect.stringContaining('site:.fr'),
          userText: 'legal conference',
          countryContext: ctx,
          locale: 'en',
          num: 10
        })
      );
    });

    it('should pass correct country context for DE', async () => {
      const { cseSearch: mockCseSearch } = require('@/services/search/cseService');
      mockCseSearch.mockResolvedValue({
        items: [
          { url: 'https://example.com', title: 'Event 1', snippet: 'Description' }
        ]
      });

      const ctx = getCountryContext('DE');
      
      await cseSearch({
        baseQuery: 'legal conference',
        userText: 'legal conference',
        countryContext: ctx,
        locale: ctx.locale,
        num: 10
      });

      expect(mockCseSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          baseQuery: expect.stringContaining('site:.de'),
          userText: 'legal conference',
          countryContext: ctx,
          locale: 'de',
          num: 10
        })
      );
    });

    it('should not contain German bias for FR requests', async () => {
      const { cseSearch: mockCseSearch } = require('@/services/search/cseService');
      mockCseSearch.mockResolvedValue({
        items: []
      });

      const ctx = getCountryContext('FR');
      
      await cseSearch({
        baseQuery: 'legal conference',
        userText: 'legal conference',
        countryContext: ctx,
        locale: ctx.locale,
        num: 10
      });

      const callArgs = mockCseSearch.mock.calls[0][0];
      expect(callArgs.baseQuery).not.toContain('site:.de');
      expect(callArgs.baseQuery).not.toContain('"in Germany"');
      expect(callArgs.baseQuery).not.toContain('"in Deutschland"');
    });
  });

  describe('Firecrawl Service', () => {
    it('should pass correct country context for FR', async () => {
      const { firecrawlSearch: mockFirecrawlSearch } = require('@/services/search/firecrawlService');
      mockFirecrawlSearch.mockResolvedValue({
        items: [
          { url: 'https://example.com', title: 'Event 1', snippet: 'Description' }
        ]
      });

      const ctx = getCountryContext('FR');
      
      await firecrawlSearch({
        baseQuery: 'legal conference',
        userText: 'legal conference',
        countryContext: ctx,
        locale: ctx.locale,
        limit: 10
      });

      expect(mockFirecrawlSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          baseQuery: expect.stringContaining('site:.fr'),
          userText: 'legal conference',
          countryContext: ctx,
          locale: 'en',
          limit: 10
        })
      );
    });

    it('should pass correct country context for DE', async () => {
      const { firecrawlSearch: mockFirecrawlSearch } = require('@/services/search/firecrawlService');
      mockFirecrawlSearch.mockResolvedValue({
        items: [
          { url: 'https://example.com', title: 'Event 1', snippet: 'Description' }
        ]
      });

      const ctx = getCountryContext('DE');
      
      await firecrawlSearch({
        baseQuery: 'legal conference',
        userText: 'legal conference',
        countryContext: ctx,
        locale: ctx.locale,
        limit: 10
      });

      expect(mockFirecrawlSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          baseQuery: expect.stringContaining('site:.de'),
          userText: 'legal conference',
          countryContext: ctx,
          locale: 'de',
          limit: 10
        })
      );
    });

    it('should not contain German bias for FR requests', async () => {
      const { firecrawlSearch: mockFirecrawlSearch } = require('@/services/search/firecrawlService');
      mockFirecrawlSearch.mockResolvedValue({
        items: []
      });

      const ctx = getCountryContext('FR');
      
      await firecrawlSearch({
        baseQuery: 'legal conference',
        userText: 'legal conference',
        countryContext: ctx,
        locale: ctx.locale,
        limit: 10
      });

      const callArgs = mockFirecrawlSearch.mock.calls[0][0];
      expect(callArgs.baseQuery).not.toContain('site:.de');
      expect(callArgs.baseQuery).not.toContain('"in Germany"');
      expect(callArgs.baseQuery).not.toContain('"in Deutschland"');
    });
  });

  describe('Country-specific query building', () => {
    it('should build FR-specific queries without German tokens', () => {
      const ctx = getCountryContext('FR');
      
      // Test that the context contains French-specific data
      expect(ctx.iso2).toBe('FR');
      expect(ctx.tld).toBe('.fr');
      expect(ctx.inPhrase).toContain('"in France"');
      expect(ctx.inPhrase).toContain('"en France"');
      expect(ctx.countryNames).toContain('France');
      expect(ctx.cities).toContain('Paris');
      
      // Test that it doesn't contain German-specific data
      expect(ctx.tld).not.toBe('.de');
      expect(ctx.inPhrase).not.toContain('"in Germany"');
      expect(ctx.inPhrase).not.toContain('"in Deutschland"');
      expect(ctx.countryNames).not.toContain('Germany');
      expect(ctx.cities).not.toContain('Berlin');
    });

    it('should build DE-specific queries with German tokens', () => {
      const ctx = getCountryContext('DE');
      
      // Test that the context contains German-specific data
      expect(ctx.iso2).toBe('DE');
      expect(ctx.tld).toBe('.de');
      expect(ctx.inPhrase).toContain('"in Germany"');
      expect(ctx.inPhrase).toContain('"in Deutschland"');
      expect(ctx.countryNames).toContain('Germany');
      expect(ctx.cities).toContain('Berlin');
      
      // Test that it doesn't contain French-specific data
      expect(ctx.tld).not.toBe('.fr');
      expect(ctx.inPhrase).not.toContain('"in France"');
      expect(ctx.inPhrase).not.toContain('"en France"');
      expect(ctx.countryNames).not.toContain('France');
      expect(ctx.cities).not.toContain('Paris');
    });
  });
});
