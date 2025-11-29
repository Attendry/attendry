/**
 * Auto-Save Rate Limit Statistics API
 * 
 * Returns rate limit statistics for the current user
 */

import { NextRequest, NextResponse } from "next/server";
import { getAutoSaveRateLimiter } from "@/lib/services/auto-save-rate-limiter";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = userRes.user.id;
    const rateLimiter = getAutoSaveRateLimiter();
    
    // Check current rate limit status
    const rateLimitCheck = await rateLimiter.checkRateLimit(userId);
    const queueStats = await rateLimiter.getQueueStats(userId);
    
    return NextResponse.json({
      success: true,
      rateLimit: {
        allowed: rateLimitCheck.allowed,
        remaining: rateLimitCheck.remaining,
        resetAt: rateLimitCheck.resetAt,
        retryAfter: rateLimitCheck.retryAfter,
        circuitBreakerOpen: rateLimitCheck.circuitBreakerOpen || false,
        queueFull: rateLimitCheck.queueFull || false,
      },
      queue: queueStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[rate-limit-stats] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

