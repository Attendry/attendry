/**
 * Test Utilities
 * 
 * This file provides utilities for testing React components
 * and API endpoints.
 */

import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * Mock Supabase client for testing
 */
export const mockSupabaseClient = {
  auth: {
    getSession: jest.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    }),
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: jest.fn(),
  },
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
      order: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    }),
    insert: jest.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
    update: jest.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
    delete: jest.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
  }),
};

/**
 * Mock Next.js request object
 */
export const mockRequest = (body: any = {}) => ({
  json: jest.fn().mockResolvedValue(body),
  headers: new Headers(),
  url: 'http://localhost:3000/api/test',
});

/**
 * Mock Next.js response object
 */
export const mockResponse = () => {
  const res = {
    json: jest.fn().mockReturnValue(res),
    status: jest.fn().mockReturnValue(res),
    headers: new Headers(),
  };
  return res;
};

/**
 * Mock fetch function
 */
export const mockFetch = (data: any, ok: boolean = true) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  });
};

/**
 * Mock localStorage
 */
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
  };
};

/**
 * Mock session storage
 */
export const mockSessionStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
  };
};

/**
 * Mock user data
 */
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00Z',
  last_sign_in_at: '2024-01-01T00:00:00Z',
  is_active: true,
};

/**
 * Mock event data
 */
export const mockEvent = {
  id: 'test-event-id',
  title: 'Test Event',
  starts_at: '2024-12-01T09:00:00Z',
  ends_at: '2024-12-01T17:00:00Z',
  city: 'Munich',
  country: 'Germany',
  venue: 'Test Venue',
  organizer: 'Test Organizer',
  description: 'Test event description',
  source_url: 'https://example.com/event',
  topics: ['technology', 'innovation'],
};

/**
 * Mock search results
 */
export const mockSearchResults = {
  events: [mockEvent],
  total: 1,
  page: 1,
  limit: 10,
};

/**
 * Mock API response
 */
export const mockApiResponse = (data: any, status: number = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(data),
  text: jest.fn().mockResolvedValue(JSON.stringify(data)),
});

/**
 * Wait for async operations
 */
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock IntersectionObserver
 */
export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  });
  window.IntersectionObserver = mockIntersectionObserver;
  return mockIntersectionObserver;
};

/**
 * Mock ResizeObserver
 */
export const mockResizeObserver = () => {
  const mockResizeObserver = jest.fn();
  mockResizeObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  });
  window.ResizeObserver = mockResizeObserver;
  return mockResizeObserver;
};

/**
 * Mock matchMedia
 */
export const mockMatchMedia = (matches: boolean = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

/**
 * Mock window.location
 */
export const mockLocation = (url: string) => {
  Object.defineProperty(window, 'location', {
    value: new URL(url),
    writable: true,
  });
};

/**
 * Mock console methods
 */
export const mockConsole = () => {
  const originalConsole = { ...console };
  
  beforeEach(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
  });
  
  afterEach(() => {
    Object.assign(console, originalConsole);
  });
};

/**
 * Test wrapper component
 */
export const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <div data-testid="test-wrapper">
      {children}
    </div>
  );
};

/**
 * Custom render function with providers
 */
export const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: TestWrapper, ...options });

/**
 * Mock environment variables
 */
export const mockEnv = (env: Record<string, string>) => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    process.env = { ...originalEnv, ...env };
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });
};

/**
 * Mock date
 */
export const mockDate = (date: string | Date) => {
  const mockDate = new Date(date);
  const originalDate = Date;
  
  beforeEach(() => {
    global.Date = jest.fn(() => mockDate) as any;
    global.Date.now = jest.fn(() => mockDate.getTime());
  });
  
  afterEach(() => {
    global.Date = originalDate;
  });
};

/**
 * Mock crypto
 */
export const mockCrypto = () => {
  const mockCrypto = {
    randomUUID: jest.fn(() => 'test-uuid'),
    getRandomValues: jest.fn((arr) => arr),
  };
  
  Object.defineProperty(global, 'crypto', {
    value: mockCrypto,
    writable: true,
  });
};

/**
 * Mock performance
 */
export const mockPerformance = () => {
  const mockPerformance = {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
  };
  
  Object.defineProperty(global, 'performance', {
    value: mockPerformance,
    writable: true,
  });
};

/**
 * Setup test environment
 */
export const setupTestEnvironment = () => {
  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage(),
      writable: true,
    });
    
    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage(),
      writable: true,
    });
    
    // Mock IntersectionObserver
    mockIntersectionObserver();
    
    // Mock ResizeObserver
    mockResizeObserver();
    
    // Mock matchMedia
    mockMatchMedia();
    
    // Mock crypto
    mockCrypto();
    
    // Mock performance
    mockPerformance();
    
    // Mock console
    mockConsole();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
};
