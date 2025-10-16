import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { EventPrioritizer } from '@/lib/event-pipeline/prioritize';
import type { EventPipelineConfig, EventCandidate } from '@/lib/event-pipeline/types';

// WHY: ensure we create a minimal config the prioritizer expects
const baseConfig: EventPipelineConfig = {
  thresholds: {
    prioritization: 0.5,
    confidence: 0.5,
    parseQuality: 0.4,
  },
  sources: { cse: true, firecrawl: true, curated: false },
  limits: { maxCandidates: 50, maxExtractions: 10 },
  timeouts: { discovery: 20000, prioritization: 12000, parsing: 8000 },
};

const fakeGemini = {
  generateContent: jest.fn(async () =>
    JSON.stringify({
      is_event: 0.8,
      has_agenda: 0.6,
      has_speakers: 0.6,
      is_recent: 0.5,
      is_relevant: 0.7,
      is_country_relevant: 0.8,
      overall: 0.65,
    }),
  ),
};

const makeCandidate = (overrides: Partial<EventCandidate> = {}): EventCandidate => ({
  id: 'cand_1',
  url: 'https://example.de/events/konferenz',
  source: 'cse',
  discoveredAt: new Date(),
  status: 'discovered',
  metadata: {
    originalQuery: 'konferenz',
    country: 'DE',
    processingTime: 0,
    stageTimings: {},
  },
  ...overrides,
});

describe('EventPrioritizer locale and date boosts', () => {
  it('boosts score when German locale signals are present and threshold is lowered in degraded mode', async () => {
    const prioritizer = new EventPrioritizer({ ...baseConfig }, fakeGemini);
    prioritizer.setThresholdForDegradedMode(true);

    const candidate = makeCandidate({
      parseResult: {
        title: 'Compliance Summit München',
        description: 'Sprache: Deutsch. Agenda verfügbar.',
        date: '15. Oktober 2025',
        confidence: 0.8,
        evidence: [],
        parseMethod: 'deterministic',
      },
    });

    const [result] = await prioritizer.prioritize([candidate], 'DE');
    expect(result).toBeDefined();
    expect(result.priorityScore).toBeGreaterThanOrEqual(0.3);
  });

  it('applies city bonus when location hints mention German cities', async () => {
    const prioritizer = new EventPrioritizer({ ...baseConfig }, fakeGemini);

    const candidate = makeCandidate({
      parseResult: {
        title: 'Legal Tech Summit Berlin',
        location: 'Berlin, Germany',
        confidence: 0.7,
        evidence: [],
        parseMethod: 'deterministic',
      },
    });

    const [result] = await prioritizer.prioritize([candidate], 'DE');
    expect(result).toBeDefined();
    expect(result.priorityScore).toBeGreaterThanOrEqual(0.5);
  });

  it('drops threshold back to default when not degraded', () => {
    const prioritizer = new EventPrioritizer({ ...baseConfig }, fakeGemini);
    prioritizer.setThresholdForDegradedMode(true);
    expect(prioritizer['config'].thresholds.prioritization).toBe(0.3);
    prioritizer.setThresholdForDegradedMode(false);
    expect(prioritizer['config'].thresholds.prioritization).toBe(0.5);
  });
});
