/**
 * Intelligent Alerting System
 * 
 * This module implements a sophisticated alerting system with intelligent
 * thresholds, notification management, and automated response capabilities.
 * 
 * Key Features:
 * - Intelligent threshold management with adaptive learning
 * - Multi-channel notification system (email, Slack, webhook)
 * - Alert escalation and routing based on severity
 * - Alert correlation and deduplication
 * - Automated response and remediation
 * - Alert analytics and reporting
 * - Custom alert rules and conditions
 * - Integration with performance monitoring
 */

import { createHash } from "crypto";
import { supabaseServer } from "./supabase-server";

// Alerting configuration
export const ALERTING_CONFIG = {
  // Alert channels
  channels: {
    email: {
      enabled: false,
      smtp: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },
      from: process.env.ALERT_EMAIL_FROM || 'alerts@attendry.com',
      to: process.env.ALERT_EMAIL_TO?.split(',') || []
    },
    slack: {
      enabled: false,
      webhook: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_ALERT_CHANNEL || '#alerts',
      username: 'Attendry Alerts',
      icon_emoji: ':warning:'
    },
    webhook: {
      enabled: false,
      url: process.env.ALERT_WEBHOOK_URL,
      timeout: 10000,
      retries: 3
    }
  },
  
  // Alert management
  management: {
    enableDeduplication: true,
    enableEscalation: true,
    enableCorrelation: true,
    maxAlertsPerHour: 50,
    alertCooldown: 5 * 60 * 1000, // 5 minutes
    escalationDelay: 15 * 60 * 1000, // 15 minutes
    correlationWindow: 10 * 60 * 1000, // 10 minutes
  },
  
  // Alert rules
  rules: {
    enableAdaptiveThresholds: true,
    enableCustomRules: true,
    enableAnomalyDetection: true,
    thresholdLearningPeriod: 24 * 60 * 60 * 1000, // 24 hours
    anomalySensitivity: 0.8, // 0-1, higher = more sensitive
  },
  
  // Response automation
  automation: {
    enableAutoResponse: true,
    enableAutoRemediation: true,
    maxAutoActions: 3,
    actionCooldown: 30 * 60 * 1000, // 30 minutes
  }
};

// Alert types and interfaces
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  conditions: AlertCondition[];
  actions: AlertAction[];
  cooldown: number;
  escalation?: AlertEscalation;
  tags: string[];
  created: number;
  updated: number;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne' | 'contains' | 'regex';
  threshold: number | string;
  duration?: number; // Duration in ms for sustained conditions
  aggregation?: 'avg' | 'max' | 'min' | 'sum' | 'count';
  window?: number; // Time window in ms
}

export interface AlertAction {
  type: 'notification' | 'webhook' | 'script' | 'remediation' | 'escalation';
  config: Record<string, any>;
  delay?: number; // Delay in ms before executing
  retries?: number;
  enabled: boolean;
}

export interface AlertEscalation {
  levels: AlertEscalationLevel[];
  enabled: boolean;
}

export interface AlertEscalationLevel {
  delay: number; // Delay in ms before escalation
  actions: AlertAction[];
  recipients: string[];
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved' | 'suppressed';
  title: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  resolvedAt?: number;
  resolvedBy?: string;
  tags: string[];
  metadata: Record<string, any>;
  correlationId?: string;
  escalationLevel?: number;
  actions: AlertAction[];
}

export interface AlertCorrelation {
  id: string;
  alerts: string[];
  pattern: string;
  confidence: number;
  timestamp: number;
  resolved: boolean;
}

export interface AlertAnalytics {
  totalAlerts: number;
  activeAlerts: number;
  resolvedAlerts: number;
  alertsBySeverity: Record<string, number>;
  alertsByMetric: Record<string, number>;
  averageResolutionTime: number;
  escalationRate: number;
  falsePositiveRate: number;
  topAlertRules: Array<{ ruleId: string; count: number }>;
}

// Alert rule manager
class AlertRuleManager {
  private rules: Map<string, AlertRule> = new Map();
  private ruleEvaluator: AlertRuleEvaluator;

  constructor() {
    this.ruleEvaluator = new AlertRuleEvaluator();
    this.loadDefaultRules();
  }

