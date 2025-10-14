/**
 * Evaluation Harness - CI-Gated Test Suite
 * 
 * Implements offline test set with gold queries and metrics computation
 */

export interface GoldQuery {
  id: string;
  query: string;
  intent: 'event' | 'speaker' | 'company' | 'topic';
  country: string;
  must_contain_domains: string[];
  must_not_contain_domains: string[];
  expected_topics: string[];
  freshness_days: number;
  expected_min_precision_k: number;
  expected_results_count: number;
}

export interface EvaluationResult {
  queryId: string;
  query: string;
  country: string;
  metrics: {
    precision_at_5: number;
    ndcg_at_10: number;
    localisation_accuracy: number;
    dedup_rate: number;
    mean_time_ms: number;
    cost_pence: number;
  };
  violations: {
    localisation: string[];
    domain_mismatches: string[];
    topic_mismatches: string[];
  };
  passed: boolean;
}

export interface EvaluationSummary {
  total_queries: number;
  passed_queries: number;
  failed_queries: number;
  overall_metrics: {
    precision_at_5: number;
    ndcg_at_10: number;
    localisation_accuracy: number;
    dedup_rate: number;
    mean_time_ms: number;
    cost_pence: number;
  };
  ci_status: 'PASS' | 'FAIL';
  failure_reasons: string[];
}

/**
 * Gold Test Dataset
 */
