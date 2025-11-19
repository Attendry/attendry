/**
 * Redis Client for Attendry Application
 * 
 * This file provides a Redis client with connection management,
 * error handling, and fallback mechanisms for caching operations.
 * 
 * Supports both:
 * - Upstash REST API (via @upstash/redis) - Recommended for serverless
 * - Standard Redis TCP (via redis package) - For traditional Redis
 */

import { createClient, RedisClientType } from 'redis';

// Upstash REST API client (lazy-loaded)
let UpstashRedis: any = null;
try {
  UpstashRedis = require('@upstash/redis').Redis;
} catch (e) {
  // @upstash/redis not available, will use TCP connection
}

/**
 * Redis client configuration
 */
interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
  // Upstash REST API
  upstashRestUrl?: string;
  upstashRestToken?: string;
}

/**
 * Redis client wrapper with error handling and fallback
 * Supports both Upstash REST API and standard Redis TCP
 */
export class RedisClient {
  private client: RedisClientType | null = null;
  private upstashClient: any = null;
  private isConnected = false;
  private connectionType: 'upstash-rest' | 'redis-tcp' | 'none' = 'none';
  private config: RedisConfig;
  private connectionPromise: Promise<void> | null = null;

  constructor(config: RedisConfig = {}) {
    // Check for Upstash REST API credentials first
    const upstashRestUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashRestToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    this.config = {
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      upstashRestUrl: upstashRestUrl || config.upstashRestUrl,
      upstashRestToken: upstashRestToken || config.upstashRestToken,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      ...config,
    };
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  private async _connect(): Promise<void> {
    try {
      // Priority 1: Upstash REST API
      if (this.config.upstashRestUrl && this.config.upstashRestToken && UpstashRedis) {
        try {
          this.upstashClient = new UpstashRedis({
            url: this.config.upstashRestUrl,
            token: this.config.upstashRestToken,
          });
          
          // Test connection
          await this.upstashClient.ping();
          this.connectionType = 'upstash-rest';
          this.isConnected = true;
          console.log('[Redis] ✅ Connected via Upstash REST API');
          return;
        } catch (error) {
          console.error('[Redis] Failed to connect via Upstash REST API:', error);
          // Fall through to TCP connection
        }
      }

      // Priority 2: Standard Redis TCP
      if (this.config.url || this.config.host) {
        this.client = createClient({
          url: this.config.url,
          socket: {
            host: this.config.host,
            port: this.config.port,
            reconnectStrategy: (retries) => {
              if (retries > 10) {
                console.error('Redis connection failed after 10 retries');
                return new Error('Redis connection failed');
              }
              return Math.min(retries * 100, 3000);
            },
          },
          password: this.config.password,
          database: this.config.db,
        });

        this.client.on('error', (error) => {
          console.error('Redis client error:', error);
          this.isConnected = false;
        });

        this.client.on('connect', () => {
          console.log('[Redis] ✅ Connected via Redis TCP');
          this.isConnected = true;
        });

        this.client.on('disconnect', () => {
          console.log('[Redis] Disconnected');
          this.isConnected = false;
        });

        await this.client.connect();
        this.connectionType = 'redis-tcp';
        this.isConnected = true;
        return;
      }

      // No configuration found
      console.warn('[Redis] ⚠️ Redis configuration not found, caching will use fallback');
      this.connectionType = 'none';
    } catch (error) {
      console.error('[Redis] ❌ Failed to connect to Redis:', error);
      this.isConnected = false;
      this.client = null;
      this.upstashClient = null;
      this.connectionType = 'none';
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return (this.client !== null && this.isConnected) || 
           (this.upstashClient !== null && this.isConnected);
  }

  /**
   * Get value from Redis
   */
  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      if (this.connectionType === 'upstash-rest' && this.upstashClient) {
        const result = await this.upstashClient.get(key);
        return result ? String(result) : null;
      } else if (this.client) {
        return await this.client.get(key);
      }
      return null;
    } catch (error) {
      console.error('[Redis] GET error:', error);
      return null;
    }
  }

