/**
 * Token Budget Service
 * 
 * Manages token usage and budgeting for Gemini API calls to control costs
 * and prevent exceeding API limits.
 */

export interface TokenBudget {
  dailyLimit: number;
  hourlyLimit: number;
  used: number;
  hourlyUsed: number;
  lastReset: Date;
  lastHourlyReset: Date;
}

export interface TokenUsage {
  estimated: number;
  actual: number;
  timestamp: Date;
  operation: string;
  service: string;
}

export interface BudgetStatus {
  canSpend: boolean;
  remainingDaily: number;
  remainingHourly: number;
  usagePercentage: number;
  nextReset: Date;
}

/**
 * Token Budget Service Class
 */
export class TokenBudgetService {
  private static budget: TokenBudget = {
    dailyLimit: 100000, // 100k tokens per day
    hourlyLimit: 10000, // 10k tokens per hour
    used: 0,
    hourlyUsed: 0,
    lastReset: new Date(),
    lastHourlyReset: new Date()
  };

  private static usageHistory: TokenUsage[] = [];
  private static readonly MAX_HISTORY = 1000;

  /**
   * Check if we can spend the estimated number of tokens
   */
  static canSpend(estimatedTokens: number): boolean {
    this.resetIfNeeded();
    
    return this.budget.used + estimatedTokens <= this.budget.dailyLimit &&
           this.budget.hourlyUsed + estimatedTokens <= this.budget.hourlyLimit;
  }

  /**
   * Record actual token usage
   */
  static recordUsage(
    actualTokens: number,
    operation: string,
    service: string = 'gemini'
  ): void {
    this.resetIfNeeded();
    
    this.budget.used += actualTokens;
    this.budget.hourlyUsed += actualTokens;
    
    // Record usage history
    this.usageHistory.push({
      estimated: 0, // We don't have estimated for actual usage
      actual: actualTokens,
      timestamp: new Date(),
      operation,
      service
    });
    
    // Trim history if too long
    if (this.usageHistory.length > this.MAX_HISTORY) {
      this.usageHistory = this.usageHistory.slice(-this.MAX_HISTORY);
    }
    
    console.log(`Token usage recorded: ${actualTokens} tokens for ${operation} (${service}). Daily: ${this.budget.used}/${this.budget.dailyLimit}, Hourly: ${this.budget.hourlyUsed}/${this.budget.hourlyLimit}`);
  }

  /**
   * Record estimated token usage (for planning)
   */
  static recordEstimate(
    estimatedTokens: number,
    operation: string,
    service: string = 'gemini'
  ): void {
    this.usageHistory.push({
      estimated: estimatedTokens,
      actual: 0, // We don't have actual yet
      timestamp: new Date(),
      operation,
      service
    });
    
    // Trim history if too long
    if (this.usageHistory.length > this.MAX_HISTORY) {
      this.usageHistory = this.usageHistory.slice(-this.MAX_HISTORY);
    }
  }

  /**
   * Get current budget status
   */
  static getBudgetStatus(): BudgetStatus {
    this.resetIfNeeded();
    
    const remainingDaily = Math.max(0, this.budget.dailyLimit - this.budget.used);
    const remainingHourly = Math.max(0, this.budget.hourlyLimit - this.budget.hourlyUsed);
    const usagePercentage = (this.budget.used / this.budget.dailyLimit) * 100;
    
    // Calculate next reset time
    const now = new Date();
    const nextDailyReset = new Date(now);
    nextDailyReset.setDate(nextDailyReset.getDate() + 1);
    nextDailyReset.setHours(0, 0, 0, 0);
    
    const nextHourlyReset = new Date(now);
    nextHourlyReset.setHours(nextHourlyReset.getHours() + 1, 0, 0, 0);
    
    const nextReset = nextDailyReset < nextHourlyReset ? nextDailyReset : nextHourlyReset;
    
    return {
      canSpend: remainingDaily > 0 && remainingHourly > 0,
      remainingDaily,
      remainingHourly,
      usagePercentage,
      nextReset
    };
  }

