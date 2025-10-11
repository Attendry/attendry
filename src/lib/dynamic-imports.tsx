/**
 * Dynamic Import Utilities
 * 
 * This file provides utilities for dynamic imports and code splitting
 * to improve bundle size and loading performance.
 */

import dynamic from 'next/dynamic';
import React, { ComponentType } from 'react';

/**
 * Loading component for dynamic imports
 */
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

/**
 * Error boundary component for dynamic imports
 */
const ErrorFallback = ({ error }: { error: Error }) => (
  <div className="flex items-center justify-center p-8 text-red-600">
    <div className="text-center">
      <p className="font-medium">Failed to load component</p>
      <p className="text-sm text-gray-500 mt-1">{error.message}</p>
    </div>
  </div>
);

/**
 * Dynamic import options
 */
interface DynamicImportOptions {
  loading?: ComponentType;
  ssr?: boolean;
  suspense?: boolean;
}

/**
 * Create a dynamic import with loading and error handling
 */
export function createDynamicImport<T = any>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  options: DynamicImportOptions = {}
) {
  const {
    loading = LoadingSpinner,
    ssr = false,
    suspense = false,
  } = options;

  return dynamic(importFn, {
    loading: loading as any,
    ssr,
    suspense,
  });
}

/**
 * Pre-configured dynamic imports for common components
 */
export const DynamicImports = {
  // Event-related components
  EventCard: createDynamicImport(() => import('@/components/EventCard')),
  
  // Layout components
  Header: createDynamicImport(() => import('@/components/Header')),
  
  // Page components
  EventsClient: createDynamicImport(() => import('@/app/(protected)/events/EventsClient')),
  
  // Admin components (lazy loaded for admin users only)
  AdminDashboard: createDynamicImport(() => import('@/components/AdminDashboard'), { ssr: false }),
  SystemHealthMonitor: createDynamicImport(() => import('@/components/SystemHealthMonitor'), { ssr: false }),
  AnalyticsDashboard: createDynamicImport(() => import('@/components/AnalyticsDashboard'), { ssr: false }),
} as const;

/**
 * Lazy load components based on user role
 */
export const RoleBasedImports = {
  /**
   * Load admin components only for admin users
   */
  loadAdminComponents: async (userRole: string) => {
    if (userRole === 'admin') {
      return {
        AdminDashboard: (await import('@/components/AdminDashboard')).default,
        SystemHealthMonitor: (await import('@/components/SystemHealthMonitor')).default,
        AnalyticsDashboard: (await import('@/components/AnalyticsDashboard')).default,
      };
    }
    return {};
  },
  
  /**
   * Load premium components only for premium users
   */
  loadPremiumComponents: async (userRole: string) => {
    if (userRole === 'premium' || userRole === 'admin') {
      return {
        // Add premium components here when they exist
        AdvancedSearch: (await import('@/components/AdvancedSearch')).default,
        EventComparison: (await import('@/components/EventComparison')).default,
        RecommendationEngine: (await import('@/components/RecommendationEngine')).default,
      };
    }
    return {};
  },
} as const;

/**
 * Preload components for better performance
 */
export const ComponentPreloader = {
  /**
   * Preload event-related components
   */
  preloadEventComponents: () => {
    import('@/components/EventCard');
    import('@/components/AdvancedSearch');
    import('@/components/EventComparison');
  },
  
  /**
   * Preload layout components
   */
  preloadLayoutComponents: () => {
    import('@/components/Header');
    import('@/components/Layout');
  },
  
  /**
   * Preload user components
   */
  preloadUserComponents: () => {
    import('@/components/UserProfile');
    import('@/components/NotificationSettings');
    import('@/components/UserActivityTracker');
  },
  
  /**
   * Preload all components
   */
  preloadAll: () => {
    ComponentPreloader.preloadEventComponents();
    ComponentPreloader.preloadLayoutComponents();
    ComponentPreloader.preloadUserComponents();
  },
} as const;

/**
 * Bundle analyzer utility
 */
export const BundleAnalyzer = {
  /**
   * Get bundle size information
   */
  getBundleInfo: async () => {
    if (typeof window !== 'undefined') {
      const { getBundleSize } = await import('@/lib/bundle-analyzer');
      return getBundleSize();
    }
    return null;
  },
  
  /**
   * Log bundle information to console
   */
  logBundleInfo: async () => {
    const info = await BundleAnalyzer.getBundleInfo();
    if (info) {
      console.log('Bundle Information:', info);
    }
  },
} as const;

/**
 * Performance monitoring for dynamic imports
 */
export const ImportPerformance = {
  /**
   * Track import performance
   */
  trackImport: async function<T>(
    importFn: () => Promise<T>,
    componentName: string
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await importFn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`[IMPORT_PERF] ${componentName} loaded in ${duration.toFixed(2)}ms`);
      
      // Send to analytics if available
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'component_load', {
          component_name: componentName,
          load_time: duration,
        });
      }
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.error(`[IMPORT_PERF] ${componentName} failed to load after ${duration.toFixed(2)}ms:`, error);
      
      throw error;
    }
  },
} as const;