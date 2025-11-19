/**
 * PHASE 0: Discovery Engine Test Script
 * 
 * This script runs discovery for sample users and generates a Signal Confidence Report
 * to validate matching accuracy before enabling the UI.
 * 
 * Usage:
 *   npx tsx src/lib/scripts/test-discovery-phase0.ts [userId]
 * 
 * If userId is not provided, it will test with the first user that has a discovery profile.
 */

import { DiscoveryEngine } from '../services/discovery-engine';
import { supabaseServer } from '../supabase-server';

interface ConfidenceReport {
  totalOpportunities: number;
  totalAccountMatches: number;
  confidenceDistribution: {
    exact: number;
    domain: number;
    fuzzy: number;
    linkedin: number;
  };
  confidenceScores: number[];
  averageConfidence: number;
  falsePositivePatterns: string[];
  recommendations: string[];
}

/**
 * Generate Signal Confidence Report
 */
async function generateConfidenceReport(userId: string): Promise<ConfidenceReport> {
  const supabase = await supabaseServer();
  
  // Get all opportunities for this user
  const { data: opportunities, error } = await supabase
    .from('user_opportunities')
    .select('account_connections, relevance_score, relevance_reasons')
    .eq('user_id', userId);

  if (error || !opportunities) {
    throw new Error(`Failed to fetch opportunities: ${error?.message}`);
  }

  const report: ConfidenceReport = {
    totalOpportunities: opportunities.length,
    totalAccountMatches: 0,
    confidenceDistribution: {
      exact: 0,
      domain: 0,
      fuzzy: 0,
      linkedin: 0
    },
    confidenceScores: [],
    averageConfidence: 0,
    falsePositivePatterns: [],
    recommendations: []
  };

  // Analyze each opportunity
  for (const opp of opportunities) {
    const accountConnections = opp.account_connections as any[];
    if (!Array.isArray(accountConnections)) continue;

    report.totalAccountMatches += accountConnections.length;

    for (const conn of accountConnections) {
      const confidence = conn.confidence_score || 0;
      const source = conn.verification_source || 'fuzzy_match';

      report.confidenceScores.push(confidence);

      // Count by source
      switch (source) {
        case 'exact_match':
          report.confidenceDistribution.exact++;
          break;
        case 'domain_match':
          report.confidenceDistribution.domain++;
          break;
        case 'fuzzy_match':
          report.confidenceDistribution.fuzzy++;
          break;
        case 'linkedin_verified':
          report.confidenceDistribution.linkedin++;
          break;
      }

      // Identify potential false positives (low confidence)
      if (confidence < 70) {
        report.falsePositivePatterns.push(
          `Low confidence match: ${conn.account_name} (${confidence}% via ${source})`
        );
      }
    }
  }

  // Calculate average confidence
  if (report.confidenceScores.length > 0) {
    report.averageConfidence = Math.round(
      report.confidenceScores.reduce((sum, score) => sum + score, 0) / report.confidenceScores.length
    );
  }

  // Generate recommendations
  if (report.averageConfidence < 85) {
    report.recommendations.push(
      `Average confidence is ${report.averageConfidence}%. Consider increasing matching thresholds.`
    );
  }

  if (report.confidenceDistribution.fuzzy > report.confidenceDistribution.exact) {
    report.recommendations.push(
      'More fuzzy matches than exact matches. Consider improving company name normalization.'
    );
  }

  if (report.falsePositivePatterns.length > report.totalAccountMatches * 0.2) {
    report.recommendations.push(
      `High number of low-confidence matches (${report.falsePositivePatterns.length}). Review matching logic.`
    );
  }

  if (report.totalOpportunities === 0) {
    report.recommendations.push(
      'No opportunities found. Check discovery profile configuration and search queries.'
    );
  }

  return report;
}

/**
 * Print confidence report
 */
