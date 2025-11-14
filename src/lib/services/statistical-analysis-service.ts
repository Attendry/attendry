/**
 * Statistical Analysis Service
 * 
 * Provides statistical significance testing and confidence interval calculations
 * for trend analysis. Helps distinguish real trends from noise.
 * 
 * Phase 1A Implementation: Statistical Significance Testing
 */

export interface SignificanceResult {
  pValue: number;
  isSignificant: boolean;
  confidenceLevel: number; // 0.90, 0.95, 0.99
  testType: 'chi-square' | 't-test' | 'proportion';
  degreesOfFreedom?: number;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidenceLevel: number;
  mean: number;
}

export interface TrendSignificance {
  significance: SignificanceResult;
  confidenceInterval: ConfidenceInterval;
  significanceScore: number; // 0-1, higher = more significant
  recommendation: 'strong' | 'moderate' | 'weak' | 'insufficient-data';
}

/**
 * Calculate statistical significance for trend growth
 * Compares current period vs previous period
 */
export function calculateTrendSignificance(
  currentCount: number,
  previousCount: number,
  currentTotal: number,
  previousTotal: number,
  confidenceLevel: number = 0.95
): TrendSignificance | null {
  // Need minimum data for significance testing
  if (currentTotal < 10 || previousTotal < 10) {
    return null;
  }

  // Calculate proportions
  const currentProportion = currentCount / currentTotal;
  const previousProportion = previousCount / previousTotal;

  // Use chi-square test for categorical data (trend presence/absence)
  const significance = chiSquareTest(
    currentCount,
    previousCount,
    currentTotal - currentCount,
    previousTotal - previousCount,
    confidenceLevel
  );

  // Calculate confidence interval for growth rate
  const growthRate = previousCount > 0
    ? ((currentCount - previousCount) / previousCount) * 100
    : currentCount > 0 ? 100 : 0;

  const confidenceInterval = calculateProportionConfidenceInterval(
    currentProportion,
    currentTotal,
    confidenceLevel
  );

  // Calculate significance score (0-1)
  // Higher p-value = lower significance, so we invert it
  const significanceScore = Math.max(0, 1 - significance.pValue);

  // Determine recommendation
  let recommendation: 'strong' | 'moderate' | 'weak' | 'insufficient-data';
  if (significance.pValue < 0.01) {
    recommendation = 'strong';
  } else if (significance.pValue < 0.05) {
    recommendation = 'moderate';
  } else if (significance.pValue < 0.10) {
    recommendation = 'weak';
  } else {
    recommendation = 'insufficient-data';
  }

  return {
    significance,
    confidenceInterval: {
      lower: confidenceInterval.lower * 100,
      upper: confidenceInterval.upper * 100,
      confidenceLevel,
      mean: growthRate
    },
    significanceScore,
    recommendation
  };
}

/**
 * Chi-square test for independence
 * Tests if there's a significant difference between two proportions
 */
function chiSquareTest(
  observed1: number,
  observed2: number,
  notObserved1: number,
  notObserved2: number,
  confidenceLevel: number = 0.95
): SignificanceResult {
  const total1 = observed1 + notObserved1;
  const total2 = observed2 + notObserved2;
  const grandTotal = total1 + total2;

  if (grandTotal === 0) {
    return {
      pValue: 1,
      isSignificant: false,
      confidenceLevel,
      testType: 'chi-square',
      degreesOfFreedom: 1
    };
  }

  // Calculate expected frequencies
  const expected1 = (total1 * (observed1 + observed2)) / grandTotal;
  const expected2 = (total2 * (observed1 + observed2)) / grandTotal;
  const expectedNot1 = (total1 * (notObserved1 + notObserved2)) / grandTotal;
  const expectedNot2 = (total2 * (notObserved1 + notObserved2)) / grandTotal;

  // Calculate chi-square statistic
  const chiSquare = 
    Math.pow(observed1 - expected1, 2) / expected1 +
    Math.pow(observed2 - expected2, 2) / expected2 +
    Math.pow(notObserved1 - expectedNot1, 2) / expectedNot1 +
    Math.pow(notObserved2 - expectedNot2, 2) / expectedNot2;

  // Degrees of freedom for 2x2 contingency table
  const degreesOfFreedom = 1;

  // Calculate p-value using chi-square distribution approximation
  // Using simplified approximation for chi-square distribution
  const pValue = approximateChiSquarePValue(chiSquare, degreesOfFreedom);

  // Critical value for chi-square (for 1 degree of freedom)
  const criticalValue = getChiSquareCriticalValue(degreesOfFreedom, confidenceLevel);

  const isSignificant = chiSquare > criticalValue;

  return {
    pValue,
    isSignificant,
    confidenceLevel,
    testType: 'chi-square',
    degreesOfFreedom
  };
}

