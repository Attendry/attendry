/**
 * Optimized AI Service
 * 
 * This service provides optimized AI calls with batching, caching,
 * and intelligent request management for better performance and cost efficiency.
 */

import { getCacheService, CACHE_CONFIGS } from '@/lib/cache';
import { executeWithCircuitBreaker, CIRCUIT_BREAKER_CONFIGS } from './circuit-breaker';
import { executeWithFallback } from './fallback-strategies';

/**
 * AI request types
 */
export interface AIRequest {
  id: string;
  type: 'filter' | 'extract' | 'prioritize' | 'enhance';
  prompt: string;
  data: any;
  priority: number;
  timestamp: number;
  maxRetries?: number;
}

/**
 * AI response types
 */
export interface AIResponse {
  id: string;
  result: any;
  confidence: number;
  processingTime: number;
  cached: boolean;
  batchId?: string;
}

/**
 * Batch processing configuration
 */
interface BatchConfig {
  maxBatchSize: number;
  maxWaitTime: number; // milliseconds
  maxTokens: number;
  temperature: number;
}

/**
 * AI service statistics
 */
interface AIServiceStats {
  totalRequests: number;
  batchedRequests: number;
  cachedRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  totalTokensUsed: number;
  costSavings: number;
}

/**
 * Optimized AI Service with batching and caching
 */
export class OptimizedAIService {
  private static cacheService = getCacheService();
  private static requestQueue: AIRequest[] = [];
  private static batchTimer: NodeJS.Timeout | null = null;
  private static stats: AIServiceStats = {
    totalRequests: 0,
    batchedRequests: 0,
    cachedRequests: 0,
    failedRequests: 0,
    averageProcessingTime: 0,
    totalTokensUsed: 0,
    costSavings: 0,
  };

  private static readonly BATCH_CONFIG: BatchConfig = {
    maxBatchSize: 10,
    maxWaitTime: 2000, // 2 seconds
    maxTokens: 8192,
    temperature: 0.1,
  };

  /**
   * Process AI request with optimization
   */
  static async processRequest<T = any>(
    type: AIRequest['type'],
    prompt: string,
    data: any,
    options: {
      priority?: number;
      maxRetries?: number;
      useCache?: boolean;
      useBatching?: boolean;
    } = {}
  ): Promise<T> {
    const {
      priority = 0,
      maxRetries = 3,
      useCache = true,
      useBatching = true,
    } = options;

    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.stats.totalRequests++;

    // Check cache first if enabled
    if (useCache) {
      const cacheKey = this.generateCacheKey(type, prompt, data);
      const cachedResult = await this.cacheService.get<T>(cacheKey, CACHE_CONFIGS.AI_RESPONSES);
      
      if (cachedResult) {
        this.stats.cachedRequests++;
        this.stats.costSavings += this.estimateTokenCost(prompt, data);
        console.log(`[AI_OPTIMIZED] Cache hit for request ${requestId}`);
        return cachedResult;
      }
    }

    // Use batching for appropriate request types
    if (useBatching && this.shouldBatch(type)) {
      return this.processBatchedRequest<T>(requestId, type, prompt, data, priority, maxRetries);
    }

    // Process individual request
    return this.processIndividualRequest<T>(requestId, type, prompt, data, maxRetries, useCache);
  }

