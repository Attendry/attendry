import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";
import { defaultPermissions, MODULE_IDS, type ModuleId, type RoleKey } from "@/lib/rbac";
import { invalidateRoleCache } from "@/lib/auth/requireModuleAccess";

async function ensureAdmin() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return { errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: roleRow, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to read user role", error);
    return { errorResponse: NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 }) };
  }

  const role = (roleRow?.role as RoleKey) ?? "Seller";
  if (role !== "Admin") {
    return { errorResponse: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }

  return { supabaseAdminClient: supabaseAdmin(), userId: session.user.id };
}

export async function GET() {
  const { errorResponse, supabaseAdminClient } = await ensureAdmin();
  if (errorResponse || !supabaseAdminClient) return errorResponse!;

  try {
    const client = supabaseAdminClient;

    const [rolesResponse, modulesResponse] = await Promise.all([
      client.from("user_roles").select("user_id, role"),
      client.from("role_modules").select("role, module_id, enabled"),
    ]);

    if (rolesResponse.error) throw rolesResponse.error;
    if (modulesResponse.error) throw modulesResponse.error;

    const matrix = defaultPermissions();

    modulesResponse.data.forEach((entry) => {
      const role = entry.role as RoleKey;
      const moduleId = entry.module_id as ModuleId;
      if (matrix.roles[role] && MODULE_IDS.includes(moduleId)) {
        matrix.roles[role][moduleId] = entry.enabled;
      }
    });

    matrix.assignments = rolesResponse.data.map((row) => ({
      userId: row.user_id,
      role: row.role as RoleKey,
    }));

    return NextResponse.json({ permissions: matrix });
  } catch (error) {
    console.error("GET /api/admin/permissions failed", error);
    return NextResponse.json({ error: "Failed to load permissions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { errorResponse, supabaseAdminClient } = await ensureAdmin();
  if (errorResponse || !supabaseAdminClient) return errorResponse!;

  try {
    const body = await request.json();
    const { roles, modules } = body as {
      roles?: { userId: string; role: RoleKey }[];
      modules?: { role: RoleKey; moduleId: ModuleId; enabled: boolean }[];
    };

    const client = supabaseAdminClient;

    if (Array.isArray(roles) && roles.length > 0) {
      const updates = roles.map((assignment) =>
        client
          .from("user_roles")
          .upsert({
            user_id: assignment.userId,
            role: assignment.role,
            updated_at: new Date().toISOString(),
          })
      );
      await Promise.all(updates);
    }

    if (Array.isArray(modules) && modules.length > 0) {
      const updates = modules.map((entry) =>
        client
          .from("role_modules")
          .upsert({
            role: entry.role,
            module_id: entry.moduleId,
            enabled: entry.enabled,
            updated_at: new Date().toISOString(),
          })
      );
      await Promise.all(updates);
    }

    invalidateRoleCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/admin/permissions failed", error);
    return NextResponse.json({ error: "Failed to update permissions" }, { status: 500 });
  }
}

