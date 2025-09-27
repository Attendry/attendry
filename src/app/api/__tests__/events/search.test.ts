/**
 * Events Search API Tests
 * 
 * This file contains tests for the events search API endpoint.
 */

import { NextRequest } from 'next/server';
import { POST } from '../events/search/route';
import { mockRequest, mockResponse, mockFetch, mockSearchResults } from '../../../../__tests__/utils/test-utils';

// Mock dependencies
jest.mock('@/lib/services/search-service', () => ({
  executeSearch: jest.fn(),
}));

jest.mock('@/lib/cache', () => ({
  getCacheService: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
  CACHE_CONFIGS: {
    SEARCH_RESULTS: { ttl: 300 },
  },
}));

describe('/api/events/search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return search results for valid query', async () => {
    const mockSearchService = require('@/lib/services/search-service');
    mockSearchService.executeSearch.mockResolvedValue(mockSearchResults);

    const request = mockRequest({ query: 'legal conference' });
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.events).toBeDefined();
    expect(data.total).toBeDefined();
  });

  it('should return error for empty query', async () => {
    const request = mockRequest({ query: '' });
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should return error for missing query', async () => {
    const request = mockRequest({});
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should handle search service errors', async () => {
    const mockSearchService = require('@/lib/services/search-service');
    mockSearchService.executeSearch.mockRejectedValue(new Error('Search failed'));

    const request = mockRequest({ query: 'legal conference' });
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should handle invalid request body', async () => {
    const request = {
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
    } as any;

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should pass query parameters to search service', async () => {
    const mockSearchService = require('@/lib/services/search-service');
    mockSearchService.executeSearch.mockResolvedValue(mockSearchResults);

    const request = mockRequest({ 
      query: 'legal conference',
      location: 'Munich',
      date: '2024-12-01',
    });
    
    await POST(request as NextRequest);

    expect(mockSearchService.executeSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'legal conference',
        location: 'Munich',
        date: '2024-12-01',
      })
    );
  });

  it('should return cached results when available', async () => {
    const mockCacheService = require('@/lib/cache');
    mockCacheService.getCacheService.mockReturnValue({
      get: jest.fn().mockResolvedValue(mockSearchResults),
      set: jest.fn(),
    });

    const request = mockRequest({ query: 'legal conference' });
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.events).toBeDefined();
  });

  it('should handle search service timeout', async () => {
    const mockSearchService = require('@/lib/services/search-service');
    mockSearchService.executeSearch.mockImplementation(
      () => new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 100)
      )
    );

    const request = mockRequest({ query: 'legal conference' });
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should validate query length', async () => {
    const request = mockRequest({ query: 'a' });
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('too short');
  });

  it('should handle special characters in query', async () => {
    const mockSearchService = require('@/lib/services/search-service');
    mockSearchService.executeSearch.mockResolvedValue(mockSearchResults);

    const request = mockRequest({ query: 'legal & compliance conference' });
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(200);
    expect(mockSearchService.executeSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'legal & compliance conference',
      })
    );
  });

  it('should return proper response format', async () => {
    const mockSearchService = require('@/lib/services/search-service');
    mockSearchService.executeSearch.mockResolvedValue(mockSearchResults);

    const request = mockRequest({ query: 'legal conference' });
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data).toHaveProperty('events');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('page');
    expect(data).toHaveProperty('limit');
    expect(Array.isArray(data.events)).toBe(true);
  });
});
