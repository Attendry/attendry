/**
 * Cache Management API
 * 
 * This API endpoint provides cache management functionality including:
 * - Cache invalidation by pattern
 * - Cache warming
 * - Cache analytics
 * - Cache optimization status
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  cacheOptimizer,
  invalidateCacheByPattern,
  getCacheAnalytics,
  getCacheWarmingStats
} from '@/lib/cache-optimizer';
import { 
  searchCache, 
  analysisCache, 
  speakerCache,
  invalidateSearchCache,
  invalidateAnalysisCache,
  invalidateSpeakerCache
} from '@/lib/advanced-cache';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const pattern = url.searchParams.get('pattern');
    const type = url.searchParams.get('type') as 'exact' | 'prefix' | 'suffix' | 'contains' | 'regex' || 'contains';

    switch (action) {
      case 'analytics':
        const analytics = getCacheAnalytics();
        const warmingStats = getCacheWarmingStats();
        const searchAnalytics = searchCache.getAnalytics();
        const analysisAnalytics = analysisCache.getAnalytics();
        const speakerAnalytics = speakerCache.getAnalytics();

        return NextResponse.json({
          success: true,
          data: {
            optimization: analytics,
            warming: warmingStats,
            search: searchAnalytics,
            analysis: analysisAnalytics,
            speaker: speakerAnalytics,
            combined: {
              hitRate: (searchAnalytics.combined.hitRate + analysisAnalytics.combined.hitRate + speakerAnalytics.combined.hitRate) / 3,
              totalRequests: searchAnalytics.combined.totalRequests + analysisAnalytics.combined.totalRequests + speakerAnalytics.combined.totalRequests,
              totalHits: searchAnalytics.combined.hits + analysisAnalytics.combined.hits + speakerAnalytics.combined.hits,
              totalSize: searchAnalytics.combined.cacheSize + analysisAnalytics.combined.cacheSize + speakerAnalytics.combined.cacheSize,
              memoryUsage: searchAnalytics.combined.memoryUsage + analysisAnalytics.combined.memoryUsage + speakerAnalytics.combined.memoryUsage,
            }
          }
        });

      case 'status':
        return NextResponse.json({
          success: true,
          data: {
            optimizerInitialized: true,
            warmingEnabled: true,
            analyticsEnabled: true,
            invalidationEnabled: true,
            lastUpdate: new Date().toISOString()
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: analytics, status'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[cache-management] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, pattern, type, keys, dataProvider } = body;

    switch (action) {
      case 'invalidate':
        if (!pattern) {
          return NextResponse.json({
            success: false,
            error: 'Pattern is required for invalidation'
          }, { status: 400 });
        }

        await invalidateCacheByPattern(pattern, type || 'contains');
        
        return NextResponse.json({
          success: true,
          message: `Cache invalidated for pattern: ${pattern} (${type || 'contains'})`
        });

      case 'invalidate-all':
        await invalidateSearchCache();
        await invalidateAnalysisCache();
        await invalidateSpeakerCache();
        
        return NextResponse.json({
          success: true,
          message: 'All caches invalidated'
        });

      case 'warm':
        if (!keys || !Array.isArray(keys)) {
          return NextResponse.json({
            success: false,
            error: 'Keys array is required for warming'
          }, { status: 400 });
        }

        if (!dataProvider) {
          return NextResponse.json({
            success: false,
            error: 'Data provider function is required for warming'
          }, { status: 400 });
        }

        // In a real implementation, this would validate and execute the data provider
        await cacheOptimizer.warmCache(keys, dataProvider);
        
        return NextResponse.json({
          success: true,
          message: `Cache warmed for ${keys.length} keys`
        });

      case 'optimize':
        // Trigger cache optimization
        const optimizationResult = await cacheOptimizer.initialize();
        
        return NextResponse.json({
          success: true,
          message: 'Cache optimization triggered',
          data: optimizationResult
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: invalidate, invalidate-all, warm, optimize'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[cache-management] POST error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const cacheType = url.searchParams.get('type');
    const pattern = url.searchParams.get('pattern');

    if (pattern) {
      // Delete by pattern
      await invalidateCacheByPattern(pattern, 'contains');
      
      return NextResponse.json({
        success: true,
        message: `Cache entries matching pattern '${pattern}' deleted`
      });
    }

    // Delete by cache type
    switch (cacheType) {
      case 'search':
        await invalidateSearchCache();
        break;
      case 'analysis':
        await invalidateAnalysisCache();
        break;
      case 'speaker':
        await invalidateSpeakerCache();
        break;
      case 'all':
        await invalidateSearchCache();
        await invalidateAnalysisCache();
        await invalidateSpeakerCache();
        break;
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid cache type. Supported types: search, analysis, speaker, all'
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Cache cleared for type: ${cacheType || 'all'}`
    });
  } catch (error) {
    console.error('[cache-management] DELETE error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
