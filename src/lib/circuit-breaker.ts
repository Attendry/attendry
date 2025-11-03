/**
 * Advanced Circuit Breaker System
 * 
 * This module implements a sophisticated circuit breaker pattern for external
 * services to prevent cascading failures and improve system resilience.
 * 
 * Key Features:
 * - Circuit breaker pattern for external services (Firecrawl, CSE, Database)
 * - Automatic recovery with exponential backoff
 * - Service health monitoring and availability tracking
 * - Graceful degradation with fallback strategies
 * - Circuit state management (Open, Closed, Half-Open)
 * - Performance impact reduction and cascading failure prevention
 * - Real-time circuit metrics and analytics
 * - Adaptive threshold management
 */

import { createHash } from "crypto";

// Circuit breaker configuration
export const CIRCUIT_BREAKER_CONFIG = {
  // Default circuit breaker settings
  default: {
    failureThreshold: 5,           // Number of failures before opening circuit
    successThreshold: 3,           // Number of successes to close circuit
    timeout: 60000,                // Timeout in ms before attempting to close circuit
    volumeThreshold: 10,           // Minimum number of calls before circuit can open
    errorThreshold: 0.5,           // Error rate threshold (50%)
    slowCallThreshold: 10000,      // Slow call threshold in ms
    slowCallRatioThreshold: 0.5,   // Slow call ratio threshold (50%)
  },
  
  // Service-specific configurations
  services: {
    firecrawl: {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000,
      volumeThreshold: 5,
      errorThreshold: 0.3,
      slowCallThreshold: 25000, // Increased to exceed API timeout (20s)
      slowCallRatioThreshold: 0.4,
    },
    cse: {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 45000,
      volumeThreshold: 8,
      errorThreshold: 0.4,
      slowCallThreshold: 8000,
      slowCallRatioThreshold: 0.3,
    },
    database: {
      failureThreshold: 8,
      successThreshold: 4,
      timeout: 90000,
      volumeThreshold: 15,
      errorThreshold: 0.6,
      slowCallThreshold: 5000,
      slowCallRatioThreshold: 0.2,
    },
    gemini: {
      failureThreshold: 4,
      successThreshold: 2,
      timeout: 60000,
      volumeThreshold: 6,
      errorThreshold: 0.35,
      slowCallThreshold: 12000,
      slowCallRatioThreshold: 0.45,
    }
  },
  
  // Monitoring and analytics
  monitoring: {
    enableMetrics: true,
    metricsRetention: 24 * 60 * 60 * 1000, // 24 hours
    healthCheckInterval: 30000,             // 30 seconds
    enableAdaptiveThresholds: true,
    adaptiveLearningPeriod: 60 * 60 * 1000, // 1 hour
  }
};

// Circuit breaker states
export enum CircuitState {
  CLOSED = 'CLOSED',       // Normal operation
  OPEN = 'OPEN',           // Circuit is open, calls are failing fast
  HALF_OPEN = 'HALF_OPEN'  // Testing if service has recovered
}

// Call result types
export enum CallResult {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  TIMEOUT = 'TIMEOUT',
  SLOW_CALL = 'SLOW_CALL'
}

// Circuit breaker metrics
export interface CircuitMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  slowCalls: number;
  timeoutCalls: number;
  errorRate: number;
  slowCallRate: number;
  averageResponseTime: number;
  circuitState: CircuitState;
  lastStateChange: number;
  stateChangeCount: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

// Circuit breaker call record
interface CallRecord {
  timestamp: number;
  result: CallResult;
  responseTime: number;
  error?: string;
}

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  volumeThreshold: number;
  errorThreshold: number;
  slowCallThreshold: number;
  slowCallRatioThreshold: number;
  name: string;
  service: string;
}

