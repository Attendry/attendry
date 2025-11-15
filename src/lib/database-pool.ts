/**
 * Database Connection Pool Manager
 * 
 * Provides singleton instances of Supabase clients with connection pooling
 * to prevent connection exhaustion and improve performance.
 */

import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Connection pool configuration
// PERF-1.2.1: Increased pool size for better concurrency handling
const POOL_CONFIG = {
  minConnections: 5, // Minimum connections to keep warm
  maxConnections: 50, // Increased from 10 to 50 for better scalability
  connectionTimeout: 30000, // 30 seconds
  idleTimeout: 300000, // 5 minutes
  healthCheckInterval: 30000, // 30 seconds (reduced from 60s for faster health checks)
};

// PERF-1.2.2: Separate pool configuration per operation type
const POOL_CONFIG_BY_TYPE = {
  read: {
    minConnections: 2,
    maxConnections: 30, // Read operations are most common
  },
  write: {
    minConnections: 1,
    maxConnections: 10, // Write operations are less frequent
  },
  admin: {
    minConnections: 1,
    maxConnections: 5, // Admin operations are rare
  },
};

// Connection pool state
interface ConnectionInfo {
  client: any;
  lastUsed: number;
  isHealthy: boolean;
  connectionId: string;
  poolType?: 'read' | 'write' | 'admin';
}

// PERF-1.2.3: Query priority levels
export enum QueryPriority {
  SEARCH = 1,      // Highest priority - user-initiated searches
  EXTRACTION = 2,  // Medium priority - event extraction
  ANALYTICS = 3,   // Lowest priority - background analytics
}

// PERF-1.2.3: Queued query interface
interface QueuedQuery {
  priority: QueryPriority;
  resolve: (client: any) => void;
  reject: (error: Error) => void;
  timestamp: number;
  timeout: NodeJS.Timeout;
}

class DatabaseConnectionPool {
  // PERF-1.2.2: Separate connection pools per operation type
  private readConnections: Map<string, ConnectionInfo> = new Map();
  private writeConnections: Map<string, ConnectionInfo> = new Map();
  private adminConnection: any = null;
  private adminConnectionId: string = '';
  
  // Legacy server connections (for backward compatibility)
  private serverConnections: Map<string, ConnectionInfo> = new Map();
  
  // PERF-1.2.3: Query queue for handling high-load scenarios
  private queryQueue: QueuedQuery[] = [];
  private isProcessingQueue = false;
  
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionCounter = 0;

  constructor() {
    this.startHealthChecks();
  }

  /**
   * PERF-1.2.2: Get a connection from the appropriate pool based on operation type
   * @param poolType - Type of pool to use ('read', 'write', or 'admin')
   * @param priority - Query priority for queuing (default: EXTRACTION)
   */
  async getClient(poolType: 'read' | 'write' | 'admin' = 'read', priority: QueryPriority = QueryPriority.EXTRACTION): Promise<any> {
    // PERF-1.2.3: If pool is at capacity, queue the request
    const pool = poolType === 'read' ? this.readConnections : 
                 poolType === 'write' ? this.writeConnections : 
                 null;
    
    if (pool && pool.size >= POOL_CONFIG_BY_TYPE[poolType].maxConnections) {
      return this.queueQuery(poolType, priority);
    }
    
    // Get connection from appropriate pool
    if (poolType === 'read') {
      return this.getReadClient();
    } else if (poolType === 'write') {
      return this.getWriteClient();
    } else {
      return this.getAdminClient();
    }
  }

