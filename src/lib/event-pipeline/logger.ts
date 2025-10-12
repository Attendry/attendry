/**
 * Pipeline Logging and Monitoring
 * 
 * Comprehensive logging for pipeline stages and quality gates
 */

import { EventCandidate, PipelineMetrics } from './types';
import { logger } from '@/utils/logger';

export class PipelineLogger {
  static logStage(
    stage: string, 
    input: number, 
    output: number, 
    duration: number,
    additionalData?: Record<string, any>
  ) {
    const efficiency = input > 0 ? (output / input * 100).toFixed(1) : '0';
    
    logger.info({ message: `[pipeline:${stage}] ${input} → ${output} (${efficiency}% efficiency, ${duration}ms)`,
      stage,
      inputCount: input,
      outputCount: output,
      efficiency: parseFloat(efficiency),
      duration,
      ...additionalData
    });
  }

  static logCandidate(candidate: EventCandidate, stage: string, additionalInfo?: string) {
    const logData = {
      stage,
      candidateId: candidate.id,
      url: candidate.url,
      source: candidate.source,
      status: candidate.status,
      priorityScore: candidate.priorityScore,
      confidence: candidate.parseResult?.confidence,
      processingTime: candidate.metadata.processingTime
    };

    if (additionalInfo) {
      (logData as any)['additionalInfo'] = additionalInfo;
    }

    logger.info({ message: `[pipeline:${stage}] Candidate processed`, ...logData });
  }

  static logError(stage: string, error: Error, context?: any) {
    logger.error({ message: `[pipeline:${stage}] Error occurred`,
      stage,
      error: error.message,
      stack: error.stack,
      context
    });
  }

  static logQualityGate(
    stage: string,
    candidate: EventCandidate,
    threshold: number,
    actual: number,
    passed: boolean
  ) {
    logger.info({ message: `[pipeline:${stage}] Quality gate ${passed ? 'PASSED' : 'FAILED'}`,
      stage,
      candidateId: candidate.id,
      url: candidate.url,
      threshold,
      actual,
      passed,
      difference: actual - threshold
    });
  }

  static logMetrics(metrics: PipelineMetrics, totalDuration: number) {
    logger.info({ message: '[pipeline] Final metrics',
      ...metrics,
      totalDuration,
      efficiency: {
        discovery: metrics.totalCandidates > 0 ? (metrics.prioritizedCandidates / metrics.totalCandidates * 100).toFixed(1) : '0',
        prioritization: metrics.prioritizedCandidates > 0 ? (metrics.parsedCandidates / metrics.prioritizedCandidates * 100).toFixed(1) : '0',
        parsing: metrics.parsedCandidates > 0 ? (metrics.publishedCandidates / metrics.parsedCandidates * 100).toFixed(1) : '0'
      }
    });
  }

  static logPerformanceWarning(stage: string, duration: number, threshold: number) {
    if (duration > threshold) {
    logger.warn({ message: `[pipeline:${stage}] Performance warning`,
      stage,
      duration,
      threshold,
      exceededBy: duration - threshold
    });
    }
  }

  static logSourceBreakdown(breakdown: Record<string, number>) {
    logger.info({ message: '[pipeline] Source breakdown',
      sources: breakdown,
      total: Object.values(breakdown).reduce((sum, count) => sum + count, 0)
    });
  }
}

// Quality gate functions
export class QualityGates {
  static checkPrioritizationThreshold(candidate: EventCandidate, threshold: number): boolean {
    const score = candidate.priorityScore || 0;
    const passed = score >= threshold;
    
    PipelineLogger.logQualityGate('prioritization', candidate, threshold, score, passed);
    return passed;
  }

  static checkParseQuality(candidate: EventCandidate, threshold: number): boolean {
    const confidence = candidate.parseResult?.confidence || 0;
    const passed = confidence >= threshold;
    
    PipelineLogger.logQualityGate('parsing', candidate, threshold, confidence, passed);
    return passed;
  }

  static checkMinimumFields(candidate: EventCandidate, requiredFields: string[]): boolean {
    if (!candidate.parseResult) return false;
    
    const missingFields = requiredFields.filter(field => {
      const value = candidate.parseResult![field as keyof typeof candidate.parseResult];
      return !value || (Array.isArray(value) && value.length === 0);
    });
    
    const passed = missingFields.length === 0;
    
    PipelineLogger.logQualityGate('minimum_fields', candidate, requiredFields.length, requiredFields.length - missingFields.length, passed);
    
    if (!passed) {
      logger.info({ message: '[pipeline] Missing required fields',
        candidateId: candidate.id,
        url: candidate.url,
        missingFields
      });
    }
    
    return passed;
  }

  static checkUrlValidity(candidate: EventCandidate): boolean {
    try {
      const url = new URL(candidate.url);
      const passed = ['http:', 'https:'].includes(url.protocol) && url.hostname.length > 0;
      
      PipelineLogger.logQualityGate('url_validity', candidate, 1, passed ? 1 : 0, passed);
      return passed;
    } catch {
      PipelineLogger.logQualityGate('url_validity', candidate, 1, 0, false);
      return false;
    }
  }

  static checkContentRelevance(candidate: EventCandidate): boolean {
    if (!candidate.parseResult) return false;
    
    const { title, description } = candidate.parseResult;
    const content = `${title || ''} ${description || ''}`.toLowerCase();
    
    // Check for event-related keywords
    const eventKeywords = ['conference', 'summit', 'workshop', 'seminar', 'event', 'meeting', 'symposium'];
    const hasEventKeywords = eventKeywords.some(keyword => content.includes(keyword));
    
    // Check for compliance/legal keywords
    const complianceKeywords = ['compliance', 'legal', 'regulation', 'governance', 'risk', 'audit'];
    const hasComplianceKeywords = complianceKeywords.some(keyword => content.includes(keyword));
    
    const passed = hasEventKeywords || hasComplianceKeywords;
    
    PipelineLogger.logQualityGate('content_relevance', candidate, 1, passed ? 1 : 0, passed);
    return passed;
  }
}
