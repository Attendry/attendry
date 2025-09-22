// src/app/api/auth/whoami/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return NextResponse.json({ error: error.message, user: null }, { status: 200 });
  }
  return NextResponse.json({
    user: data.user ? { id: data.user.id, email: data.user.email } : null
  });
}
