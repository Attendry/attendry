export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { BatchGeminiService } from "@/lib/services/batch-gemini-service";
import { TokenBudgetService } from "@/lib/services/token-budget-service";

/**
 * GET /api/debug/test-batch-processing
 * 
 * Test endpoint for batch processing functionality
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const testType = searchParams.get('type') || 'speaker_extraction';
    
    console.log(`[BATCH_TEST] Testing ${testType} batch processing`);
    
    const results: any = {
      testType,
      timestamp: new Date().toISOString(),
      tokenBudget: TokenBudgetService.getBudgetStatus(),
      usageStats: TokenBudgetService.getUsageStats()
    };

    if (testType === 'speaker_extraction') {
      // Test speaker extraction batch processing
      const testEvents = [
        {
          id: 'test_event_1',
          title: 'Legal Tech Conference 2025',
          description: 'Join us for the premier legal technology conference featuring speakers from top law firms and legal tech companies.',
          starts_at: '2025-03-15',
          location: 'Munich, Germany',
          city: 'Munich'
        },
        {
          id: 'test_event_2',
          title: 'Compliance Summit 2025',
          description: 'Annual compliance summit with keynote speakers from regulatory bodies and industry leaders.',
          starts_at: '2025-04-20',
          location: 'Berlin, Germany',
          city: 'Berlin'
        }
      ];

      console.log(`[BATCH_TEST] Processing ${testEvents.length} test events`);
      
      const batchResult = await BatchGeminiService.processSpeakerExtractionBatch(
        testEvents,
        {
          batchSize: 2,
          maxRetries: 1,
          delayBetweenBatches: 500
        }
      );

      results.speakerExtraction = {
        inputEvents: testEvents.length,
        outputResults: batchResult.results.length,
        stats: batchResult.stats,
        results: batchResult.results
      };

    } else if (testType === 'url_prioritization') {
      // Test URL prioritization batch processing
      const testUrls = [
        {
          title: 'Legal Tech Conference 2025 - Munich',
          link: 'https://example.com/legal-tech-2025',
          snippet: 'Join us for the premier legal technology conference in Munich, featuring compliance, e-discovery, and regulatory technology sessions.'
        },
        {
          title: 'Compliance Summit 2025 - Berlin',
          link: 'https://example.com/compliance-summit-2025',
          snippet: 'Annual compliance summit with keynote speakers from regulatory bodies and industry leaders.'
        }
      ];

      console.log(`[BATCH_TEST] Processing ${testUrls.length} test URLs`);
      
      const batchResult = await BatchGeminiService.processUrlPrioritizationBatch(
        testUrls,
        { industry: 'legal-compliance' },
        'de',
        {
          batchSize: 2,
          maxRetries: 1,
          delayBetweenBatches: 500
        }
      );

      results.urlPrioritization = {
        inputUrls: testUrls.length,
        outputResults: batchResult.results.length,
        stats: batchResult.stats,
        results: batchResult.results
      };

    } else if (testType === 'prompt_templates') {
      // Test prompt templates
      const testEvents = [
        {
          id: 'test_event_1',
          title: 'Test Event',
          description: 'Test description',
          starts_at: '2025-01-01',
          location: 'Test Location',
          city: 'Test City'
        }
      ];

      const speakerPrompt = `Extract speakers from ${testEvents.length} events. Return JSON array with speaker information.`;
      const urlPrompt = `Prioritize URLs for events in test industry, de. Return top 15 URLs with scores.`;

      results.promptTemplates = {
        speakerExtractionPrompt: {
          length: speakerPrompt.length,
          estimatedTokens: TokenBudgetService.estimateTokenUsage(speakerPrompt),
          preview: speakerPrompt.substring(0, 200) + '...'
        },
        urlPrioritizationPrompt: {
          length: urlPrompt.length,
          estimatedTokens: TokenBudgetService.estimateTokenUsage(urlPrompt),
          preview: urlPrompt.substring(0, 200) + '...'
        }
      };

    } else if (testType === 'token_budget') {
      // Test token budget functionality
      const testPrompt = "This is a test prompt for token estimation.";
      const estimatedTokens = TokenBudgetService.estimateTokenUsage(testPrompt);
      
      results.tokenBudget = {
        testPrompt,
        estimatedTokens,
        canSpend: TokenBudgetService.canSpend(estimatedTokens),
        fallbackRecommendation: TokenBudgetService.getFallbackRecommendation(estimatedTokens),
        budgetStatus: TokenBudgetService.getBudgetStatus()
      };

    } else {
      return NextResponse.json({ 
        error: 'Invalid test type. Use: speaker_extraction, url_prioritization, prompt_templates, or token_budget' 
      }, { status: 400 });
    }

    // Update final token budget status
    results.finalTokenBudget = TokenBudgetService.getBudgetStatus();
    results.finalUsageStats = TokenBudgetService.getUsageStats();

    console.log(`[BATCH_TEST] ${testType} test completed successfully`);

    return NextResponse.json({
      success: true,
      ...results
    });

  } catch (error: any) {
    console.error('[BATCH_TEST] Test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      tokenBudget: TokenBudgetService.getBudgetStatus(),
      usageStats: TokenBudgetService.getUsageStats()
    }, { status: 500 });
  }
}
