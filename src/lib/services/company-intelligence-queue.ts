/**
 * Company Intelligence Queue Service
 * 
 * Provides background job processing for company intelligence tasks
 * using the existing request queue infrastructure.
 */

import { getServiceQueue, RATE_LIMIT_CONFIGS } from '@/lib/services/request-queue';
import { CompanyIntelligenceCache } from './company-intelligence-cache';
import { CompanySearchService } from './company-search-service';
import { CompanySpeakerService } from './company-speaker-service';
import { EventParticipationService } from './event-participation-service';

export interface CompanyAnalysisJob {
  id: string;
  companyName: string;
  domain?: string;
  searchType: 'annual_reports' | 'intent_signals' | 'competitor_analysis' | 'event_participation';
  userId: string;
  priority: number;
  maxRetries: number;
  createdAt: string;
  scheduledFor?: string;
}

export interface PeriodicScanJob {
  id: string;
  monitoringListId: string;
  userId: string;
  companies: string[];
  scanType: 'full' | 'incremental';
  priority: number;
  maxRetries: number;
  createdAt: string;
  scheduledFor?: string;
}

export interface JobResult {
  jobId: string;
  success: boolean;
  data?: any;
  error?: string;
  processingTime: number;
  retryCount: number;
}

export interface QueueStats {
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
}

/**
 * Company Intelligence Queue Service
 */
export class CompanyIntelligenceQueue {
  private static queue = getServiceQueue('company-intelligence');
  private static jobStats: QueueStats = {
    pendingJobs: 0,
    processingJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    averageProcessingTime: 0
  };

