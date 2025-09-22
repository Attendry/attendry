export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await supabaseServer();
    
    // Check authentication
    const { data: me, error: meErr } = await supabase.auth.getUser();
    if (meErr || !me?.user) {
      return NextResponse.json({ 
        ok: false, 
        error: "Not authenticated", 
        user: null 
      });
    }

    // Test table access
    const { data: configs, error: configError } = await supabase
      .from("search_configurations")
      .select("*")
      .limit(5);

    // Test RPC function
    let rpcTest = null;
    let rpcError = null;
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("upsert_search_configuration_text", {
        p_name: "Test Config",
        p_industry: "test",
        p_base_search_query: "test query",
        p_exclude_terms_text: "",
        p_industry_terms_text: "",
        p_icp_terms_text: "",
        p_speaker_prompts_text: "",
        p_normalization_prompts_text: ""
      });
      rpcTest = rpcData;
      rpcError = rpcErr;
    } catch (e: any) {
      rpcError = e.message;
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: me.user.id,
        email: me.user.email
      },
      table: {
        exists: !configError,
        error: configError?.message,
        count: configs?.length || 0,
        sample: configs?.[0] || null
      },
      rpc: {
        exists: !rpcError,
        error: rpcError?.message,
        testResult: rpcTest
      }
    });
  } catch (e: any) {
    return NextResponse.json({ 
      ok: false, 
      error: e?.message || "failed" 
    }, { status: 500 });
  }
}
