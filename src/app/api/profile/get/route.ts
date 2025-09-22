// src/app/api/profile/get/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: sessionData } = await supabase.auth.getUser();
  const uid = sessionData.user?.id;
  if (!uid) return NextResponse.json({ profile: null });

  const { data } = await supabase
    .from("user_profiles")
    .select("full_name, company, competitors, icp_terms, industry_terms, use_in_basic_search")
    .eq("owner", uid)
    .maybeSingle();

  return NextResponse.json({ profile: data || null });
}
