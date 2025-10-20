/**
 * Advanced Performance Monitoring System
 * 
 * This module implements comprehensive performance monitoring for the entire
 * search pipeline, including metrics collection, analysis, and optimization
 * recommendations.
 * 
 * Key Features:
 * - Real-time performance metrics collection
 * - Historical performance data analysis
 * - Performance trend analysis and predictions
 * - Resource utilization monitoring
 * - API response time tracking
 * - Error rate monitoring and analysis
 * - Performance bottleneck identification
 * - Automated performance optimization recommendations
 */

import { createHash } from "crypto";
import { supabaseServer } from "./supabase-server";
import { alertingSystem, evaluateAlertMetrics } from "./alerting-system";

// Performance monitoring configuration
export const PERFORMANCE_CONFIG = {
  // Metrics collection
  metrics: {
    collectionInterval: 10000, // 10 seconds
    retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxMetricsInMemory: 1000,
    enableRealTimeMetrics: true,
    enableHistoricalMetrics: true,
  },
  
  // Performance thresholds
  thresholds: {
    responseTime: {
      excellent: 1000,    // < 1s
      good: 3000,         // < 3s
      acceptable: 5000,   // < 5s
      poor: 10000,        // < 10s
      critical: 30000,    // > 30s
    },
    errorRate: {
      excellent: 0.01,    // < 1%
      good: 0.05,         // < 5%
      acceptable: 0.10,   // < 10%
      poor: 0.20,         // < 20%
      critical: 0.50,     // > 50%
    },
    cacheHitRate: {
      excellent: 0.90,    // > 90%
      good: 0.80,         // > 80%
      acceptable: 0.70,   // > 70%
      poor: 0.60,         // > 60%
      critical: 0.50,     // < 50%
    },
    resourceUtilization: {
      memory: {
        excellent: 0.50,  // < 50%
        good: 0.70,       // < 70%
        acceptable: 0.80, // < 80%
        poor: 0.90,       // < 90%
        critical: 0.95,   // > 95%
      },
      cpu: {
        excellent: 0.30,  // < 30%
        good: 0.50,       // < 50%
        acceptable: 0.70, // < 70%
        poor: 0.85,       // < 85%
        critical: 0.95,   // > 95%
      }
    }
  },
  
  // Alerting configuration
  alerting: {
    enableAlerts: true,
    alertCooldown: 5 * 60 * 1000, // 5 minutes
    maxAlertsPerHour: 10,
    enableEmailAlerts: false,
    enableSlackAlerts: false,
  },
  
  // Analysis configuration
  analysis: {
    enableTrendAnalysis: true,
    enableBottleneckDetection: true,
    enableOptimizationRecommendations: true,
    analysisWindow: 60 * 60 * 1000, // 1 hour
    predictionWindow: 24 * 60 * 60 * 1000, // 24 hours
  }
};

// Performance metric types
export interface PerformanceMetric {
  id: string;
  timestamp: number;
  type: 'api' | 'cache' | 'database' | 'external' | 'system';
  name: string;
  value: number;
  unit: string;
  tags: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface PerformanceSnapshot {
  timestamp: number;
  metrics: PerformanceMetric[];
  summary: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export interface PerformanceTrend {
  metric: string;
  period: string;
  trend: 'improving' | 'stable' | 'degrading';
  change: number;
  confidence: number;
  prediction?: number;
}

export interface PerformanceAlert {
  id: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'threshold' | 'anomaly' | 'trend';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  recommendations: string[];
  resolved: boolean;
  resolvedAt?: number;
}

export interface PerformanceRecommendation {
  id: string;
  type: 'optimization' | 'scaling' | 'configuration' | 'architecture';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  metrics: string[];
  implementation: string[];
}

// Performance metrics collector
class PerformanceMetricsCollector {
  private metrics: PerformanceMetric[] = [];
  private collectionTimer: NodeJS.Timeout | null = null;
  private isCollecting = false;

  startCollection(): void {
    if (this.isCollecting) return;
    
    this.isCollecting = true;
    this.collectionTimer = setInterval(() => {
      this.collectSystemMetrics();
    }, PERFORMANCE_CONFIG.metrics.collectionInterval);
    
    console.log('[performance-monitor] Metrics collection started');
  }

  stopCollection(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }
    this.isCollecting = false;
    console.log('[performance-monitor] Metrics collection stopped');
  }

  recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      id: createHash('md5').update(`${metric.type}-${metric.name}-${Date.now()}`).digest('hex'),
      timestamp: Date.now(),
      ...metric
    };
    
