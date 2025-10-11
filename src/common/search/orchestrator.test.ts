import { executeEnhancedSearch } from './enhanced-orchestrator';

// Mock the enhanced orchestrator dependencies
jest.mock('./config', () => ({
  loadActiveConfig: jest.fn().mockResolvedValue({
    baseQuery: 'test query',
    industry: 'legal-compliance',
    defaultCountries: ['DE']
  })
}));

jest.mock('../../providers/firecrawl', () => ({
  search: jest.fn().mockResolvedValue({ items: ['A','B'] })
}));

jest.mock('../../providers/cse', () => ({
  search: jest.fn().mockResolvedValue({ items: [] })
}));

jest.mock('../../providers/database', () => ({
  search: jest.fn().mockResolvedValue({ items: [], debug: {} })
}));

describe('enhanced orchestrator', () => {
  it('executes enhanced search and returns events', async () => {
    const r = await executeEnhancedSearch({ 
      userText: 'legal conference',
      country: 'DE'
    });
    expect(r.events).toBeDefined();
    expect(Array.isArray(r.events)).toBe(true);
    expect(r.providersTried).toBeDefined();
  });

  it('handles search with user text and country', async () => {
    const r = await executeEnhancedSearch({ 
      userText: 'compliance summit',
      country: 'DE',
      dateFrom: '2025-01-01',
      dateTo: '2025-12-31'
    });
    expect(r).toBeDefined();
    expect(r.events).toBeDefined();
    expect(r.logs).toBeDefined();
  });
});
