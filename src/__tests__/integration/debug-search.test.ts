/**
 * Debug Search Integration Tests
 * 
 * Tests the debug search endpoint and orchestrator to ensure
 * zero-result prevention works correctly.
 */

import { runSearchOrchestrator } from '@/lib/search/search-orchestrator';
import { FLAGS } from '@/config/flags';

// Mock the search services
jest.mock('@/lib/search/tier-guardrails', () => ({
  executeAllTiers: jest.fn().mockResolvedValue([
    {
      title: 'Legal Tech Conference 2024',
      url: 'https://example.com/legal-tech-2024',
      snippet: 'Legal technology conference in Berlin',
      tier: 'A'
    },
    {
      title: 'Compliance Summit 2024',
      url: 'https://example.com/compliance-summit-2024',
      snippet: 'Compliance summit in Munich',
      tier: 'A'
    }
  ])
}));

jest.mock('@/lib/ai/gemini-bypass', () => ({
  prioritizeWithBypass: jest.fn().mockResolvedValue({
    prioritizedUrls: [
      'https://example.com/legal-tech-2024',
      'https://example.com/compliance-summit-2024'
    ],
    prioritizationStats: {
      total: 2,
      prioritized: 2,
      reasons: ['Heuristic scoring successful']
    },
    bypassed: true,
    repairUsed: false
  })
}));

jest.mock('@/lib/extraction/timeout-handler', () => ({
  extractWithFallbacks: jest.fn().mockResolvedValue([
    {
      url: 'https://example.com/legal-tech-2024',
      title: 'Legal Tech Conference 2024',
      description: 'Legal technology conference',
      startsAt: '2024-01-15T09:00:00Z',
      endsAt: '2024-01-15T17:00:00Z',
      venue: 'Conference Center',
      city: 'Berlin',
      country: 'DE',
      speakers: [
        { name: 'Speaker 1', title: 'Expert' }
      ],
      success: true
    },
    {
      url: 'https://example.com/compliance-summit-2024',
      title: 'Compliance Summit 2024',
      description: 'Compliance summit',
      startsAt: '2024-01-20T09:00:00Z',
      endsAt: '2024-01-20T17:00:00Z',
      venue: 'Summit Center',
      city: 'Munich',
      country: 'DE',
      speakers: [
        { name: 'Speaker 2', title: 'Professional' }
      ],
      success: true
    }
  ])
}));

jest.mock('@/lib/filters/relaxed-filters', () => ({
  applyRelaxedFilters: jest.fn().mockImplementation((items) => items)
}));

