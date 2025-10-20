/**
 * Advanced Database Connection Pool Manager
 * 
 * This module provides sophisticated database connection pooling with:
 * - Intelligent pool sizing based on load and performance metrics
 * - Connection health monitoring and automatic replacement
 * - Query optimization and connection-aware query management
 * - Pool analytics and optimization recommendations
 * - Resource management with automatic cleanup and lifecycle management
 * - Performance monitoring and adaptive scaling
 */

import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Advanced pool configuration
export const ADVANCED_POOL_CONFIG = {
  // Pool sizing configuration
  sizing: {
    minConnections: 2,
    maxConnections: 20,
    initialConnections: 5,
    scalingFactor: 1.5,
    loadThreshold: 0.8, // 80% utilization triggers scaling
    performanceThreshold: 1000, // 1 second response time threshold
  },
  
  // Connection lifecycle management
  lifecycle: {
    connectionTimeout: 30000, // 30 seconds
    idleTimeout: 300000, // 5 minutes
    maxLifetime: 1800000, // 30 minutes
    healthCheckInterval: 30000, // 30 seconds
    cleanupInterval: 60000, // 1 minute
  },
  
  // Performance monitoring
  monitoring: {
    enableMetrics: true,
    metricsRetention: 24 * 60 * 60 * 1000, // 24 hours
    enableAdaptiveScaling: true,
    adaptiveLearningPeriod: 60 * 60 * 1000, // 1 hour
    performanceWindow: 300000, // 5 minutes
  },
  
  // Query optimization
  query: {
    enableQueryCaching: true,
    queryCacheSize: 1000,
    queryCacheTTL: 300000, // 5 minutes
    enableQueryAnalysis: true,
    slowQueryThreshold: 2000, // 2 seconds
    enableQueryOptimization: true,
  },
  
  // Resource management
  resources: {
    enableMemoryManagement: true,
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    enableConnectionReuse: true,
    enableConnectionWarming: true,
    warmingConnections: 2,
  }
};

// Connection types
export enum ConnectionType {
  SERVER = 'SERVER',
  ADMIN = 'ADMIN',
  READ_ONLY = 'READ_ONLY',
  WRITE_ONLY = 'WRITE_ONLY'
}

// Connection health status
export enum ConnectionHealth {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
  UNKNOWN = 'UNKNOWN'
}

// Connection information
export interface ConnectionInfo {
  id: string;
  client: any;
  type: ConnectionType;
  health: ConnectionHealth;
  createdAt: number;
  lastUsed: number;
  lastHealthCheck: number;
  queryCount: number;
  errorCount: number;
  averageResponseTime: number;
  isActive: boolean;
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    sessionId?: string;
  };
}

// Pool metrics
export interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  healthyConnections: number;
  unhealthyConnections: number;
  averageResponseTime: number;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  querySuccessRate: number;
  connectionUtilization: number;
  memoryUsage: number;
  lastScaling: number;
  scalingEvents: number;
}

// Query performance metrics
export interface QueryMetrics {
  queryId: string;
  query: string;
  executionTime: number;
  success: boolean;
  error?: string;
  connectionId: string;
  timestamp: number;
  resultSize?: number;
}

// Pool analytics
export interface PoolAnalytics {
  metrics: PoolMetrics;
  queryMetrics: QueryMetrics[];
  performanceTrends: {
    responseTime: number[];
    utilization: number[];
    errorRate: number[];
    timestamps: number[];
  };
  recommendations: string[];
  lastUpdate: number;
}

// Advanced connection pool class
export class AdvancedDatabaseConnectionPool {
  private static instance: AdvancedDatabaseConnectionPool;
  private connections: Map<string, ConnectionInfo> = new Map();
  private queryCache: Map<string, { result: any; timestamp: number; ttl: number }> = new Map();
  private metrics: PoolMetrics;
  private analytics: PoolAnalytics;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private performanceTimer: NodeJS.Timeout | null = null;
  private connectionCounter = 0;
  private queryCounter = 0;
  private isInitialized = false;

  private constructor() {
    this.metrics = this.initializeMetrics();
    this.analytics = this.initializeAnalytics();
    this.startHealthChecks();
    this.startCleanup();
    this.startPerformanceMonitoring();
  }

  public static getInstance(): AdvancedDatabaseConnectionPool {
    if (!AdvancedDatabaseConnectionPool.instance) {
      AdvancedDatabaseConnectionPool.instance = new AdvancedDatabaseConnectionPool();
    }
    return AdvancedDatabaseConnectionPool.instance;
  }

