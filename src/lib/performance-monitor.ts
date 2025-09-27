/**
 * Performance Monitor
 * 
 * This service provides comprehensive performance monitoring and metrics
 * collection for the Attendry application.
 */

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  // Page load metrics
  pageLoad: {
    domContentLoaded: number;
    loadComplete: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    firstInputDelay: number;
    cumulativeLayoutShift: number;
  };
  
  // API metrics
  api: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    slowRequests: number;
  };
  
  // Cache metrics
  cache: {
    hitRate: number;
    missRate: number;
    totalRequests: number;
    averageResponseTime: number;
  };
  
  // Bundle metrics
  bundle: {
    totalSize: number;
    loadTime: number;
    chunkCount: number;
  };
  
  // User interaction metrics
  interactions: {
    totalClicks: number;
    averageClickDelay: number;
    scrollDepth: number;
    timeOnPage: number;
  };
}

/**
 * Performance event types
 */
export type PerformanceEventType = 
  | 'page_load'
  | 'api_request'
  | 'api_response'
  | 'cache_hit'
  | 'cache_miss'
  | 'user_interaction'
  | 'error'
  | 'bundle_load';

/**
 * Performance event
 */
export interface PerformanceEvent {
  type: PerformanceEventType;
  timestamp: number;
  data: any;
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * Performance Monitor Class
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private events: PerformanceEvent[] = [];
  private metrics: Partial<PerformanceMetrics> = {};
  private observers: Map<string, PerformanceObserver> = new Map();
  private isInitialized = false;

