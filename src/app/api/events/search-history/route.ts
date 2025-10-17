import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// GET /api/events/search-history - Get user's search history
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get user's search history
    const { data, error } = await supabase
      .from('user_search_results')
      .select('*')
      .eq('user_id', userRes.user.id)
      .order('searched_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ 
        success: false,
        error: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      searches: data || [],
      total: data?.length || 0
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to fetch search history" 
    }, { status: 500 });
  }
}

// POST /api/events/search-history - Save search results
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    const requestData = await req.json();
    const { 
      searchParams, 
      results, 
      searchDurationMs, 
      apiEndpoint 
    } = requestData;

    if (!searchParams || !results) {
      return NextResponse.json({ 
        success: false,
        error: "searchParams and results are required" 
      }, { status: 400 });
    }

    // Save search results using the database function
    const { data, error } = await supabase.rpc('save_search_results', {
      p_user_id: userRes.user.id,
      p_search_params: searchParams,
      p_results: results,
      p_search_duration_ms: searchDurationMs || null,
      p_api_endpoint: apiEndpoint || null
    });

    if (error) {
      return NextResponse.json({ 
        success: false,
        error: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      searchId: data
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to save search results" 
    }, { status: 500 });
  }
}

// DELETE /api/events/search-history - Clear user's search history
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const searchId = searchParams.get('id');

    if (searchId) {
      // Delete specific search
      const { error } = await supabase
        .from('user_search_results')
        .delete()
        .eq('id', searchId)
        .eq('user_id', userRes.user.id);

      if (error) {
        return NextResponse.json({ 
          success: false,
          error: error.message 
        }, { status: 400 });
      }
    } else {
      // Delete all user's search history
      const { error } = await supabase
        .from('user_search_results')
        .delete()
        .eq('user_id', userRes.user.id);

      if (error) {
        return NextResponse.json({ 
          success: false,
          error: error.message 
        }, { status: 400 });
      }
    }

    return NextResponse.json({ 
      success: true
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to delete search history" 
    }, { status: 500 });
  }
}
