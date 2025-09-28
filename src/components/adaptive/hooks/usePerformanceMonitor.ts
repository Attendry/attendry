'use client';

import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage?: number;
  componentMounts: number;
}

export const usePerformanceMonitor = (componentName: string) => {
  const mountTimeRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);
  const metricsRef = useRef<PerformanceMetrics>({
    renderTime: 0,
    componentMounts: 0,
  });

  useEffect(() => {
    mountTimeRef.current = performance.now();
    metricsRef.current.componentMounts += 1;

    return () => {
      const unmountTime = performance.now();
      const totalTime = unmountTime - mountTimeRef.current;
      
      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${componentName}:`, {
          mountTime: totalTime,
          renderCount: renderCountRef.current,
          memoryUsage: (performance as any).memory?.usedJSHeapSize,
        });
      }
    };
  }, [componentName]);

  const recordRender = () => {
    renderCountRef.current += 1;
    const renderTime = performance.now();
    metricsRef.current.renderTime = renderTime;
  };

  return {
    recordRender,
    metrics: metricsRef.current,
  };
};