    this.metrics.push(fullMetric);
    
    // Keep only recent metrics in memory
    if (this.metrics.length > PERFORMANCE_CONFIG.metrics.maxMetricsInMemory) {
      this.metrics = this.metrics.slice(-PERFORMANCE_CONFIG.metrics.maxMetricsInMemory);
    }
  }

  recordApiMetric(name: string, responseTime: number, success: boolean, tags: Record<string, string> = {}): void {
    this.recordMetric({
      type: 'api',
      name,
      value: responseTime,
      unit: 'ms',
      tags: { ...tags, success: success.toString() }
    });
    
    if (!success) {
      this.recordMetric({
        type: 'api',
        name: `${name}_error`,
        value: 1,
        unit: 'count',
        tags
      });
    }
  }

  recordCacheMetric(name: string, hit: boolean, responseTime: number, tags: Record<string, string> = {}): void {
    this.recordMetric({
      type: 'cache',
      name,
      value: responseTime,
      unit: 'ms',
      tags: { ...tags, hit: hit.toString() }
    });
  }

  recordDatabaseMetric(name: string, responseTime: number, success: boolean, tags: Record<string, string> = {}): void {
    this.recordMetric({
      type: 'database',
      name,
      value: responseTime,
      unit: 'ms',
      tags: { ...tags, success: success.toString() }
    });
  }

  recordExternalMetric(name: string, responseTime: number, success: boolean, tags: Record<string, string> = {}): void {
    this.recordMetric({
      type: 'external',
      name,
      value: responseTime,
      unit: 'ms',
      tags: { ...tags, success: success.toString() }
    });
  }

  private collectSystemMetrics(): void {
    // Collect memory usage
    const memoryUsage = process.memoryUsage();
    this.recordMetric({
      type: 'system',
      name: 'memory_heap_used',
      value: memoryUsage.heapUsed,
      unit: 'bytes',
      tags: {}
    });
    
    this.recordMetric({
      type: 'system',
      name: 'memory_heap_total',
      value: memoryUsage.heapTotal,
      unit: 'bytes',
      tags: {}
    });
    
    this.recordMetric({
      type: 'system',
      name: 'memory_external',
      value: memoryUsage.external,
      unit: 'bytes',
      tags: {}
    });
    
    // Collect CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    this.recordMetric({
      type: 'system',
      name: 'cpu_user',
      value: cpuUsage.user,
      unit: 'microseconds',
      tags: {}
    });
    
    this.recordMetric({
      type: 'system',
      name: 'cpu_system',
      value: cpuUsage.system,
      unit: 'microseconds',
      tags: {}
    });
  }

  getMetrics(filter?: { type?: string; name?: string; since?: number }): PerformanceMetric[] {
    let filtered = [...this.metrics];
    
    if (filter?.type) {
      filtered = filtered.filter(m => m.type === filter.type);
    }
    
    if (filter?.name) {
      filtered = filtered.filter(m => m.name === filter.name);
    }
    
    if (filter?.since) {
      filtered = filtered.filter(m => m.timestamp >= filter.since!);
    }
    
    return filtered;
  }

  getLatestSnapshot(): PerformanceSnapshot {
    const now = Date.now();
    const window = 5 * 60 * 1000; // 5 minutes
    const recentMetrics = this.getMetrics({ since: now - window });
    
    // Calculate summary metrics
    const apiMetrics = recentMetrics.filter(m => m.type === 'api');
    const cacheMetrics = recentMetrics.filter(m => m.type === 'cache');
    
    const totalRequests = apiMetrics.length;
    const averageResponseTime = apiMetrics.length > 0 
      ? apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length 
      : 0;
    
    const errorCount = apiMetrics.filter(m => m.tags.success === 'false').length;
    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;
    
    const cacheHits = cacheMetrics.filter(m => m.tags.hit === 'true').length;
    const cacheHitRate = cacheMetrics.length > 0 ? cacheHits / cacheMetrics.length : 0;
    
    const memoryMetrics = recentMetrics.filter(m => m.name === 'memory_heap_used');
    const memoryUsage = memoryMetrics.length > 0 
      ? memoryMetrics[memoryMetrics.length - 1].value / (1024 * 1024 * 1024) // Convert to GB
      : 0;
    
    const cpuMetrics = recentMetrics.filter(m => m.name === 'cpu_user');
    const cpuUsage = cpuMetrics.length > 0 
      ? cpuMetrics[cpuMetrics.length - 1].value / 1000000 // Convert to seconds
      : 0;
    
    return {
      timestamp: now,
      metrics: recentMetrics,
      summary: {
        totalRequests,
        averageResponseTime,
        errorRate,
        cacheHitRate,
        memoryUsage,
        cpuUsage
      }
    };
  }
}

