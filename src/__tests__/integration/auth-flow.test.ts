/**
 * Authentication Flow Integration Tests
 * 
 * This file contains integration tests for the authentication flow.
 */

import { NextRequest } from 'next/server';
import { GET as profileGET } from '@/app/api/profile/get/route';
import { POST as profilePOST } from '@/app/api/profile/save/route';
import { mockRequest, mockUserProfile } from '../utils/test-utils';

// Mock dependencies
jest.mock('@/lib/supabase-server', () => ({
  supabaseServer: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(),
      upsert: jest.fn(),
    })),
  })),
}));

jest.mock('@/lib/cache', () => ({
  getCacheService: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
  CACHE_CONFIGS: {
    USER_PROFILE: { ttl: 300 },
  },
}));

describe('Authentication Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Profile Management Integration', () => {
    it('should handle complete profile flow', async () => {
      const mockSupabase = await import('@/lib/supabase-server');
      const mockClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user123' } },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockResolvedValue({
            data: [mockUserProfile],
            error: null,
          }),
        })),
      };
      (mockSupabase.supabaseServer as jest.Mock).mockResolvedValue(mockClient);

      const response = await profileGET();

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.profile).toBeDefined();
    });

    it('should handle profile save flow', async () => {
      const mockSupabase = await import('@/lib/supabase-server');
      const mockClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user123' } },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          upsert: jest.fn().mockResolvedValue({
            data: [mockUserProfile],
            error: null,
          }),
        })),
      };
      (mockSupabase.supabaseServer as jest.Mock).mockResolvedValue(mockClient);

      const request = mockRequest({
        profile: mockUserProfile,
      });
      
      const response = await profilePOST(request as unknown as NextRequest);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should handle profile get with cached results', async () => {
      const mockCacheService = require('@/lib/cache');
      mockCacheService.getCacheService.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockUserProfile),
        set: jest.fn(),
        delete: jest.fn(),
      });

      const response = await profileGET();

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.profile).toBeDefined();
    });

    it('should handle profile save with cache invalidation', async () => {
      const mockSupabase = await import('@/lib/supabase-server');
      const mockClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user123' } },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          upsert: jest.fn().mockResolvedValue({
            data: [mockUserProfile],
            error: null,
          }),
        })),
      };
      (mockSupabase.supabaseServer as jest.Mock).mockResolvedValue(mockClient);

      const mockCacheService = require('@/lib/cache');
      const mockDelete = jest.fn();
      mockCacheService.getCacheService.mockReturnValue({
        get: jest.fn(),
        set: jest.fn(),
        delete: mockDelete,
      });

      const request = mockRequest({
        profile: mockUserProfile,
      });
      
      await profilePOST(request as NextRequest);

      expect(mockDelete).toHaveBeenCalled();
    });

    it('should handle profile get errors', async () => {
      const mockSupabase = await import('@/lib/supabase-server');
      const mockClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      };
      (mockSupabase.supabaseServer as jest.Mock).mockResolvedValue(mockClient);

      const response = await profileGET();

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle profile save errors', async () => {
      const mockSupabase = await import('@/lib/supabase-server');
      const mockClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      };
      (mockSupabase.supabaseServer as jest.Mock).mockResolvedValue(mockClient);

      const request = mockRequest({
        profile: mockUserProfile,
      });
      
      const response = await profilePOST(request as unknown as NextRequest);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle profile get with database errors', async () => {
      const mockSupabase = await import('@/lib/supabase-server');
      const mockClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user123' } },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        })),
      };
      (mockSupabase.supabaseServer as jest.Mock).mockResolvedValue(mockClient);

      const response = await profileGET();

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle profile save with database errors', async () => {
      const mockSupabase = await import('@/lib/supabase-server');
      const mockClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user123' } },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          upsert: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        })),
      };
      (mockSupabase.supabaseServer as jest.Mock).mockResolvedValue(mockClient);

      const request = mockRequest({
        profile: mockUserProfile,
      });
      
      const response = await profilePOST(request as unknown as NextRequest);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle profile get with invalid request body', async () => {
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any;

      const response = await profileGET();

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle profile save with invalid request body', async () => {
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any;

      const response = await profilePOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle profile get with missing profile', async () => {
      const mockSupabase = await import('@/lib/supabase-server');
      const mockClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user123' } },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        })),
      };
      (mockSupabase.supabaseServer as jest.Mock).mockResolvedValue(mockClient);

      const response = await profileGET();

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle profile save with validation errors', async () => {
      const request = mockRequest({
        profile: {
          // Invalid profile data
          email: 'invalid-email',
        },
      });
      
      const response = await profilePOST(request as unknown as NextRequest);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });
});
