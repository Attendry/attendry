/**
 * Enhanced Search Integration Tests
 * 
 * These tests verify the end-to-end functionality of the enhanced search pipeline.
 */

import { EnhancedSearchService } from '../enhanced-search-service';

// Mock the external services
jest.mock('../enhanced-gemini-service');
jest.mock('../enhanced-firecrawl-service');

describe('Enhanced Search Integration', () => {
  let searchService: EnhancedSearchService;

  beforeEach(() => {
    // Mock API keys
    const mockGeminiKey = 'mock-gemini-key';
    const mockFirecrawlKey = 'mock-firecrawl-key';
    
    searchService = new EnhancedSearchService(mockGeminiKey, mockFirecrawlKey);
  });

  it('should perform end-to-end search', async () => {
    // Mock the search results
    const mockSearchResults = [
      {
        url: 'https://beck-akademie.de/veranstaltung/compliance-konferenz',
        title: 'Compliance Konferenz 2024',
        snippet: 'Eine umfassende Konferenz zu Compliance-Themen'
      },
      {
        url: 'https://dav.de/termine/rechtskongress',
        title: 'Deutscher Rechtskongress',
        snippet: 'Der größte Rechtskongress Deutschlands'
      }
    ];

    // Mock the prioritization response
    const mockPrioritizationResponse = {
      prioritizedUrls: [
        'https://beck-akademie.de/veranstaltung/compliance-konferenz',
        'https://dav.de/termine/rechtskongress'
      ],
      prioritizationStats: {
        total: 2,
        prioritized: 2,
        reasons: ['High legal relevance', 'Major legal event']
      },
      repairUsed: false
    };

    // Mock the extract results
    const mockExtractResults = new Map([
      [
        'https://beck-akademie.de/veranstaltung/compliance-konferenz',
        {
          success: true,
          content: `
            <h1>Compliance Konferenz 2024</h1>
            <p>Die Veranstaltung findet am 15. Juni 2024 in Berlin statt.</p>
            <div class="speakers">
              <h2>Referenten</h2>
              <p>Dr. Max Mustermann, Leiter Compliance, Muster AG</p>
              <p>Prof. Dr. Maria Schmidt, Rechtsanwältin, Kanzlei Schmidt</p>
            </div>
          `,
          polledAttempts: 3,
          timedOut: false
        }
      ],
      [
        'https://dav.de/termine/rechtskongress',
        {
          success: true,
          content: `
            <h1>Deutscher Rechtskongress</h1>
            <p>Der Kongress findet vom 20. bis 22. September 2024 in München statt.</p>
            <div class="speakers">
              <h2>Referenten</h2>
              <p>Dr. Thomas Weber, Präsident des DAV</p>
              <p>Prof. Dr. Anna Müller, Universität München</p>
            </div>
          `,
          polledAttempts: 2,
          timedOut: false
        }
      ]
    ]);

    // Mock the speaker extraction response
    const mockSpeakerResponse = {
      speakers: [
        {
          name: 'Dr. Max Mustermann',
          title: 'Leiter Compliance',
          company: 'Muster AG',
          talkTitle: 'Compliance in der Praxis'
        },
        {
          name: 'Prof. Dr. Maria Schmidt',
          title: 'Rechtsanwältin',
          company: 'Kanzlei Schmidt',
          talkTitle: 'Rechtliche Aspekte der Compliance'
        }
      ],
      repairUsed: false
    };

    // Mock the service methods
    jest.spyOn(searchService['geminiService'], 'prioritizeUrls').mockResolvedValue(mockPrioritizationResponse);
    jest.spyOn(searchService['firecrawlService'], 'extractContent').mockResolvedValue(mockExtractResults);
    jest.spyOn(searchService['geminiService'], 'extractSpeakers').mockResolvedValue(mockSpeakerResponse);

    // Perform the search
    const result = await searchService.search({
      baseQuery: 'Compliance OR "Interne Untersuchung" OR eDiscovery OR DSGVO',
      fromISO: '2024-01-01',
      toISO: '2024-12-31',
      country: 'DE',
      allowUndated: false,
      maxResults: 50
    });

    // Verify the results
    expect(result.events).toHaveLength(2);
    expect(result.events[0].url).toBe('https://beck-akademie.de/veranstaltung/compliance-konferenz');
    expect(result.events[0].title).toBe('Compliance Konferenz 2024');
    expect(result.events[0].dateISO).toBe('2024-06-15');
    expect(result.events[0].country).toBe('DE');
    expect(result.events[0].speakers).toHaveLength(2);

    // Verify the trace
    expect(result.trace.finalQueries).toHaveLength(3);
    expect(result.trace.prioritization.repairUsed).toBe(false);
    expect(result.trace.extract.stats.successful).toBe(2);
    expect(result.trace.extract.stats.failed).toBe(0);
  });

  it('should handle search with no results', async () => {
    // Mock empty search results
    jest.spyOn(searchService['geminiService'], 'prioritizeUrls').mockResolvedValue({
      prioritizedUrls: [],
      prioritizationStats: { total: 0, prioritized: 0, reasons: [] },
      repairUsed: false
    });

    const result = await searchService.search({
      baseQuery: 'Non-existent legal terms',
      fromISO: '2024-01-01',
      toISO: '2024-12-31',
      country: 'DE'
    });

    expect(result.events).toHaveLength(0);
    expect(result.trace.urls.kept).toBe(0);
  });

  it('should handle extraction failures gracefully', async () => {
    // Mock search results
    const mockSearchResults = [
      {
        url: 'https://example.com/event',
        title: 'Test Event',
        snippet: 'Test snippet'
      }
    ];

    // Mock prioritization
    jest.spyOn(searchService['geminiService'], 'prioritizeUrls').mockResolvedValue({
      prioritizedUrls: ['https://example.com/event'],
      prioritizationStats: { total: 1, prioritized: 1, reasons: ['Test reason'] },
      repairUsed: false
    });

    // Mock extraction failure
    const mockExtractResults = new Map([
      [
        'https://example.com/event',
        {
          success: false,
          error: 'Extraction failed',
          polledAttempts: 5,
          timedOut: true
        }
      ]
    ]);

    jest.spyOn(searchService['firecrawlService'], 'extractContent').mockResolvedValue(mockExtractResults);

    const result = await searchService.search({
      baseQuery: 'Test query',
      fromISO: '2024-01-01',
      toISO: '2024-12-31',
      country: 'DE'
    });

    expect(result.events).toHaveLength(0);
    expect(result.trace.extract.stats.failed).toBe(1);
    expect(result.trace.extract.stats.timedOut).toBe(1);
  });
});
