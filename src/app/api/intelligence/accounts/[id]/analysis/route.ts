/**
 * API Route: /api/intelligence/accounts/[id]/analysis
 * 
 * Handles company intelligence analysis requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { CompanySearchService } from '@/lib/services/company-search-service';
import { CompanyIntelligenceCache } from '@/lib/services/company-intelligence-cache';
import { CompanyIntelligenceQueue } from '@/lib/services/company-intelligence-queue';
import { CompanyIntelligenceAI } from '@/lib/services/company-intelligence-ai-service';
import { UserProfile } from '@/lib/types/core';
import { z } from 'zod';

const AnalysisRequestSchema = z.object({
  searchType: z.enum(['annual_reports', 'intent_signals', 'competitor_analysis', 'event_participation']),
  timeRange: z.object({
    from: z.string().optional(),
    to: z.string().optional()
  }).optional(),
  country: z.string().optional(),
  maxResults: z.coerce.number().min(1).max(200).default(50),
  forceRefresh: z.boolean().default(false)
});

/**
 * POST /api/intelligence/accounts/[id]/analysis
 * Perform company intelligence analysis
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = params.id;

    // Parse and validate request body
    const body = await req.json();
    const validatedData = AnalysisRequestSchema.parse(body);

    // Get account details
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .eq('created_by', user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Get user profile for personalization (Phase 2B)
    let userProfile: UserProfile | undefined;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        userProfile = {
          id: profile.id,
          full_name: profile.full_name,
          company: profile.company,
          competitors: profile.competitors || [],
          icp_terms: profile.icp_terms || [],
          industry_terms: profile.industry_terms || [],
          use_in_basic_search: profile.use_in_basic_search ?? true
        };
      }
    } catch (error) {
      console.warn('[API] Failed to load user profile for personalization:', error);
      // Continue without personalization
    }

    // Check cache first (unless force refresh)
    if (!validatedData.forceRefresh) {
      const cacheKey = {
        companyName: account.name,
        dataType: validatedData.searchType,
        country: validatedData.country || 'DE',
        timeRange: validatedData.timeRange ? 
          `${validatedData.timeRange.from}_${validatedData.timeRange.to}` : undefined
      };

      const cached = await CompanyIntelligenceCache.getCompanyData(cacheKey);
      if (cached && !CompanyIntelligenceCache.shouldRefreshCache(cached)) {
        return NextResponse.json({
          data: cached.data,
          cached: true,
          cacheMetadata: cached.metadata
        });
      }
    }

    // Perform analysis
    const analysisResult = await CompanySearchService.searchCompanyIntelligence({
      companyName: account.company_name,
      domain: account.domain || undefined,
      searchType: validatedData.searchType,
      country: validatedData.country || 'DE',
      timeRange: validatedData.timeRange?.from && validatedData.timeRange?.to ? {
        from: validatedData.timeRange.from,
        to: validatedData.timeRange.to
      } : undefined,
      maxResults: validatedData.maxResults
    });

    // Phase 2B: Calculate insight score for company intelligence
    let insightScore = undefined;
    if (analysisResult.results?.aiAnalysis) {
      try {
        insightScore = CompanyIntelligenceAI.calculateCompanyInsightScore(
          analysisResult.results.aiAnalysis,
          userProfile
        );
        // Add insight score to the AI analysis result
        analysisResult.results.aiAnalysis.insightScore = insightScore;
      } catch (error) {
        console.error('[API] Error calculating insight score:', error);
        // Continue without insight score
      }
    }

    // Cache the result
    await CompanyIntelligenceCache.setCompanyData(
      {
        companyName: account.company_name,
        dataType: validatedData.searchType,
        country: validatedData.country || 'DE',
        timeRange: validatedData.timeRange ? 
          `${validatedData.timeRange.from}_${validatedData.timeRange.to}` : undefined
      },
      analysisResult,
      {
        sourceCount: analysisResult.metadata.sourcesFound,
        confidence: analysisResult.results.confidence
      }
    );

    // Store intelligence data in database (including insight score)
    await storeIntelligenceData(accountId, validatedData.searchType, analysisResult, insightScore);

    return NextResponse.json({
      data: analysisResult,
      cached: false,
      metadata: {
        processingTime: analysisResult.metadata.searchTime,
        sourcesAnalyzed: analysisResult.metadata.sourcesFound,
        confidence: analysisResult.results.confidence,
        // Phase 2B: Include insight score in response
        insightScore: insightScore || undefined
      }
    });

  } catch (error) {
    console.error('[API] Error in POST /api/intelligence/accounts/[id]/analysis:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data', 
        details: error.issues 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * GET /api/intelligence/accounts/[id]/analysis
 * Get cached analysis results
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = params.id;
    const { searchParams } = new URL(req.url);
    const searchType = searchParams.get('searchType') as any;

    // Get account details
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .eq('created_by', user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Get cached analysis
    const cacheKey = {
      companyName: account.company_name,
      dataType: searchType || 'event_participation',
      country: 'DE'
    };

    const cached = await CompanyIntelligenceCache.getCompanyData(cacheKey);
    
    if (cached) {
      return NextResponse.json({
        data: cached.data,
        cached: true,
        cacheMetadata: cached.metadata
      });
    }

    // Get from database
    const { data: intelligenceData, error: dbError } = await supabase
      .from('account_intelligence_data')
      .select('*')
      .eq('account_id', accountId)
      .eq('data_type', searchType || 'event_participation')
      .order('extracted_at', { ascending: false })
      .limit(1);

    if (dbError) {
      console.error('[API] Error getting intelligence data:', dbError);
      return NextResponse.json({ error: 'Failed to get intelligence data' }, { status: 500 });
    }

    if (intelligenceData && intelligenceData.length > 0) {
      return NextResponse.json({
        data: intelligenceData[0],
        cached: false,
        source: 'database'
      });
    }

    return NextResponse.json({
      data: null,
      message: 'No analysis data found'
    });

  } catch (error) {
    console.error('[API] Error in GET /api/intelligence/accounts/[id]/analysis:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * Store intelligence data in database
 * Phase 2B: Includes insight score in metadata
 */
async function storeIntelligenceData(
  accountId: string,
  dataType: string,
  analysisResult: any,
  insightScore?: any
): Promise<void> {
  try {
    const supabase = await supabaseServer();
    
    // Store the analysis result
    const { error } = await supabase
      .from('account_intelligence_data')
      .insert({
        account_id: accountId,
        data_type: dataType,
        title: `${dataType.replace('_', ' ')} analysis`,
        content: JSON.stringify(analysisResult),
        source_url: 'internal_analysis',
        confidence_score: analysisResult.results.confidence,
        metadata: {
          sourcesAnalyzed: analysisResult.metadata.sourcesFound,
          processingTime: analysisResult.metadata.searchTime,
          searchType: dataType,
          // Phase 2B: Include insight score in metadata
          insightScore: insightScore || null
        }
      });

    if (error) {
      console.error('[API] Error storing intelligence data:', error);
    }
  } catch (error) {
    console.error('[API] Error in storeIntelligenceData:', error);
  }
}