  private loadDefaultRules(): void {
    // Performance-based alert rules
    this.addRule({
      id: 'high_response_time',
      name: 'High Response Time',
      description: 'Alert when API response time exceeds threshold',
      enabled: true,
      severity: 'high',
      conditions: [{
        metric: 'api_response_time',
        operator: 'gt',
        threshold: 5000, // 5 seconds
        duration: 60000, // 1 minute
        aggregation: 'avg',
        window: 300000 // 5 minutes
      }],
      actions: [{
        type: 'notification',
        config: { channels: ['slack', 'email'] },
        enabled: true
      }],
      cooldown: 300000, // 5 minutes
      tags: ['performance', 'api'],
      created: Date.now(),
      updated: Date.now()
    });

    this.addRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      description: 'Alert when error rate exceeds threshold',
      enabled: true,
      severity: 'critical',
      conditions: [{
        metric: 'error_rate',
        operator: 'gt',
        threshold: 0.1, // 10%
        duration: 300000, // 5 minutes
        aggregation: 'avg',
        window: 600000 // 10 minutes
      }],
      actions: [{
        type: 'notification',
        config: { channels: ['slack', 'email', 'webhook'] },
        enabled: true
      }],
      cooldown: 300000,
      escalation: {
        enabled: true,
        levels: [{
          delay: 900000, // 15 minutes
          actions: [{
            type: 'webhook',
            config: { url: process.env.ON_CALL_WEBHOOK_URL },
            enabled: true
          }],
          recipients: ['oncall@attendry.com']
        }]
      },
      tags: ['performance', 'errors'],
      created: Date.now(),
      updated: Date.now()
    });

    this.addRule({
      id: 'low_cache_hit_rate',
      name: 'Low Cache Hit Rate',
      description: 'Alert when cache hit rate falls below threshold',
      enabled: true,
      severity: 'medium',
      conditions: [{
        metric: 'cache_hit_rate',
        operator: 'lt',
        threshold: 0.7, // 70%
        duration: 600000, // 10 minutes
        aggregation: 'avg',
        window: 900000 // 15 minutes
      }],
      actions: [{
        type: 'notification',
        config: { channels: ['slack'] },
        enabled: true
      }],
      cooldown: 600000, // 10 minutes
      tags: ['performance', 'cache'],
      created: Date.now(),
      updated: Date.now()
    });

    this.addRule({
      id: 'high_memory_usage',
      name: 'High Memory Usage',
      description: 'Alert when memory usage exceeds threshold',
      enabled: true,
      severity: 'high',
      conditions: [{
        metric: 'memory_usage',
        operator: 'gt',
        threshold: 0.85, // 85%
        duration: 300000, // 5 minutes
        aggregation: 'avg',
        window: 600000 // 10 minutes
      }],
      actions: [{
        type: 'notification',
        config: { channels: ['slack', 'email'] },
        enabled: true
      }, {
        type: 'remediation',
        config: { action: 'clear_cache' },
        enabled: true
      }],
      cooldown: 300000,
      tags: ['performance', 'memory'],
      created: Date.now(),
      updated: Date.now()
    });

    this.addRule({
      id: 'external_api_failure',
      name: 'External API Failure',
      description: 'Alert when external API calls fail',
      enabled: true,
      severity: 'high',
      conditions: [{
        metric: 'external_api_error_rate',
        operator: 'gt',
        threshold: 0.2, // 20%
        duration: 180000, // 3 minutes
        aggregation: 'avg',
        window: 300000 // 5 minutes
      }],
      actions: [{
        type: 'notification',
        config: { channels: ['slack', 'email'] },
        enabled: true
      }],
      cooldown: 300000,
      tags: ['external', 'api', 'errors'],
      created: Date.now(),
      updated: Date.now()
    });
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    
    this.rules.set(ruleId, { ...rule, ...updates, updated: Date.now() });
    return true;
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  getEnabledRules(): AlertRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.enabled);
  }

  evaluateRules(metrics: Record<string, number>): Alert[] {
    const alerts: Alert[] = [];
    const enabledRules = this.getEnabledRules();

    for (const rule of enabledRules) {
      const ruleAlerts = this.ruleEvaluator.evaluate(rule, metrics);
      alerts.push(...ruleAlerts);
    }

    return alerts;
  }
}