// Performance analyzer
class PerformanceAnalyzer {
  private metricsCollector: PerformanceMetricsCollector;
  private trends: PerformanceTrend[] = [];
  private recommendations: PerformanceRecommendation[] = [];

  constructor(metricsCollector: PerformanceMetricsCollector) {
    this.metricsCollector = metricsCollector;
  }

  analyzeTrends(): PerformanceTrend[] {
    const now = Date.now();
    const analysisWindow = PERFORMANCE_CONFIG.analysis.analysisWindow;
    const metrics = this.metricsCollector.getMetrics({ since: now - analysisWindow });
    
    const trends: PerformanceTrend[] = [];
    
    // Analyze response time trend
    const responseTimeMetrics = metrics.filter(m => m.type === 'api' && m.name.includes('response_time'));
    if (responseTimeMetrics.length > 10) {
      const trend = this.calculateTrend(responseTimeMetrics, 'response_time');
      trends.push(trend);
    }
    
    // Analyze error rate trend
    const errorMetrics = metrics.filter(m => m.type === 'api' && m.name.includes('error'));
    if (errorMetrics.length > 10) {
      const trend = this.calculateTrend(errorMetrics, 'error_rate');
      trends.push(trend);
    }
    
    // Analyze cache hit rate trend
    const cacheMetrics = metrics.filter(m => m.type === 'cache');
    if (cacheMetrics.length > 10) {
      const trend = this.calculateTrend(cacheMetrics, 'cache_hit_rate');
      trends.push(trend);
    }
    
    this.trends = trends;
    return trends;
  }

  private calculateTrend(metrics: PerformanceMetric[], metricName: string): PerformanceTrend {
    const sorted = metrics.sort((a, b) => a.timestamp - b.timestamp);
    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length;
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    const confidence = Math.min(sorted.length / 20, 1); // Higher confidence with more data
    
    let trend: 'improving' | 'stable' | 'degrading';
    if (change > 10) {
      trend = 'degrading';
    } else if (change < -10) {
      trend = 'improving';
    } else {
      trend = 'stable';
    }
    
    return {
      metric: metricName,
      period: '1h',
      trend,
      change,
      confidence,
      prediction: this.predictFutureValue(sorted, 24) // Predict 24 hours ahead
    };
  }

