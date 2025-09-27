/**
 * Events Run API Tests
 * 
 * This file contains tests for the events run API endpoint.
 */

import { NextRequest } from 'next/server';
import { POST } from '../events/run/route';
import { mockRequest, mockResponse, mockEventData } from '../../../../__tests__/utils/test-utils';

// Mock dependencies
jest.mock('@/lib/services/search-service', () => ({
  runEventDiscovery: jest.fn(),
}));

jest.mock('@/lib/cache', () => ({
  getCacheService: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
  CACHE_CONFIGS: {
    EVENT_DISCOVERY: { ttl: 600 },
  },
}));

describe('/api/events/run', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should run event discovery for valid request', async () => {
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
    
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.events).toBeDefined();
    expect(data.stats).toBeDefined();
  });

  it('should return error for empty query', async () => {
    const request = mockRequest({ query: '' });
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should handle discovery service errors', async () => {
    const mockSearchService = require('@/lib/services/search-service');
    mockSearchService.runEventDiscovery.mockRejectedValue(new Error('Discovery failed'));

    const request = mockRequest({ query: 'legal conference' });
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should pass parameters to discovery service', async () => {
    const mockSearchService = require('@/lib/services/search-service');
    mockSearchService.runEventDiscovery.mockResolvedValue({
      events: [],
      total: 0,
      stats: { totalUrls: 0, processedUrls: 0, extractedEvents: 0, errors: 0 },
    });

    const request = mockRequest({ 
      query: 'legal conference',
      location: 'Munich',
      date: '2024-12-01',
    });
    
    await POST(request as NextRequest);

    expect(mockSearchService.runEventDiscovery).toHaveBeenCalledWith(
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
      get: jest.fn().mockResolvedValue({
        events: [mockEventData],
        total: 1,
        stats: { totalUrls: 10, processedUrls: 8, extractedEvents: 1, errors: 0 },
      }),
      set: jest.fn(),
    });

    const request = mockRequest({ query: 'legal conference' });
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.events).toBeDefined();
  });

  it('should handle discovery timeout', async () => {
    const mockSearchService = require('@/lib/services/search-service');
    mockSearchService.runEventDiscovery.mockImplementation(
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

  it('should validate required parameters', async () => {
    const request = mockRequest({});
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(400);
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

  it('should return proper response format', async () => {
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
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data).toHaveProperty('events');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('stats');
    expect(Array.isArray(data.events)).toBe(true);
    expect(data.stats).toHaveProperty('totalUrls');
    expect(data.stats).toHaveProperty('processedUrls');
    expect(data.stats).toHaveProperty('extractedEvents');
    expect(data.stats).toHaveProperty('errors');
  });

  it('should handle discovery with no results', async () => {
    const mockSearchService = require('@/lib/services/search-service');
    mockSearchService.runEventDiscovery.mockResolvedValue({
      events: [],
      total: 0,
      stats: { totalUrls: 5, processedUrls: 5, extractedEvents: 0, errors: 0 },
    });

    const request = mockRequest({ query: 'nonexistent event' });
    const response = await POST(request as NextRequest);

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
      stats: { totalUrls: 10, processedUrls: 8, extractedEvents: 1, errors: 2 },
    });

    const request = mockRequest({ query: 'legal conference' });
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.stats.errors).toBe(2);
  });
});