  private constructor() {
    this.initialize();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Initialize performance monitoring
   */
  private initialize(): void {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    this.setupPageLoadMonitoring();
    this.setupApiMonitoring();
    this.setupUserInteractionMonitoring();
    this.setupErrorMonitoring();
    this.setupBundleMonitoring();

    this.isInitialized = true;
    console.log('[PERF_MONITOR] Performance monitoring initialized');
  }

  /**
   * Setup page load monitoring
   */
  private setupPageLoadMonitoring(): void {
    // Monitor Core Web Vitals
    this.observePerformanceEntries('paint', (entries) => {
      entries.forEach(entry => {
        if (entry.name === 'first-contentful-paint') {
          this.recordEvent('page_load', {
            firstContentfulPaint: entry.startTime,
          });
        }
      });
    });

    this.observePerformanceEntries('largest-contentful-paint', (entries) => {
      entries.forEach(entry => {
        this.recordEvent('page_load', {
          largestContentfulPaint: entry.startTime,
        });
      });
    });

    this.observePerformanceEntries('first-input', (entries) => {
      entries.forEach(entry => {
        this.recordEvent('page_load', {
          firstInputDelay: entry.processingStart - entry.startTime,
        });
      });
    });

    this.observePerformanceEntries('layout-shift', (entries) => {
      let cumulativeLayoutShift = 0;
      entries.forEach(entry => {
        if (!(entry as any).hadRecentInput) {
          cumulativeLayoutShift += (entry as any).value;
        }
      });
      this.recordEvent('page_load', {
        cumulativeLayoutShift,
      });
    });

    // Monitor page load events
    window.addEventListener('DOMContentLoaded', () => {
      this.recordEvent('page_load', {
        domContentLoaded: performance.now(),
      });
    });

    window.addEventListener('load', () => {
      this.recordEvent('page_load', {
        loadComplete: performance.now(),
      });
    });
  }

  /**
   * Setup API monitoring
   */
  private setupApiMonitoring(): void {
    // Monitor fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const url = args[0]?.toString() || 'unknown';
      
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.recordEvent('api_response', {
          url,
          status: response.status,
          duration,
          success: response.ok,
        });
        
        return response;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.recordEvent('api_response', {
          url,
          status: 0,
          duration,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        throw error;
      }
    };
  }

  /**
   * Setup user interaction monitoring
   */
  private setupUserInteractionMonitoring(): void {
    let clickCount = 0;
    let totalClickDelay = 0;
    let maxScrollDepth = 0;
    let startTime = Date.now();

    // Monitor clicks
    document.addEventListener('click', (event) => {
      clickCount++;
      const clickDelay = performance.now() - (event as any).timeStamp;
      totalClickDelay += clickDelay;
      
      this.recordEvent('user_interaction', {
        type: 'click',
        target: (event.target as Element)?.tagName || 'unknown',
        delay: clickDelay,
      });
    });

    // Monitor scroll depth
    let ticking = false;
    const updateScrollDepth = () => {
      const scrollDepth = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );
      
      if (scrollDepth > maxScrollDepth) {
        maxScrollDepth = scrollDepth;
        this.recordEvent('user_interaction', {
          type: 'scroll',
          depth: scrollDepth,
        });
      }
      
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollDepth);
        ticking = true;
      }
    });

    // Monitor time on page
    setInterval(() => {
      const timeOnPage = Date.now() - startTime;
      this.recordEvent('user_interaction', {
        type: 'time_on_page',
        duration: timeOnPage,
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Setup error monitoring
   */
  private setupErrorMonitoring(): void {
    window.addEventListener('error', (event) => {
      this.recordEvent('error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.recordEvent('error', {
        type: 'unhandled_promise_rejection',
        reason: event.reason,
        promise: event.promise,
      });
    });
  }

  /**
   * Setup bundle monitoring
   */
  private setupBundleMonitoring(): void {
    // Monitor script loading
    const scriptTags = document.querySelectorAll('script[src]');
    scriptTags.forEach(script => {
      const src = script.getAttribute('src');
      if (src) {
        const startTime = performance.now();
        
        script.addEventListener('load', () => {
          const endTime = performance.now();
          const loadTime = endTime - startTime;
          
          this.recordEvent('bundle_load', {
            type: 'script',
            src,
            loadTime,
          });
        });
      }
    });

    // Monitor CSS loading
    const linkTags = document.querySelectorAll('link[rel="stylesheet"]');
    linkTags.forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        const startTime = performance.now();
        
        link.addEventListener('load', () => {
          const endTime = performance.now();
          const loadTime = endTime - startTime;
          
          this.recordEvent('bundle_load', {
            type: 'css',
            href,
            loadTime,
          });
        });
      }
    });
  }

  /**
   * Observe performance entries
   */
  private observePerformanceEntries(
    type: string,
    callback: (entries: PerformanceEntry[]) => void
  ): void {
    if (!('PerformanceObserver' in window)) {
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      
      observer.observe({ type, buffered: true });
      this.observers.set(type, observer);
    } catch (error) {
      console.warn(`[PERF_MONITOR] Failed to observe ${type}:`, error);
    }
  }

  /**
   * Record a performance event
   */
  recordEvent(type: PerformanceEventType, data: any, duration?: number): void {
    const event: PerformanceEvent = {
      type,
      timestamp: Date.now(),
      data,
      duration,
    };

    this.events.push(event);

    // Keep only last 1000 events to prevent memory leaks
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    // Update metrics
    this.updateMetrics(event);

    // Send to analytics if available
    this.sendToAnalytics(event);
  }

  /**
   * Update metrics based on event
   */
  private updateMetrics(event: PerformanceEvent): void {
    switch (event.type) {
      case 'page_load':
        this.metrics.pageLoad = {
          ...this.metrics.pageLoad,
          ...event.data,
        };
        break;
        
      case 'api_response':
        if (!this.metrics.api) {
          this.metrics.api = {
            totalRequests: 0,
            averageResponseTime: 0,
            errorRate: 0,
            slowRequests: 0,
          };
        }
        
        this.metrics.api.totalRequests++;
        this.metrics.api.averageResponseTime = 
          (this.metrics.api.averageResponseTime + event.data.duration) / 2;
        
        if (!event.data.success) {
          this.metrics.api.errorRate = 
            (this.metrics.api.errorRate + 1) / this.metrics.api.totalRequests;
        }
        
        if (event.data.duration > 1000) { // 1 second
          this.metrics.api.slowRequests++;
        }
        break;
        
      case 'user_interaction':
        if (!this.metrics.interactions) {
          this.metrics.interactions = {
            totalClicks: 0,
            averageClickDelay: 0,
            scrollDepth: 0,
            timeOnPage: 0,
          };
        }
        
        if (event.data.type === 'click') {
          this.metrics.interactions.totalClicks++;
          this.metrics.interactions.averageClickDelay = 
            (this.metrics.interactions.averageClickDelay + event.data.delay) / 2;
        } else if (event.data.type === 'scroll') {
          this.metrics.interactions.scrollDepth = Math.max(
            this.metrics.interactions.scrollDepth,
            event.data.depth
          );
        } else if (event.data.type === 'time_on_page') {
          this.metrics.interactions.timeOnPage = event.data.duration;
        }
        break;
    }
  }

  /**
   * Send event to analytics
   */
  private sendToAnalytics(event: PerformanceEvent): void {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'performance_event', {
        event_type: event.type,
        event_data: event.data,
        duration: event.duration,
      });
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics };
  }

  /**
   * Get performance events
   */
  getEvents(type?: PerformanceEventType): PerformanceEvent[] {
    if (type) {
      return this.events.filter(event => event.type === type);
    }
    return [...this.events];
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    metrics: Partial<PerformanceMetrics>;
    eventCounts: Record<PerformanceEventType, number>;
    recommendations: string[];
  } {
    const eventCounts = this.events.reduce((counts, event) => {
      counts[event.type] = (counts[event.type] || 0) + 1;
      return counts;
    }, {} as Record<PerformanceEventType, number>);

    const recommendations = this.generateRecommendations();

    return {
      metrics: this.metrics,
      eventCounts,
      recommendations,
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.metrics;

    // Page load recommendations
    if (metrics.pageLoad?.firstContentfulPaint && metrics.pageLoad.firstContentfulPaint > 1500) {
      recommendations.push('First Contentful Paint is slow (>1.5s). Consider optimizing critical resources.');
    }

    if (metrics.pageLoad?.largestContentfulPaint && metrics.pageLoad.largestContentfulPaint > 2500) {
      recommendations.push('Largest Contentful Paint is slow (>2.5s). Consider optimizing images and fonts.');
    }

    if (metrics.pageLoad?.cumulativeLayoutShift && metrics.pageLoad.cumulativeLayoutShift > 0.1) {
      recommendations.push('Cumulative Layout Shift is high (>0.1). Consider fixing layout shifts.');
    }

    // API recommendations
    if (metrics.api?.averageResponseTime && metrics.api.averageResponseTime > 1000) {
      recommendations.push('Average API response time is slow (>1s). Consider optimizing backend or adding caching.');
    }

    if (metrics.api?.errorRate && metrics.api.errorRate > 0.05) {
      recommendations.push('API error rate is high (>5%). Consider improving error handling and monitoring.');
    }

    // Interaction recommendations
    if (metrics.interactions?.averageClickDelay && metrics.interactions.averageClickDelay > 100) {
      recommendations.push('Click delay is high (>100ms). Consider optimizing JavaScript execution.');
    }

    return recommendations;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.events = [];
    this.metrics = {};
  }

  /**
   * Destroy the monitor
   */
  destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.clear();
    this.isInitialized = false;
  }
}

/**
 * Global performance monitor instance
 */
export const performanceMonitor = PerformanceMonitor.getInstance();

/**
 * Utility functions for easy access
 */
export const PerformanceUtils = {
  /**
   * Record a custom performance event
   */
  record: (type: PerformanceEventType, data: any, duration?: number) => {
    performanceMonitor.recordEvent(type, data, duration);
  },

  /**
   * Get current metrics
   */
  getMetrics: () => performanceMonitor.getMetrics(),

  /**
   * Get performance summary
   */
  getSummary: () => performanceMonitor.getSummary(),

  /**
   * Log performance summary to console
   */
  logSummary: () => {
    const summary = performanceMonitor.getSummary();
    console.group('📊 Performance Summary');
    console.log('Metrics:', summary.metrics);
    console.log('Event Counts:', summary.eventCounts);
    if (summary.recommendations.length > 0) {
      console.group('Recommendations:');
      summary.recommendations.forEach(rec => console.log(`• ${rec}`));
      console.groupEnd();
    }
    console.groupEnd();
  },
};
