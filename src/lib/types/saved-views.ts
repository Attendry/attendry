/**
 * Saved View Type Definitions
 */

export type ViewType = 'kanban' | 'list';
export type Density = 'comfortable' | 'compact';

export interface ViewFilters {
  status?: string[];
  topics?: string[];
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface ColumnConfig {
  id: string;
  visible: boolean;
  width?: number;
  order: number;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SavedView {
  id: string;
  user_id: string;
  name: string;
  view_type: ViewType;
  filters?: ViewFilters;
  columns?: ColumnConfig[];
  sort?: SortConfig;
  density?: Density;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
}