/**
 * Approximate p-value for chi-square distribution
 * Simplified approximation - for production, consider using a proper statistical library
 */
function approximateChiSquarePValue(chiSquare: number, df: number): number {
  // For df=1, use normal approximation: sqrt(chiSquare) ~ N(0,1)
  if (df === 1) {
    const z = Math.sqrt(chiSquare);
    // Two-tailed p-value approximation
    return 2 * (1 - normalCDF(Math.abs(z)));
  }

  // For other df, use approximation
  // This is a simplified version - consider using proper library for production
  const normalized = (chiSquare - df) / Math.sqrt(2 * df);
  return 2 * (1 - normalCDF(Math.abs(normalized)));
}

/**
 * Normal cumulative distribution function (CDF) approximation
 * Using error function approximation
 */
function normalCDF(x: number): number {
  // Abramowitz and Stegun approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Get critical value for chi-square distribution
 * For df=1 and common confidence levels
 */
function getChiSquareCriticalValue(df: number, confidenceLevel: number): number {
  // Critical values for chi-square distribution (df=1)
  const criticalValues: Record<number, number> = {
    0.90: 2.706,
    0.95: 3.841,
    0.99: 6.635
  };

  return criticalValues[confidenceLevel] || 3.841;
}

/**
 * Calculate confidence interval for a proportion
 */
function calculateProportionConfidenceInterval(
  proportion: number,
  sampleSize: number,
  confidenceLevel: number = 0.95
): ConfidenceInterval {
  if (sampleSize === 0) {
    return {
      lower: 0,
      upper: 0,
      confidenceLevel,
      mean: 0
    };
  }

  // Z-score for confidence level
  const zScores: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576
  };
  const z = zScores[confidenceLevel] || 1.96;

  // Standard error
  const standardError = Math.sqrt((proportion * (1 - proportion)) / sampleSize);

  // Margin of error
  const marginOfError = z * standardError;

  return {
    lower: Math.max(0, proportion - marginOfError),
    upper: Math.min(1, proportion + marginOfError),
    confidenceLevel,
    mean: proportion
  };
}

/**
 * Calculate confidence interval for growth rate
 */
export function calculateGrowthRateConfidenceInterval(
  currentCount: number,
  previousCount: number,
  confidenceLevel: number = 0.95
): ConfidenceInterval | null {
  if (previousCount === 0) {
    return null;
  }

  const growthRate = ((currentCount - previousCount) / previousCount) * 100;

  // Approximate standard error for growth rate
  // Using log transformation for better approximation
  const logGrowth = Math.log(currentCount / previousCount);
  const standardError = Math.sqrt((1 / currentCount) + (1 / previousCount));

  // Z-score
  const zScores: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576
  };
  const z = zScores[confidenceLevel] || 1.96;

  const marginOfError = z * standardError * 100;

  return {
    lower: growthRate - marginOfError,
    upper: growthRate + marginOfError,
    confidenceLevel,
    mean: growthRate
  };
}

/**
 * Filter trends by statistical significance
 * Returns only trends that meet the significance threshold
 */
export function filterSignificantTrends<T extends { growth: number; count: number }>(
  trends: T[],
  previousTrends: Map<string, { count: number; total: number }>,
  currentTotal: number,
  significanceThreshold: number = 0.05
): Array<T & { significance: TrendSignificance }> {
  const significantTrends: Array<T & { significance: TrendSignificance }> = [];

  for (const trend of trends) {
    const previous = previousTrends.get(trend.name || '');
    if (!previous) {
      // New trend - consider it significant if count is high enough
      if (trend.count >= 3) {
        // Create a significance result for new trends
        const significance: TrendSignificance = {
          significance: {
            pValue: 0.01, // New trends get high significance
            isSignificant: true,
            confidenceLevel: 0.95,
            testType: 'proportion'
          },
          confidenceInterval: {
            lower: trend.growth,
            upper: trend.growth,
            confidenceLevel: 0.95,
            mean: trend.growth
          },
          significanceScore: 0.9,
          recommendation: 'strong'
        };
        significantTrends.push({ ...trend, significance });
      }
      continue;
    }

    const significanceResult = calculateTrendSignificance(
      trend.count,
      previous.count,
      currentTotal,
      previous.total
    );

    if (significanceResult && significanceResult.significance.pValue <= significanceThreshold) {
      significantTrends.push({ ...trend, significance: significanceResult });
    }
  }

  return significantTrends;
}

/**
 * Calculate sample size needed for statistical significance
 * Useful for determining if we have enough data
 */
export function calculateRequiredSampleSize(
  expectedProportion: number,
  marginOfError: number,
  confidenceLevel: number = 0.95
): number {
  const zScores: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576
  };
  const z = zScores[confidenceLevel] || 1.96;

  const n = (z * z * expectedProportion * (1 - expectedProportion)) / (marginOfError * marginOfError);
  return Math.ceil(n);
}

