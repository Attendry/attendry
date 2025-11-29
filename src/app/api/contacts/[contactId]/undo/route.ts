import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { undoAutoSave } from "@/lib/services/auto-save-feedback-service";

export const runtime = "nodejs";

/**
 * POST /api/contacts/[contactId]/undo - Undo auto-save (delete contact if within 24 hours)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { contactId: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { contactId } = params;

    const success = await undoAutoSave(contactId, user.id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Unable to undo. The 24-hour window may have expired or contact was not auto-saved." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Auto-save undone. Contact removed.",
    });
  } catch (error: any) {
    console.error("Error undoing auto-save:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to undo auto-save" },
      { status: 500 }
    );
  }
}

