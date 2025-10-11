/**
 * Search Service Tests
 * 
 * This file contains tests for the search service.
 */

import { SearchService } from '../search-service';
import { mockSearchResults, mockEventData } from '../../../__tests__/utils/test-utils';

// Mock dependencies
jest.mock('@/lib/cache', () => ({
  getCacheService: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
  CACHE_CONFIGS: {
    SEARCH_RESULTS: { ttl: 300 },
  },
}));

jest.mock('@/lib/services/request-deduplicator', () => ({
  deduplicateRequest: jest.fn(),
  createHttpRequestFingerprint: jest.fn(),
}));

jest.mock('@/lib/services/circuit-breaker', () => ({
  executeWithCircuitBreaker: jest.fn(),
  CIRCUIT_BREAKER_CONFIGS: {
    GOOGLE_CSE: { failureThreshold: 5, timeout: 5000 },
  },
}));

jest.mock('@/lib/services/fallback-strategies', () => ({
  executeWithFallback: jest.fn(),
}));

jest.mock('@/lib/services/optimized-ai-service', () => ({
  OptimizedAIService: {
    processRequest: jest.fn(),
  },
}));

describe('SearchService', () => {
  let searchService: SearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    searchService = new SearchService();
  });

  describe('executeSearch', () => {
    it('should execute search and return results', async () => {
      const mockRequestDeduplicator = await import('@/lib/services/request-deduplicator');
      const mockCircuitBreaker = await import('@/lib/services/circuit-breaker');
      const mockFallbackStrategies = await import('@/lib/services/fallback-strategies');
      const mockOptimizedAI = await import('@/lib/services/optimized-ai-service');

      mockRequestDeduplicator.deduplicateRequest.mockResolvedValue(mockSearchResults);
      mockCircuitBreaker.executeWithCircuitBreaker.mockResolvedValue(mockSearchResults);
      mockFallbackStrategies.executeWithFallback.mockResolvedValue(mockSearchResults);
      mockOptimizedAI.OptimizedAIService.processRequest.mockResolvedValue({
        prioritizedUrls: ['url1', 'url2'],
        prioritizationStats: { total: 2, prioritized: 2, reasons: ['relevant'] },
      });

      const result = await searchService.executeSearch({
        query: 'legal conference',
        location: 'Munich',
        date: '2024-12-01',
      });

      expect(result).toBeDefined();
      expect(result.events).toBeDefined();
    });

    it('should handle search errors gracefully', async () => {
      const mockRequestDeduplicator = await import('@/lib/services/request-deduplicator');
      mockRequestDeduplicator.deduplicateRequest.mockRejectedValue(new Error('Search failed'));

      await expect(searchService.executeSearch({
        query: 'legal conference',
      })).rejects.toThrow('Search failed');
    });

    it('should use cached results when available', async () => {
      const mockCacheService = await import('@/lib/cache');
      mockCacheService.getCacheService.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockSearchResults),
        set: jest.fn(),
      });

      const result = await searchService.executeSearch({
        query: 'legal conference',
      });

      expect(result).toBeDefined();
      expect(mockCacheService.getCacheService().get).toHaveBeenCalled();
    });

    it('should cache results after successful search', async () => {
      const mockCacheService = await import('@/lib/cache');
      const mockSet = jest.fn();
      mockCacheService.getCacheService.mockReturnValue({
        get: jest.fn().mockResolvedValue(null),
        set: mockSet,
      });

      const mockRequestDeduplicator = await import('@/lib/services/request-deduplicator');
      mockRequestDeduplicator.deduplicateRequest.mockResolvedValue(mockSearchResults);

      await searchService.executeSearch({
        query: 'legal conference',
      });

      expect(mockSet).toHaveBeenCalled();
    });

    it('should handle circuit breaker failures', async () => {
      const mockCircuitBreaker = await import('@/lib/services/circuit-breaker');
      mockCircuitBreaker.executeWithCircuitBreaker.mockRejectedValue(new Error('Circuit breaker open'));

      const mockFallbackStrategies = await import('@/lib/services/fallback-strategies');
      mockFallbackStrategies.executeWithFallback.mockResolvedValue(mockSearchResults);

      const result = await searchService.executeSearch({
        query: 'legal conference',
      });

      expect(result).toBeDefined();
      expect(mockFallbackStrategies.executeWithFallback).toHaveBeenCalled();
    });

    it('should handle AI service failures', async () => {
      const mockOptimizedAI = await import('@/lib/services/optimized-ai-service');
      mockOptimizedAI.OptimizedAIService.processRequest.mockRejectedValue(new Error('AI service failed'));

      const mockRequestDeduplicator = await import('@/lib/services/request-deduplicator');
      mockRequestDeduplicator.deduplicateRequest.mockResolvedValue(mockSearchResults);

      const result = await searchService.executeSearch({
        query: 'legal conference',
      });

      expect(result).toBeDefined();
    });

    it('should validate search parameters', async () => {
      await expect(searchService.executeSearch({
        query: '',
      })).rejects.toThrow();
    });

    it('should handle empty search results', async () => {
      const mockRequestDeduplicator = await import('@/lib/services/request-deduplicator');
      mockRequestDeduplicator.deduplicateRequest.mockResolvedValue({
        events: [],
        total: 0,
      });

      const result = await searchService.executeSearch({
        query: 'nonexistent event',
      });

      expect(result.events).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle search with filters', async () => {
      const mockRequestDeduplicator = await import('@/lib/services/request-deduplicator');
      mockRequestDeduplicator.deduplicateRequest.mockResolvedValue(mockSearchResults);

      const result = await searchService.executeSearch({
        query: 'legal conference',
        location: 'Munich',
        date: '2024-12-01',
        category: 'legal',
        priceRange: { min: 0, max: 1000 },
      });

      expect(result).toBeDefined();
    });

    it('should handle search pagination', async () => {
      const mockRequestDeduplicator = await import('@/lib/services/request-deduplicator');
      mockRequestDeduplicator.deduplicateRequest.mockResolvedValue(mockSearchResults);

      const result = await searchService.executeSearch({
        query: 'legal conference',
        page: 2,
        limit: 10,
      });

      expect(result).toBeDefined();
    });
  });

  describe('runEventDiscovery', () => {
    it('should run event discovery and return results', async () => {
      const mockRequestDeduplicator = await import('@/lib/services/request-deduplicator');
      const mockCircuitBreaker = await import('@/lib/services/circuit-breaker');
      const mockFallbackStrategies = await import('@/lib/services/fallback-strategies');
      const mockOptimizedAI = await import('@/lib/services/optimized-ai-service');

      mockRequestDeduplicator.deduplicateRequest.mockResolvedValue(mockSearchResults);
      mockCircuitBreaker.executeWithCircuitBreaker.mockResolvedValue(mockSearchResults);
      mockFallbackStrategies.executeWithFallback.mockResolvedValue(mockSearchResults);
      mockOptimizedAI.OptimizedAIService.processRequest.mockResolvedValue({
        prioritizedUrls: ['url1', 'url2'],
        prioritizationStats: { total: 2, prioritized: 2, reasons: ['relevant'] },
      });

      const result = await searchService.runEventDiscovery({
        query: 'legal conference',
        location: 'Munich',
        date: '2024-12-01',
      });

      expect(result).toBeDefined();
      expect(result.events).toBeDefined();
      expect(result.stats).toBeDefined();
    });

    it('should handle discovery errors gracefully', async () => {
      const mockRequestDeduplicator = await import('@/lib/services/request-deduplicator');
      mockRequestDeduplicator.deduplicateRequest.mockRejectedValue(new Error('Discovery failed'));

      await expect(searchService.runEventDiscovery({
        query: 'legal conference',
      })).rejects.toThrow('Discovery failed');
    });

    it('should return discovery statistics', async () => {
      const mockRequestDeduplicator = await import('@/lib/services/request-deduplicator');
      mockRequestDeduplicator.deduplicateRequest.mockResolvedValue(mockSearchResults);

      const result = await searchService.runEventDiscovery({
        query: 'legal conference',
      });

      expect(result.stats).toBeDefined();
      expect(result.stats.totalUrls).toBeDefined();
      expect(result.stats.processedUrls).toBeDefined();
      expect(result.stats.extractedEvents).toBeDefined();
      expect(result.stats.errors).toBeDefined();
    });

    it('should handle discovery with no results', async () => {
      const mockRequestDeduplicator = await import('@/lib/services/request-deduplicator');
      mockRequestDeduplicator.deduplicateRequest.mockResolvedValue({
        events: [],
        total: 0,
      });

      const result = await searchService.runEventDiscovery({
        query: 'nonexistent event',
      });

      expect(result.events).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle discovery with errors', async () => {
      const mockRequestDeduplicator = await import('@/lib/services/request-deduplicator');
      mockRequestDeduplicator.deduplicateRequest.mockResolvedValue(mockSearchResults);

      const result = await searchService.runEventDiscovery({
        query: 'legal conference',
      });

      expect(result.stats.errors).toBeDefined();
    });
  });
});