  private predictFutureValue(metrics: PerformanceMetric[], hoursAhead: number): number {
    // Simple linear regression for prediction
    if (metrics.length < 2) return 0;
    
    const sorted = metrics.sort((a, b) => a.timestamp - b.timestamp);
    const n = sorted.length;
    const sumX = sorted.reduce((sum, m, i) => sum + i, 0);
    const sumY = sorted.reduce((sum, m) => sum + m.value, 0);
    const sumXY = sorted.reduce((sum, m, i) => sum + i * m.value, 0);
    const sumXX = sorted.reduce((sum, m, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const futureIndex = n + (hoursAhead * 60 * 60 * 1000) / PERFORMANCE_CONFIG.metrics.collectionInterval;
    return slope * futureIndex + intercept;
  }

  generateRecommendations(): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];
    const snapshot = this.metricsCollector.getLatestSnapshot();
    
    // Response time recommendations
    if (snapshot.summary.averageResponseTime > PERFORMANCE_CONFIG.thresholds.responseTime.poor) {
      recommendations.push({
        id: 'response_time_optimization',
        type: 'optimization',
        priority: 'high',
        title: 'Optimize API Response Times',
        description: `Average response time is ${snapshot.summary.averageResponseTime.toFixed(0)}ms, which is above the acceptable threshold.`,
        impact: 'High - Will improve user experience and reduce server load',
        effort: 'medium',
        metrics: ['response_time'],
        implementation: [
          'Enable more aggressive caching',
          'Optimize database queries',
          'Implement request batching',
          'Add connection pooling'
        ]
      });
    }
    
    // Error rate recommendations
    if (snapshot.summary.errorRate > PERFORMANCE_CONFIG.thresholds.errorRate.poor) {
      recommendations.push({
        id: 'error_rate_reduction',
        type: 'optimization',
        priority: 'critical',
        title: 'Reduce Error Rate',
        description: `Error rate is ${(snapshot.summary.errorRate * 100).toFixed(1)}%, which is above the acceptable threshold.`,
        impact: 'Critical - High error rates impact user experience',
        effort: 'high',
        metrics: ['error_rate'],
        implementation: [
          'Implement better error handling',
          'Add retry mechanisms',
          'Improve input validation',
          'Add circuit breakers'
        ]
      });
    }
    
    // Cache hit rate recommendations
    if (snapshot.summary.cacheHitRate < PERFORMANCE_CONFIG.thresholds.cacheHitRate.poor) {
      recommendations.push({
        id: 'cache_optimization',
        type: 'optimization',
        priority: 'medium',
        title: 'Improve Cache Hit Rate',
        description: `Cache hit rate is ${(snapshot.summary.cacheHitRate * 100).toFixed(1)}%, which is below the acceptable threshold.`,
        impact: 'Medium - Will reduce external API calls and improve performance',
        effort: 'low',
        metrics: ['cache_hit_rate'],
        implementation: [
          'Increase cache TTL',
          'Implement cache warming',
          'Optimize cache keys',
          'Add more cache layers'
        ]
      });
    }
    
    // Memory usage recommendations
    if (snapshot.summary.memoryUsage > PERFORMANCE_CONFIG.thresholds.resourceUtilization.memory.poor) {
      recommendations.push({
        id: 'memory_optimization',
        type: 'scaling',
        priority: 'high',
        title: 'Optimize Memory Usage',
        description: `Memory usage is ${snapshot.summary.memoryUsage.toFixed(2)}GB, which is above the acceptable threshold.`,
        impact: 'High - Will prevent memory leaks and improve stability',
        effort: 'medium',
        metrics: ['memory_usage'],
        implementation: [
          'Implement memory pooling',
          'Add garbage collection optimization',
          'Reduce cache size',
          'Optimize data structures'
        ]
      });
    }
    
    this.recommendations = recommendations;
    return recommendations;
  }

  getTrends(): PerformanceTrend[] {
    return [...this.trends];
  }

  getRecommendations(): PerformanceRecommendation[] {
    return [...this.recommendations];
  }
}

// Performance alert manager
class PerformanceAlertManager {
  private alerts: PerformanceAlert[] = [];
  private alertCooldowns = new Map<string, number>();
  private isMonitoring = false;

  startMonitoring(metricsCollector: PerformanceMetricsCollector): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    setInterval(async () => {
      await this.checkThresholds(metricsCollector);
    }, PERFORMANCE_CONFIG.metrics.collectionInterval);
    
