/**
 * Test API Route: /api/test/intelligence
 * 
 * This is a test endpoint that doesn't require authentication
 * for testing the Market Intelligence functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { CompanySearchService } from '@/lib/services/company-search-service';
import { CompanyIntelligenceCache } from '@/lib/services/company-intelligence-cache';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    return NextResponse.json({
      message: 'Market Intelligence Test API is working!',
      timestamp: new Date().toISOString(),
      endpoints: {
        accounts: '/api/intelligence/accounts',
        analysis: '/api/intelligence/accounts/[id]/analysis'
      },
      status: 'healthy'
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Test API error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { testType, companyName = 'Test Company' } = body;

    switch (testType) {
      case 'search':
        // Test company search functionality
        const searchResult = await CompanySearchService.searchCompanyIntelligence({
          companyName,
          searchType: 'event_participation',
          country: 'DE',
          maxResults: 5
        });

        return NextResponse.json({
          testType: 'search',
          success: true,
          result: {
            companyName: searchResult.companyName,
            searchType: searchResult.searchType,
            totalResults: searchResult.results.searchResults.length,
            confidence: searchResult.results.confidence,
            metadata: searchResult.metadata
          }
        });

      case 'cache':
        // Test cache functionality
        const cacheKey = {
          companyName,
          dataType: 'event_participation',
          country: 'DE'
        };

        const cached = await CompanyIntelligenceCache.getCompanyData(cacheKey);
        const cacheStats = CompanyIntelligenceCache.getCacheStats();

        return NextResponse.json({
          testType: 'cache',
          success: true,
          result: {
            cacheKey: CompanyIntelligenceCache['buildCacheKey'](cacheKey),
            cached: !!cached,
            stats: cacheStats
          }
        });

      case 'analysis':
        // Test analysis functionality (simplified)
        return NextResponse.json({
          testType: 'analysis',
          success: true,
          result: {
            message: 'Analysis test would require authentication in real scenario',
            companyName,
            mockAnalysis: {
              confidence: 0.85,
              insights: ['Company is active in legal events', 'Strong speaker presence'],
              totalEvents: 12
            }
          }
        });

      default:
        return NextResponse.json({
          testType: 'unknown',
          success: false,
          error: 'Unknown test type. Use: search, cache, or analysis'
        }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