describe('Debug Search Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Search Orchestrator', () => {
    it('should never return zero results', async () => {
      const config = {
        query: 'legal compliance conference',
        country: 'DE',
        fromDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        toDate: new Date().toISOString()
      };

      const result = await runSearchOrchestrator(config);

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.trace).toBeDefined();
      expect(result.telemetry).toBeDefined();
    });

    it('should handle search failures gracefully', async () => {
      // Mock search failure
      const { executeAllTiers } = await import('@/lib/search/tier-guardrails');
      executeAllTiers.mockResolvedValueOnce([]);

      const config = {
        query: 'legal compliance conference',
        country: 'DE',
        fromDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        toDate: new Date().toISOString()
      };

      const result = await runSearchOrchestrator(config);

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.fallbackUsed).toBe(true);
      expect(result.issues).toContain('No search results found');
    });

    it('should handle extraction failures gracefully', async () => {
      // Mock extraction failure
      const { extractWithFallbacks } = require('@/lib/extraction/timeout-handler');
      extractWithFallbacks.mockResolvedValueOnce([]);

      const config = {
        query: 'legal compliance conference',
        country: 'DE',
        fromDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        toDate: new Date().toISOString()
      };

      const result = await runSearchOrchestrator(config);

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should handle prioritization failures gracefully', async () => {
      // Mock prioritization failure
      const { prioritizeWithBypass } = require('@/lib/ai/gemini-bypass');
      prioritizeWithBypass.mockResolvedValueOnce({
        prioritizedUrls: [],
        prioritizationStats: { total: 0, prioritized: 0, reasons: [] },
        bypassed: true,
        repairUsed: false
      });

      const config = {
        query: 'legal compliance conference',
        country: 'DE',
        fromDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        toDate: new Date().toISOString()
      };

      const result = await runSearchOrchestrator(config);

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should provide comprehensive telemetry', async () => {
      const config = {
        query: 'legal compliance conference',
        country: 'DE',
        fromDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        toDate: new Date().toISOString()
      };

      const result = await runSearchOrchestrator(config);

      expect(result.telemetry).toBeDefined();
      expect(result.telemetry.searchId).toBeDefined();
      expect(result.telemetry.query).toBe(config.query);
      expect(result.telemetry.country).toBe(config.country);
      expect(result.telemetry.results).toBeDefined();
      expect(result.telemetry.performance).toBeDefined();
      expect(result.telemetry.flags).toBeDefined();
      expect(result.telemetry.trace).toBeDefined();
    });

    it('should track performance metrics', async () => {
      const config = {
        query: 'legal compliance conference',
        country: 'DE',
        fromDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        toDate: new Date().toISOString()
      };

      const result = await runSearchOrchestrator(config);

      expect(result.telemetry.performance.totalMs).toBeGreaterThan(0);
      expect(result.telemetry.performance.searchMs).toBeGreaterThan(0);
      expect(result.telemetry.performance.prioritizationMs).toBeGreaterThan(0);
      expect(result.telemetry.performance.extractionMs).toBeGreaterThan(0);
      expect(result.telemetry.performance.filteringMs).toBeGreaterThan(0);
    });

    it('should track search trace', async () => {
      const config = {
        query: 'legal compliance conference',
        country: 'DE',
        fromDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        toDate: new Date().toISOString()
      };

      const result = await runSearchOrchestrator(config);

      expect(result.trace).toBeDefined();
      expect(result.trace.marker).toBeDefined();
      expect(result.trace.queries).toBeDefined();
      expect(result.trace.results).toBeDefined();
      expect(result.trace.prioritization).toBeDefined();
      expect(result.trace.extract).toBeDefined();
      expect(result.trace.filters).toBeDefined();
      expect(result.trace.performance).toBeDefined();
    });
  });

  describe('Feature Flags', () => {
    it('should respect bypass flags', async () => {
      const originalBypass = FLAGS.BYPASS_GEMINI_JSON_STRICT;
      FLAGS.BYPASS_GEMINI_JSON_STRICT = true;

      const config = {
        query: 'legal compliance conference',
        country: 'DE',
        fromDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        toDate: new Date().toISOString()
      };

      const result = await runSearchOrchestrator(config);

      expect(result.telemetry.flags.bypassGemini).toBe(true);

      // Restore original value
      FLAGS.BYPASS_GEMINI_JSON_STRICT = originalBypass;
    });

    it('should respect relaxation flags', async () => {
      const originalRelax = FLAGS.RELAX_COUNTRY;
      FLAGS.RELAX_COUNTRY = true;

      const config = {
        query: 'legal compliance conference',
        country: 'DE',
        fromDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        toDate: new Date().toISOString()
      };

      const result = await runSearchOrchestrator(config);

      expect(result.telemetry.flags.relaxCountry).toBe(true);

      // Restore original value
      FLAGS.RELAX_COUNTRY = originalRelax;
    });
  });

  describe('Error Handling', () => {
    it('should handle complete system failure', async () => {
      // Mock complete failure
      const { executeAllTiers } = await import('@/lib/search/tier-guardrails');
      executeAllTiers.mockRejectedValueOnce(new Error('Complete system failure'));

      const config = {
        query: 'legal compliance conference',
        country: 'DE',
        fromDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        toDate: new Date().toISOString()
      };

      const result = await runSearchOrchestrator(config);

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.fallbackUsed).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });
});
