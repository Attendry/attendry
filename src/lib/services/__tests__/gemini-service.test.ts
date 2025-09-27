/**
 * Gemini Service Tests
 * 
 * This file contains tests for the Gemini service.
 */

import { GeminiService } from '../gemini-service';
import { mockEventData } from '@/lib/testing/test-utils';

// Mock dependencies
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({
    getGenerativeModel: jest.fn(() => ({
      generateContent: jest.fn(),
    })),
  })),
}));

jest.mock('@/lib/cache', () => ({
  getCacheService: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
  CACHE_CONFIGS: {
    AI_RESPONSES: { ttl: 600 },
  },
}));

describe('GeminiService', () => {
  let geminiService: GeminiService;

  beforeEach(() => {
    jest.clearAllMocks();
    geminiService = new GeminiService();
  });

  describe('extractEventData', () => {
    it('should extract event data from content', async () => {
      const mockGoogleAI = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify([mockEventData]),
          },
        }),
      };
      mockGoogleAI.GoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      });

      const result = await geminiService.extractEventData('Event content');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle extraction errors gracefully', async () => {
      const mockGoogleAI = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockRejectedValue(new Error('Extraction failed')),
      };
      mockGoogleAI.GoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      });

      await expect(geminiService.extractEventData('Event content')).rejects.toThrow('Extraction failed');
    });

    it('should use cached results when available', async () => {
      const mockCacheService = require('@/lib/cache');
      mockCacheService.getCacheService.mockReturnValue({
        get: jest.fn().mockResolvedValue([mockEventData]),
        set: jest.fn(),
      });

      const result = await geminiService.extractEventData('Event content');

      expect(result).toBeDefined();
      expect(mockCacheService.getCacheService().get).toHaveBeenCalled();
    });

    it('should cache results after successful extraction', async () => {
      const mockCacheService = require('@/lib/cache');
      const mockSet = jest.fn();
      mockCacheService.getCacheService.mockReturnValue({
        get: jest.fn().mockResolvedValue(null),
        set: mockSet,
      });

      const mockGoogleAI = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify([mockEventData]),
          },
        }),
      };
      mockGoogleAI.GoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      });

      await geminiService.extractEventData('Event content');

      expect(mockSet).toHaveBeenCalled();
    });

    it('should handle invalid JSON response', async () => {
      const mockGoogleAI = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => 'invalid json',
          },
        }),
      };
      mockGoogleAI.GoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      });

      await expect(geminiService.extractEventData('Event content')).rejects.toThrow();
    });

    it('should handle empty content', async () => {
      await expect(geminiService.extractEventData('')).rejects.toThrow();
    });

    it('should handle null content', async () => {
      await expect(geminiService.extractEventData(null as any)).rejects.toThrow();
    });

    it('should handle undefined content', async () => {
      await expect(geminiService.extractEventData(undefined as any)).rejects.toThrow();
    });

    it('should handle extraction with multiple events', async () => {
      const mockGoogleAI = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify([mockEventData, mockEventData]),
          },
        }),
      };
      mockGoogleAI.GoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      });

      const result = await geminiService.extractEventData('Event content');

      expect(result).toHaveLength(2);
    });

    it('should handle extraction with no events', async () => {
      const mockGoogleAI = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify([]),
          },
        }),
      };
      mockGoogleAI.GoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      });

      const result = await geminiService.extractEventData('Event content');

      expect(result).toEqual([]);
    });
  });

  describe('prioritizeUrlsWithGemini', () => {
    it('should prioritize URLs based on relevance', async () => {
      const mockGoogleAI = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              prioritizedUrls: ['url1', 'url2'],
              prioritizationStats: { total: 2, prioritized: 2, reasons: ['relevant'] },
            }),
          },
        }),
      };
      mockGoogleAI.GoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      });

      const result = await geminiService.prioritizeUrlsWithGemini(['url1', 'url2'], 'legal conference');

      expect(result).toBeDefined();
      expect(result.prioritizedUrls).toBeDefined();
      expect(result.prioritizationStats).toBeDefined();
    });

    it('should handle prioritization errors gracefully', async () => {
      const mockGoogleAI = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockRejectedValue(new Error('Prioritization failed')),
      };
      mockGoogleAI.GoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      });

      await expect(geminiService.prioritizeUrlsWithGemini(['url1', 'url2'], 'legal conference')).rejects.toThrow('Prioritization failed');
    });

    it('should use cached results when available', async () => {
      const mockCacheService = require('@/lib/cache');
      mockCacheService.getCacheService.mockReturnValue({
        get: jest.fn().mockResolvedValue({
          prioritizedUrls: ['url1', 'url2'],
          prioritizationStats: { total: 2, prioritized: 2, reasons: ['relevant'] },
        }),
        set: jest.fn(),
      });

      const result = await geminiService.prioritizeUrlsWithGemini(['url1', 'url2'], 'legal conference');

      expect(result).toBeDefined();
      expect(mockCacheService.getCacheService().get).toHaveBeenCalled();
    });

    it('should handle empty URL list', async () => {
      const result = await geminiService.prioritizeUrlsWithGemini([], 'legal conference');

      expect(result.prioritizedUrls).toEqual([]);
      expect(result.prioritizationStats.total).toBe(0);
    });

    it('should handle null URL list', async () => {
      await expect(geminiService.prioritizeUrlsWithGemini(null as any, 'legal conference')).rejects.toThrow();
    });

    it('should handle undefined URL list', async () => {
      await expect(geminiService.prioritizeUrlsWithGemini(undefined as any, 'legal conference')).rejects.toThrow();
    });

    it('should handle empty query', async () => {
      await expect(geminiService.prioritizeUrlsWithGemini(['url1', 'url2'], '')).rejects.toThrow();
    });

    it('should handle null query', async () => {
      await expect(geminiService.prioritizeUrlsWithGemini(['url1', 'url2'], null as any)).rejects.toThrow();
    });

    it('should handle undefined query', async () => {
      await expect(geminiService.prioritizeUrlsWithGemini(['url1', 'url2'], undefined as any)).rejects.toThrow();
    });

    it('should handle prioritization with single URL', async () => {
      const mockGoogleAI = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              prioritizedUrls: ['url1'],
              prioritizationStats: { total: 1, prioritized: 1, reasons: ['relevant'] },
            }),
          },
        }),
      };
      mockGoogleAI.GoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      });

      const result = await geminiService.prioritizeUrlsWithGemini(['url1'], 'legal conference');

      expect(result.prioritizedUrls).toHaveLength(1);
      expect(result.prioritizationStats.total).toBe(1);
    });

    it('should handle prioritization with many URLs', async () => {
      const urls = Array.from({ length: 100 }, (_, i) => `url${i}`);
      const mockGoogleAI = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              prioritizedUrls: urls.slice(0, 10),
              prioritizationStats: { total: 100, prioritized: 10, reasons: ['relevant'] },
            }),
          },
        }),
      };
      mockGoogleAI.GoogleGenerativeAI.mockReturnValue({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      });

      const result = await geminiService.prioritizeUrlsWithGemini(urls, 'legal conference');

      expect(result.prioritizedUrls).toHaveLength(10);
      expect(result.prioritizationStats.total).toBe(100);
    });
  });
});
