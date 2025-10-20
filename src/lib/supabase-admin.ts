/**
 * Supabase Admin Client with Connection Pooling
 * 
 * This file now uses the database connection pool to prevent
 * connection exhaustion and improve performance.
 */

export { supabaseAdmin } from './database-pool';