function printReport(report: ConfidenceReport, userId: string) {
  console.log('\n' + '='.repeat(80));
  console.log('SIGNAL CONFIDENCE REPORT');
  console.log('='.repeat(80));
  console.log(`User ID: ${userId}`);
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log('\n');

  console.log('SUMMARY');
  console.log('-'.repeat(80));
  console.log(`Total Opportunities: ${report.totalOpportunities}`);
  console.log(`Total Account Matches: ${report.totalAccountMatches}`);
  console.log(`Average Confidence: ${report.averageConfidence}%`);
  console.log('\n');

  console.log('CONFIDENCE DISTRIBUTION');
  console.log('-'.repeat(80));
  console.log(`Exact Matches: ${report.confidenceDistribution.exact}`);
  console.log(`Domain Matches: ${report.confidenceDistribution.domain}`);
  console.log(`Fuzzy Matches: ${report.confidenceDistribution.fuzzy}`);
  console.log(`LinkedIn Verified: ${report.confidenceDistribution.linkedin}`);
  console.log('\n');

  if (report.confidenceScores.length > 0) {
    const sorted = [...report.confidenceScores].sort((a, b) => b - a);
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = Math.min(...report.confidenceScores);
    const max = Math.max(...report.confidenceScores);

    console.log('CONFIDENCE STATISTICS');
    console.log('-'.repeat(80));
    console.log(`Min: ${min}%`);
    console.log(`Max: ${max}%`);
    console.log(`Median: ${median}%`);
    console.log(`Average: ${report.averageConfidence}%`);
    console.log('\n');
  }

  if (report.falsePositivePatterns.length > 0) {
    console.log('POTENTIAL FALSE POSITIVES (Low Confidence Matches)');
    console.log('-'.repeat(80));
    report.falsePositivePatterns.slice(0, 10).forEach((pattern, i) => {
      console.log(`${i + 1}. ${pattern}`);
    });
    if (report.falsePositivePatterns.length > 10) {
      console.log(`... and ${report.falsePositivePatterns.length - 10} more`);
    }
    console.log('\n');
  }

  if (report.recommendations.length > 0) {
    console.log('RECOMMENDATIONS');
    console.log('-'.repeat(80));
    report.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
    console.log('\n');
  }

  console.log('='.repeat(80));
  console.log('\n');
}

/**
 * Main test function
 */
async function main() {
  const userId = process.argv[2];

  try {
    const supabase = await supabaseServer();

    let targetUserId = userId;

    // If no userId provided, find first user with discovery profile
    if (!targetUserId) {
      const { data: profiles, error } = await supabase
        .from('user_discovery_profiles')
        .select('user_id')
        .limit(1)
        .single();

      if (error || !profiles) {
        console.error('No discovery profiles found. Please create a discovery profile first.');
        console.error('Or provide a userId as argument: npx tsx src/lib/scripts/test-discovery-phase0.ts <userId>');
        process.exit(1);
      }

      targetUserId = profiles.user_id;
      console.log(`No userId provided. Using first available profile: ${targetUserId}`);
    }

    console.log(`\nRunning discovery for user: ${targetUserId}`);
    console.log('This may take a few minutes...\n');

    // Run discovery
    const result = await DiscoveryEngine.runDiscovery(targetUserId);

    console.log('\nDiscovery Complete!');
    console.log(`Events Discovered: ${result.eventsDiscovered}`);
    console.log(`Opportunities Created: ${result.opportunitiesCreated}`);
    console.log(`High Signal Opportunities: ${result.highSignalOpportunities}`);
    console.log(`Duration: ${result.durationMs}ms`);

    // Generate confidence report
    console.log('\nGenerating Signal Confidence Report...');
    const report = await generateConfidenceReport(targetUserId);
    printReport(report, targetUserId);

    // Exit with appropriate code
    if (report.averageConfidence < 70) {
      console.log('⚠️  WARNING: Low average confidence. Review matching logic before enabling UI.');
      process.exit(1);
    } else if (report.averageConfidence < 85) {
      console.log('⚠️  CAUTION: Moderate confidence. Consider improvements before production.');
      process.exit(0);
    } else {
      console.log('✅ Confidence levels look good! Ready for Phase 1.');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Error running discovery test:');
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { generateConfidenceReport, printReport };

