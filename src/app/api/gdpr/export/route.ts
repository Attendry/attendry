import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { exportUserData, getExportRequest } from "@/lib/services/gdpr-service";

export const runtime = "nodejs";

/**
 * POST /api/gdpr/export - Request data export
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

    const body = await req.json();
    const format = body.format || 'json';

    if (format !== 'json' && format !== 'csv') {
      return NextResponse.json(
        { success: false, error: "Format must be 'json' or 'csv'" },
        { status: 400 }
      );
    }

    const exportRequest = await exportUserData(user.id, format);

    if (!exportRequest) {
      return NextResponse.json(
        { success: false, error: "Failed to create export request" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      export: exportRequest,
    });
  } catch (error: any) {
    console.error("Error creating export request:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create export request" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/gdpr/export - Get export request status
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
    const requestId = searchParams.get("requestId");

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: "requestId is required" },
        { status: 400 }
      );
    }

    const exportRequest = await getExportRequest(user.id, requestId);

    if (!exportRequest) {
      return NextResponse.json(
        { success: false, error: "Export request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      export: exportRequest,
    });
  } catch (error: any) {
    console.error("Error fetching export request:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch export request" },
      { status: 500 }
    );
  }
}