  /**
   * Get usage statistics
   */
  static getUsageStats(): {
    totalUsed: number;
    dailyUsed: number;
    hourlyUsed: number;
    averagePerHour: number;
    topOperations: Array<{ operation: string; tokens: number; count: number }>;
    recentUsage: TokenUsage[];
  } {
    this.resetIfNeeded();
    
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Calculate averages
    const recentUsage = this.usageHistory.filter(usage => 
      usage.timestamp >= last24Hours
    );
    
    const totalUsed = recentUsage.reduce((sum, usage) => sum + usage.actual, 0);
    const hourlyUsage = recentUsage.filter(usage => 
      usage.timestamp >= lastHour
    );
    const hourlyUsed = hourlyUsage.reduce((sum, usage) => sum + usage.actual, 0);
    
    const averagePerHour = recentUsage.length > 0 ? totalUsed / 24 : 0;
    
    // Top operations
    const operationStats = new Map<string, { tokens: number; count: number }>();
    for (const usage of recentUsage) {
      if (usage.actual > 0) {
        const existing = operationStats.get(usage.operation) || { tokens: 0, count: 0 };
        operationStats.set(usage.operation, {
          tokens: existing.tokens + usage.actual,
          count: existing.count + 1
        });
      }
    }
    
    const topOperations = Array.from(operationStats.entries())
      .map(([operation, stats]) => ({ operation, ...stats }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10);
    
    return {
      totalUsed,
      dailyUsed: this.budget.used,
      hourlyUsed: this.budget.hourlyUsed,
      averagePerHour,
      topOperations,
      recentUsage: recentUsage.slice(-50) // Last 50 usage records
    };
  }

  /**
   * Set budget limits (for configuration)
   */
  static setLimits(dailyLimit: number, hourlyLimit: number): void {
    this.budget.dailyLimit = dailyLimit;
    this.budget.hourlyLimit = hourlyLimit;
    
    console.log(`Token budget limits updated: Daily: ${dailyLimit}, Hourly: ${hourlyLimit}`);
  }

  /**
   * Reset budget (for testing or manual reset)
   */
  static resetBudget(): void {
    this.budget.used = 0;
    this.budget.hourlyUsed = 0;
    this.budget.lastReset = new Date();
    this.budget.lastHourlyReset = new Date();
    
    console.log('Token budget reset');
  }

  /**
   * Estimate token usage for a prompt
   */
  static estimateTokenUsage(prompt: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    // This is a simplified estimation - actual tokenization may vary
    const estimatedTokens = Math.ceil(prompt.length / 4);
    
    // Add some buffer for response tokens (typically 1.5x input)
    return Math.ceil(estimatedTokens * 2.5);
  }

  /**
   * Check if we should use fallback processing due to budget constraints
   */
  static shouldUseFallback(estimatedTokens: number): boolean {
    const status = this.getBudgetStatus();
    
    // Use fallback if we're over 80% of daily limit or can't afford the operation
    return status.usagePercentage > 80 || !this.canSpend(estimatedTokens);
  }

  /**
   * Get fallback recommendation
   */
  static getFallbackRecommendation(estimatedTokens: number): {
    useFallback: boolean;
    reason: string;
    alternative: string;
  } {
    const status = this.getBudgetStatus();
    
    if (!this.canSpend(estimatedTokens)) {
      return {
        useFallback: true,
        reason: 'Insufficient token budget',
        alternative: 'Use cached results or simplified processing'
      };
    }
    
    if (status.usagePercentage > 90) {
      return {
        useFallback: true,
        reason: 'Near daily limit (90%+)',
        alternative: 'Use cached results or wait for reset'
      };
    }
    
    if (status.usagePercentage > 80) {
      return {
        useFallback: false,
        reason: 'High usage but within limits',
        alternative: 'Consider using cached results for non-critical operations'
      };
    }
    
    return {
      useFallback: false,
      reason: 'Within normal usage limits',
      alternative: 'Proceed with normal processing'
    };
  }

  /**
   * Reset budget if needed (daily and hourly)
   */
  private static resetIfNeeded(): void {
    const now = new Date();
    
    // Reset daily budget if needed
    if (now.getDate() !== this.budget.lastReset.getDate()) {
      this.budget.used = 0;
      this.budget.lastReset = now;
      console.log('Daily token budget reset');
    }
    
    // Reset hourly budget if needed
    if (now.getHours() !== this.budget.lastHourlyReset.getHours()) {
      this.budget.hourlyUsed = 0;
      this.budget.lastHourlyReset = now;
      console.log('Hourly token budget reset');
    }
  }

  /**
   * Get service health status
   */
  static getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    budgetStatus: BudgetStatus;
    lastError?: string;
  } {
    try {
      const budgetStatus = this.getBudgetStatus();
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (budgetStatus.usagePercentage > 95) {
        status = 'unhealthy';
      } else if (budgetStatus.usagePercentage > 80) {
        status = 'degraded';
      }
      
      return {
        status,
        budgetStatus
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        budgetStatus: this.getBudgetStatus(),
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
