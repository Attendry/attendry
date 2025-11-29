import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getAuditLog } from "@/lib/services/gdpr-service";

export const runtime = "nodejs";

/**
 * GET /api/gdpr/audit-log - Get user's data access audit log
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
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const auditLog = await getAuditLog(user.id, limit);

    return NextResponse.json({
      success: true,
      auditLog,
    });
  } catch (error: any) {
    console.error("Error fetching audit log:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch audit log" },
      { status: 500 }
    );
  }
}