  /**
   * PERF-1.2.2: Get a read connection
   */
  private async getReadClient(): Promise<any> {
    const connectionId = this.generateConnectionId();
    const pool = this.readConnections;
    const config = POOL_CONFIG_BY_TYPE.read;
    
    // Check for available connection
    for (const [id, conn] of pool.entries()) {
      if (conn.isHealthy && this.isConnectionIdle(conn)) {
        conn.lastUsed = Date.now();
        return conn.client;
      }
    }
    
    // Ensure minimum connections
    if (pool.size < config.minConnections) {
      const client = await this.createServerClient();
      const connectionInfo: ConnectionInfo = {
        client,
        lastUsed: Date.now(),
        isHealthy: true,
        connectionId,
        poolType: 'read'
      };
      pool.set(connectionId, connectionInfo);
      return client;
    }
    
    // Create new connection if under max
    if (pool.size < config.maxConnections) {
      const client = await this.createServerClient();
      const connectionInfo: ConnectionInfo = {
        client,
        lastUsed: Date.now(),
        isHealthy: true,
        connectionId,
        poolType: 'read'
      };
      pool.set(connectionId, connectionInfo);
      return client;
    }
    
    // Reuse oldest connection
    const oldest = this.getOldestConnectionFromPool(pool);
    if (oldest) {
      oldest.lastUsed = Date.now();
      return oldest.client;
    }
    
    throw new Error('Unable to create read connection');
  }

  /**
   * PERF-1.2.2: Get a write connection
   */
  private async getWriteClient(): Promise<any> {
    const connectionId = this.generateConnectionId();
    const pool = this.writeConnections;
    const config = POOL_CONFIG_BY_TYPE.write;
    
    // Check for available connection
    for (const [id, conn] of pool.entries()) {
      if (conn.isHealthy && this.isConnectionIdle(conn)) {
        conn.lastUsed = Date.now();
        return conn.client;
      }
    }
    
    // Ensure minimum connections
    if (pool.size < config.minConnections) {
      const client = await this.createServerClient();
      const connectionInfo: ConnectionInfo = {
        client,
        lastUsed: Date.now(),
        isHealthy: true,
        connectionId,
        poolType: 'write'
      };
      pool.set(connectionId, connectionInfo);
      return client;
    }
    
    // Create new connection if under max
    if (pool.size < config.maxConnections) {
      const client = await this.createServerClient();
      const connectionInfo: ConnectionInfo = {
        client,
        lastUsed: Date.now(),
        isHealthy: true,
        connectionId,
        poolType: 'write'
      };
      pool.set(connectionId, connectionInfo);
      return client;
    }
    
    // Reuse oldest connection
    const oldest = this.getOldestConnectionFromPool(pool);
    if (oldest) {
      oldest.lastUsed = Date.now();
      return oldest.client;
    }
    
    throw new Error('Unable to create write connection');
  }

  /**
   * PERF-1.2.3: Queue a query when pool is at capacity
   */
  private queueQuery(poolType: 'read' | 'write', priority: QueryPriority): Promise<any> {
    return new Promise((resolve, reject) => {
      const maxWaitTime = 10000; // 10 seconds max wait
      const timeout = setTimeout(() => {
        const index = this.queryQueue.findIndex(q => q.resolve === resolve);
        if (index !== -1) {
          this.queryQueue.splice(index, 1);
        }
        reject(new Error(`Query queue timeout after ${maxWaitTime}ms`));
      }, maxWaitTime);
      
      const queuedQuery: QueuedQuery = {
        priority,
        resolve,
        reject,
        timestamp: Date.now(),
        timeout
      };
      
      // Insert based on priority (lower number = higher priority)
      const insertIndex = this.queryQueue.findIndex(q => q.priority > priority);
      if (insertIndex === -1) {
        this.queryQueue.push(queuedQuery);
      } else {
        this.queryQueue.splice(insertIndex, 0, queuedQuery);
      }
      
      // Process queue if not already processing
      if (!this.isProcessingQueue) {
        this.processQueryQueue(poolType);
      }
    });
  }