    console.log('[performance-monitor] Alert monitoring started');
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    console.log('[performance-monitor] Alert monitoring stopped');
  }

  private async checkThresholds(metricsCollector: PerformanceMetricsCollector): Promise<void> {
    const snapshot = metricsCollector.getLatestSnapshot();
    
    // Prepare metrics for alerting system
    const alertMetrics: Record<string, number> = {
      api_response_time: snapshot.summary.averageResponseTime,
      error_rate: snapshot.summary.errorRate,
      cache_hit_rate: snapshot.summary.cacheHitRate,
      memory_usage: snapshot.summary.memoryUsage,
      cpu_usage: snapshot.summary.cpuUsage,
      total_requests: snapshot.summary.totalRequests
    };

    // Evaluate alert rules
    await evaluateAlertMetrics(alertMetrics);
    
    // Check response time threshold
    this.checkThreshold(
      'response_time',
      snapshot.summary.averageResponseTime,
      PERFORMANCE_CONFIG.thresholds.responseTime,
      'Average response time is above threshold'
    );
    
    // Check error rate threshold
    this.checkThreshold(
      'error_rate',
      snapshot.summary.errorRate * 100, // Convert to percentage
      PERFORMANCE_CONFIG.thresholds.errorRate,
      'Error rate is above threshold'
    );
    
    // Check cache hit rate threshold
    this.checkThreshold(
      'cache_hit_rate',
      snapshot.summary.cacheHitRate * 100, // Convert to percentage
      PERFORMANCE_CONFIG.thresholds.cacheHitRate,
      'Cache hit rate is below threshold'
    );
    
    // Check memory usage threshold
    this.checkThreshold(
      'memory_usage',
      snapshot.summary.memoryUsage,
      PERFORMANCE_CONFIG.thresholds.resourceUtilization.memory,
      'Memory usage is above threshold'
    );
  }

  private checkThreshold(
    metric: string,
    value: number,
    thresholds: Record<string, number>,
    message: string
  ): void {
    const alertKey = `${metric}_${Date.now()}`;
    const now = Date.now();
    
    // Check cooldown
    if (this.alertCooldowns.has(metric)) {
      const lastAlert = this.alertCooldowns.get(metric)!;
      if (now - lastAlert < PERFORMANCE_CONFIG.alerting.alertCooldown) {
        return;
      }
    }
    
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let threshold = 0;
    
    if (value >= thresholds.critical) {
      severity = 'critical';
      threshold = thresholds.critical;
    } else if (value >= thresholds.poor) {
      severity = 'high';
      threshold = thresholds.poor;
    } else if (value >= thresholds.acceptable) {
      severity = 'medium';
      threshold = thresholds.acceptable;
    } else if (value >= thresholds.good) {
      severity = 'low';
      threshold = thresholds.good;
    } else {
      return; // No alert needed
    }
    
    const alert: PerformanceAlert = {
      id: createHash('md5').update(`${metric}-${now}`).digest('hex'),
      timestamp: now,
      severity,
      type: 'threshold',
      metric,
      value,
      threshold,
      message: `${message}: ${value.toFixed(2)} (threshold: ${threshold})`,
      recommendations: this.getRecommendationsForMetric(metric),
      resolved: false
    };
    
    this.alerts.push(alert);
    this.alertCooldowns.set(metric, now);
    
    console.warn(`[performance-monitor] ALERT: ${alert.message}`);
  }

  private getRecommendationsForMetric(metric: string): string[] {
    const recommendations: Record<string, string[]> = {
      response_time: [
        'Enable more aggressive caching',
        'Optimize database queries',
        'Implement request batching'
      ],
      error_rate: [
        'Implement better error handling',
        'Add retry mechanisms',
        'Improve input validation'
      ],
      cache_hit_rate: [
        'Increase cache TTL',
        'Implement cache warming',
        'Optimize cache keys'
      ],
      memory_usage: [
        'Implement memory pooling',
        'Add garbage collection optimization',
        'Reduce cache size'
      ]
    };
    
    return recommendations[metric] || [];
  }

  getAlerts(filter?: { severity?: string; resolved?: boolean }): PerformanceAlert[] {
    let filtered = [...this.alerts];
    
    if (filter?.severity) {
      filtered = filtered.filter(a => a.severity === filter.severity);
    }
    
    if (filter?.resolved !== undefined) {
      filtered = filtered.filter(a => a.resolved === filter.resolved);
    }
    
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      return true;
    }
    return false;
  }
}

