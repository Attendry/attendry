/**
 * Pre-compute Intelligence Cron Endpoint
 * 
 * Background job to process intelligence queue
 * Configured in vercel.json to run periodically
 */

import { NextRequest, NextResponse } from 'next/server';
import { processIntelligenceQueue, getQueueStats } from '@/lib/services/intelligence-queue';

/**
 * GET /api/cron/precompute-intelligence
 * 
 * Process queued intelligence items
 * Called by Vercel Cron
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Verify cron secret (if configured)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Process queue (limit to 20 items per run)
    const result = await processIntelligenceQueue(20);
    
    // Get updated stats
    const stats = await getQueueStats();
    
    return NextResponse.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      errors: result.errors,
      stats
    });
  } catch (error: any) {
    console.error('Cron precompute intelligence error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 }
    );
  }
}