const GOLD_QUERIES: GoldQuery[] = [
  // German queries
  {
    id: 'de_001',
    query: 'legal conference',
    intent: 'event',
    country: 'DE',
    must_contain_domains: ['.de', 'germany', 'deutschland'],
    must_not_contain_domains: ['.fr', 'france', '.uk', 'britain'],
    expected_topics: ['legal', 'conference', 'law'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },
  {
    id: 'de_002',
    query: 'compliance summit',
    intent: 'event',
    country: 'DE',
    must_contain_domains: ['.de', 'germany', 'deutschland'],
    must_not_contain_domains: ['.fr', 'france', '.uk', 'britain'],
    expected_topics: ['compliance', 'summit', 'regulation'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },
  {
    id: 'de_003',
    query: 'GDPR workshop',
    intent: 'event',
    country: 'DE',
    must_contain_domains: ['.de', 'germany', 'deutschland'],
    must_not_contain_domains: ['.fr', 'france', '.uk', 'britain'],
    expected_topics: ['GDPR', 'privacy', 'data protection'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },
  {
    id: 'de_004',
    query: 'fintech event',
    intent: 'event',
    country: 'DE',
    must_contain_domains: ['.de', 'germany', 'deutschland'],
    must_not_contain_domains: ['.fr', 'france', '.uk', 'britain'],
    expected_topics: ['fintech', 'financial technology', 'banking'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },
  {
    id: 'de_005',
    query: 'cybersecurity conference',
    intent: 'event',
    country: 'DE',
    must_contain_domains: ['.de', 'germany', 'deutschland'],
    must_not_contain_domains: ['.fr', 'france', '.uk', 'britain'],
    expected_topics: ['cybersecurity', 'security', 'information security'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },

  // French queries
  {
    id: 'fr_001',
    query: 'legal conference',
    intent: 'event',
    country: 'FR',
    must_contain_domains: ['.fr', 'france', 'français'],
    must_not_contain_domains: ['.de', 'germany', 'deutschland'],
    expected_topics: ['legal', 'conference', 'law'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },
  {
    id: 'fr_002',
    query: 'compliance summit',
    intent: 'event',
    country: 'FR',
    must_contain_domains: ['.fr', 'france', 'français'],
    must_not_contain_domains: ['.de', 'germany', 'deutschland'],
    expected_topics: ['compliance', 'summit', 'regulation'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },
  {
    id: 'fr_003',
    query: 'GDPR workshop',
    intent: 'event',
    country: 'FR',
    must_contain_domains: ['.fr', 'france', 'français'],
    must_not_contain_domains: ['.de', 'germany', 'deutschland'],
    expected_topics: ['GDPR', 'privacy', 'data protection'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },
  {
    id: 'fr_004',
    query: 'fintech event',
    intent: 'event',
    country: 'FR',
    must_contain_domains: ['.fr', 'france', 'français'],
    must_not_contain_domains: ['.de', 'germany', 'deutschland'],
    expected_topics: ['fintech', 'financial technology', 'banking'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },
  {
    id: 'fr_005',
    query: 'cybersecurity conference',
    intent: 'event',
    country: 'FR',
    must_contain_domains: ['.fr', 'france', 'français'],
    must_not_contain_domains: ['.de', 'germany', 'deutschland'],
    expected_topics: ['cybersecurity', 'security', 'information security'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },

  // Dutch queries
  {
    id: 'nl_001',
    query: 'legal conference',
    intent: 'event',
    country: 'NL',
    must_contain_domains: ['.nl', 'netherlands', 'nederland'],
    must_not_contain_domains: ['.de', 'germany', '.fr', 'france'],
    expected_topics: ['legal', 'conference', 'law'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },
  {
    id: 'nl_002',
    query: 'compliance summit',
    intent: 'event',
    country: 'NL',
    must_contain_domains: ['.nl', 'netherlands', 'nederland'],
    must_not_contain_domains: ['.de', 'germany', '.fr', 'france'],
    expected_topics: ['compliance', 'summit', 'regulation'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },
  {
    id: 'nl_003',
    query: 'GDPR workshop',
    intent: 'event',
    country: 'NL',
    must_contain_domains: ['.nl', 'netherlands', 'nederland'],
    must_not_contain_domains: ['.de', 'germany', '.fr', 'france'],
    expected_topics: ['GDPR', 'privacy', 'data protection'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },
  {
    id: 'nl_004',
    query: 'fintech event',
    intent: 'event',
    country: 'NL',
    must_contain_domains: ['.nl', 'netherlands', 'nederland'],
    must_not_contain_domains: ['.de', 'germany', '.fr', 'france'],
    expected_topics: ['fintech', 'financial technology', 'banking'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },
  {
    id: 'nl_005',
    query: 'cybersecurity conference',
    intent: 'event',
    country: 'NL',
    must_contain_domains: ['.nl', 'netherlands', 'nederland'],
    must_not_contain_domains: ['.de', 'germany', '.fr', 'france'],
    expected_topics: ['cybersecurity', 'security', 'information security'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },

  // UK queries
  {
    id: 'gb_001',
    query: 'legal conference',
    intent: 'event',
    country: 'GB',
    must_contain_domains: ['.uk', '.co.uk', 'united kingdom', 'britain'],
    must_not_contain_domains: ['.de', 'germany', '.fr', 'france'],
    expected_topics: ['legal', 'conference', 'law'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },
  {
    id: 'gb_002',
    query: 'compliance summit',
    intent: 'event',
    country: 'GB',
    must_contain_domains: ['.uk', '.co.uk', 'united kingdom', 'britain'],
    must_not_contain_domains: ['.de', 'germany', '.fr', 'france'],
    expected_topics: ['compliance', 'summit', 'regulation'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },
  {
    id: 'gb_003',
    query: 'GDPR workshop',
    intent: 'event',
    country: 'GB',
    must_contain_domains: ['.uk', '.co.uk', 'united kingdom', 'britain'],
    must_not_contain_domains: ['.de', 'germany', '.fr', 'france'],
    expected_topics: ['GDPR', 'privacy', 'data protection'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },
  {
    id: 'gb_004',
    query: 'fintech event',
    intent: 'event',
    country: 'GB',
    must_contain_domains: ['.uk', '.co.uk', 'united kingdom', 'britain'],
    must_not_contain_domains: ['.de', 'germany', '.fr', 'france'],
    expected_topics: ['fintech', 'financial technology', 'banking'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  },
  {
    id: 'gb_005',
    query: 'cybersecurity conference',
    intent: 'event',
    country: 'GB',
    must_contain_domains: ['.uk', '.co.uk', 'united kingdom', 'britain'],
    must_not_contain_domains: ['.de', 'germany', '.fr', 'france'],
    expected_topics: ['cybersecurity', 'security', 'information security'],
    freshness_days: 30,
    expected_min_precision_k: 0.8,
    expected_results_count: 5
  }
];

/**
 * Evaluation Harness
 */
export class EvaluationHarness {
  private goldQueries: GoldQuery[];

  constructor(goldQueries: GoldQuery[] = GOLD_QUERIES) {
    this.goldQueries = goldQueries;
  }

  /**
   * Run evaluation on all gold queries
   */
  async runEvaluation(
    searchFunction: (query: string, country: string) => Promise<{
      results: Array<{ url: string; title: string; snippet: string; content?: string }>;
      metrics: { latencyMs: number; costPence: number };
    }>
  ): Promise<EvaluationSummary> {
    const results: EvaluationResult[] = [];
    const startTime = Date.now();

    console.log(`Running evaluation on ${this.goldQueries.length} gold queries...`);

    for (const goldQuery of this.goldQueries) {
      try {
        const result = await this.evaluateQuery(goldQuery, searchFunction);
        results.push(result);
        
        console.log(`Query ${goldQuery.id}: ${result.passed ? 'PASS' : 'FAIL'} (P@5: ${result.metrics.precision_at_5.toFixed(3)})`);
      } catch (error) {
        console.error(`Error evaluating query ${goldQuery.id}:`, error);
        results.push({
          queryId: goldQuery.id,
          query: goldQuery.query,
          country: goldQuery.country,
          metrics: {
            precision_at_5: 0,
            ndcg_at_10: 0,
            localisation_accuracy: 0,
            dedup_rate: 0,
            mean_time_ms: 0,
            cost_pence: 0
          },
          violations: {
            localisation: ['Evaluation error'],
            domain_mismatches: [],
            topic_mismatches: []
          },
          passed: false
        });
      }
    }

    const totalTime = Date.now() - startTime;
    return this.computeSummary(results, totalTime);
  }

  /**
   * Evaluate single query
   */
  private async evaluateQuery(
    goldQuery: GoldQuery,
    searchFunction: (query: string, country: string) => Promise<{
      results: Array<{ url: string; title: string; snippet: string; content?: string }>;
      metrics: { latencyMs: number; costPence: number };
    }>
  ): Promise<EvaluationResult> {
    const startTime = Date.now();
    
    // Execute search
    const searchResult = await searchFunction(goldQuery.query, goldQuery.country);
    const results = searchResult.results;
    const latencyMs = Date.now() - startTime;

    // Compute metrics
    const precisionAt5 = this.computePrecisionAtK(results, goldQuery, 5);
    const ndcgAt10 = this.computeNDCGAtK(results, goldQuery, 10);
    const localisationAccuracy = this.computeLocalisationAccuracy(results, goldQuery);
    const dedupRate = this.computeDedupRate(results);

    // Check violations
    const violations = this.checkViolations(results, goldQuery);

    // Determine if query passed
    const passed = precisionAt5 >= goldQuery.expected_min_precision_k &&
                   localisationAccuracy >= 0.99 &&
                   violations.localisation.length === 0;

    return {
      queryId: goldQuery.id,
      query: goldQuery.query,
      country: goldQuery.country,
      metrics: {
        precision_at_5: precisionAt5,
        ndcg_at_10: ndcgAt10,
        localisation_accuracy: localisationAccuracy,
        dedup_rate: dedupRate,
        mean_time_ms: latencyMs,
        cost_pence: searchResult.metrics.costPence
      },
      violations,
      passed
    };
  }

  /**
   * Compute precision at K
   */
  private computePrecisionAtK(
    results: Array<{ url: string; title: string; snippet: string; content?: string }>,
    goldQuery: GoldQuery,
    k: number
  ): number {
    const topK = results.slice(0, k);
    let relevantCount = 0;

    for (const result of topK) {
      if (this.isRelevant(result, goldQuery)) {
        relevantCount++;
      }
    }

    return relevantCount / k;
  }

  /**
   * Compute NDCG at K
   */
  private computeNDCGAtK(
    results: Array<{ url: string; title: string; snippet: string; content?: string }>,
    goldQuery: GoldQuery,
    k: number
  ): number {
    const topK = results.slice(0, k);
    let dcg = 0;

    for (let i = 0; i < topK.length; i++) {
      const relevance = this.isRelevant(topK[i], goldQuery) ? 1 : 0;
      dcg += relevance / Math.log2(i + 2);
    }

    // Ideal DCG (all relevant results at the top)
    const relevantCount = Math.min(k, goldQuery.expected_results_count);
    let idcg = 0;
    for (let i = 0; i < relevantCount; i++) {
      idcg += 1 / Math.log2(i + 2);
    }

    return idcg > 0 ? dcg / idcg : 0;
  }

  /**
   * Compute localisation accuracy
   */
  private computeLocalisationAccuracy(
    results: Array<{ url: string; title: string; snippet: string; content?: string }>,
    goldQuery: GoldQuery
  ): number {
    if (results.length === 0) return 0;

    let correctCount = 0;
    for (const result of results) {
      if (this.isLocalisedCorrectly(result, goldQuery)) {
        correctCount++;
      }
    }

    return correctCount / results.length;
  }

  /**
   * Compute deduplication rate
   */
  private computeDedupRate(
    results: Array<{ url: string; title: string; snippet: string; content?: string }>
  ): number {
    if (results.length === 0) return 0;

    const uniqueUrls = new Set(results.map(r => r.url));
    const duplicates = results.length - uniqueUrls.size;
    
    return duplicates / results.length;
  }

  /**
   * Check for violations
   */
  private checkViolations(
    results: Array<{ url: string; title: string; snippet: string; content?: string }>,
    goldQuery: GoldQuery
  ): {
    localisation: string[];
    domain_mismatches: string[];
    topic_mismatches: string[];
  } {
    const violations = {
      localisation: [] as string[],
      domain_mismatches: [] as string[],
      topic_mismatches: [] as string[]
    };

    for (const result of results) {
      // Check localisation violations
      if (!this.isLocalisedCorrectly(result, goldQuery)) {
        violations.localisation.push(result.url);
      }

      // Check domain mismatches
      if (this.hasDomainMismatch(result, goldQuery)) {
        violations.domain_mismatches.push(result.url);
      }

      // Check topic mismatches
      if (!this.hasTopicMatch(result, goldQuery)) {
        violations.topic_mismatches.push(result.url);
      }
    }

    return violations;
  }

  /**
   * Check if result is relevant
   */
  private isRelevant(
    result: { url: string; title: string; snippet: string; content?: string },
    goldQuery: GoldQuery
  ): boolean {
    return this.isLocalisedCorrectly(result, goldQuery) &&
           this.hasTopicMatch(result, goldQuery) &&
           !this.hasDomainMismatch(result, goldQuery);
  }

  /**
   * Check if result is localised correctly
   */
  private isLocalisedCorrectly(
    result: { url: string; title: string; snippet: string; content?: string },
    goldQuery: GoldQuery
  ): boolean {
    const allText = `${result.url} ${result.title} ${result.snippet} ${result.content || ''}`.toLowerCase();
    
    // Check for required domains
    const hasRequiredDomain = goldQuery.must_contain_domains.some(domain => 
      allText.includes(domain.toLowerCase())
    );
    
    // Check for forbidden domains
    const hasForbiddenDomain = goldQuery.must_not_contain_domains.some(domain => 
      allText.includes(domain.toLowerCase())
    );
    
    return hasRequiredDomain && !hasForbiddenDomain;
  }

  /**
   * Check if result has domain mismatch
   */
  private hasDomainMismatch(
    result: { url: string; title: string; snippet: string; content?: string },
    goldQuery: GoldQuery
  ): boolean {
    const allText = `${result.url} ${result.title} ${result.snippet} ${result.content || ''}`.toLowerCase();
    
    return goldQuery.must_not_contain_domains.some(domain => 
      allText.includes(domain.toLowerCase())
    );
  }

  /**
   * Check if result has topic match
   */
  private hasTopicMatch(
    result: { url: string; title: string; snippet: string; content?: string },
    goldQuery: GoldQuery
  ): boolean {
    const allText = `${result.title} ${result.snippet} ${result.content || ''}`.toLowerCase();
    
    return goldQuery.expected_topics.some(topic => 
      allText.includes(topic.toLowerCase())
    );
  }

  /**
   * Compute evaluation summary
   */
  private computeSummary(results: EvaluationResult[], totalTime: number): EvaluationSummary {
    const passedQueries = results.filter(r => r.passed);
    const failedQueries = results.filter(r => !r.passed);

    // Compute overall metrics
    const overallMetrics = {
      precision_at_5: results.reduce((sum, r) => sum + r.metrics.precision_at_5, 0) / results.length,
      ndcg_at_10: results.reduce((sum, r) => sum + r.metrics.ndcg_at_10, 0) / results.length,
      localisation_accuracy: results.reduce((sum, r) => sum + r.metrics.localisation_accuracy, 0) / results.length,
      dedup_rate: results.reduce((sum, r) => sum + r.metrics.dedup_rate, 0) / results.length,
      mean_time_ms: results.reduce((sum, r) => sum + r.metrics.mean_time_ms, 0) / results.length,
      cost_pence: results.reduce((sum, r) => sum + r.metrics.cost_pence, 0) / results.length
    };

    // Determine CI status
    const ciStatus = this.determineCIStatus(overallMetrics, failedQueries);

    // Collect failure reasons
    const failureReasons = this.collectFailureReasons(failedQueries);

    return {
      total_queries: results.length,
      passed_queries: passedQueries.length,
      failed_queries: failedQueries.length,
      overall_metrics: overallMetrics,
      ci_status: ciStatus,
      failure_reasons: failureReasons
    };
  }

  /**
   * Determine CI status
   */
  private determineCIStatus(
    metrics: any,
    failedQueries: EvaluationResult[]
  ): 'PASS' | 'FAIL' {
    // Check if precision dropped >3 points
    if (metrics.precision_at_5 < 0.82) { // 0.85 - 0.03
      return 'FAIL';
    }

    // Check if localisation <99%
    if (metrics.localisation_accuracy < 0.99) {
      return 'FAIL';
    }

    // Check if p95 latency exceeds budget (approximate)
    if (metrics.mean_time_ms > 2000) {
      return 'FAIL';
    }

    // Check if too many queries failed
    if (failedQueries.length > results.length * 0.1) { // >10% failure rate
      return 'FAIL';
    }

    return 'PASS';
  }

  /**
   * Collect failure reasons
   */
  private collectFailureReasons(failedQueries: EvaluationResult[]): string[] {
    const reasons = new Set<string>();

    for (const query of failedQueries) {
      if (query.metrics.precision_at_5 < 0.8) {
        reasons.add(`Low precision: ${query.queryId} (${query.metrics.precision_at_5.toFixed(3)})`);
      }
      if (query.metrics.localisation_accuracy < 0.99) {
        reasons.add(`Localisation failure: ${query.queryId} (${query.metrics.localisation_accuracy.toFixed(3)})`);
      }
      if (query.violations.localisation.length > 0) {
        reasons.add(`Localisation violations: ${query.queryId} (${query.violations.localisation.length} violations)`);
      }
    }

    return Array.from(reasons);
  }
}

/**
 * CI Integration
 */
export class CIIntegration {
  /**
   * Run evaluation and set CI exit code
   */
  static async runEvaluationAndExit(): Promise<void> {
    const harness = new EvaluationHarness();
    
    // Mock search function for testing
    const mockSearchFunction = async (query: string, country: string) => {
      // This would be replaced with actual search pipeline
      return {
        results: [
          {
            url: `https://example.${country.toLowerCase()}/event1`,
            title: `${query} in ${country}`,
            snippet: `This is a ${query} event in ${country}`,
            content: `Full content about ${query} in ${country}`
          }
        ],
        metrics: {
          latencyMs: 1000,
          costPence: 10
        }
      };
    };

    try {
      const summary = await harness.runEvaluation(mockSearchFunction);
      
      console.log('\n=== EVALUATION SUMMARY ===');
      console.log(`Total Queries: ${summary.total_queries}`);
      console.log(`Passed: ${summary.passed_queries}`);
      console.log(`Failed: ${summary.failed_queries}`);
      console.log(`CI Status: ${summary.ci_status}`);
      console.log('\nOverall Metrics:');
      console.log(`  Precision@5: ${summary.overall_metrics.precision_at_5.toFixed(3)}`);
      console.log(`  NDCG@10: ${summary.overall_metrics.ndcg_at_10.toFixed(3)}`);
      console.log(`  Localisation Accuracy: ${summary.overall_metrics.localisation_accuracy.toFixed(3)}`);
      console.log(`  Dedup Rate: ${summary.overall_metrics.dedup_rate.toFixed(3)}`);
      console.log(`  Mean Time: ${summary.overall_metrics.mean_time_ms.toFixed(0)}ms`);
      console.log(`  Cost: ${summary.overall_metrics.cost_pence.toFixed(2)}p`);
      
      if (summary.failure_reasons.length > 0) {
        console.log('\nFailure Reasons:');
        summary.failure_reasons.forEach(reason => console.log(`  - ${reason}`));
      }

      // Set exit code
      process.exit(summary.ci_status === 'PASS' ? 0 : 1);
      
    } catch (error) {
      console.error('Evaluation failed:', error);
      process.exit(1);
    }
  }
}

// Export for use in CI
export { GOLD_QUERIES };
