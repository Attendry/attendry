export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();

    // Ensure logged in
    const { data: me, error: meErr } = await supabase.auth.getUser();
    if (meErr || !me?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();

    // If your form sends newline strings, call the *_text function:
    const { data, error } = await supabase.rpc("upsert_search_configuration_text", {
      p_name:                  body.name,
      p_industry:              body.industry ?? null,
      p_base_search_query:     body.baseQuery ?? body.base_search_query ?? null,
      p_exclude_terms_text:    body.excludeTerms ?? body.exclude_terms ?? "",
      p_industry_terms_text:   body.industryTerms ?? body.industry_terms ?? "",
      p_icp_terms_text:        body.icpTerms ?? body.icp_terms ?? "",
      p_speaker_prompts_text:  body.speakerPrompts ?? body.speaker_prompts ?? "",
      p_normalization_prompts_text: body.normalizationPrompts ?? body.normalization_prompts ?? ""
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