  /**
   * Schedule company analysis job
   */
  static async scheduleCompanyAnalysis(
    companyName: string,
    domain: string | undefined,
    searchType: CompanyAnalysisJob['searchType'],
    userId: string,
    options: {
      priority?: number;
      maxRetries?: number;
      scheduledFor?: string;
    } = {}
  ): Promise<string> {
    const jobId = this.generateJobId('analysis', companyName);
    
    const job: CompanyAnalysisJob = {
      id: jobId,
      companyName,
      domain,
      searchType,
      userId,
      priority: options.priority || 1,
      maxRetries: options.maxRetries || 3,
      createdAt: new Date().toISOString(),
      scheduledFor: options.scheduledFor
    };

    try {
      await this.queue.enqueue(
        async () => this.processCompanyAnalysisJob(job),
        {
          priority: job.priority,
          maxRetries: job.maxRetries
        }
      );

      this.jobStats.pendingJobs++;
      console.log(`[CompanyIntelligenceQueue] Scheduled analysis job ${jobId} for ${companyName}`);
      return jobId;
    } catch (error) {
      console.error(`[CompanyIntelligenceQueue] Failed to schedule analysis job for ${companyName}:`, error);
      throw new Error(`Failed to schedule analysis job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Schedule periodic scan job
   */
  static async schedulePeriodicScan(
    monitoringListId: string,
    userId: string,
    companies: string[],
    options: {
      scanType?: 'full' | 'incremental';
      priority?: number;
      maxRetries?: number;
      scheduledFor?: string;
    } = {}
  ): Promise<string> {
    const jobId = this.generateJobId('scan', monitoringListId);
    
    const job: PeriodicScanJob = {
      id: jobId,
      monitoringListId,
      userId,
      companies,
      scanType: options.scanType || 'incremental',
      priority: options.priority || 2,
      maxRetries: options.maxRetries || 2,
      createdAt: new Date().toISOString(),
      scheduledFor: options.scheduledFor
    };

    try {
      await this.queue.enqueue(
        async () => this.processPeriodicScanJob(job),
        {
          priority: job.priority,
          maxRetries: job.maxRetries
        }
      );

      this.jobStats.pendingJobs++;
      console.log(`[CompanyIntelligenceQueue] Scheduled periodic scan job ${jobId} for ${companies.length} companies`);
      return jobId;
    } catch (error) {
      console.error(`[CompanyIntelligenceQueue] Failed to schedule periodic scan job:`, error);
      throw new Error(`Failed to schedule periodic scan job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process company analysis job
   */
  static async processCompanyAnalysisJob(job: CompanyAnalysisJob): Promise<JobResult> {
    const startTime = Date.now();
    let retryCount = 0;

    try {
      this.jobStats.processingJobs++;
      this.jobStats.pendingJobs--;

      console.log(`[CompanyIntelligenceQueue] Processing analysis job ${job.id} for ${job.companyName}`);

      // Check cache first
      const cacheKey = {
        companyName: job.companyName,
        dataType: job.searchType,
        country: 'DE' // Default country
      };

      const cached = await CompanyIntelligenceCache.getCompanyData(cacheKey);
      if (cached && !CompanyIntelligenceCache.shouldRefreshCache(cached)) {
        console.log(`[CompanyIntelligenceQueue] Using cached data for ${job.companyName}`);
        return {
          jobId: job.id,
          success: true,
          data: cached.data,
          processingTime: Date.now() - startTime,
          retryCount
        };
      }

      // Perform fresh analysis
      const result = await CompanySearchService.searchCompanyIntelligence({
        companyName: job.companyName,
        domain: job.domain,
        searchType: job.searchType,
        country: 'DE',
        maxResults: 100
      });

      // Cache the result
      await CompanyIntelligenceCache.setCompanyData(
        cacheKey,
        result,
        {
          sourceCount: result.metadata.sourcesFound,
          confidence: result.results.confidence
        }
      );

      this.jobStats.completedJobs++;
      this.jobStats.processingJobs--;
      this.updateAverageProcessingTime(Date.now() - startTime);

      console.log(`[CompanyIntelligenceQueue] Completed analysis job ${job.id} for ${job.companyName}`);

      return {
        jobId: job.id,
        success: true,
        data: result,
        processingTime: Date.now() - startTime,
        retryCount
      };
    } catch (error) {
      this.jobStats.failedJobs++;
      this.jobStats.processingJobs--;
      this.updateAverageProcessingTime(Date.now() - startTime);

      console.error(`[CompanyIntelligenceQueue] Analysis job ${job.id} failed:`, error);

      return {
        jobId: job.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
        retryCount
      };
    }
  }

  /**
   * Process periodic scan job
   */
  static async processPeriodicScanJob(job: PeriodicScanJob): Promise<JobResult> {
    const startTime = Date.now();
    let retryCount = 0;

    try {
      this.jobStats.processingJobs++;
      this.jobStats.pendingJobs--;

      console.log(`[CompanyIntelligenceQueue] Processing periodic scan job ${job.id} for ${job.companies.length} companies`);

      const results = [];
      const errors = [];

      for (const companyName of job.companies) {
        try {
          // Schedule individual analysis jobs for each company
          await this.scheduleCompanyAnalysis(
            companyName,
            undefined,
            'event_participation',
            job.userId,
            { priority: 3, maxRetries: 2 }
          );
          results.push({ companyName, status: 'scheduled' });
        } catch (error) {
          errors.push({ companyName, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }

      this.jobStats.completedJobs++;
      this.jobStats.processingJobs--;
      this.updateAverageProcessingTime(Date.now() - startTime);

      console.log(`[CompanyIntelligenceQueue] Completed periodic scan job ${job.id}: ${results.length} scheduled, ${errors.length} failed`);

      return {
        jobId: job.id,
        success: true,
        data: { results, errors },
        processingTime: Date.now() - startTime,
        retryCount
      };
    } catch (error) {
      this.jobStats.failedJobs++;
      this.jobStats.processingJobs--;
      this.updateAverageProcessingTime(Date.now() - startTime);

      console.error(`[CompanyIntelligenceQueue] Periodic scan job ${job.id} failed:`, error);

      return {
        jobId: job.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
        retryCount
      };
    }
  }

  /**
   * Get job status
   */
  static async getJobStatus(jobId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'not_found';
    result?: JobResult;
    createdAt?: string;
  }> {
    try {
      // This would typically query the queue system for job status
      // For now, we'll return a basic status
      return {
        status: 'pending'
      };
    } catch (error) {
      console.error(`[CompanyIntelligenceQueue] Failed to get job status for ${jobId}:`, error);
      return { status: 'not_found' };
    }
  }

  /**
   * Cancel job
   */
  static async cancelJob(jobId: string): Promise<boolean> {
    try {
      // This would typically cancel the job in the queue system
      console.log(`[CompanyIntelligenceQueue] Cancelled job ${jobId}`);
      return true;
    } catch (error) {
      console.error(`[CompanyIntelligenceQueue] Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Get queue statistics
   */
  static getQueueStats(): QueueStats {
    return { ...this.jobStats };
  }

  /**
   * Reset queue statistics
   */
  static resetQueueStats(): void {
    this.jobStats = {
      pendingJobs: 0,
      processingJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageProcessingTime: 0
    };
  }

  /**
   * Generate unique job ID
   */
  private static generateJobId(type: string, identifier: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${type}_${identifier.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}_${random}`;
  }

  /**
   * Update average processing time
   */
  private static updateAverageProcessingTime(newTime: number): void {
    const totalJobs = this.jobStats.completedJobs + this.jobStats.failedJobs;
    if (totalJobs === 1) {
      this.jobStats.averageProcessingTime = newTime;
    } else {
      this.jobStats.averageProcessingTime = 
        (this.jobStats.averageProcessingTime * (totalJobs - 1) + newTime) / totalJobs;
    }
  }

  /**
   * Schedule recurring jobs
   */
  static async scheduleRecurringJobs(userId: string): Promise<void> {
    try {
      // Schedule daily incremental scans
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 0, 0, 0); // 2 AM

      await this.schedulePeriodicScan(
        'daily_scan',
        userId,
        [], // Will be populated from user's monitoring list
        {
          scanType: 'incremental',
          priority: 3,
          scheduledFor: tomorrow.toISOString()
        }
      );

      // Schedule weekly full scans
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(3, 0, 0, 0); // 3 AM

      await this.schedulePeriodicScan(
        'weekly_scan',
        userId,
        [], // Will be populated from user's monitoring list
        {
          scanType: 'full',
          priority: 2,
          scheduledFor: nextWeek.toISOString()
        }
      );

      console.log(`[CompanyIntelligenceQueue] Scheduled recurring jobs for user ${userId}`);
    } catch (error) {
      console.error(`[CompanyIntelligenceQueue] Failed to schedule recurring jobs for user ${userId}:`, error);
    }
  }

  /**
   * Process job with retry logic
   */
  static async processJobWithRetry<T>(
    job: any,
    processor: (job: any) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await processor(job);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`[CompanyIntelligenceQueue] Job ${job.id} attempt ${attempt} failed, retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }
}
