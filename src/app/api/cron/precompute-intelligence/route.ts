/**
 * Pre-compute Intelligence Cron Endpoint
 * 
 * Background job to process intelligence queue
 * Configured in vercel.json to run periodically
 */

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { processIntelligenceQueue, getQueueStats } from '@/lib/services/intelligence-queue';

/**
 * Verify cron request authentication
 * Supports both Vercel Cron (x-vercel-cron header) and manual testing (Authorization header)
 */
function verifyCronRequest(req: NextRequest): boolean {
  // Check for Vercel Cron header (automatically added by Vercel)
  // Vercel adds this header when triggering cron jobs
  const vercelCronHeader = req.headers.get('x-vercel-cron');
  
  // Log all headers for debugging (in production, check logs)
  const allHeaders = Object.fromEntries(
    Array.from(req.headers.entries()).map(([key, value]) => [key, value])
  );
  console.log('[CRON AUTH] Headers received:', JSON.stringify(allHeaders));
  console.log('[CRON AUTH] x-vercel-cron header:', vercelCronHeader);
  console.log('[CRON AUTH] CRON_SECRET set:', !!process.env.CRON_SECRET);
  
  if (vercelCronHeader) {
    console.log('[CRON AUTH] ✅ Authenticated via x-vercel-cron header');
    return true; // Vercel automatically adds this header for cron jobs
  }

  // Fallback: Check for manual Authorization header (for testing)
  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;
  
  if (expectedToken && authHeader === `Bearer ${expectedToken}`) {
    console.log('[CRON AUTH] ✅ Authenticated via Authorization header');
    return true;
  }

  // If CRON_SECRET is set but no valid auth, reject
  if (expectedToken) {
    console.log('[CRON AUTH] ❌ CRON_SECRET is set but no valid auth provided');
    return false;
  }

  // If no CRON_SECRET is set, allow (for development)
  console.log('[CRON AUTH] ⚠️ No CRON_SECRET set, allowing (development mode)');
  return true;
}

/**
 * GET /api/cron/precompute-intelligence
 * 
 * Process queued intelligence items
 * Called by Vercel Cron
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Verify this is a legitimate cron request
    if (!verifyCronRequest(req)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { 
          status: 401,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );
    }
    
    // Process queue (limit to 10 items per run to avoid timeout)
    const result = await processIntelligenceQueue(10);
    
    // Get updated stats
    const stats = await getQueueStats();
    
    return NextResponse.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      errors: result.errors,
      stats
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error('Cron precompute intelligence error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
}