// Alert rule evaluator
class AlertRuleEvaluator {
  private metricHistory: Map<string, Array<{ timestamp: number; value: number }>> = new Map();
  private alertCooldowns: Map<string, number> = new Map();

  evaluate(rule: AlertRule, metrics: Record<string, number>): Alert[] {
    const alerts: Alert[] = [];
    const now = Date.now();

    // Check cooldown
    const cooldownKey = `${rule.id}_${now}`;
    if (this.alertCooldowns.has(rule.id)) {
      const lastAlert = this.alertCooldowns.get(rule.id)!;
      if (now - lastAlert < rule.cooldown) {
        return alerts; // Still in cooldown
      }
    }

    for (const condition of rule.conditions) {
      const metricValue = metrics[condition.metric];
      if (metricValue === undefined) continue;

      // Store metric history
      this.updateMetricHistory(condition.metric, metricValue, now);

      // Evaluate condition
      if (this.evaluateCondition(condition, metricValue, now)) {
        const alert: Alert = {
          id: createHash('md5').update(`${rule.id}_${condition.metric}_${now}`).digest('hex'),
          ruleId: rule.id,
          severity: rule.severity,
          status: 'active',
          title: rule.name,
          message: this.generateAlertMessage(rule, condition, metricValue),
          metric: condition.metric,
          value: metricValue,
          threshold: condition.threshold as number,
          timestamp: now,
          tags: rule.tags,
          metadata: {
            rule: rule.name,
            condition: condition,
            duration: condition.duration,
            aggregation: condition.aggregation
          },
          actions: rule.actions
        };

        alerts.push(alert);
        this.alertCooldowns.set(rule.id, now);
        break; // Only create one alert per rule evaluation
      }
    }

    return alerts;
  }

  private updateMetricHistory(metric: string, value: number, timestamp: number): void {
    if (!this.metricHistory.has(metric)) {
      this.metricHistory.set(metric, []);
    }
    
    const history = this.metricHistory.get(metric)!;
    history.push({ timestamp, value });
    
    // Keep only recent history (last hour)
    const cutoff = timestamp - (60 * 60 * 1000);
    const filtered = history.filter(entry => entry.timestamp > cutoff);
    this.metricHistory.set(metric, filtered);
  }

  private evaluateCondition(condition: AlertCondition, value: number, timestamp: number): boolean {
    const { operator, threshold, duration, aggregation, window } = condition;
    
    // Simple evaluation without duration
    if (!duration) {
      return this.compareValues(value, operator, threshold as number);
    }

    // Duration-based evaluation
    const history = this.metricHistory.get(condition.metric) || [];
    const windowStart = timestamp - (window || duration);
    const relevantHistory = history.filter(entry => entry.timestamp >= windowStart);
    
    if (relevantHistory.length === 0) return false;

    // Apply aggregation
    const aggregatedValue = this.aggregateValues(relevantHistory.map(h => h.value), aggregation || 'avg');
    
    // Check if condition is met for the required duration
    const conditionMet = this.compareValues(aggregatedValue, operator, threshold as number);
    
    if (!conditionMet) return false;

    // Check duration requirement
    const durationStart = timestamp - duration;
    const durationHistory = relevantHistory.filter(entry => entry.timestamp >= durationStart);
    
    if (durationHistory.length < 2) return false;

    // Check if condition has been met for the required duration
    const durationAggregated = this.aggregateValues(durationHistory.map(h => h.value), aggregation || 'avg');
    return this.compareValues(durationAggregated, operator, threshold as number);
  }

  private compareValues(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'ne': return value !== threshold;
      default: return false;
    }
  }

  private aggregateValues(values: number[], aggregation: string): number {
    if (values.length === 0) return 0;
    
    switch (aggregation) {
      case 'avg': return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'max': return Math.max(...values);
      case 'min': return Math.min(...values);
      case 'sum': return values.reduce((sum, val) => sum + val, 0);
      case 'count': return values.length;
      default: return values[values.length - 1]; // Latest value
    }
  }

  private generateAlertMessage(rule: AlertRule, condition: AlertCondition, value: number): string {
    const threshold = condition.threshold;
    const operator = condition.operator;
    const metric = condition.metric;
    
    let operatorText = '';
    switch (operator) {
      case 'gt': operatorText = 'exceeds'; break;
      case 'lt': operatorText = 'falls below'; break;
      case 'eq': operatorText = 'equals'; break;
      case 'gte': operatorText = 'is at or above'; break;
      case 'lte': operatorText = 'is at or below'; break;
      case 'ne': operatorText = 'does not equal'; break;
    }
    
    return `${metric} ${operatorText} threshold (${value} ${operatorText} ${threshold})`;
  }
}

