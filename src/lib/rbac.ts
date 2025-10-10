export type RoleKey = 'Seller' | 'Marketing' | 'Admin';

export const MODULE_IDS = [
  'smartSearch',
  'accountSignals',
  'eventInsights',
  'accountWatchlist',
  'compareEvents',
  'eventsCalendar',
  'alerts',
  'adminOps',
] as const;

export type ModuleId = typeof MODULE_IDS[number];

export interface RoleModuleAccess {
  role: RoleKey;
  moduleId: ModuleId;
  enabled: boolean;
}

export interface RoleAssignment {
  userId: string;
  role: RoleKey;
}

export interface PermissionMatrix {
  roles: Record<RoleKey, Record<ModuleId, boolean>>;
  assignments: RoleAssignment[];
}

export function defaultPermissions(): PermissionMatrix {
  const base: Record<RoleKey, Record<ModuleId, boolean>> = {
    Seller: {
      smartSearch: true,
      accountSignals: true,
      eventInsights: true,
      accountWatchlist: true,
      compareEvents: true,
      eventsCalendar: true,
      alerts: true,
      adminOps: false,
    },
    Marketing: {
      smartSearch: true,
      accountSignals: true,
      eventInsights: true,
      accountWatchlist: true,
      compareEvents: true,
      eventsCalendar: true,
      alerts: true,
      adminOps: false,
    },
    Admin: {
      smartSearch: true,
      accountSignals: true,
      eventInsights: true,
      accountWatchlist: true,
      compareEvents: true,
      eventsCalendar: true,
      alerts: true,
      adminOps: true,
    },
  };

  return {
    roles: base,
    assignments: [],
  };
}

export function hasModuleAccess(matrix: PermissionMatrix | null, role: RoleKey, moduleId: ModuleId): boolean {
  if (!matrix && role === 'Admin') return true;
  const lookup = matrix?.roles?.[role]?.[moduleId];
  if (typeof lookup === 'boolean') return lookup;
  return role === 'Admin';
}

