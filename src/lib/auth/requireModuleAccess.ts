import { defaultPermissions, MODULE_IDS, type ModuleId, type RoleKey } from "@/lib/rbac";
import type { SupabaseClient } from "@supabase/supabase-js";

const matrixCache = new Map<string, { matrix: Record<RoleKey, Record<ModuleId, boolean>>; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000;

export function invalidateRoleCache(role?: RoleKey) {
  if (role) {
    matrixCache.delete(role);
  } else {
    matrixCache.clear();
  }
}

export async function requireModuleAccess(client: SupabaseClient, userId: string, moduleId: ModuleId) {
  const { data: roleRow, error: roleError } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (roleError) throw roleError;

  const role = (roleRow?.role as RoleKey) ?? "Seller";

  const cached = matrixCache.get(role);
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.matrix[role]?.[moduleId]) {
      throw new Error("Forbidden");
    }
    return role;
  }

  const matrix = defaultPermissions().roles;

  const { data: overrides, error: modulesError } = await client
    .from("role_modules")
    .select("module_id, enabled")
    .eq("role", role);

  if (modulesError) throw modulesError;

  overrides?.forEach((entry) => {
    const id = entry.module_id as ModuleId;
    if (MODULE_IDS.includes(id)) {
      matrix[role][id] = entry.enabled;
    }
  });

  matrixCache.set(role, { matrix, expiresAt: Date.now() + CACHE_TTL_MS });

  if (!matrix[role]?.[moduleId]) {
    throw new Error("Forbidden");
  }

  return role;
}

