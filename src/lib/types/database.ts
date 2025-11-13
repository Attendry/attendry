/**
 * Database Type Definitions for Attendry Application
 * 
 * This file contains type definitions that match the database schema
 * and Supabase operations, ensuring type safety for database interactions.
 */

/**
 * Collected events table structure
 */
export interface CollectedEvent {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  city: string | null;
  country: string | null;
  venue: string | null;
  organizer: string | null;
  description: string | null;
  topics: string[] | null;
  speakers: any | null; // JSONB
  sponsors: any | null; // JSONB
  participating_organizations: string[] | null;
  partners: string[] | null;
  competitors: string[] | null;
  source_url: string;
  source_domain: string | null;
  extraction_method: string | null;
  confidence: number | null;
  collected_at: string;
  collection_batch_id: string | null;
  industry: string | null;
  search_terms: string[] | null;
  data_completeness: number | null;
  last_verified_at: string | null;
  verification_status: 'unverified' | 'verified' | 'outdated' | null;
  created_at: string;
  updated_at: string;
}

/**
 * Collection batches table structure
 */
export interface CollectionBatch {
  id: string;
  industry: string;
  country: string;
  date_range_start: string;
  date_range_end: string;
  events_found: number;
  events_stored: number;
  events_updated: number;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

/**
 * Search configurations table structure
 */
export interface SearchConfiguration {
  id: string;
  name: string;
  industry: string;
  base_query: string;
  exclude_terms: string | null;
  industry_terms: any | null; // JSONB
  icp_terms: any | null; // JSONB
  speaker_prompts: any | null; // JSONB
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Search cache table structure
 */
export interface SearchCache {
  id: number;
  cache_key: string;
  provider: string;
  payload: any; // JSONB
  schema_version: number;
  created_at: string;
  ttl_at: string;
}

/**
 * Search sessions table structure
 */
export interface SearchSession {
  id: string;
  query: string;
  country: string | null;
  provider: string;
  result_count: number;
  created_at: string;
}

/**
 * Search results table structure
 */
export interface SearchResult {
  id: string;
  session_id: string;
  title: string;
  url: string;
  snippet: string;
  created_at: string;
}

/**
 * User profiles table structure
 */
export interface UserProfile {
  id: string;
  full_name: string | null;
  company: string | null;
  competitors: string[] | null;
  icp_terms: string[] | null;
  industry_terms: string[] | null;
  use_in_basic_search: boolean | null;
  created_at: string;
  updated_at: string;
}

/**
 * Watchlists table structure
 */
export interface Watchlist {
  id: string;
  owner: string;
  kind: string;
  label: string | null;
  ref_id: string;
  created_at: string;
}

/**
 * User event board table structure
 */
export interface UserEventBoardItem {
  id: string;
  user_id: string;
  event_id: string | null;
  event_url: string;
  column_status: 'interested' | 'researching' | 'attending' | 'follow-up' | 'archived';
  position: number;
  notes: string | null;
  tags: string[] | null;
  added_at: string;
  updated_at: string;
}

/**
 * AI decisions table structure (for caching AI filtering decisions)
 */
export interface AiDecision {
  id: string;
  item_hash: string;
  is_event: boolean;
  confidence: number | null;
  reason: string | null;
  created_at: string;
}

/**
 * Enhanced speaker profiles table structure
 */
export interface EnhancedSpeakerProfile {
  id: string;
  user_id: string;
  speaker_key: string;
  speaker_name: string;
  speaker_org?: string | null;
  speaker_title?: string | null;
  session_title?: string | null;
  profile_url?: string | null;
  raw_input: any;
  enhanced_data: any;
  confidence?: number | null;
  last_enhanced_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Saved speaker profiles table structure
 */
export interface SavedSpeakerProfile {
  id: string;
  user_id: string;
  speaker_data: any;
  enhanced_data: any;
  notes?: string | null;
  tags?: string[] | null;
  outreach_status: 'not_started' | 'contacted' | 'responded' | 'meeting_scheduled';
  saved_at: string;
  last_updated: string;
}

/**
 * Database operation result types
 */
export interface DatabaseResult<T = any> {
  data: T | null;
  error: any | null;
  count?: number | null;
}

export interface DatabaseArrayResult<T = any> {
  data: T[] | null;
  error: any | null;
  count?: number | null;
}

/**
 * Supabase query options
 */
export interface QueryOptions {
  select?: string;
  filter?: any;
  order?: any;
  limit?: number;
  offset?: number;
  single?: boolean;
}

/**
 * Database insert operation
 */
export interface InsertOperation<T = any> {
  table: string;
  data: T | T[];
  options?: {
    onConflict?: string;
    ignoreDuplicates?: boolean;
  };
}

/**
 * Database update operation
 */
export interface UpdateOperation<T = any> {
  table: string;
  data: Partial<T>;
  filter: any;
  options?: {
    returning?: string;
  };
}

/**
 * Database delete operation
 */
export interface DeleteOperation {
  table: string;
  filter: any;
  options?: {
    returning?: string;
  };
}

/**
 * Database upsert operation
 */
export interface UpsertOperation<T = any> {
  table: string;
  data: T | T[];
  onConflict: string;
  options?: {
    ignoreDuplicates?: boolean;
    returning?: string;
  };
}

/**
 * RPC function call types
 */
export interface RpcCall<TParams = any, TResult = any> {
  function: string;
  params: TParams;
  options?: {
    timeout?: number;
    retries?: number;
  };
}

/**
 * Specific RPC function types
 */
export interface UpsertEventParams {
  p: {
    title?: string;
    starts_at?: string;
    ends_at?: string;
    city?: string;
    country?: string;
    venue?: string;
    organizer?: string;
    topics?: string[];
    speakers?: any;
    sponsors?: any;
    participating_organizations?: string[];
    partners?: string[];
    competitors?: string[];
    source_url: string;
    confidence?: number;
  };
}

export interface UpsertEventResult {
  id: string;
}

export interface AddWatchlistItemParams {
  p_kind: string;
  p_label: string | null;
  p_ref_id: string;
}

export interface AddWatchlistItemResult {
  id: string;
}

export interface UpsertSearchConfigurationParams {
  p_name: string;
  p_industry?: string;
  p_base_search_query?: string;
  p_exclude_terms_text?: string;
  p_industry_terms_text?: string;
  p_icp_terms_text?: string;
  p_speaker_prompts_text?: string;
  p_normalization_prompts_text?: string;
}

export interface UpsertSearchConfigurationResult {
  id: string;
}

/**
 * Database transaction types
 */
export interface Transaction {
  id: string;
  operations: Array<InsertOperation | UpdateOperation | DeleteOperation | UpsertOperation>;
  options?: {
    isolation?: 'read_committed' | 'repeatable_read' | 'serializable';
    timeout?: number;
  };
}

/**
 * Database connection status
 */
export interface DatabaseStatus {
  connected: boolean;
  version: string;
  uptime: number;
  activeConnections: number;
  maxConnections: number;
  lastError?: string;
}

/**
 * Database performance metrics
 */
export interface DatabaseMetrics {
  queryCount: number;
  averageQueryTime: number;
  slowQueries: number;
  connectionPoolSize: number;
  activeConnections: number;
  cacheHitRate: number;
}

/**
 * Database migration types
 */
export interface Migration {
  id: string;
  name: string;
  version: string;
  applied_at: string;
  checksum: string;
}

/**
 * Database backup types
 */
export interface BackupInfo {
  id: string;
  name: string;
  size: number;
  created_at: string;
  status: 'pending' | 'completed' | 'failed';
  download_url?: string;
}

/**
 * Row Level Security (RLS) policy types
 */
export interface RlsPolicy {
  table: string;
  policy_name: string;
  command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  roles: string[];
  using_expression: string;
  with_check_expression?: string;
}

/**
 * Database index information
 */
export interface IndexInfo {
  table_name: string;
  index_name: string;
  column_names: string[];
  is_unique: boolean;
  is_primary: boolean;
  size: number;
  usage_count: number;
}

/**
 * Database table statistics
 */
export interface TableStats {
  table_name: string;
  row_count: number;
  size_bytes: number;
  index_size_bytes: number;
  last_analyzed: string;
  last_vacuum: string;
}

/**
 * Database query plan information
 */
export interface QueryPlan {
  query: string;
  plan: any;
  execution_time: number;
  planning_time: number;
  total_cost: number;
  actual_rows: number;
  estimated_rows: number;
}

/**
 * Database error types
 */
export interface DatabaseError {
  code: string;
  message: string;
  detail?: string;
  hint?: string;
  position?: string;
  internal_position?: string;
  internal_query?: string;
  where?: string;
  schema_name?: string;
  table_name?: string;
  column_name?: string;
  data_type_name?: string;
  constraint_name?: string;
  file?: string;
  line?: number;
  routine?: string;
}
