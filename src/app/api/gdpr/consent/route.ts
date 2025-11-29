import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getConsentStatus, updateConsentStatus } from "@/lib/services/gdpr-service";

export const runtime = "nodejs";

/**
 * GET /api/gdpr/consent - Get user's consent status
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

    const consentStatus = await getConsentStatus(user.id);

    if (!consentStatus) {
      return NextResponse.json(
        { success: false, error: "User profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      consent: consentStatus,
    });
  } catch (error: any) {
    console.error("Error fetching consent status:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch consent status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gdpr/consent - Update user's consent status
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
    const { autoSaveConsent, privacyPolicyAccepted } = body;

    // Get IP address and user agent for audit log
    const ipAddress = req.headers.get("x-forwarded-for") || 
                      req.headers.get("x-real-ip") || 
                      null;
    const userAgent = req.headers.get("user-agent") || null;

    const success = await updateConsentStatus(
      user.id,
      {
        autoSaveConsent,
        privacyPolicyAccepted,
      },
      ipAddress || undefined,
      userAgent || undefined
    );

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Failed to update consent status" },
        { status: 500 }
      );
    }

    const updatedConsent = await getConsentStatus(user.id);

    return NextResponse.json({
      success: true,
      consent: updatedConsent,
    });
  } catch (error: any) {
    console.error("Error updating consent status:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update consent status" },
      { status: 500 }
    );
  }
}