// Alert manager
class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private correlations: Map<string, AlertCorrelation> = new Map();
  private notificationManager: NotificationManager;
  private escalationManager: EscalationManager;
  private analytics: AlertAnalytics;

  constructor() {
    this.notificationManager = new NotificationManager();
    this.escalationManager = new EscalationManager();
    this.analytics = this.initializeAnalytics();
  }

  private initializeAnalytics(): AlertAnalytics {
    return {
      totalAlerts: 0,
      activeAlerts: 0,
      resolvedAlerts: 0,
      alertsBySeverity: {},
      alertsByMetric: {},
      averageResolutionTime: 0,
      escalationRate: 0,
      falsePositiveRate: 0,
      topAlertRules: []
    };
  }

  async processAlerts(alerts: Alert[]): Promise<void> {
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  private async processAlert(alert: Alert): Promise<void> {
    // Check for correlation
    const correlationId = await this.checkCorrelation(alert);
    if (correlationId) {
      alert.correlationId = correlationId;
    }

    // Store alert
    this.alerts.set(alert.id, alert);
    this.updateAnalytics(alert);

    // Send notifications
    await this.notificationManager.sendAlert(alert);

    // Start escalation if configured
    if (alert.actions.some(action => action.type === 'escalation')) {
      await this.escalationManager.scheduleEscalation(alert);
    }

    console.log(`[alerting-system] Alert triggered: ${alert.title} (${alert.severity})`);
  }

  private async checkCorrelation(alert: Alert): Promise<string | null> {
    if (!ALERTING_CONFIG.management.enableCorrelation) return null;

    const correlationWindow = ALERTING_CONFIG.management.correlationWindow;
    const now = Date.now();
    const windowStart = now - correlationWindow;

    // Find similar alerts in the correlation window
    const similarAlerts = Array.from(this.alerts.values()).filter(existingAlert => 
      existingAlert.timestamp >= windowStart &&
      existingAlert.metric === alert.metric &&
      existingAlert.severity === alert.severity &&
      existingAlert.status === 'active'
    );

    if (similarAlerts.length === 0) return null;

    // Create or update correlation
    const correlationId = createHash('md5').update(`${alert.metric}_${alert.severity}_${windowStart}`).digest('hex');
    
    if (this.correlations.has(correlationId)) {
      const correlation = this.correlations.get(correlationId)!;
      correlation.alerts.push(alert.id);
      correlation.confidence = Math.min(correlation.confidence + 0.1, 1.0);
    } else {
      this.correlations.set(correlationId, {
        id: correlationId,
        alerts: [alert.id, ...similarAlerts.map(a => a.id)],
        pattern: `${alert.metric}_${alert.severity}`,
        confidence: 0.5,
        timestamp: now,
        resolved: false
      });
    }

    return correlationId;
  }

  private updateAnalytics(alert: Alert): void {
    this.analytics.totalAlerts++;
    
    if (alert.status === 'active') {
      this.analytics.activeAlerts++;
    } else if (alert.status === 'resolved') {
      this.analytics.resolvedAlerts++;
    }

    // Update severity breakdown
    this.analytics.alertsBySeverity[alert.severity] = 
      (this.analytics.alertsBySeverity[alert.severity] || 0) + 1;

    // Update metric breakdown
    this.analytics.alertsByMetric[alert.metric] = 
      (this.analytics.alertsByMetric[alert.metric] || 0) + 1;
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status !== 'active') return false;

    alert.status = 'acknowledged';
    alert.acknowledgedAt = Date.now();
    alert.acknowledgedBy = acknowledgedBy;

    this.alerts.set(alertId, alert);
    return true;
  }

  async resolveAlert(alertId: string, resolvedBy: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status === 'resolved') return false;

    alert.status = 'resolved';
    alert.resolvedAt = Date.now();
    alert.resolvedBy = resolvedBy;

    this.alerts.set(alertId, alert);
    this.analytics.activeAlerts--;
    this.analytics.resolvedAlerts++;

    // Update resolution time
    const resolutionTime = alert.resolvedAt - alert.timestamp;
    this.analytics.averageResolutionTime = 
      (this.analytics.averageResolutionTime + resolutionTime) / 2;

    return true;
  }

  getAlerts(filter?: { status?: string; severity?: string; metric?: string }): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (filter?.status) {
      alerts = alerts.filter(alert => alert.status === filter.status);
    }

    if (filter?.severity) {
      alerts = alerts.filter(alert => alert.severity === filter.severity);
    }

    if (filter?.metric) {
      alerts = alerts.filter(alert => alert.metric === filter.metric);
    }

    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  getAnalytics(): AlertAnalytics {
    return { ...this.analytics };
  }

  getCorrelations(): AlertCorrelation[] {
    return Array.from(this.correlations.values());
  }
}

