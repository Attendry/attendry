// src/app/api/profile/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    full_name,
    company,
    competitors = [],
    icp_terms = [],
    industry_terms = [],
    use_in_basic_search = true,
  } = await req.json();

  const { data: sessionData } = await supabase.auth.getUser();
  const uid = sessionData.user?.id;
  if (!uid) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Upsert one row per owner
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert({
      owner: uid,
      full_name,
      company,
      competitors,
      icp_terms,
      industry_terms,
      use_in_basic_search,
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner" })
    .select("id, owner").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data?.id });
}
