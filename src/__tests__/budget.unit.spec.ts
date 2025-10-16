import { describe, expect, it, vi } from '@jest/globals';

// WHY: Minimal NextRequest stub for unit testing
function makeRequest(body: Record<string, unknown>) {
  return {
    async json() {
      return body;
    },
  } as any;
}

describe('Search budget fallback behaviour', () => {
  it('returns partial results when Firecrawl times out and CSE fallback succeeds', async () => {
    vi.mock('@/lib/event-pipeline', () => ({
      executeNewPipeline: vi.fn().mockResolvedValue({
        events: [{
          id: 'partial-1',
          source_url: 'https://example.com/event',
          title: 'Partial Event',
        }],
        providersTried: ['firecrawl', 'cse'],
      }),
    }));
    vi.mock('@/lib/event-pipeline/config', () => ({
      isNewPipelineEnabled: vi.fn(() => true),
    }));

    const req = makeRequest({
      userText: '',
      country: 'DE',
      dateFrom: '2025-10-15',
      dateTo: '2025-10-20',
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.events?.length).toBeGreaterThan(0);
    expect(json.providersTried).toContain('cse');
  });

  it('returns demo fallback when no providers yield events', async () => {
    vi.resetModules();
    vi.mock('@/lib/event-pipeline', () => ({
      executeNewPipeline: vi.fn().mockResolvedValue({
        events: [],
        providersTried: ['firecrawl', 'cse'],
      }),
    }));
    vi.mock('@/lib/event-pipeline/config', () => ({
      isNewPipelineEnabled: vi.fn(() => true),
    }));

    process.env.SEARCH_ENABLE_DEMO_FALLBACK = 'true';
    const req = makeRequest({ userText: '', country: 'DE' });
    const res = await POST(req);
    const json = await res.json();
    expect(json.provider).toBe('demo_fallback');
    expect(json.events?.length).toBeGreaterThan(0);
  });
});