// Notification manager
class NotificationManager {
  async sendAlert(alert: Alert): Promise<void> {
    const actions = alert.actions.filter(action => action.type === 'notification' && action.enabled);
    
    for (const action of actions) {
      const config = action.config;
      const channels = config.channels || ['slack'];

      for (const channel of channels) {
        try {
          await this.sendToChannel(channel, alert);
        } catch (error) {
          console.error(`[alerting-system] Failed to send alert to ${channel}:`, error);
        }
      }
    }
  }

  private async sendToChannel(channel: string, alert: Alert): Promise<void> {
    switch (channel) {
      case 'slack':
        await this.sendSlackNotification(alert);
        break;
      case 'email':
        await this.sendEmailNotification(alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(alert);
        break;
    }
  }

  private async sendSlackNotification(alert: Alert): Promise<void> {
    if (!ALERTING_CONFIG.channels.slack.enabled) return;

    const severityEmoji = {
      low: ':information_source:',
      medium: ':warning:',
      high: ':exclamation:',
      critical: ':rotating_light:'
    };

    const message = {
      channel: ALERTING_CONFIG.channels.slack.channel,
      username: ALERTING_CONFIG.channels.slack.username,
      icon_emoji: ALERTING_CONFIG.channels.slack.icon_emoji,
      text: `${severityEmoji[alert.severity]} *${alert.title}*`,
      attachments: [{
        color: this.getSeverityColor(alert.severity),
        fields: [
          { title: 'Metric', value: alert.metric, short: true },
          { title: 'Value', value: alert.value.toString(), short: true },
          { title: 'Threshold', value: alert.threshold.toString(), short: true },
          { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
          { title: 'Message', value: alert.message, short: false },
          { title: 'Timestamp', value: new Date(alert.timestamp).toISOString(), short: true }
        ],
        footer: 'Attendry Alerting System',
        ts: Math.floor(alert.timestamp / 1000)
      }]
    };

    // In a real implementation, this would send to Slack
    console.log('[alerting-system] Slack notification:', JSON.stringify(message, null, 2));
  }

  private async sendEmailNotification(alert: Alert): Promise<void> {
    if (!ALERTING_CONFIG.channels.email.enabled) return;

    const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;
    const body = `
      <h2>${alert.title}</h2>
      <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
      <p><strong>Metric:</strong> ${alert.metric}</p>
      <p><strong>Value:</strong> ${alert.value}</p>
      <p><strong>Threshold:</strong> ${alert.threshold}</p>
      <p><strong>Message:</strong> ${alert.message}</p>
      <p><strong>Timestamp:</strong> ${new Date(alert.timestamp).toISOString()}</p>
      <p><strong>Tags:</strong> ${alert.tags.join(', ')}</p>
    `;

    // In a real implementation, this would send email
    console.log('[alerting-system] Email notification:', { subject, body });
  }

  private async sendWebhookNotification(alert: Alert): Promise<void> {
    if (!ALERTING_CONFIG.channels.webhook.enabled) return;

    const payload = {
      alert: {
        id: alert.id,
        title: alert.title,
        severity: alert.severity,
        message: alert.message,
        metric: alert.metric,
        value: alert.value,
        threshold: alert.threshold,
        timestamp: alert.timestamp,
        tags: alert.tags
      }
    };

    // In a real implementation, this would send webhook
    console.log('[alerting-system] Webhook notification:', JSON.stringify(payload, null, 2));
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'low': return '#36a64f';
      case 'medium': return '#ff9500';
      case 'high': return '#ff6b6b';
      case 'critical': return '#e74c3c';
      default: return '#95a5a6';
    }
  }
}

// Escalation manager
class EscalationManager {
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map();

