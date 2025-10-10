"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { PermissionMatrix, ModuleId, RoleKey } from "@/lib/rbac";

interface PermissionsState {
  matrix: PermissionMatrix | null;
  loading: boolean;
  error?: string;
}

const PermissionsContext = createContext<PermissionsState>({ matrix: null, loading: true });

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PermissionsState>({ matrix: null, loading: true });

useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/permissions")
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setState({ matrix: json.permissions, loading: false });
      })
      .catch((error) => {
        if (!cancelled) setState({ matrix: null, loading: false, error: error instanceof Error ? error.message : String(error) });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <PermissionsContext.Provider value={state}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  return useContext(PermissionsContext);
}

export function canAccess(matrix: PermissionMatrix | null, role: RoleKey, module: ModuleId) {
  if (!matrix) return false;
  return matrix.roles?.[role]?.[module] ?? false;
}