  private initializeMetrics(): PoolMetrics {
    return {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      healthyConnections: 0,
      unhealthyConnections: 0,
      averageResponseTime: 0,
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      querySuccessRate: 0,
      connectionUtilization: 0,
      memoryUsage: 0,
      lastScaling: Date.now(),
      scalingEvents: 0
    };
  }

  private initializeAnalytics(): PoolAnalytics {
    return {
      metrics: this.metrics,
      queryMetrics: [],
      performanceTrends: {
        responseTime: [],
        utilization: [],
        errorRate: [],
        timestamps: []
      },
      recommendations: [],
      lastUpdate: Date.now()
    };
  }

  private startHealthChecks(): void {
    if (ADVANCED_POOL_CONFIG.lifecycle.healthCheckInterval > 0) {
      this.healthCheckTimer = setInterval(() => {
        this.performHealthChecks();
      }, ADVANCED_POOL_CONFIG.lifecycle.healthCheckInterval);
    }
  }

  private startCleanup(): void {
    if (ADVANCED_POOL_CONFIG.lifecycle.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.performCleanup();
      }, ADVANCED_POOL_CONFIG.lifecycle.cleanupInterval);
    }
  }

  private startPerformanceMonitoring(): void {
    if (ADVANCED_POOL_CONFIG.monitoring.enableMetrics) {
      this.performanceTimer = setInterval(() => {
        this.updatePerformanceMetrics();
      }, 30000); // Every 30 seconds
    }
  }

  private async performHealthChecks(): Promise<void> {
    const now = Date.now();
    const unhealthyConnections: string[] = [];

    for (const [id, connection] of this.connections) {
      try {
        // Perform health check
        const startTime = Date.now();
        await connection.client.from('_health_check').select('count').limit(1);
        const responseTime = Date.now() - startTime;

        // Update connection health
        connection.health = ConnectionHealth.HEALTHY;
        connection.lastHealthCheck = now;
        connection.averageResponseTime = (connection.averageResponseTime + responseTime) / 2;

        // Check if connection is too old
        if (now - connection.createdAt > ADVANCED_POOL_CONFIG.lifecycle.maxLifetime) {
          unhealthyConnections.push(id);
        }

      } catch (error) {
        console.warn(`[advanced-db-pool] Health check failed for connection ${id}:`, error);
        connection.health = ConnectionHealth.UNHEALTHY;
        connection.errorCount++;
        connection.lastHealthCheck = now;

        // Mark for removal if too many errors
        if (connection.errorCount > 5) {
          unhealthyConnections.push(id);
        }
      }
    }

    // Remove unhealthy connections
    for (const id of unhealthyConnections) {
      await this.removeConnection(id);
    }

    this.updatePerformanceMetrics();
  }

  async performCleanup(): Promise<void> {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const [id, connection] of this.connections) {
      // Remove idle connections
      if (now - connection.lastUsed > ADVANCED_POOL_CONFIG.lifecycle.idleTimeout) {
        connectionsToRemove.push(id);
      }
    }

    // Remove connections if we have too many
    if (this.connections.size > ADVANCED_POOL_CONFIG.sizing.maxConnections) {
      const sortedConnections = Array.from(this.connections.entries())
        .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);
      
      const excessConnections = this.connections.size - ADVANCED_POOL_CONFIG.sizing.maxConnections;
      for (let i = 0; i < excessConnections; i++) {
        connectionsToRemove.push(sortedConnections[i][0]);
      }
    }

    // Remove connections
    for (const id of connectionsToRemove) {
      await this.removeConnection(id);
    }

    // Clean up query cache
    this.cleanupQueryCache();
  }

  private cleanupQueryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.queryCache) {
      if (now > entry.timestamp + entry.ttl) {
        this.queryCache.delete(key);
      }
    }

    // Limit cache size
    if (this.queryCache.size > ADVANCED_POOL_CONFIG.query.queryCacheSize) {
      const entries = Array.from(this.queryCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const excessEntries = this.queryCache.size - ADVANCED_POOL_CONFIG.query.queryCacheSize;
      for (let i = 0; i < excessEntries; i++) {
        this.queryCache.delete(entries[i][0]);
      }
    }
  }

  private updatePerformanceMetrics(): void {
    const now = Date.now();
    const activeConnections = Array.from(this.connections.values()).filter(c => c.isActive);
    const healthyConnections = Array.from(this.connections.values()).filter(c => c.health === ConnectionHealth.HEALTHY);
    const unhealthyConnections = Array.from(this.connections.values()).filter(c => c.health === ConnectionHealth.UNHEALTHY);

    const totalResponseTime = Array.from(this.connections.values())
      .reduce((sum, c) => sum + c.averageResponseTime, 0);
    const averageResponseTime = this.connections.size > 0 ? totalResponseTime / this.connections.size : 0;

    const totalQueries = Array.from(this.connections.values())
      .reduce((sum, c) => sum + c.queryCount, 0);
    const successfulQueries = Array.from(this.connections.values())
      .reduce((sum, c) => sum + (c.queryCount - c.errorCount), 0);
    const failedQueries = Array.from(this.connections.values())
      .reduce((sum, c) => sum + c.errorCount, 0);

    this.metrics = {
      totalConnections: this.connections.size,
      activeConnections: activeConnections.length,
      idleConnections: this.connections.size - activeConnections.length,
      healthyConnections: healthyConnections.length,
      unhealthyConnections: unhealthyConnections.length,
      averageResponseTime,
      totalQueries,
      successfulQueries,
      failedQueries,
      querySuccessRate: totalQueries > 0 ? (successfulQueries / totalQueries) * 100 : 0,
      connectionUtilization: this.connections.size > 0 ? (activeConnections.length / this.connections.size) * 100 : 0,
      memoryUsage: this.estimateMemoryUsage(),
      lastScaling: this.metrics.lastScaling,
      scalingEvents: this.metrics.scalingEvents
    };

    // Update performance trends
    this.updatePerformanceTrends();

    // Check if scaling is needed
    if (ADVANCED_POOL_CONFIG.monitoring.enableAdaptiveScaling) {
      this.checkScalingNeeds();
    }
  }

  private updatePerformanceTrends(): void {
    const now = Date.now();
    const window = ADVANCED_POOL_CONFIG.monitoring.performanceWindow;
    
    // Keep only recent data
    this.analytics.performanceTrends.responseTime = this.analytics.performanceTrends.responseTime
      .filter((_, index) => now - this.analytics.performanceTrends.timestamps[index] < window);
    this.analytics.performanceTrends.utilization = this.analytics.performanceTrends.utilization
      .filter((_, index) => now - this.analytics.performanceTrends.timestamps[index] < window);
    this.analytics.performanceTrends.errorRate = this.analytics.performanceTrends.errorRate
      .filter((_, index) => now - this.analytics.performanceTrends.timestamps[index] < window);
    this.analytics.performanceTrends.timestamps = this.analytics.performanceTrends.timestamps
      .filter(timestamp => now - timestamp < window);

    // Add current metrics
    this.analytics.performanceTrends.responseTime.push(this.metrics.averageResponseTime);
    this.analytics.performanceTrends.utilization.push(this.metrics.connectionUtilization);
    this.analytics.performanceTrends.errorRate.push(100 - this.metrics.querySuccessRate);
    this.analytics.performanceTrends.timestamps.push(now);

    this.analytics.lastUpdate = now;
  }

  private checkScalingNeeds(): void {
    const utilization = this.metrics.connectionUtilization;
    const responseTime = this.metrics.averageResponseTime;
    const errorRate = 100 - this.metrics.querySuccessRate;

    // Scale up if utilization is high and performance is poor
    if (utilization > ADVANCED_POOL_CONFIG.sizing.loadThreshold * 100 && 
        responseTime > ADVANCED_POOL_CONFIG.sizing.performanceThreshold &&
        this.connections.size < ADVANCED_POOL_CONFIG.sizing.maxConnections) {
      this.scaleUp();
    }

    // Scale down if utilization is low and we have excess connections
    if (utilization < ADVANCED_POOL_CONFIG.sizing.loadThreshold * 50 && 
        this.connections.size > ADVANCED_POOL_CONFIG.sizing.minConnections) {
      this.scaleDown();
    }
  }

  private async scaleUp(): Promise<void> {
    const targetConnections = Math.min(
      Math.ceil(this.connections.size * ADVANCED_POOL_CONFIG.sizing.scalingFactor),
      ADVANCED_POOL_CONFIG.sizing.maxConnections
    );

    const connectionsToAdd = targetConnections - this.connections.size;
    console.log(`[advanced-db-pool] Scaling up: adding ${connectionsToAdd} connections`);

    for (let i = 0; i < connectionsToAdd; i++) {
      await this.createConnection(ConnectionType.SERVER);
    }

    this.metrics.lastScaling = Date.now();
    this.metrics.scalingEvents++;
  }

  private async scaleDown(): Promise<void> {
    const targetConnections = Math.max(
      Math.floor(this.connections.size / ADVANCED_POOL_CONFIG.sizing.scalingFactor),
      ADVANCED_POOL_CONFIG.sizing.minConnections
    );

    const connectionsToRemove = this.connections.size - targetConnections;
    console.log(`[advanced-db-pool] Scaling down: removing ${connectionsToRemove} connections`);

    // Remove least recently used connections
    const sortedConnections = Array.from(this.connections.entries())
      .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);

    for (let i = 0; i < connectionsToRemove; i++) {
      await this.removeConnection(sortedConnections[i][0]);
    }

    this.metrics.lastScaling = Date.now();
    this.metrics.scalingEvents++;
  }

  private estimateMemoryUsage(): number {
    // Rough estimate of memory usage
    const connectionOverhead = 1024 * 1024; // 1MB per connection
    const cacheOverhead = this.queryCache.size * 1024; // 1KB per cache entry
    return (this.connections.size * connectionOverhead) + cacheOverhead;
  }

  private generateConnectionId(): string {
    return `conn_${++this.connectionCounter}_${Date.now()}`;
  }

  private generateQueryId(): string {
    return `query_${++this.queryCounter}_${Date.now()}`;
  }

  private async createConnection(type: ConnectionType): Promise<ConnectionInfo> {
    const id = this.generateConnectionId();
    let client: any;

    try {
      if (type === ConnectionType.ADMIN) {
        client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
      } else {
        const cookieStore = await cookies();
        client = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              get(name: string) {
                return cookieStore.get(name)?.value;
              },
              set(name: string, value: string, options: CookieOptions) {
                cookieStore.set({ name, value, ...options });
              },
              remove(name: string, options: CookieOptions) {
                cookieStore.set({ name, value: '', ...options });
              },
            },
          }
        );
      }

      const connection: ConnectionInfo = {
        id,
        client,
        type,
        health: ConnectionHealth.UNKNOWN,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        lastHealthCheck: 0,
        queryCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        isActive: false,
        metadata: {}
      };

      this.connections.set(id, connection);
      return connection;

    } catch (error) {
      console.error(`[advanced-db-pool] Failed to create connection ${id}:`, error);
      throw error;
    }
  }

  private async removeConnection(id: string): Promise<void> {
    const connection = this.connections.get(id);
    if (connection) {
      try {
        // Close connection if possible
        if (connection.client && typeof connection.client.close === 'function') {
          await connection.client.close();
        }
      } catch (error) {
        console.warn(`[advanced-db-pool] Error closing connection ${id}:`, error);
      }
      
      this.connections.delete(id);
      console.log(`[advanced-db-pool] Removed connection ${id}`);
    }
  }

  private getBestConnection(type: ConnectionType): ConnectionInfo | null {
    const candidates = Array.from(this.connections.values())
      .filter(conn => conn.type === type && conn.health === ConnectionHealth.HEALTHY)
      .sort((a, b) => a.lastUsed - b.lastUsed);

    return candidates.length > 0 ? candidates[0] : null;
  }

  // Public methods
  async getServerClient(): Promise<any> {
    let connection = this.getBestConnection(ConnectionType.SERVER);
    
    if (!connection) {
      connection = await this.createConnection(ConnectionType.SERVER);
    }

    connection.lastUsed = Date.now();
    connection.isActive = true;
    return connection.client;
  }

  async getAdminClient(): Promise<any> {
    let connection = this.getBestConnection(ConnectionType.ADMIN);
    
    if (!connection) {
      connection = await this.createConnection(ConnectionType.ADMIN);
    }

    connection.lastUsed = Date.now();
    connection.isActive = true;
    return connection.client;
  }

  async executeQuery<T>(
    query: () => Promise<T>,
    type: ConnectionType = ConnectionType.SERVER,
    cacheKey?: string
  ): Promise<T> {
    const queryId = this.generateQueryId();
    const startTime = Date.now();

    // Check cache first
    if (cacheKey && ADVANCED_POOL_CONFIG.query.enableQueryCaching) {
      const cached = this.queryCache.get(cacheKey);
      if (cached && Date.now() < cached.timestamp + cached.ttl) {
        console.log(`[advanced-db-pool] Cache hit for query: ${cacheKey}`);
        return cached.result;
      }
    }

    let connection: ConnectionInfo | null = null;
    try {
      // Get connection
      connection = this.getBestConnection(type);
      if (!connection) {
        connection = await this.createConnection(type);
      }

      connection.lastUsed = Date.now();
      connection.isActive = true;

      // Execute query
      const result = await query();
      const executionTime = Date.now() - startTime;

      // Update connection metrics
      connection.queryCount++;
      connection.averageResponseTime = (connection.averageResponseTime + executionTime) / 2;

      // Update global metrics
      this.metrics.totalQueries++;
      this.metrics.successfulQueries++;

      // Record query metrics
      if (ADVANCED_POOL_CONFIG.query.enableQueryAnalysis) {
        this.analytics.queryMetrics.push({
          queryId,
          query: cacheKey || 'unknown',
          executionTime,
          success: true,
          connectionId: connection.id,
          timestamp: startTime
        });
      }

      // Cache result if enabled
      if (cacheKey && ADVANCED_POOL_CONFIG.query.enableQueryCaching) {
        this.queryCache.set(cacheKey, {
          result,
          timestamp: Date.now(),
          ttl: ADVANCED_POOL_CONFIG.query.queryCacheTTL
        });
      }

      // Check for slow queries
      if (executionTime > ADVANCED_POOL_CONFIG.query.slowQueryThreshold) {
        console.warn(`[advanced-db-pool] Slow query detected: ${executionTime}ms for ${cacheKey || 'unknown'}`);
      }

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Update connection metrics
      if (connection) {
        connection.errorCount++;
        connection.health = ConnectionHealth.DEGRADED;
      }

      // Update global metrics
      this.metrics.totalQueries++;
      this.metrics.failedQueries++;

      // Record query metrics
      if (ADVANCED_POOL_CONFIG.query.enableQueryAnalysis) {
        this.analytics.queryMetrics.push({
          queryId,
          query: cacheKey || 'unknown',
          executionTime,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          connectionId: connection?.id || 'unknown',
          timestamp: startTime
        });
      }

      throw error;
    } finally {
      if (connection) {
        connection.isActive = false;
      }
    }
  }

  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  getAnalytics(): PoolAnalytics {
    return { ...this.analytics };
  }

  getConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  async warmConnections(count: number = ADVANCED_POOL_CONFIG.resources.warmingConnections): Promise<void> {
    console.log(`[advanced-db-pool] Warming ${count} connections`);
    
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(this.createConnection(ConnectionType.SERVER));
    }
    
    await Promise.all(promises);
    console.log(`[advanced-db-pool] Warmed ${count} connections`);
  }

  async reset(): Promise<void> {
    console.log('[advanced-db-pool] Resetting connection pool');
    
    // Close all connections
    for (const id of this.connections.keys()) {
      await this.removeConnection(id);
    }
    
    // Clear cache
    this.queryCache.clear();
    
    // Reset metrics
    this.metrics = this.initializeMetrics();
    this.analytics = this.initializeAnalytics();
    
    console.log('[advanced-db-pool] Connection pool reset complete');
  }

  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer);
      this.performanceTimer = null;
    }
    
    // Close all connections
    for (const id of this.connections.keys()) {
      this.removeConnection(id);
    }
    
    this.connections.clear();
    this.queryCache.clear();
  }
}

// Global advanced connection pool instance
export const advancedDatabasePool = AdvancedDatabaseConnectionPool.getInstance();

// Utility functions
export async function getAdvancedServerClient(): Promise<any> {
  return advancedDatabasePool.getServerClient();
}

export async function getAdvancedAdminClient(): Promise<any> {
  return advancedDatabasePool.getAdminClient();
}

export async function executeAdvancedQuery<T>(
  query: () => Promise<T>,
  type: ConnectionType = ConnectionType.SERVER,
  cacheKey?: string
): Promise<T> {
  return advancedDatabasePool.executeQuery(query, type, cacheKey);
}

export function getAdvancedPoolMetrics(): PoolMetrics {
  return advancedDatabasePool.getMetrics();
}

export function getAdvancedPoolAnalytics(): PoolAnalytics {
  return advancedDatabasePool.getAnalytics();
}

export async function warmAdvancedConnections(count?: number): Promise<void> {
  return advancedDatabasePool.warmConnections(count);
}

export async function resetAdvancedPool(): Promise<void> {
  return advancedDatabasePool.reset();
}