  /**
   * Process request in batch
   */
  private static async processBatchedRequest<T>(
    requestId: string,
    type: AIRequest['type'],
    prompt: string,
    data: any,
    priority: number,
    maxRetries: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const request: AIRequest = {
        id: requestId,
        type,
        prompt,
        data,
        priority,
        timestamp: Date.now(),
        maxRetries,
      };

      // Add to queue
      this.insertByPriority(request);

      // Set up promise resolution
      (request as any).resolve = resolve;
      (request as any).reject = reject;

      // Start batch processing if not already running
      if (!this.batchTimer) {
        this.startBatchProcessing();
      }
    });
  }

  /**
   * Process individual request
   */
  private static async processIndividualRequest<T>(
    requestId: string,
    type: AIRequest['type'],
    prompt: string,
    data: any,
    maxRetries: number,
    useCache: boolean
  ): Promise<T> {
    try {
      const result = await executeWithFallback('gemini', async () => {
        return await executeWithCircuitBreaker('gemini', () =>
          this.callGeminiAPI(prompt, data),
          CIRCUIT_BREAKER_CONFIGS.GEMINI
        );
      });

      // Cache result if enabled
      if (useCache) {
        const cacheKey = this.generateCacheKey(type, prompt, data);
        await this.cacheService.set(cacheKey, result, CACHE_CONFIGS.AI_RESPONSES);
      }

      return result;
    } catch (error) {
      this.stats.failedRequests++;
      throw error;
    }
  }

  /**
   * Start batch processing
   */
  private static startBatchProcessing(): void {
    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.BATCH_CONFIG.maxWaitTime);
  }

  /**
   * Process a batch of requests
   */
  private static async processBatch(): Promise<void> {
    if (this.requestQueue.length === 0) {
      this.batchTimer = null;
      return;
    }

    const batch = this.requestQueue.splice(0, this.BATCH_CONFIG.maxBatchSize);
    this.stats.batchedRequests += batch.length;

    console.log(`[AI_OPTIMIZED] Processing batch of ${batch.length} requests`);

    try {
      const results = await this.processBatchRequests(batch);
      
      // Resolve all promises
      for (let i = 0; i < batch.length; i++) {
        const request = batch[i];
        const result = results[i];
        
        if (result.success) {
          (request as any).resolve(result.data);
        } else {
          (request as any).reject(new Error(result.error));
        }
      }
    } catch (error) {
      // Reject all promises on batch failure
      for (const request of batch) {
        (request as any).reject(error);
      }
    }

    // Continue processing if there are more requests
    if (this.requestQueue.length > 0) {
      this.startBatchProcessing();
    } else {
      this.batchTimer = null;
    }
  }

  /**
   * Process batch requests
   */
  private static async processBatchRequests(batch: AIRequest[]): Promise<Array<{ success: boolean; data?: any; error?: string }>> {
    try {
      // Group requests by type for better batching
      const groupedRequests = this.groupRequestsByType(batch);
      const results: Array<{ success: boolean; data?: any; error?: string }> = [];

      for (const [type, requests] of groupedRequests.entries()) {
        const batchResult = await this.processBatchByType(type, requests);
        results.push(...batchResult);
      }

      return results;
    } catch (error) {
      // Return failure for all requests
      return batch.map(() => ({
        success: false,
        error: error instanceof Error ? error.message : 'Batch processing failed'
      }));
    }
  }

  /**
   * Group requests by type
   */
  private static groupRequestsByType(batch: AIRequest[]): Map<AIRequest['type'], AIRequest[]> {
    const grouped = new Map<AIRequest['type'], AIRequest[]>();
    
    for (const request of batch) {
      if (!grouped.has(request.type)) {
        grouped.set(request.type, []);
      }
      grouped.get(request.type)!.push(request);
    }
    
    return grouped;
  }

  /**
   * Process batch by type
   */
  private static async processBatchByType(
    type: AIRequest['type'],
    requests: AIRequest[]
  ): Promise<Array<{ success: boolean; data?: any; error?: string }>> {
    try {
      // Create combined prompt for batch processing
      const combinedPrompt = this.createBatchPrompt(type, requests);
      
      // Call Gemini API with batch request
      const result = await executeWithFallback('gemini', async () => {
        return await executeWithCircuitBreaker('gemini', () =>
          this.callGeminiAPI(combinedPrompt, { batch: true, requests }),
          CIRCUIT_BREAKER_CONFIGS.GEMINI
        );
      });

      // Parse batch results
      return this.parseBatchResults(result, requests);
    } catch (error) {
      return requests.map(() => ({
        success: false,
        error: error instanceof Error ? error.message : 'Batch processing failed'
      }));
    }
  }

  /**
   * Create batch prompt
   */
  private static createBatchPrompt(type: AIRequest['type'], requests: AIRequest[]): string {
    const basePrompt = this.getBasePrompt(type);
    
    let batchPrompt = `${basePrompt}\n\nProcess the following ${requests.length} requests in batch:\n\n`;
    
    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      batchPrompt += `Request ${i + 1} (ID: ${request.id}):\n`;
      batchPrompt += `Prompt: ${request.prompt}\n`;
      batchPrompt += `Data: ${JSON.stringify(request.data)}\n\n`;
    }
    
    batchPrompt += `\nPlease respond with a JSON array containing the results for each request in order.`;
    
    return batchPrompt;
  }

  /**
   * Get base prompt for request type
   */
  private static getBasePrompt(type: AIRequest['type']): string {
    const prompts = {
      filter: 'You are an AI assistant that filters search results to identify relevant events.',
      extract: 'You are an AI assistant that extracts structured data from content.',
      prioritize: 'You are an AI assistant that prioritizes URLs based on relevance.',
      enhance: 'You are an AI assistant that enhances event data with additional information.',
    };
    
    return prompts[type] || 'You are an AI assistant that processes requests.';
  }

  /**
   * Parse batch results
   */
  private static parseBatchResults(result: any, requests: AIRequest[]): Array<{ success: boolean; data?: any; error?: string }> {
    try {
      if (Array.isArray(result)) {
        return result.map((item, index) => ({
          success: true,
          data: item
        }));
      }
      
      // If result is not an array, try to parse it
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => ({
          success: true,
          data: item
        }));
      }
      
      // Single result for all requests
      return requests.map(() => ({
        success: true,
        data: parsed
      }));
    } catch (error) {
      return requests.map(() => ({
        success: false,
        error: 'Failed to parse batch results'
      }));
    }
  }

  /**
   * Call Gemini API
   */
  private static async callGeminiAPI(prompt: string, data?: any): Promise<any> {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: this.BATCH_CONFIG.temperature,
        maxOutputTokens: this.BATCH_CONFIG.maxTokens,
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Check if request should be batched
   */
  private static shouldBatch(type: AIRequest['type']): boolean {
    const batchableTypes: AIRequest['type'][] = ['filter', 'prioritize'];
    return batchableTypes.includes(type);
  }

  /**
   * Insert request by priority
   */
  private static insertByPriority(request: AIRequest): void {
    let insertIndex = this.requestQueue.length;
    
    for (let i = 0; i < this.requestQueue.length; i++) {
      if (request.priority > this.requestQueue[i].priority) {
        insertIndex = i;
        break;
      }
    }
    
    this.requestQueue.splice(insertIndex, 0, request);
  }

  /**
   * Generate cache key
   */
  private static generateCacheKey(type: AIRequest['type'], prompt: string, data: any): string {
    const dataHash = JSON.stringify(data);
    return `ai_${type}_${this.hashString(prompt)}_${this.hashString(dataHash)}`;
  }

  /**
   * Generate request ID
   */
  private static generateRequestId(): string {
    return `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Hash string for cache key
   */
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Estimate token cost
   */
  private static estimateTokenCost(prompt: string, data: any): number {
    const text = prompt + JSON.stringify(data);
    return Math.ceil(text.length / 4); // Rough estimate: 4 characters per token
  }

  /**
   * Get service statistics
   */
  static getStats(): AIServiceStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  static resetStats(): void {
    this.stats = {
      totalRequests: 0,
      batchedRequests: 0,
      cachedRequests: 0,
      failedRequests: 0,
      averageProcessingTime: 0,
      totalTokensUsed: 0,
      costSavings: 0,
    };
  }

  /**
   * Clear request queue
   */
  static clearQueue(): void {
    // Reject all pending requests
    for (const request of this.requestQueue) {
      (request as any).reject(new Error('Queue cleared'));
    }
    this.requestQueue = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }
}