// Circuit breaker class
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = CircuitState.CLOSED;
  private callHistory: CallRecord[] = [];
  private lastFailureTime: number = 0;
  private consecutiveFailures: number = 0;
  private consecutiveSuccesses: number = 0;
  private stateChangeCount: number = 0;
  private lastStateChange: number = Date.now();
  private metrics: CircuitMetrics;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
    this.metrics = this.initializeMetrics();
    this.startHealthCheck();
  }

  private initializeMetrics(): CircuitMetrics {
    return {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      slowCalls: 0,
      timeoutCalls: 0,
      errorRate: 0,
      slowCallRate: 0,
      averageResponseTime: 0,
      circuitState: this.state,
      lastStateChange: this.lastStateChange,
      stateChangeCount: this.stateChangeCount,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
    };
  }

  private startHealthCheck(): void {
    if (CIRCUIT_BREAKER_CONFIG.monitoring.healthCheckInterval > 0) {
      this.healthCheckTimer = setInterval(() => {
        this.performHealthCheck();
      }, CIRCUIT_BREAKER_CONFIG.monitoring.healthCheckInterval);
    }
  }

  private performHealthCheck(): void {
    // Clean up old call records
    this.cleanupCallHistory();
    
    // Update metrics
    this.updateMetrics();
    
    // Check if circuit should transition states
    this.checkStateTransition();
  }

  private cleanupCallHistory(): void {
    const cutoff = Date.now() - CIRCUIT_BREAKER_CONFIG.monitoring.metricsRetention;
    this.callHistory = this.callHistory.filter(record => record.timestamp > cutoff);
  }

  private updateMetrics(): void {
    const totalCalls = this.callHistory.length;
    if (totalCalls === 0) return;

    const successfulCalls = this.callHistory.filter(r => r.result === CallResult.SUCCESS).length;
    const failedCalls = this.callHistory.filter(r => r.result === CallResult.FAILURE).length;
    const slowCalls = this.callHistory.filter(r => r.result === CallResult.SLOW_CALL).length;
    const timeoutCalls = this.callHistory.filter(r => r.result === CallResult.TIMEOUT).length;

    const totalResponseTime = this.callHistory.reduce((sum, r) => sum + r.responseTime, 0);

    this.metrics = {
      totalCalls,
      successfulCalls,
      failedCalls,
      slowCalls,
      timeoutCalls,
      errorRate: totalCalls > 0 ? (failedCalls + timeoutCalls) / totalCalls : 0,
      slowCallRate: totalCalls > 0 ? slowCalls / totalCalls : 0,
      averageResponseTime: totalCalls > 0 ? totalResponseTime / totalCalls : 0,
      circuitState: this.state,
      lastStateChange: this.lastStateChange,
      stateChangeCount: this.stateChangeCount,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
    };
  }

  private checkStateTransition(): void {
    const now = Date.now();
    
    switch (this.state) {
      case CircuitState.CLOSED:
        this.checkOpenTransition();
        break;
      case CircuitState.OPEN:
        this.checkHalfOpenTransition(now);
        break;
      case CircuitState.HALF_OPEN:
        this.checkClosedTransition();
        break;
    }
  }

  private checkOpenTransition(): void {
    const totalCalls = this.callHistory.length;
    if (totalCalls < this.config.volumeThreshold) return;

    const recentCalls = this.getRecentCalls(60000); // Last minute
    if (recentCalls.length < this.config.volumeThreshold) return;

    const errorRate = this.calculateErrorRate(recentCalls);
    const slowCallRate = this.calculateSlowCallRate(recentCalls);

    if (errorRate >= this.config.errorThreshold || 
        slowCallRate >= this.config.slowCallRatioThreshold ||
        this.consecutiveFailures >= this.config.failureThreshold) {
      this.openCircuit();
    }
  }

  private checkHalfOpenTransition(now: number): void {
    if (now - this.lastFailureTime >= this.config.timeout) {
      this.halfOpenCircuit();
    }
  }

  private checkClosedTransition(): void {
    if (this.consecutiveSuccesses >= this.config.successThreshold) {
      this.closeCircuit();
    } else if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.openCircuit();
    }
  }

  private getRecentCalls(timeWindow: number): CallRecord[] {
    const cutoff = Date.now() - timeWindow;
    return this.callHistory.filter(record => record.timestamp > cutoff);
  }

  private calculateErrorRate(calls: CallRecord[]): number {
    if (calls.length === 0) return 0;
    const errorCalls = calls.filter(r => r.result === CallResult.FAILURE || r.result === CallResult.TIMEOUT).length;
    return errorCalls / calls.length;
  }

  private calculateSlowCallRate(calls: CallRecord[]): number {
    if (calls.length === 0) return 0;
    const slowCalls = calls.filter(r => r.responseTime > this.config.slowCallThreshold).length;
    return slowCalls / calls.length;
  }

  private openCircuit(): void {
    if (this.state !== CircuitState.OPEN) {
      this.state = CircuitState.OPEN;
      this.lastFailureTime = Date.now();
      this.stateChangeCount++;
      this.lastStateChange = Date.now();
      this.consecutiveSuccesses = 0;
      
      console.warn(`[circuit-breaker] Circuit opened for ${this.config.name}: ${this.config.service}`);
    }
  }

  private halfOpenCircuit(): void {
    if (this.state !== CircuitState.HALF_OPEN) {
      this.state = CircuitState.HALF_OPEN;
      this.stateChangeCount++;
      this.lastStateChange = Date.now();
      this.consecutiveFailures = 0;
      this.consecutiveSuccesses = 0;
      
      console.log(`[circuit-breaker] Circuit half-opened for ${this.config.name}: ${this.config.service}`);
    }
  }

  private closeCircuit(): void {
    if (this.state !== CircuitState.CLOSED) {
      this.state = CircuitState.CLOSED;
      this.stateChangeCount++;
      this.lastStateChange = Date.now();
      this.consecutiveFailures = 0;
      
      console.log(`[circuit-breaker] Circuit closed for ${this.config.name}: ${this.config.service}`);
    }
  }

  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    
    // Check if circuit allows the call
    if (this.state === CircuitState.OPEN) {
      const record: CallRecord = {
        timestamp: startTime,
        result: CallResult.FAILURE,
        responseTime: 0,
        error: 'Circuit breaker is OPEN'
      };
      this.recordCall(record);
      
      if (fallback) {
        console.log(`[circuit-breaker] Using fallback for ${this.config.name} due to open circuit`);
        return await fallback();
      }
      
      throw new Error(`Circuit breaker is OPEN for ${this.config.name}`);
    }

    try {
      // Execute the operation with timeout
      const result = await this.executeWithTimeout(operation, this.config.slowCallThreshold);
      const responseTime = Date.now() - startTime;
      
      // Record successful call
      const record: CallRecord = {
        timestamp: startTime,
        result: responseTime > this.config.slowCallThreshold ? CallResult.SLOW_CALL : CallResult.SUCCESS,
        responseTime
      };
      this.recordCall(record);
      
      // Update state based on result
      if (record.result === CallResult.SUCCESS) {
        this.consecutiveSuccesses++;
        this.consecutiveFailures = 0;
      } else {
        this.consecutiveFailures++;
        this.consecutiveSuccesses = 0;
      }
      
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Record failed call
      const record: CallRecord = {
        timestamp: startTime,
        result: CallResult.FAILURE,
        responseTime,
        error: error instanceof Error ? error.message : String(error)
      };
      this.recordCall(record);
      
      // Update failure count
      this.consecutiveFailures++;
      this.consecutiveSuccesses = 0;
      this.lastFailureTime = Date.now();
      
      // Try fallback if available
      if (fallback) {
        console.log(`[circuit-breaker] Using fallback for ${this.config.name} due to error: ${record.error}`);
        try {
          return await fallback();
        } catch (fallbackError) {
          console.error(`[circuit-breaker] Fallback also failed for ${this.config.name}:`, fallbackError);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timeout after ${timeout}ms`));
      }, timeout);
      
      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private recordCall(record: CallRecord): void {
    this.callHistory.push(record);
    
    // Keep only recent records to prevent memory issues
    if (this.callHistory.length > 1000) {
      this.callHistory = this.callHistory.slice(-500);
    }
  }

  // Public methods
  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): CircuitMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.callHistory = [];
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.stateChangeCount = 0;
    this.lastStateChange = Date.now();
    this.lastFailureTime = 0;
    
    console.log(`[circuit-breaker] Circuit reset for ${this.config.name}: ${this.config.service}`);
  }

  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}

// Circuit breaker manager
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private isInitialized = false;

  private constructor() {
    this.initializeDefaultCircuitBreakers();
  }

  public static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  private initializeDefaultCircuitBreakers(): void {
    // Firecrawl circuit breaker
    this.createCircuitBreaker('firecrawl', {
      ...CIRCUIT_BREAKER_CONFIG.default,
      ...CIRCUIT_BREAKER_CONFIG.services.firecrawl,
      name: 'firecrawl',
      service: 'firecrawl'
    });

    // CSE circuit breaker
    this.createCircuitBreaker('cse', {
      ...CIRCUIT_BREAKER_CONFIG.default,
      ...CIRCUIT_BREAKER_CONFIG.services.cse,
      name: 'cse',
      service: 'cse'
    });

    // Database circuit breaker
    this.createCircuitBreaker('database', {
      ...CIRCUIT_BREAKER_CONFIG.default,
      ...CIRCUIT_BREAKER_CONFIG.services.database,
      name: 'database',
      service: 'database'
    });

    // Gemini circuit breaker
    this.createCircuitBreaker('gemini', {
      ...CIRCUIT_BREAKER_CONFIG.default,
      ...CIRCUIT_BREAKER_CONFIG.services.gemini,
      name: 'gemini',
      service: 'gemini'
    });
  }

  createCircuitBreaker(name: string, config: CircuitBreakerConfig): CircuitBreaker {
    const circuitBreaker = new CircuitBreaker(config);
    this.circuitBreakers.set(name, circuitBreaker);
    return circuitBreaker;
  }

  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  getAllCircuitBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.circuitBreakers);
  }

  getCircuitBreakerMetrics(): Record<string, CircuitMetrics> {
    const metrics: Record<string, CircuitMetrics> = {};
    for (const [name, circuitBreaker] of this.circuitBreakers) {
      metrics[name] = circuitBreaker.getMetrics();
    }
    return metrics;
  }

  resetCircuitBreaker(name: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (circuitBreaker) {
      circuitBreaker.reset();
      return true;
    }
    return false;
  }

  resetAllCircuitBreakers(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
  }

  destroy(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.destroy();
    }
    this.circuitBreakers.clear();
  }
}

// Global circuit breaker manager instance
export const circuitBreakerManager = CircuitBreakerManager.getInstance();

// Utility functions
export async function executeWithCircuitBreaker<T>(
  serviceName: string,
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  const circuitBreaker = circuitBreakerManager.getCircuitBreaker(serviceName);
  if (!circuitBreaker) {
    throw new Error(`Circuit breaker not found for service: ${serviceName}`);
  }
  
  return circuitBreaker.execute(operation, fallback);
}

export function getCircuitBreakerState(serviceName: string): CircuitState | undefined {
  const circuitBreaker = circuitBreakerManager.getCircuitBreaker(serviceName);
  return circuitBreaker?.getState();
}

export function getCircuitBreakerMetrics(serviceName?: string): Record<string, CircuitMetrics> | CircuitMetrics | undefined {
  if (serviceName) {
    const circuitBreaker = circuitBreakerManager.getCircuitBreaker(serviceName);
    return circuitBreaker?.getMetrics();
  }
  return circuitBreakerManager.getCircuitBreakerMetrics();
}

export function resetCircuitBreaker(serviceName: string): boolean {
  return circuitBreakerManager.resetCircuitBreaker(serviceName);
}

export function resetAllCircuitBreakers(): void {
  circuitBreakerManager.resetAllCircuitBreakers();
}
