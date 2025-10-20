/**
 * Database Connection Pool Manager
 * 
 * Provides singleton instances of Supabase clients with connection pooling
 * to prevent connection exhaustion and improve performance.
 */

import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Connection pool configuration
const POOL_CONFIG = {
  maxConnections: 10,
  connectionTimeout: 30000, // 30 seconds
  idleTimeout: 300000, // 5 minutes
  healthCheckInterval: 60000, // 1 minute
};

// Connection pool state
interface ConnectionInfo {
  client: any;
  lastUsed: number;
  isHealthy: boolean;
  connectionId: string;
}

class DatabaseConnectionPool {
  private serverConnections: Map<string, ConnectionInfo> = new Map();
  private adminConnection: any = null;
  private adminConnectionId: string = '';
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionCounter = 0;

  constructor() {
    this.startHealthChecks();
  }

  /**
   * Get a server-side Supabase client with connection pooling
   */
  async getServerClient(): Promise<any> {
    const connectionId = this.generateConnectionId();
    
    // Check if we have a healthy connection available
    for (const [id, conn] of this.serverConnections.entries()) {
      if (conn.isHealthy && this.isConnectionIdle(conn)) {
        conn.lastUsed = Date.now();
        return conn.client;
      }
    }

    // Create new connection if under limit
    if (this.serverConnections.size < POOL_CONFIG.maxConnections) {
      try {
        const client = await this.createServerClient();
        const connectionInfo: ConnectionInfo = {
          client,
          lastUsed: Date.now(),
          isHealthy: true,
          connectionId
        };
        
        this.serverConnections.set(connectionId, connectionInfo);
        return client;
      } catch (error) {
        console.error('[db-pool] Failed to create server client:', error);
        throw error;
      }
    }

    // Reuse oldest connection if at limit
    const oldestConnection = this.getOldestConnection();
    if (oldestConnection) {
      oldestConnection.lastUsed = Date.now();
      return oldestConnection.client;
    }

    throw new Error('Unable to create database connection');
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
   */
  private async createServerClient(): Promise<any> {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('Supabase environment variables not configured');
    }
    
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
   */
  private performHealthChecks(): void {
    const now = Date.now();
    
    // Check server connections
    for (const [id, connection] of this.serverConnections.entries()) {
      if (!this.isConnectionHealthy(connection.client) || 
          now - connection.lastUsed > POOL_CONFIG.idleTimeout) {
        console.log('[db-pool] Removing unhealthy/idle connection:', id);
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
   */
  getPoolStats(): {
    serverConnections: number;
    adminConnection: boolean;
    healthyConnections: number;
    totalConnections: number;
  } {
    const healthyConnections = Array.from(this.serverConnections.values())
      .filter(conn => conn.isHealthy).length;

    return {
      serverConnections: this.serverConnections.size,
      adminConnection: !!this.adminConnection,
      healthyConnections,
      totalConnections: this.serverConnections.size + (this.adminConnection ? 1 : 0)
    };
  }

  /**
   * Cleanup and destroy the pool
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.serverConnections.clear();
    this.adminConnection = null;
    
    console.log('[db-pool] Connection pool destroyed');
  }
}

// Singleton instance
const connectionPool = new DatabaseConnectionPool();

// Export functions that replace the original supabaseServer and supabaseAdmin
export async function supabaseServer(): Promise<any> {
  return connectionPool.getServerClient();
}

export function supabaseAdmin(): any {
  return connectionPool.getAdminClient();
}

// Export pool for monitoring
export function getDatabasePoolStats() {
  return connectionPool.getPoolStats();
}

// Export pool for cleanup (useful for testing)
export function destroyDatabasePool() {
  connectionPool.destroy();
}
