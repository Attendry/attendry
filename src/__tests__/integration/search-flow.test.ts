/**
 * Search Flow Integration Tests
 * 
 * This file contains integration tests for the search flow.
 */

import { NextRequest } from 'next/server';
import { POST as searchPOST } from '@/app/api/events/search/route';
import { POST as runPOST } from '@/app/api/events/run/route';
import { mockRequest, mockSearchResults, mockEventData } from '../utils/test-utils';

// Mock dependencies
jest.mock('@/lib/services/search-service', () => ({
  executeSearch: jest.fn(),
  runEventDiscovery: jest.fn(),
}));

jest.mock('@/lib/cache', () => ({
  getCacheService: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
  CACHE_CONFIGS: {
    SEARCH_RESULTS: { ttl: 300 },
    EVENT_DISCOVERY: { ttl: 600 },
  },
}));

describe('Search Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Search API Integration', () => {
    it('should handle complete search flow', async () => {
      const mockSearchService = require('@/lib/services/search-service');
      mockSearchService.executeSearch.mockResolvedValue(mockSearchResults);

      const request = mockRequest({ query: 'legal conference' });
      const response = await searchPOST(request as NextRequest);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toBeDefined();
      expect(data.total).toBeDefined();
    });

    it('should handle search with filters', async () => {
      const mockSearchService = require('@/lib/services/search-service');
      mockSearchService.executeSearch.mockResolvedValue(mockSearchResults);

      const request = mockRequest({ 
        query: 'legal conference',
        location: 'Munich',
        date: '2024-12-01',
        category: 'legal',
        priceRange: { min: 0, max: 1000 },
      });
      
      const response = await searchPOST(request as NextRequest);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toBeDefined();
    });

    it('should handle search pagination', async () => {
      const mockSearchService = require('@/lib/services/search-service');
      mockSearchService.executeSearch.mockResolvedValue(mockSearchResults);

      const request = mockRequest({ 
        query: 'legal conference',
        page: 2,
        limit: 10,
      });
      
      const response = await searchPOST(request as NextRequest);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toBeDefined();
    });

    it('should handle search errors', async () => {
      const mockSearchService = require('@/lib/services/search-service');
      mockSearchService.executeSearch.mockRejectedValue(new Error('Search failed'));

      const request = mockRequest({ query: 'legal conference' });
      const response = await searchPOST(request as NextRequest);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle search with empty results', async () => {
      const mockSearchService = require('@/lib/services/search-service');
      mockSearchService.executeSearch.mockResolvedValue({
        events: [],
        total: 0,
      });

      const request = mockRequest({ query: 'nonexistent event' });
      const response = await searchPOST(request as NextRequest);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toEqual([]);
      expect(data.total).toBe(0);
    });
  });

  describe('Event Discovery API Integration', () => {
    it('should handle complete discovery flow', async () => {
      const mockSearchService = require('@/lib/services/search-service');
      mockSearchService.runEventDiscovery.mockResolvedValue({
        events: [mockEventData],
        total: 1,
        stats: {
          totalUrls: 10,
          processedUrls: 8,
          extractedEvents: 1,
          errors: 0,
        },
      });

      const request = mockRequest({ query: 'legal conference' });
      const response = await runPOST(request as NextRequest);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toBeDefined();
      expect(data.stats).toBeDefined();
    });

    it('should handle discovery with filters', async () => {
      const mockSearchService = require('@/lib/services/search-service');
      mockSearchService.runEventDiscovery.mockResolvedValue({
        events: [mockEventData],
        total: 1,
        stats: {
          totalUrls: 10,
          processedUrls: 8,
          extractedEvents: 1,
          errors: 0,
        },
      });

      const request = mockRequest({ 
        query: 'legal conference',
        location: 'Munich',
        date: '2024-12-01',
      });
      
      const response = await runPOST(request as NextRequest);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toBeDefined();
    });

    it('should handle discovery errors', async () => {
      const mockSearchService = require('@/lib/services/search-service');
      mockSearchService.runEventDiscovery.mockRejectedValue(new Error('Discovery failed'));

      const request = mockRequest({ query: 'legal conference' });
      const response = await runPOST(request as NextRequest);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle discovery with no results', async () => {
      const mockSearchService = require('@/lib/services/search-service');
      mockSearchService.runEventDiscovery.mockResolvedValue({
        events: [],
        total: 0,
        stats: {
          totalUrls: 5,
          processedUrls: 5,
          extractedEvents: 0,
          errors: 0,
        },
      });

      const request = mockRequest({ query: 'nonexistent event' });
      const response = await runPOST(request as NextRequest);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('should handle discovery with errors', async () => {
      const mockSearchService = require('@/lib/services/search-service');
      mockSearchService.runEventDiscovery.mockResolvedValue({
        events: [mockEventData],
        total: 1,
        stats: {
          totalUrls: 10,
          processedUrls: 8,
          extractedEvents: 1,
          errors: 2,
        },
      });

      const request = mockRequest({ query: 'legal conference' });
      const response = await runPOST(request as NextRequest);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.stats.errors).toBe(2);
    });
  });

  describe('Search and Discovery Flow Integration', () => {
    it('should handle search followed by discovery', async () => {
      const mockSearchService = require('@/lib/services/search-service');
      mockSearchService.executeSearch.mockResolvedValue(mockSearchResults);
      mockSearchService.runEventDiscovery.mockResolvedValue({
        events: [mockEventData],
        total: 1,
        stats: {
          totalUrls: 10,
          processedUrls: 8,
          extractedEvents: 1,
          errors: 0,
        },
      });

      // First, search for events
      const searchRequest = mockRequest({ query: 'legal conference' });
      const searchResponse = await searchPOST(searchRequest as NextRequest);

      expect(searchResponse.status).toBe(200);
      const searchData = await searchResponse.json();
      expect(searchData.events).toBeDefined();

      // Then, run discovery
      const discoveryRequest = mockRequest({ query: 'legal conference' });
      const discoveryResponse = await runPOST(discoveryRequest as NextRequest);

      expect(discoveryResponse.status).toBe(200);
      const discoveryData = await discoveryResponse.json();
      expect(discoveryData.events).toBeDefined();
    });

    it('should handle search with cached results', async () => {
      const mockCacheService = require('@/lib/cache');
      mockCacheService.getCacheService.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockSearchResults),
        set: jest.fn(),
      });

      const request = mockRequest({ query: 'legal conference' });
      const response = await searchPOST(request as NextRequest);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toBeDefined();
    });

    it('should handle discovery with cached results', async () => {
      const mockCacheService = require('@/lib/cache');
      mockCacheService.getCacheService.mockReturnValue({
        get: jest.fn().mockResolvedValue({
          events: [mockEventData],
          total: 1,
          stats: {
            totalUrls: 10,
            processedUrls: 8,
            extractedEvents: 1,
            errors: 0,
          },
        }),
        set: jest.fn(),
      });

      const request = mockRequest({ query: 'legal conference' });
      const response = await runPOST(request as NextRequest);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toBeDefined();
    });

    it('should handle search with validation errors', async () => {
      const request = mockRequest({ query: '' });
      const response = await searchPOST(request as NextRequest);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle discovery with validation errors', async () => {
      const request = mockRequest({ query: '' });
      const response = await runPOST(request as NextRequest);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle search with invalid request body', async () => {
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any;

      const response = await searchPOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle discovery with invalid request body', async () => {
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any;

      const response = await runPOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });
});
