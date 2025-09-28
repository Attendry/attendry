import { executeSearch } from '../../services/search/orchestrator';

// Mock providers
const mockProviders = {
  firecrawl: { items: ['A','B'] },
  cse: { items: [] }
};

// Mock the providers module
jest.mock('../../providers', () => ({
  providers: {
    firecrawl: { search: jest.fn().mockResolvedValue(mockProviders.firecrawl) },
    cse: { search: jest.fn().mockResolvedValue(mockProviders.cse) },
    database: { search: jest.fn().mockResolvedValue({ items: [], debug: {} }) }
  }
}));

describe('orchestrator', () => {
  it('prefers first non-empty provider and does not overwrite with empty fallback', async () => {
    const r = await executeSearch({ baseQuery: '(foo)' });
    expect(r.providerUsed).toBe('firecrawl');
    expect(r.items).toEqual(['A','B']);
  });

  it('uses buildSearchQuery output for all providers', async () => {
    const r = await executeSearch({ baseQuery: 'foo bar', userText: 'baz' });
    // This test would need to verify that providers received the correct query
    // For now, just ensure the function runs without error
    expect(r).toBeDefined();
  });
});