// Main performance monitor class
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metricsCollector: PerformanceMetricsCollector;
  private analyzer: PerformanceAnalyzer;
  private alertManager: PerformanceAlertManager;
  private isInitialized = false;

  private constructor() {
    this.metricsCollector = new PerformanceMetricsCollector();
    this.analyzer = new PerformanceAnalyzer(this.metricsCollector);
    this.alertManager = new PerformanceAlertManager();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Start metrics collection
    this.metricsCollector.startCollection();
    
    // Start alert monitoring
    if (PERFORMANCE_CONFIG.alerting.enableAlerts) {
      this.alertManager.startMonitoring(this.metricsCollector);
    }
    
    // Start periodic analysis
    if (PERFORMANCE_CONFIG.analysis.enableTrendAnalysis) {
      setInterval(() => {
        this.analyzer.analyzeTrends();
        this.analyzer.generateRecommendations();
      }, PERFORMANCE_CONFIG.analysis.analysisWindow);
    }

    this.isInitialized = true;
    console.log('[performance-monitor] Performance monitoring initialized');
  }

  // Metrics recording methods
  recordApiMetric(name: string, responseTime: number, success: boolean, tags: Record<string, string> = {}): void {
    this.metricsCollector.recordApiMetric(name, responseTime, success, tags);
  }

  recordCacheMetric(name: string, hit: boolean, responseTime: number, tags: Record<string, string> = {}): void {
    this.metricsCollector.recordCacheMetric(name, hit, responseTime, tags);
  }

  recordDatabaseMetric(name: string, responseTime: number, success: boolean, tags: Record<string, string> = {}): void {
    this.metricsCollector.recordDatabaseMetric(name, responseTime, success, tags);
  }

  recordExternalMetric(name: string, responseTime: number, success: boolean, tags: Record<string, string> = {}): void {
    this.metricsCollector.recordExternalMetric(name, responseTime, success, tags);
  }

  // Analytics methods
  getLatestSnapshot(): PerformanceSnapshot {
    return this.metricsCollector.getLatestSnapshot();
  }

  getTrends(): PerformanceTrend[] {
    return this.analyzer.getTrends();
  }

  getRecommendations(): PerformanceRecommendation[] {
    return this.analyzer.getRecommendations();
  }

  getAlerts(filter?: { severity?: string; resolved?: boolean }): PerformanceAlert[] {
    return this.alertManager.getAlerts(filter);
  }

  resolveAlert(alertId: string): boolean {
    return this.alertManager.resolveAlert(alertId);
  }

  getMetrics(filter?: { type?: string; name?: string; since?: number }): PerformanceMetric[] {
    return this.metricsCollector.getMetrics(filter);
  }

  async shutdown(): Promise<void> {
    this.metricsCollector.stopCollection();
    this.alertManager.stopMonitoring();
    this.isInitialized = false;
    console.log('[performance-monitor] Performance monitoring shutdown');
  }
}

// Global performance monitor instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Initialize performance monitoring
performanceMonitor.initialize().catch(error => {
  console.error('[performance-monitor] Failed to initialize:', error);
});

// Export utility functions
export function recordApiPerformance(name: string, responseTime: number, success: boolean, tags: Record<string, string> = {}): void {
  performanceMonitor.recordApiMetric(name, responseTime, success, tags);
}

export function recordCachePerformance(name: string, hit: boolean, responseTime: number, tags: Record<string, string> = {}): void {
  performanceMonitor.recordCacheMetric(name, hit, responseTime, tags);
}

export function recordDatabasePerformance(name: string, responseTime: number, success: boolean, tags: Record<string, string> = {}): void {
  performanceMonitor.recordDatabaseMetric(name, responseTime, success, tags);
}

export function recordExternalPerformance(name: string, responseTime: number, success: boolean, tags: Record<string, string> = {}): void {
  performanceMonitor.recordExternalMetric(name, responseTime, success, tags);
}

export function getPerformanceSnapshot(): PerformanceSnapshot {
  return performanceMonitor.getLatestSnapshot();
}

export function getPerformanceTrends(): PerformanceTrend[] {
  return performanceMonitor.getTrends();
}

export function getPerformanceRecommendations(): PerformanceRecommendation[] {
  return performanceMonitor.getRecommendations();
}

export function getPerformanceAlerts(filter?: { severity?: string; resolved?: boolean }): PerformanceAlert[] {
  return performanceMonitor.getAlerts(filter);
}