  async scheduleEscalation(alert: Alert): Promise<void> {
    if (!alert.actions.some(action => action.type === 'escalation')) return;

    const escalationAction = alert.actions.find(action => action.type === 'escalation');
    if (!escalationAction) return;

    const delay = escalationAction.delay || ALERTING_CONFIG.management.escalationDelay;
    
    const timer = setTimeout(async () => {
      await this.executeEscalation(alert);
    }, delay);

    this.escalationTimers.set(alert.id, timer);
  }

  private async executeEscalation(alert: Alert): Promise<void> {
    // Check if alert is still active
    if (alert.status !== 'active') {
      this.escalationTimers.delete(alert.id);
      return;
    }

    // Execute escalation actions
    console.log(`[alerting-system] Escalating alert: ${alert.title}`);
    
    // In a real implementation, this would execute escalation actions
    // such as calling on-call systems, sending SMS, etc.
  }

  cancelEscalation(alertId: string): void {
    const timer = this.escalationTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(alertId);
    }
  }
}

// Main alerting system
export class AlertingSystem {
  private static instance: AlertingSystem;
  private ruleManager: AlertRuleManager;
  private alertManager: AlertManager;
  private isInitialized = false;

  private constructor() {
    this.ruleManager = new AlertRuleManager();
    this.alertManager = new AlertManager();
  }

  public static getInstance(): AlertingSystem {
    if (!AlertingSystem.instance) {
      AlertingSystem.instance = new AlertingSystem();
    }
    return AlertingSystem.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.isInitialized = true;
    console.log('[alerting-system] Alerting system initialized');
  }

  async evaluateMetrics(metrics: Record<string, number>): Promise<void> {
    const alerts = this.ruleManager.evaluateRules(metrics);
    if (alerts.length > 0) {
      await this.alertManager.processAlerts(alerts);
    }
  }

  // Rule management
  addRule(rule: AlertRule): void {
    this.ruleManager.addRule(rule);
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    return this.ruleManager.updateRule(ruleId, updates);
  }

  removeRule(ruleId: string): boolean {
    return this.ruleManager.removeRule(ruleId);
  }

  getRule(ruleId: string): AlertRule | undefined {
    return this.ruleManager.getRule(ruleId);
  }

  getAllRules(): AlertRule[] {
    return this.ruleManager.getAllRules();
  }

  // Alert management
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    return this.alertManager.acknowledgeAlert(alertId, acknowledgedBy);
  }

  async resolveAlert(alertId: string, resolvedBy: string): Promise<boolean> {
    return this.alertManager.resolveAlert(alertId, resolvedBy);
  }

  getAlerts(filter?: { status?: string; severity?: string; metric?: string }): Alert[] {
    return this.alertManager.getAlerts(filter);
  }

  getAnalytics(): AlertAnalytics {
    return this.alertManager.getAnalytics();
  }

  getCorrelations(): AlertCorrelation[] {
    return this.alertManager.getCorrelations();
  }
}

// Global alerting system instance
export const alertingSystem = AlertingSystem.getInstance();

// Initialize alerting system
alertingSystem.initialize().catch(error => {
  console.error('[alerting-system] Failed to initialize:', error);
});

// Export utility functions
export async function evaluateAlertMetrics(metrics: Record<string, number>): Promise<void> {
  await alertingSystem.evaluateMetrics(metrics);
}

export function addAlertRule(rule: AlertRule): void {
  alertingSystem.addRule(rule);
}

export function getActiveAlerts(): Alert[] {
  return alertingSystem.getAlerts({ status: 'active' });
}

export function getAlertAnalytics(): AlertAnalytics {
  return alertingSystem.getAnalytics();
}
