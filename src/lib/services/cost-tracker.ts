/**
 * Comprehensive Cost Tracker Service
 * 
 * Tracks costs for all API calls (Firecrawl, Gemini, Google CSE, etc.)
 * Extends existing cost tracking infrastructure with per-call granularity.
 * 
 * Features:
 * - Per-call cost tracking
 * - Per-user and per-feature attribution
 * - Cache savings tracking
 * - Budget alerts
 * - Cost summaries and analytics
 * 
 * Builds on:
 * - discovery_cost_tracking (existing)
 * - LLMBudgetManager (existing)
 * - CostOptimizationService (existing)
 */

import { supabaseServer } from '@/lib/supabase-server';

export type ServiceType = 'firecrawl' | 'gemini' | 'google_cse' | 'linkedin' | 'email_discovery' | 'other';
export type FeatureType = 
  | 'speaker_enrichment' 
  | 'event_search' 
  | 'contact_research' 
  | 'event_discovery'
  | 'speaker_extraction'
  | 'intelligence_generation'
  | 'other';

export interface APICostRecord {
  userId?: string;
  service: ServiceType;
  feature?: FeatureType;
  costUsd: number;
  tokensUsed?: number;
  apiCalls?: number;
  cacheHit?: boolean;
  cacheSavingsUsd?: number;
  metadata?: Record<string, any>;
}

export interface CostSummary {
  totalCostUsd: number;
  totalCalls: number;
  cacheHits: number;
  cacheSavingsUsd: number;
  cacheHitRate: number;
  byService: Record<ServiceType, {
    cost: number;
    calls: number;
  }>;
  byFeature: Record<string, {
    cost: number;
    calls: number;
  }>;
}

export interface BudgetAlert {
  budgetType: 'monthly' | 'daily' | 'per_feature';
  budgetLimitUsd: number;
  currentSpendUsd: number;
  percentageUsed: number;
  alertSent: boolean;
}

// Service pricing (cost per API call or per token)
// These are estimates - update based on actual pricing
const SERVICE_PRICING: Record<ServiceType, {
  costPerCall?: number;
  costPerToken?: { input: number; output: number };
  costPer1kTokens?: { input: number; output: number };
}> = {
  firecrawl: {
    costPerCall: 0.001, // $0.001 per search call
  },
  gemini: {
    costPer1kTokens: { input: 0.000075, output: 0.0003 }, // gemini-2.5-flash pricing
  },
  google_cse: {
    costPerCall: 0.0005, // $0.0005 per search (100 free/day, then $5 per 1000)
  },
  linkedin: {
    costPerCall: 0.01, // Estimated
  },
  email_discovery: {
    costPerCall: 0.005, // Estimated
  },
  other: {
    costPerCall: 0.001, // Default
  },
};

/**
 * Calculate cost for an API call
 */
export function calculateAPICost(
  service: ServiceType,
  options: {
    tokensUsed?: number;
    inputTokens?: number;
    outputTokens?: number;
    calls?: number;
  } = {}
): number {
  const pricing = SERVICE_PRICING[service] || SERVICE_PRICING.other;
  let cost = 0;

  // Calculate based on tokens (for LLM services)
  if (options.tokensUsed && pricing.costPer1kTokens) {
    // Assume 80% input, 20% output if not specified
    const inputTokens = options.inputTokens || (options.tokensUsed * 0.8);
    const outputTokens = options.outputTokens || (options.tokensUsed * 0.2);
    
    cost += (inputTokens / 1000) * pricing.costPer1kTokens.input;
    cost += (outputTokens / 1000) * pricing.costPer1kTokens.output;
  } else if (options.inputTokens && options.outputTokens && pricing.costPer1kTokens) {
    cost += (options.inputTokens / 1000) * pricing.costPer1kTokens.input;
    cost += (options.outputTokens / 1000) * pricing.costPer1kTokens.output;
  }

  // Calculate based on calls
  if (pricing.costPerCall) {
    const calls = options.calls || 1;
    cost += calls * pricing.costPerCall;
  }

  return Math.max(0, cost);
}

/**
 * Cost Tracker Service
 */
export class CostTracker {
  private static instance: CostTracker;

  private constructor() {}

  static getInstance(): CostTracker {
    if (!CostTracker.instance) {
      CostTracker.instance = new CostTracker();
    }
    return CostTracker.instance;
  }

