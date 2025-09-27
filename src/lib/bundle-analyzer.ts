/**
 * Bundle Analyzer Utility
 * 
 * This utility provides bundle size analysis and optimization insights
 * for the application.
 */

/**
 * Bundle size information
 */
export interface BundleInfo {
  totalSize: number;
  gzippedSize: number;
  chunks: Array<{
    name: string;
    size: number;
    gzippedSize: number;
    modules: number;
  }>;
  largestChunks: Array<{
    name: string;
    size: number;
    percentage: number;
  }>;
  recommendations: string[];
}

/**
 * Get bundle size information
 */
export function getBundleSize(): BundleInfo | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // Get performance entries
    const performanceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    // Filter for JavaScript and CSS files
    const bundleEntries = performanceEntries.filter(entry => 
      entry.name.includes('.js') || entry.name.includes('.css')
    );

    // Calculate total size
    const totalSize = bundleEntries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
    
    // Estimate gzipped size (rough approximation)
    const gzippedSize = Math.round(totalSize * 0.3);

    // Group by chunk name
    const chunks = bundleEntries.map(entry => {
      const name = entry.name.split('/').pop() || 'unknown';
      const size = entry.transferSize || 0;
      const gzippedSize = Math.round(size * 0.3);
      
      return {
        name,
        size,
        gzippedSize,
        modules: 1, // We can't easily determine this from performance API
      };
    });

    // Find largest chunks
    const largestChunks = chunks
      .sort((a, b) => b.size - a.size)
      .slice(0, 5)
      .map(chunk => ({
        name: chunk.name,
        size: chunk.size,
        percentage: Math.round((chunk.size / totalSize) * 100),
      }));

    // Generate recommendations
    const recommendations = generateRecommendations(chunks, totalSize);

    return {
      totalSize,
      gzippedSize,
      chunks,
      largestChunks,
      recommendations,
    };
  } catch (error) {
    console.error('Failed to analyze bundle size:', error);
    return null;
  }
}

/**
 * Generate optimization recommendations
 */
function generateRecommendations(chunks: any[], totalSize: number): string[] {
  const recommendations: string[] = [];

  // Check for large chunks
  const largeChunks = chunks.filter(chunk => chunk.size > 100000); // 100KB
  if (largeChunks.length > 0) {
    recommendations.push(`Consider code splitting for large chunks: ${largeChunks.map(c => c.name).join(', ')}`);
  }

  // Check total bundle size
  if (totalSize > 1000000) { // 1MB
    recommendations.push('Total bundle size is large (>1MB). Consider lazy loading and code splitting.');
  }

  // Check for vendor chunks
  const vendorChunks = chunks.filter(chunk => 
    chunk.name.includes('vendor') || chunk.name.includes('chunk')
  );
  if (vendorChunks.length > 3) {
    recommendations.push('Consider consolidating vendor chunks to reduce HTTP requests.');
  }

  // Check for duplicate dependencies
  const duplicateChunks = findDuplicateChunks(chunks);
  if (duplicateChunks.length > 0) {
    recommendations.push(`Potential duplicate dependencies detected: ${duplicateChunks.join(', ')}`);
  }

  return recommendations;
}

/**
 * Find potential duplicate chunks
 */
function findDuplicateChunks(chunks: any[]): string[] {
  const duplicates: string[] = [];
  const chunkNames = chunks.map(chunk => chunk.name);
  
  // Simple heuristic: chunks with similar names might be duplicates
  const nameGroups = new Map<string, string[]>();
  
  for (const name of chunkNames) {
    const baseName = name.replace(/\d+/g, '').replace(/[.-]/g, '');
    if (!nameGroups.has(baseName)) {
      nameGroups.set(baseName, []);
    }
    nameGroups.get(baseName)!.push(name);
  }
  
  for (const [baseName, names] of nameGroups.entries()) {
    if (names.length > 1) {
      duplicates.push(baseName);
    }
  }
  
  return duplicates;
}

/**
 * Monitor bundle loading performance
 */
export function monitorBundlePerformance(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Monitor script loading
  const scriptTags = document.querySelectorAll('script[src]');
  scriptTags.forEach(script => {
    const src = script.getAttribute('src');
    if (src) {
      const startTime = performance.now();
      
      script.addEventListener('load', () => {
        const endTime = performance.now();
        const loadTime = endTime - startTime;
        
        console.log(`[BUNDLE_PERF] Script loaded: ${src} (${loadTime.toFixed(2)}ms)`);
        
        // Send to analytics
        if ((window as any).gtag) {
          (window as any).gtag('event', 'script_load', {
            script_src: src,
            load_time: loadTime,
          });
        }
      });
      
      script.addEventListener('error', () => {
        console.error(`[BUNDLE_PERF] Script failed to load: ${src}`);
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
        
        console.log(`[BUNDLE_PERF] CSS loaded: ${href} (${loadTime.toFixed(2)}ms)`);
      });
      
      link.addEventListener('error', () => {
        console.error(`[BUNDLE_PERF] CSS failed to load: ${href}`);
      });
    }
  });
}

/**
 * Get bundle optimization score
 */
export function getBundleScore(bundleInfo: BundleInfo): number {
  let score = 100;
  
  // Deduct points for large total size
  if (bundleInfo.totalSize > 1000000) { // 1MB
    score -= 20;
  } else if (bundleInfo.totalSize > 500000) { // 500KB
    score -= 10;
  }
  
  // Deduct points for large individual chunks
  const largeChunks = bundleInfo.chunks.filter(chunk => chunk.size > 100000);
  score -= largeChunks.length * 5;
  
  // Deduct points for too many chunks
  if (bundleInfo.chunks.length > 20) {
    score -= 10;
  }
  
  // Deduct points for recommendations
  score -= bundleInfo.recommendations.length * 2;
  
  return Math.max(0, score);
}

/**
 * Log bundle analysis to console
 */
export function logBundleAnalysis(): void {
  const bundleInfo = getBundleSize();
  if (!bundleInfo) {
    console.log('Bundle analysis not available in this environment');
    return;
  }
  
  const score = getBundleScore(bundleInfo);
  
  console.group('📦 Bundle Analysis');
  console.log(`Total Size: ${(bundleInfo.totalSize / 1024).toFixed(2)} KB`);
  console.log(`Gzipped Size: ${(bundleInfo.gzippedSize / 1024).toFixed(2)} KB`);
  console.log(`Chunks: ${bundleInfo.chunks.length}`);
  console.log(`Optimization Score: ${score}/100`);
  
  if (bundleInfo.largestChunks.length > 0) {
    console.group('Largest Chunks:');
    bundleInfo.largestChunks.forEach(chunk => {
      console.log(`${chunk.name}: ${(chunk.size / 1024).toFixed(2)} KB (${chunk.percentage}%)`);
    });
    console.groupEnd();
  }
  
  if (bundleInfo.recommendations.length > 0) {
    console.group('Recommendations:');
    bundleInfo.recommendations.forEach(rec => {
      console.log(`• ${rec}`);
    });
    console.groupEnd();
  }
  
  console.groupEnd();
}
