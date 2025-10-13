import { NextRequest } from 'next/server';
import { POST } from '@/app/api/events/run/route';

// Mock the dependencies
jest.mock('@/common/search/enhanced-orchestrator', () => ({
  executeEnhancedSearch: jest.fn()
}));

jest.mock('@/lib/event-pipeline', () => ({
  executeNewPipeline: jest.fn()
}));

jest.mock('@/lib/event-pipeline/config', () => ({
  isNewPipelineEnabled: jest.fn(() => false)
}));

describe('/api/events/run', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Country validation', () => {
    it('should reject requests without country parameter', async () => {
      const req = new NextRequest('http://localhost:3000/api/events/run', {
        method: 'POST',
        body: JSON.stringify({
          userText: 'legal conference'
        })
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body.error).toBe('country (ISO2) required');
    });

    it('should reject requests with invalid country codes', async () => {
      const req = new NextRequest('http://localhost:3000/api/events/run', {
        method: 'POST',
        body: JSON.stringify({
          userText: 'legal conference',
          country: 'INVALID'
        })
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body.error).toBe('country (ISO2) required');
    });

    it('should accept valid ISO2 country codes', async () => {
      const { executeEnhancedSearch } = require('@/common/search/enhanced-orchestrator');
      executeEnhancedSearch.mockResolvedValue({
        events: [],
        effectiveQ: 'legal conference',
        providersTried: ['cse', 'firecrawl']
      });

      const req = new NextRequest('http://localhost:3000/api/events/run', {
        method: 'POST',
        body: JSON.stringify({
          userText: 'legal conference',
          country: 'FR'
        })
      });

      const response = await POST(req);
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body).toHaveProperty('telemetry');
      expect(body.telemetry.ctx.country).toBe('FR');
      expect(body.telemetry.ctx.locale).toBe('en');
      expect(body.telemetry.ctx.tld).toBe('.fr');
    });

    it('should accept country name aliases', async () => {
      const { executeEnhancedSearch } = require('@/common/search/enhanced-orchestrator');
      executeEnhancedSearch.mockResolvedValue({
        events: [],
        effectiveQ: 'legal conference',
        providersTried: ['cse', 'firecrawl']
      });

      const req = new NextRequest('http://localhost:3000/api/events/run', {
        method: 'POST',
        body: JSON.stringify({
          userText: 'legal conference',
          country: 'France'
        })
      });

      const response = await POST(req);
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body.telemetry.ctx.country).toBe('FR');
    });
  });

  describe('Country context propagation', () => {
    it('should pass correct country context to enhanced orchestrator', async () => {
      const { executeEnhancedSearch } = require('@/common/search/enhanced-orchestrator');
      executeEnhancedSearch.mockResolvedValue({
        events: [],
        effectiveQ: 'legal conference',
        providersTried: ['cse', 'firecrawl']
      });

      const req = new NextRequest('http://localhost:3000/api/events/run', {
        method: 'POST',
        body: JSON.stringify({
          userText: 'legal conference',
          country: 'FR'
        })
      });

      await POST(req);

      expect(executeEnhancedSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          userText: 'legal conference',
          country: 'FR',
          locale: 'en'
        })
      );
    });

    it('should pass correct country context to new pipeline', async () => {
      const { isNewPipelineEnabled } = require('@/lib/event-pipeline/config');
      const { executeNewPipeline } = require('@/lib/event-pipeline');
      
      isNewPipelineEnabled.mockReturnValue(true);
      executeNewPipeline.mockResolvedValue({
        events: [],
        provider: 'new_pipeline'
      });

      const req = new NextRequest('http://localhost:3000/api/events/run', {
        method: 'POST',
        body: JSON.stringify({
          userText: 'legal conference',
          country: 'DE'
        })
      });

      await POST(req);

      expect(executeNewPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          userText: 'legal conference',
          country: 'DE',
          locale: 'de'
        })
      );
    });
  });

  describe('Demo fallback', () => {
    it('should return country-specific demo events when no results found', async () => {
      const { executeEnhancedSearch } = require('@/common/search/enhanced-orchestrator');
      executeEnhancedSearch.mockResolvedValue({
        events: [],
        effectiveQ: 'legal conference',
        providersTried: ['cse', 'firecrawl']
      });

      // Mock environment variable
      process.env.SEARCH_ENABLE_DEMO_FALLBACK = 'true';

      const req = new NextRequest('http://localhost:3000/api/events/run', {
        method: 'POST',
        body: JSON.stringify({
          userText: 'legal conference',
          country: 'FR'
        })
      });

      const response = await POST(req);
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body.provider).toBe('demo_fallback');
      expect(body.telemetry.fallbackUsed).toBe(true);
      expect(body.events).toBeDefined();
      expect(body.events.length).toBeGreaterThan(0);
      
      // Check that demo events are country-specific
      body.events.forEach((event: any) => {
        expect(event.country).toBe('FR');
        expect(event.countrySource).toBe('fallback');
      });
    });
  });

  describe('Telemetry', () => {
    it('should include structured telemetry in response', async () => {
      const { executeEnhancedSearch } = require('@/common/search/enhanced-orchestrator');
      executeEnhancedSearch.mockResolvedValue({
        events: [
          { id: '1', title: 'Event 1', country: 'FR' },
          { id: '2', title: 'Event 2', country: 'FR' }
        ],
        effectiveQ: 'legal conference',
        providersTried: ['cse', 'firecrawl']
      });

      const req = new NextRequest('http://localhost:3000/api/events/run', {
        method: 'POST',
        body: JSON.stringify({
          userText: 'legal conference',
          country: 'FR'
        })
      });

      const response = await POST(req);
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body.telemetry).toBeDefined();
      expect(body.telemetry.ctx).toBeDefined();
      expect(body.telemetry.ctx.country).toBe('FR');
      expect(body.telemetry.ctx.locale).toBe('en');
      expect(body.telemetry.ctx.tld).toBe('.fr');
      expect(body.telemetry.query).toBeDefined();
      expect(body.telemetry.results).toBeDefined();
      expect(body.telemetry.fallbackUsed).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle search errors gracefully', async () => {
      const { executeEnhancedSearch } = require('@/common/search/enhanced-orchestrator');
      executeEnhancedSearch.mockRejectedValue(new Error('Search failed'));

      const req = new NextRequest('http://localhost:3000/api/events/run', {
        method: 'POST',
        body: JSON.stringify({
          userText: 'legal conference',
          country: 'FR'
        })
      });

      const response = await POST(req);
      expect(response.status).toBe(500);
      
      const body = await response.json();
      expect(body.error).toBe('Search failed');
      expect(body.debug).toBeDefined();
      expect(body.debug.crashed).toBe(true);
    });
  });
});