  /**
   * Track an API call cost
   */
  async trackCost(record: APICostRecord): Promise<boolean> {
    try {
      const supabase = await supabaseServer();
      
      const { error } = await supabase
        .from('api_costs')
        .insert({
          user_id: record.userId || null,
          service: record.service,
          feature: record.feature || null,
          cost_usd: record.costUsd,
          tokens_used: record.tokensUsed || null,
          api_calls: record.apiCalls || 1,
          cache_hit: record.cacheHit || false,
          cache_savings_usd: record.cacheSavingsUsd || 0,
          metadata: record.metadata || {},
        });

      if (error) {
        console.error('[cost-tracker] Error tracking cost:', error);
        return false;
      }

      // Check budget alerts if user provided
      if (record.userId) {
        await this.checkBudgetAlerts(record.userId);
      }

      return true;
    } catch (error) {
      console.error('[cost-tracker] Exception tracking cost:', error);
      return false;
    }
  }

  /**
   * Track cost with automatic calculation
   */
  async trackAPICall(
    userId: string | undefined,
    service: ServiceType,
    feature: FeatureType | undefined,
    options: {
      tokensUsed?: number;
      inputTokens?: number;
      outputTokens?: number;
      calls?: number;
      cacheHit?: boolean;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<boolean> {
    const cost = calculateAPICost(service, options);
    
    // Calculate cache savings if cache hit
    const cacheSavings = options.cacheHit ? cost : 0;

    return this.trackCost({
      userId,
      service,
      feature,
      costUsd: cost,
      tokensUsed: options.tokensUsed,
      apiCalls: options.calls || 1,
      cacheHit: options.cacheHit || false,
      cacheSavingsUsd: cacheSavings,
      metadata: options.metadata,
    });
  }

  /**
   * Get cost summary for user
   */
  async getUserCostSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<CostSummary> {
    try {
      const supabase = await supabaseServer();
      
      let query = supabase
        .from('api_costs')
        .select('*')
        .eq('user_id', userId);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data: records, error } = await query;

      if (error || !records || records.length === 0) {
        return this.getEmptySummary();
      }

      return this.calculateSummary(records);
    } catch (error) {
      console.error('[cost-tracker] Error getting cost summary:', error);
      return this.getEmptySummary();
    }
  }

  /**
   * Get monthly cost for user
   */
  async getMonthlyCost(userId: string, month?: Date): Promise<number> {
    try {
      const supabase = await supabaseServer();
      const targetMonth = month || new Date();
      
      const { data, error } = await supabase.rpc('get_user_monthly_cost', {
        p_user_id: userId,
        p_month: targetMonth.toISOString().split('T')[0],
      });

      if (error) {
        console.error('[cost-tracker] Error getting monthly cost:', error);
        return 0;
      }

      return parseFloat(data || '0');
    } catch (error) {
      console.error('[cost-tracker] Exception getting monthly cost:', error);
      return 0;
    }
  }

  /**
   * Check and send budget alerts
   */
  async checkBudgetAlerts(userId: string): Promise<BudgetAlert[]> {
    try {
      const supabase = await supabaseServer();
      
      const { data, error } = await supabase.rpc('check_budget_alerts', {
        p_user_id: userId,
        p_month: new Date().toISOString().split('T')[0],
      });

      if (error) {
        console.error('[cost-tracker] Error checking budget alerts:', error);
        return [];
      }

      const alerts: BudgetAlert[] = (data || []).map((row: any) => ({
        budgetType: row.budget_type,
        budgetLimitUsd: parseFloat(row.budget_limit),
        currentSpendUsd: parseFloat(row.current_spend),
        percentageUsed: parseFloat(row.percentage_used),
        alertSent: row.alert_sent,
      }));

      // TODO: Send email notifications for alerts
      if (alerts.length > 0) {
        console.log(`[cost-tracker] Budget alerts triggered for user ${userId}:`, alerts);
        // await sendBudgetAlertEmail(userId, alerts);
      }

      return alerts;
    } catch (error) {
      console.error('[cost-tracker] Exception checking budget alerts:', error);
      return [];
    }
  }

  /**
   * Set budget for user
   */
  async setBudget(
    userId: string,
    budgetType: 'monthly' | 'daily' | 'per_feature',
    budgetLimitUsd: number,
    alertThreshold: number = 80
  ): Promise<boolean> {
    try {
      const supabase = await supabaseServer();
      
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const { error } = await supabase
        .from('budget_alerts')
        .upsert({
          user_id: userId,
          budget_type: budgetType,
          budget_limit_usd: budgetLimitUsd,
          alert_threshold: alertThreshold,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          updated_at: now.toISOString(),
        }, {
          onConflict: 'user_id,budget_type,period_start',
        });

      if (error) {
        console.error('[cost-tracker] Error setting budget:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[cost-tracker] Exception setting budget:', error);
      return false;
    }
  }

  /**
   * Get admin cost summary (all users)
   */
  async getAdminCostSummary(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalCostUsd: number;
    totalCalls: number;
    totalUsers: number;
    byService: Record<string, number>;
    byFeature: Record<string, number>;
    topUsers: Array<{ userId: string; cost: number }>;
  }> {
    try {
      const supabase = await supabaseServer();
      
      let query = supabase
        .from('api_costs')
        .select('user_id, service, feature, cost_usd');

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data: records, error } = await query;

      if (error || !records || records.length === 0) {
        return {
          totalCostUsd: 0,
          totalCalls: 0,
          totalUsers: 0,
          byService: {},
          byFeature: {},
          topUsers: [],
        };
      }

      const summary = {
        totalCostUsd: 0,
        totalCalls: records.length,
        totalUsers: new Set(records.map(r => r.user_id).filter(Boolean)).size,
        byService: {} as Record<string, number>,
        byFeature: {} as Record<string, number>,
        userCosts: {} as Record<string, number>,
      };

      records.forEach(record => {
        const cost = parseFloat(record.cost_usd || '0');
        summary.totalCostUsd += cost;

        // By service
        summary.byService[record.service] = (summary.byService[record.service] || 0) + cost;

        // By feature
        if (record.feature) {
          summary.byFeature[record.feature] = (summary.byFeature[record.feature] || 0) + cost;
        }

        // By user
        if (record.user_id) {
          summary.userCosts[record.user_id] = (summary.userCosts[record.user_id] || 0) + cost;
        }
      });

      // Top users
      const topUsers = Object.entries(summary.userCosts)
        .map(([userId, cost]) => ({ userId, cost }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10);

      return {
        totalCostUsd: summary.totalCostUsd,
        totalCalls: summary.totalCalls,
        totalUsers: summary.totalUsers,
        byService: summary.byService,
        byFeature: summary.byFeature,
        topUsers,
      };
    } catch (error) {
      console.error('[cost-tracker] Error getting admin cost summary:', error);
      return {
        totalCostUsd: 0,
        totalCalls: 0,
        totalUsers: 0,
        byService: {},
        byFeature: {},
        topUsers: [],
      };
    }
  }

  /**
   * Calculate summary from records
   */
  private calculateSummary(records: any[]): CostSummary {
    const summary: CostSummary = {
      totalCostUsd: 0,
      totalCalls: records.length,
      cacheHits: 0,
      cacheSavingsUsd: 0,
      cacheHitRate: 0,
      byService: {} as Record<ServiceType, { cost: number; calls: number }>,
      byFeature: {},
    };

    records.forEach(record => {
      const cost = parseFloat(record.cost_usd || '0');
      summary.totalCostUsd += cost;

      if (record.cache_hit) {
        summary.cacheHits++;
        summary.cacheSavingsUsd += parseFloat(record.cache_savings_usd || '0');
      }

      // By service
      const service = record.service as ServiceType;
      if (!summary.byService[service]) {
        summary.byService[service] = { cost: 0, calls: 0 };
      }
      summary.byService[service].cost += cost;
      summary.byService[service].calls += record.api_calls || 1;

      // By feature
      if (record.feature) {
        if (!summary.byFeature[record.feature]) {
          summary.byFeature[record.feature] = { cost: 0, calls: 0 };
        }
        summary.byFeature[record.feature].cost += cost;
        summary.byFeature[record.feature].calls += record.api_calls || 1;
      }
    });

    summary.cacheHitRate = summary.totalCalls > 0
      ? (summary.cacheHits / summary.totalCalls) * 100
      : 0;

    return summary;
  }

  /**
   * Get empty summary
   */
  private getEmptySummary(): CostSummary {
    return {
      totalCostUsd: 0,
      totalCalls: 0,
      cacheHits: 0,
      cacheSavingsUsd: 0,
      cacheHitRate: 0,
      byService: {} as Record<ServiceType, { cost: number; calls: number }>,
      byFeature: {},
    };
  }
}

/**
 * Get cost tracker instance
 */
export function getCostTracker(): CostTracker {
  return CostTracker.getInstance();
}

/**
 * Helper to track cost with automatic calculation
 */
export async function trackAPICost(
  userId: string | undefined,
  service: ServiceType,
  feature: FeatureType | undefined,
  options: {
    tokensUsed?: number;
    inputTokens?: number;
    outputTokens?: number;
    calls?: number;
    cacheHit?: boolean;
    metadata?: Record<string, any>;
  } = {}
): Promise<void> {
  const tracker = getCostTracker();
  await tracker.trackAPICall(userId, service, feature, options);
}

