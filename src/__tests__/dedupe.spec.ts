import { describe, expect, it, jest } from '@jest/globals';
import { EventDiscoverer } from '@/lib/event-pipeline/discover';
import type { EventPipelineConfig, DiscoveryService } from '@/lib/event-pipeline/types';

const config: EventPipelineConfig = {
  thresholds: {
    prioritization: 0.5,
    confidence: 0.5,
    parseQuality: 0.4,
  },
  sources: {
    cse: true,
    firecrawl: false,
    curated: false,
  },
  limits: {
    maxCandidates: 50,
    maxExtractions: 10,
  },
  timeouts: {
    discovery: 20000,
    prioritization: 12000,
    parsing: 8000,
  },
};

describe('Discovery dedupe instrumentation', () => {
  it('logs duplicate count when duplicates are removed', async () => {
    const cseService: DiscoveryService = {
      search: jest.fn().mockResolvedValue({
        items: [
          { url: 'https://example.com/event/1' },
          { url: 'https://example.com/event/1' },
          { url: 'https://example.com/event/2' },
        ],
      }),
    };

    const loggerInfo = jest.spyOn(console, 'info').mockImplementation(() => {});

    const discoverer = new EventDiscoverer(config, cseService, cseService);
    const result = await discoverer.discover('query', 'DE');

    expect(result.candidates.length).toBe(2);
    expect(result.providers).toContain('cse');
    loggerInfo.mockRestore();
  });
});
