/**
 * Extraction Timeout Handler
 * 
 * Implements soft failure handling for extraction timeouts to prevent zero results.
 */

import { updateExtractionStats, type SearchTrace } from '@/lib/trace';

export interface ExtractionItem {
  url: string;
  title?: string;
  snippet?: string;
}

export interface ExtractionResult {
  url: string;
  title: string;
  description?: string;
  speakers?: any[];
  startsAt?: string;
  endsAt?: string;
  venue?: string;
  city?: string;
  country?: string;
  success: boolean;
  timeout?: boolean;
  error?: string;
}

export interface ExtractionConfig {
  batchSize: number;
  maxPollMs: number;
  maxRetries: number;
}

/**
 * Default extraction configuration
 */
export const DEFAULT_EXTRACTION_CONFIG: ExtractionConfig = {
  batchSize: 3,
  maxPollMs: 25000, // 25 seconds
  maxRetries: 2
};

/**
 * Extract events with timeout handling
 */
export async function extractEventsWithTimeouts(
  items: ExtractionItem[],
  config: ExtractionConfig = DEFAULT_EXTRACTION_CONFIG,
  trace: SearchTrace
): Promise<ExtractionResult[]> {
  const results: ExtractionResult[] = [];
  let attempted = 0;
  let successful = 0;
  let failed = 0;
  let timedOut = 0;
  let speakersFound = 0;
  
  // Process in batches
  for (let i = 0; i < items.length; i += config.batchSize) {
    const batch = items.slice(i, i + config.batchSize);
    
    const batchPromises = batch.map(async (item) => {
      attempted++;
      
      try {
        const result = await extractSingleItemWithTimeout(item, config.maxPollMs);
        
        if (result.success) {
          successful++;
          if (result.speakers && result.speakers.length > 0) {
            speakersFound += result.speakers.length;
          }
        } else if (result.timeout) {
          timedOut++;
        } else {
          failed++;
        }
        
        return result;
      } catch (error) {
        failed++;
        return {
          url: item.url,
          title: item.title || 'Unknown',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    // Wait for batch to complete (with timeout)
    try {
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          failed++;
          results.push({
            url: 'unknown',
            title: 'Unknown',
            success: false,
            error: result.reason?.message || 'Batch processing failed'
          });
        }
      });
    } catch (error) {
      console.warn(`Batch ${i / config.batchSize + 1} failed:`, error);
    }
  }
  
  // Update trace statistics
  updateExtractionStats(trace, attempted, successful, failed, timedOut, speakersFound);
  
  return results;
}

/**
 * Extract single item with timeout
 */
async function extractSingleItemWithTimeout(
  item: ExtractionItem,
  maxPollMs: number
): Promise<ExtractionResult> {
  const timeoutPromise = new Promise<ExtractionResult>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Extraction timeout'));
    }, maxPollMs);
  });
  
  const extractionPromise = performExtraction(item);
  
  try {
    const result = await Promise.race([extractionPromise, timeoutPromise]);
    return result;
  } catch (error) {
    if (error instanceof Error && error.message === 'Extraction timeout') {
      return {
        url: item.url,
        title: item.title || 'Unknown',
        success: false,
        timeout: true,
        error: 'Extraction timeout'
      };
    }
    
    return {
      url: item.url,
      title: item.title || 'Unknown',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Perform actual extraction (placeholder)
 */
async function performExtraction(item: ExtractionItem): Promise<ExtractionResult> {
  // Simulate extraction delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 5000 + 1000));
  
  // Simulate success/failure
  const success = Math.random() > 0.3; // 70% success rate
  
  if (success) {
    return {
      url: item.url,
      title: item.title || 'Extracted Event',
      description: 'Event description extracted from content',
      speakers: [
        { name: 'Speaker 1', title: 'Expert' },
        { name: 'Speaker 2', title: 'Professional' }
      ],
      startsAt: '2024-01-15T09:00:00Z',
      endsAt: '2024-01-15T17:00:00Z',
      venue: 'Conference Center',
      city: 'Berlin',
      country: 'DE',
      success: true
    };
  } else {
    throw new Error('Extraction failed');
  }
}

/**
 * Fallback extraction for failed items
 */
export async function fallbackExtraction(
  failedItems: ExtractionItem[],
  trace: SearchTrace
): Promise<ExtractionResult[]> {
  console.warn(`Attempting fallback extraction for ${failedItems.length} items`);
  
  const results: ExtractionResult[] = [];
  
  for (const item of failedItems) {
    try {
      // Try plain scrape with markdown/html formats
      const fallbackResult = await performFallbackScrape(item);
      results.push(fallbackResult);
    } catch (error) {
      // If everything fails, return URL stub
      results.push({
        url: item.url,
        title: item.title || 'Event',
        success: false,
        error: 'All extraction methods failed'
      });
    }
  }
  
  return results;
}

/**
 * Perform fallback scrape
 */
async function performFallbackScrape(item: ExtractionItem): Promise<ExtractionResult> {
  // Simulate fallback scraping
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    url: item.url,
    title: item.title || 'Fallback Event',
    description: 'Content extracted via fallback method',
    success: true
  };
}

/**
 * Create URL stubs for completely failed extractions
 */
export function createUrlStubs(items: ExtractionItem[]): ExtractionResult[] {
  return items.map(item => ({
    url: item.url,
    title: item.title || 'Event',
    description: item.snippet || 'No description available',
    success: false,
    error: 'Extraction failed - showing URL stub'
  }));
}

/**
 * Main extraction orchestrator with fallbacks
 */
export async function extractWithFallbacks(
  items: ExtractionItem[],
  config: ExtractionConfig = DEFAULT_EXTRACTION_CONFIG,
  trace: SearchTrace
): Promise<ExtractionResult[]> {
  // Primary extraction
  const primaryResults = await extractEventsWithTimeouts(items, config, trace);
  
  const successful = primaryResults.filter(r => r.success);
  const failed = primaryResults.filter(r => !r.success && !r.timeout);
  const timedOut = primaryResults.filter(r => r.timeout);
  
  // If we have some successful results, return them
  if (successful.length > 0) {
    console.info(`Extraction completed: ${successful.length} successful, ${failed.length} failed, ${timedOut.length} timed out`);
    return primaryResults;
  }
  
  // If no successful results, try fallback extraction
  console.warn('No successful extractions, attempting fallback');
  const fallbackResults = await fallbackExtraction([...failed, ...timedOut], trace);
  
  // If fallback also fails, return URL stubs
  if (fallbackResults.filter(r => r.success).length === 0) {
    console.warn('All extraction methods failed, returning URL stubs');
    return createUrlStubs(items);
  }
  
  return [...successful, ...fallbackResults];
}