  /**
   * Set value in Redis with TTL
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      if (this.connectionType === 'upstash-rest' && this.upstashClient) {
        if (ttlSeconds) {
          await this.upstashClient.set(key, value, { ex: ttlSeconds });
        } else {
          await this.upstashClient.set(key, value);
        }
        return true;
      } else if (this.client) {
        if (ttlSeconds) {
          await this.client.setEx(key, ttlSeconds, value);
        } else {
          await this.client.set(key, value);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Redis] SET error:', error);
      return false;
    }
  }

  /**
   * Delete key from Redis
   */
  async del(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      if (this.connectionType === 'upstash-rest' && this.upstashClient) {
        await this.upstashClient.del(key);
        return true;
      } else if (this.client) {
        await this.client.del(key);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Redis] DEL error:', error);
      return false;
    }
  }

  /**
   * Check if key exists in Redis
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      if (this.connectionType === 'upstash-rest' && this.upstashClient) {
        const result = await this.upstashClient.exists(key);
        return result === 1;
      } else if (this.client) {
        const result = await this.client.exists(key);
        return result === 1;
      }
      return false;
    } catch (error) {
      console.error('[Redis] EXISTS error:', error);
      return false;
    }
  }

  /**
   * Get multiple keys from Redis
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (!this.isAvailable() || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      if (this.connectionType === 'upstash-rest' && this.upstashClient) {
        const results = await this.upstashClient.mget(...keys);
        return results.map((r: any) => r ? String(r) : null);
      } else if (this.client) {
        return await this.client.mGet(keys);
      }
      return keys.map(() => null);
    } catch (error) {
      console.error('[Redis] MGET error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple key-value pairs in Redis
   */
  async mset(keyValuePairs: Record<string, string>, ttlSeconds?: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      if (this.connectionType === 'upstash-rest' && this.upstashClient) {
        const entries = Object.entries(keyValuePairs);
        if (ttlSeconds) {
          // Upstash doesn't support MSET with TTL, so set individually
          for (const [key, value] of entries) {
            await this.upstashClient.set(key, value, { ex: ttlSeconds });
          }
        } else {
          await this.upstashClient.mset(...entries.flat());
        }
        return true;
      } else if (this.client) {
        if (ttlSeconds) {
          const pipeline = this.client.multi();
          for (const [key, value] of Object.entries(keyValuePairs)) {
            pipeline.setEx(key, ttlSeconds, value);
          }
          await pipeline.exec();
        } else {
          await this.client.mSet(keyValuePairs);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Redis] MSET error:', error);
      return false;
    }
  }

  /**
   * Get keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      if (this.connectionType === 'upstash-rest' && this.upstashClient) {
        // Upstash REST API uses SCAN instead of KEYS
        const keys: string[] = [];
        let cursor = 0;
        do {
          const result = await this.upstashClient.scan(cursor, { match: pattern, count: 100 });
          cursor = result[0];
          keys.push(...result[1]);
        } while (cursor !== 0);
        return keys;
      } else if (this.client) {
        return await this.client.keys(pattern);
      }
      return [];
    } catch (error) {
      console.error('[Redis] KEYS error:', error);
      return [];
    }
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    if (!this.isAvailable()) {
      return -1;
    }

    try {
      if (this.connectionType === 'upstash-rest' && this.upstashClient) {
        const result = await this.upstashClient.ttl(key);
        return result;
      } else if (this.client) {
        return await this.client.ttl(key);
      }
      return -1;
    } catch (error) {
      console.error('[Redis] TTL error:', error);
      return -1;
    }
  }

  /**
   * Increment counter
   */
  async incr(key: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      if (this.connectionType === 'upstash-rest' && this.upstashClient) {
        return await this.upstashClient.incr(key);
      } else if (this.client) {
        return await this.client.incr(key);
      }
      return 0;
    } catch (error) {
      console.error('[Redis] INCR error:', error);
      return 0;
    }
  }

  /**
   * Set expiration for key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      if (this.connectionType === 'upstash-rest' && this.upstashClient) {
        const result = await this.upstashClient.expire(key, seconds);
        return result === 1;
      } else if (this.client) {
        const result = await this.client.expire(key, seconds);
        return result === 1;
      }
      return false;
    } catch (error) {
      console.error('[Redis] EXPIRE error:', error);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch (error) {
        console.error('Error disconnecting Redis:', error);
      }
      this.client = null;
    }
    // Upstash REST API doesn't need explicit disconnection
    this.upstashClient = null;
    this.isConnected = false;
  }

  /**
   * Get Redis connection info
   */
  getConnectionInfo(): { connected: boolean; connectionType: string; config: Partial<RedisConfig> } {
    return {
      connected: this.isConnected,
      connectionType: this.connectionType,
      config: {
        url: this.config.url ? '***' : undefined,
        host: this.config.host,
        port: this.config.port,
        upstashRestUrl: this.config.upstashRestUrl ? '***' : undefined,
        upstashRestToken: this.config.upstashRestToken ? '***' : undefined,
      },
    };
  }
}

/**
 * Global Redis client instance
 */
let globalRedisClient: RedisClient | null = null;

/**
 * Get or create global Redis client
 */
export function getRedisClient(): RedisClient {
  if (!globalRedisClient) {
    globalRedisClient = new RedisClient();
  }
  return globalRedisClient;
}

/**
 * Initialize Redis connection
 */
export async function initializeRedis(): Promise<RedisClient> {
  const client = getRedisClient();
  await client.connect();
  return client;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (globalRedisClient) {
    await globalRedisClient.disconnect();
    globalRedisClient = null;
  }
}
