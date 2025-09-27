/**
 * Redis Client for Attendry Application
 * 
 * This file provides a Redis client with connection management,
 * error handling, and fallback mechanisms for caching operations.
 */

import { createClient, RedisClientType } from 'redis';

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
}

/**
 * Redis client wrapper with error handling and fallback
 */
export class RedisClient {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private config: RedisConfig;
  private connectionPromise: Promise<void> | null = null;

  constructor(config: RedisConfig = {}) {
    this.config = {
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
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
      if (!this.config.url && !this.config.host) {
        console.warn('Redis configuration not found, caching will use fallback');
        return;
      }

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
        console.log('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('Redis client disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      this.client = null;
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.client !== null && this.isConnected;
  }

  /**
   * Get value from Redis
   */
  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      return await this.client!.get(key);
    } catch (error) {
      console.error('Redis GET error:', error);
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
      if (ttlSeconds) {
        await this.client!.setEx(key, ttlSeconds, value);
      } else {
        await this.client!.set(key, value);
      }
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
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
      await this.client!.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
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
      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
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
      return await this.client!.mGet(keys);
    } catch (error) {
      console.error('Redis MGET error:', error);
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
      if (ttlSeconds) {
        const pipeline = this.client!.multi();
        for (const [key, value] of Object.entries(keyValuePairs)) {
          pipeline.setEx(key, ttlSeconds, value);
        }
        await pipeline.exec();
      } else {
        await this.client!.mSet(keyValuePairs);
      }
      return true;
    } catch (error) {
      console.error('Redis MSET error:', error);
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
      return await this.client!.keys(pattern);
    } catch (error) {
      console.error('Redis KEYS error:', error);
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
      return await this.client!.ttl(key);
    } catch (error) {
      console.error('Redis TTL error:', error);
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
      return await this.client!.incr(key);
    } catch (error) {
      console.error('Redis INCR error:', error);
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
      const result = await this.client!.expire(key, seconds);
      return result === 1;
    } catch (error) {
      console.error('Redis EXPIRE error:', error);
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
      this.isConnected = false;
    }
  }

  /**
   * Get Redis connection info
   */
  getConnectionInfo(): { connected: boolean; config: RedisConfig } {
    return {
      connected: this.isConnected,
      config: this.config,
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