  /**
   * PERF-1.2.3: Process queued queries
   */
  private async processQueryQueue(poolType: 'read' | 'write'): Promise<void> {
    if (this.isProcessingQueue || this.queryQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.queryQueue.length > 0) {
      const pool = poolType === 'read' ? this.readConnections : this.writeConnections;
      const config = POOL_CONFIG_BY_TYPE[poolType];
      
      // Check if we have capacity
      if (pool.size < config.maxConnections) {
        const queuedQuery = this.queryQueue.shift();
        if (queuedQuery) {
          clearTimeout(queuedQuery.timeout);
          try {
            const client = poolType === 'read' ? await this.getReadClient() : await this.getWriteClient();
            queuedQuery.resolve(client);
          } catch (error) {
            queuedQuery.reject(error instanceof Error ? error : new Error('Failed to get connection'));
          }
        }
      } else {
        // No capacity, wait a bit and retry
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Get oldest connection from a specific pool
   */
  private getOldestConnectionFromPool(pool: Map<string, ConnectionInfo>): ConnectionInfo | null {
    let oldest: ConnectionInfo | null = null;
    let oldestTime = Date.now();
    
    for (const connection of pool.values()) {
      if (connection.lastUsed < oldestTime) {
        oldest = connection;
        oldestTime = connection.lastUsed;
      }
    }
    
    return oldest;
  }

  /**
   * Get a server-side Supabase client with connection pooling
   * PERF-1.2.2: Now uses read pool by default for backward compatibility
   */
  async getServerClient(priority: QueryPriority = QueryPriority.EXTRACTION): Promise<any> {
    // PERF-1.2.2: Use read pool by default for backward compatibility
    return this.getClient('read', priority);
  }

  /**
   * Get an admin Supabase client (singleton)
   */
  getAdminClient(): any {
    if (!this.adminConnection || !this.isConnectionHealthy(this.adminConnection)) {
      try {
        this.adminConnection = this.createAdminClient();
        this.adminConnectionId = this.generateConnectionId();
        console.log('[db-pool] Created new admin connection:', this.adminConnectionId);
      } catch (error) {
        console.error('[db-pool] Failed to create admin client:', error);
        throw error;
      }
    }
    
    return this.adminConnection;
  }

  /**
   * Create a new server client
   * PERF-1.2.4: Use Supabase pooler connection string if available for better connection management
   */
  private async createServerClient(): Promise<any> {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('Supabase environment variables not configured');
    }
    
    // Dynamically import cookies to avoid issues when this module is imported in client components
    const { cookies } = await import("next/headers");
    // PERF-1.2.4: Use pooler connection string if available (for transaction mode)
    // Pooler URL format: https://<project-ref>.supabase.co (pooler uses port 6543)
    // For transaction mode (read-heavy), use pooler connection
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const poolerUrl = process.env.SUPABASE_POOLER_URL || baseUrl;
    const url = poolerUrl;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const jar = await cookies();

    return createServerClient(url, key, {
      cookies: {
        get(name: string) { 
          const cookie = jar.get(name);
          return cookie?.value; 
        },
        set(name: string, value: string, opts: CookieOptions) { 
          jar.set(name, value, {
            ...opts,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
          }); 
        },
        remove(name: string, opts: CookieOptions) { 
          jar.set(name, "", { 
            ...opts, 
            maxAge: 0,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
          }); 
        },
      },
    });
  }

  /**
   * Create a new admin client
   */
  private createAdminClient(): any {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error("Supabase admin environment variables missing");
    }
    
    return createClient(url, key, { 
      auth: { persistSession: false },
      db: {
        schema: 'public'
      }
    });
  }

  /**
   * Check if connection is idle and can be reused
   */
  private isConnectionIdle(connection: ConnectionInfo): boolean {
    return Date.now() - connection.lastUsed < POOL_CONFIG.idleTimeout;
  }

  /**
   * Check if connection is healthy
   */
  private isConnectionHealthy(connection: any): boolean {
    try {
      // Simple health check - if client exists and has expected methods
      return connection && typeof connection.from === 'function';
    } catch {
      return false;
    }
  }

  /**
   * Get the oldest connection for reuse
   */
  private getOldestConnection(): ConnectionInfo | null {
    let oldest: ConnectionInfo | null = null;
    let oldestTime = Date.now();

    for (const connection of this.serverConnections.values()) {
      if (connection.lastUsed < oldestTime) {
        oldest = connection;
        oldestTime = connection.lastUsed;
      }
    }

    return oldest;
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${++this.connectionCounter}_${Date.now()}`;
  }

  /**
   * Start health checks for connections
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, POOL_CONFIG.healthCheckInterval);
  }

  /**
   * Perform health checks on all connections
   * PERF-1.2.2: Now checks all pool types
   */
  private performHealthChecks(): void {
    const now = Date.now();
    
    // Check read connections
    for (const [id, connection] of this.readConnections.entries()) {
      if (!this.isConnectionHealthy(connection.client) || 
          now - connection.lastUsed > POOL_CONFIG.idleTimeout) {
        console.log('[db-pool] Removing unhealthy/idle read connection:', id);
        this.readConnections.delete(id);
      }
    }
    
    // Check write connections
    for (const [id, connection] of this.writeConnections.entries()) {
      if (!this.isConnectionHealthy(connection.client) || 
          now - connection.lastUsed > POOL_CONFIG.idleTimeout) {
        console.log('[db-pool] Removing unhealthy/idle write connection:', id);
        this.writeConnections.delete(id);
      }
    }
    
    // Check legacy server connections (for backward compatibility)
    for (const [id, connection] of this.serverConnections.entries()) {
      if (!this.isConnectionHealthy(connection.client) || 
          now - connection.lastUsed > POOL_CONFIG.idleTimeout) {
        console.log('[db-pool] Removing unhealthy/idle server connection:', id);
        this.serverConnections.delete(id);
      }
    }

    // Check admin connection
    if (this.adminConnection && !this.isConnectionHealthy(this.adminConnection)) {
      console.log('[db-pool] Admin connection unhealthy, will recreate on next use');
      this.adminConnection = null;
    }
  }

  /**
   * Get pool statistics
   * PERF-1.2.2: Now includes separate pool stats
   */
  getPoolStats(): {
    readConnections: number;
    writeConnections: number;
    adminConnection: boolean;
    legacyServerConnections: number;
    healthyConnections: number;
    totalConnections: number;
    queuedQueries: number;
  } {
    const healthyRead = Array.from(this.readConnections.values())
      .filter(conn => conn.isHealthy).length;
    const healthyWrite = Array.from(this.writeConnections.values())
      .filter(conn => conn.isHealthy).length;
    const healthyLegacy = Array.from(this.serverConnections.values())
      .filter(conn => conn.isHealthy).length;

    return {
      readConnections: this.readConnections.size,
      writeConnections: this.writeConnections.size,
      adminConnection: !!this.adminConnection,
      legacyServerConnections: this.serverConnections.size,
      healthyConnections: healthyRead + healthyWrite + healthyLegacy + (this.adminConnection ? 1 : 0),
      totalConnections: this.readConnections.size + this.writeConnections.size + this.serverConnections.size + (this.adminConnection ? 1 : 0),
      queuedQueries: this.queryQueue.length
    };
  }

  /**
   * Cleanup and destroy the pool
   * PERF-1.2.2: Now clears all pool types
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Clear all queues
    for (const queuedQuery of this.queryQueue) {
      clearTimeout(queuedQuery.timeout);
      queuedQuery.reject(new Error('Pool destroyed'));
    }
    this.queryQueue = [];
    
    // Clear all connection pools
    this.readConnections.clear();
    this.writeConnections.clear();
    this.serverConnections.clear();
    this.adminConnection = null;
    
    console.log('[db-pool] Connection pool destroyed');
  }
}

// Singleton instance
const connectionPool = new DatabaseConnectionPool();

// Export functions that replace the original supabaseServer and supabaseAdmin
export async function supabaseServer(priority: QueryPriority = QueryPriority.EXTRACTION): Promise<any> {
  return connectionPool.getServerClient(priority);
}

export function supabaseAdmin(): any {
  return connectionPool.getAdminClient();
}

// PERF-1.2.2: Export new pool-aware functions
export async function getReadClient(priority: QueryPriority = QueryPriority.EXTRACTION): Promise<any> {
  return connectionPool.getClient('read', priority);
}

export async function getWriteClient(priority: QueryPriority = QueryPriority.EXTRACTION): Promise<any> {
  return connectionPool.getClient('write', priority);
}

// Export pool for monitoring
export function getDatabasePoolStats() {
  return connectionPool.getPoolStats();
}

// Export pool for cleanup (useful for testing)
export function destroyDatabasePool() {
  connectionPool.destroy();
}
