/**
 * Health Check API Tests
 * 
 * This file contains tests for the health check API endpoint.
 */

import { NextRequest } from 'next/server';
import { GET } from '../health/route';
import { mockRequest, mockResponse } from '../../../../__tests__/utils/test-utils';

// Mock dependencies
jest.mock('@/lib/services/gemini-service', () => ({
  GeminiService: {
    checkHealth: jest.fn(),
  },
}));

jest.mock('@/lib/services/firecrawl-search-service', () => ({
  FirecrawlSearchService: {
    checkHealth: jest.fn(),
  },
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
  })),
}));

describe('/api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return healthy status when all services are up', async () => {
    // Mock the services directly since there's no health service
    const mockGeminiService = await import('@/lib/services/gemini-service');
    const mockFirecrawlService = await import('@/lib/services/firecrawl-search-service');
    mockGeminiService.GeminiService.checkHealth.mockResolvedValue({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'healthy', responseTime: 50 },
        cache: { status: 'healthy', responseTime: 10 },
        external_apis: { status: 'healthy', responseTime: 200 },
      },
      uptime: 3600,
      version: '1.0.0',
    });

    const request = mockRequest({});
    const response = await GET(request as NextRequest);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.services).toBeDefined();
  });

  it('should return degraded status when some services are down', async () => {
    // Mock the services directly since there's no health service
    const mockGeminiService = await import('@/lib/services/gemini-service');
    const mockFirecrawlService = await import('@/lib/services/firecrawl-search-service');
    mockGeminiService.GeminiService.checkHealth.mockResolvedValue({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'healthy', responseTime: 50 },
        cache: { status: 'unhealthy', responseTime: 5000 },
        external_apis: { status: 'healthy', responseTime: 200 },
      },
      uptime: 3600,
      version: '1.0.0',
    });

    const request = mockRequest({});
    const response = await GET(request as NextRequest);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('degraded');
  });

  it('should return unhealthy status when critical services are down', async () => {
    // Mock the services directly since there's no health service
    const mockGeminiService = await import('@/lib/services/gemini-service');
    const mockFirecrawlService = await import('@/lib/services/firecrawl-search-service');
    mockGeminiService.GeminiService.checkHealth.mockResolvedValue({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'unhealthy', responseTime: 10000 },
        cache: { status: 'unhealthy', responseTime: 5000 },
        external_apis: { status: 'unhealthy', responseTime: 10000 },
      },
      uptime: 3600,
      version: '1.0.0',
    });

    const request = mockRequest({});
    const response = await GET(request as NextRequest);

    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.status).toBe('unhealthy');
  });

  it('should handle health service errors', async () => {
    // Mock the services directly since there's no health service
    const mockGeminiService = await import('@/lib/services/gemini-service');
    const mockFirecrawlService = await import('@/lib/services/firecrawl-search-service');
    mockHealthService.checkSystemHealth.mockRejectedValue(new Error('Health check failed'));

    const request = mockRequest({});
    const response = await GET(request as NextRequest);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should return proper response format', async () => {
    // Mock the services directly since there's no health service
    const mockGeminiService = await import('@/lib/services/gemini-service');
    const mockFirecrawlService = await import('@/lib/services/firecrawl-search-service');
    mockGeminiService.GeminiService.checkHealth.mockResolvedValue({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'healthy', responseTime: 50 },
        cache: { status: 'healthy', responseTime: 10 },
        external_apis: { status: 'healthy', responseTime: 200 },
      },
      uptime: 3600,
      version: '1.0.0',
    });

    const request = mockRequest({});
    const response = await GET(request as NextRequest);

    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('services');
    expect(data).toHaveProperty('uptime');
    expect(data).toHaveProperty('version');
    expect(data.services).toHaveProperty('database');
    expect(data.services).toHaveProperty('cache');
    expect(data.services).toHaveProperty('external_apis');
  });

  it('should include response times for services', async () => {
    // Mock the services directly since there's no health service
    const mockGeminiService = await import('@/lib/services/gemini-service');
    const mockFirecrawlService = await import('@/lib/services/firecrawl-search-service');
    mockGeminiService.GeminiService.checkHealth.mockResolvedValue({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'healthy', responseTime: 50 },
        cache: { status: 'healthy', responseTime: 10 },
        external_apis: { status: 'healthy', responseTime: 200 },
      },
      uptime: 3600,
      version: '1.0.0',
    });

    const request = mockRequest({});
    const response = await GET(request as NextRequest);

    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.services.database.responseTime).toBe(50);
    expect(data.services.cache.responseTime).toBe(10);
    expect(data.services.external_apis.responseTime).toBe(200);
  });

  it('should handle database connection errors', async () => {
    // Mock the services directly since there's no health service
    const mockGeminiService = await import('@/lib/services/gemini-service');
    const mockFirecrawlService = await import('@/lib/services/firecrawl-search-service');
    mockGeminiService.GeminiService.checkHealth.mockResolvedValue({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'unhealthy', responseTime: 10000, error: 'Connection timeout' },
        cache: { status: 'healthy', responseTime: 10 },
        external_apis: { status: 'healthy', responseTime: 200 },
      },
      uptime: 3600,
      version: '1.0.0',
    });

    const request = mockRequest({});
    const response = await GET(request as NextRequest);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.services.database.error).toBe('Connection timeout');
  });

  it('should include system uptime', async () => {
    // Mock the services directly since there's no health service
    const mockGeminiService = await import('@/lib/services/gemini-service');
    const mockFirecrawlService = await import('@/lib/services/firecrawl-search-service');
    mockGeminiService.GeminiService.checkHealth.mockResolvedValue({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'healthy', responseTime: 50 },
        cache: { status: 'healthy', responseTime: 10 },
        external_apis: { status: 'healthy', responseTime: 200 },
      },
      uptime: 7200,
      version: '1.0.0',
    });

    const request = mockRequest({});
    const response = await GET(request as NextRequest);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.uptime).toBe(7200);
  });

  it('should include version information', async () => {
    // Mock the services directly since there's no health service
    const mockGeminiService = await import('@/lib/services/gemini-service');
    const mockFirecrawlService = await import('@/lib/services/firecrawl-search-service');
    mockGeminiService.GeminiService.checkHealth.mockResolvedValue({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'healthy', responseTime: 50 },
        cache: { status: 'healthy', responseTime: 10 },
        external_apis: { status: 'healthy', responseTime: 200 },
      },
      uptime: 3600,
      version: '1.0.0',
    });

    const request = mockRequest({});
    const response = await GET(request as NextRequest);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.version).toBe('1.0.0');
  });

  it('should handle health check timeout', async () => {
    // Mock the services directly since there's no health service
    const mockGeminiService = await import('@/lib/services/gemini-service');
    const mockFirecrawlService = await import('@/lib/services/firecrawl-search-service');
    mockHealthService.checkSystemHealth.mockImplementation(
      () => new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 100)
      )
    );

    const request = mockRequest({});
    const response = await GET(request as NextRequest);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});
