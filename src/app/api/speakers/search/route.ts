import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { searchSpeakers, getSpeakerHistory } from "@/lib/services/speaker-search-service";
import { checkSearchRateLimit } from "@/lib/services/search-rate-limiter";

export const runtime = "nodejs";

/**
 * POST /api/speakers/search - Unified speaker search
 * 
 * Search speakers across all tables with fuzzy matching and full-text search
 * 
 * Request body:
 * {
 *   query?: string;           // Full-text search
 *   name?: string;            // Name search (fuzzy)
 *   org?: string;             // Organization filter
 *   title?: string;           // Job title filter
 *   topic?: string;           // Speaking topic filter
 *   eventId?: string;         // Filter by event
 *   dateRange?: { from, to };  // Date range filter
 *   minConfidence?: number;    // Confidence threshold (0-1)
 *   limit?: number;           // Result limit (default: 50, max: 100)
 *   offset?: number;          // Pagination offset
 * }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check rate limit
    const rateLimit = await checkSearchRateLimit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
          rateLimitExceeded: true,
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimit.retryAfter?.toString() || '60',
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          },
        }
      );
    }

    const body = await req.json();
    const {
      query,
      name,
      org,
      title,
      topic,
      eventId,
      dateRange,
      minConfidence,
      limit = 50,
      offset = 0,
    } = body;

    // Validate limit
    const searchLimit = Math.min(Math.max(limit, 1), 100); // Between 1 and 100

    // Build search options
    const searchOptions = {
      query,
      name,
      org,
      title,
      topic,
      eventId,
      dateRange,
      minConfidence,
      limit: searchLimit,
      offset: Math.max(offset, 0),
      userId: user.id,
    };

    // Perform search
    const searchResult = await searchSpeakers(searchOptions);

    return NextResponse.json({
      success: true,
      results: searchResult.results,
      pagination: {
        total: searchResult.total,
        limit: searchResult.limit,
        offset: searchResult.offset,
        hasMore: searchResult.offset + searchResult.limit < searchResult.total,
      },
      rateLimit: {
        remaining: rateLimit.remaining,
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      },
    }, {
      headers: {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error in speaker search:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to search speakers" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/speakers/search - Get speaker history by speaker_key
 * 
 * Query params:
 * - speakerKey: Speaker key to get history for
 * - limit: Number of events to return (default: 10)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const speakerKey = searchParams.get("speakerKey");
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!speakerKey) {
      return NextResponse.json(
        { success: false, error: "speakerKey parameter is required" },
        { status: 400 }
      );
    }

    const history = await getSpeakerHistory(speakerKey, limit);

    return NextResponse.json({
      success: true,
      history,
    });
  } catch (error: any) {
    console.error("Error getting speaker history:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to get speaker history" },
      { status: 500 }
    );
  }
}

