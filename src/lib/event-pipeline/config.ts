/**
 * Event Pipeline Configuration
 * 
 * Default configuration and feature flags for the new event pipeline
 */

import { EventPipelineConfig } from './types';

// Default pipeline configuration
export const DEFAULT_PIPELINE_CONFIG: EventPipelineConfig = {
  thresholds: {
    prioritization: 0.5,      // Minimum score to proceed from prioritization
    confidence: 0.5,          // Minimum confidence to publish
    parseQuality: 0.4         // Minimum parse quality
  },
  sources: {
    cse: true,                // Google Custom Search Engine - high precision
    firecrawl: true,          // Firecrawl for site maps, agenda pages, PDFs
    curated: false            // Curated seed list - start disabled
  },
  limits: {
    maxCandidates: 50,        // Max URLs to discover
    maxExtractions: 10        // Max events to extract
  },
  timeouts: {
    discovery: 30000,         // 30s - discovery timeout
    prioritization: 15000,    // 15s - prioritization timeout per batch
    parsing: 10000            // 10s - parsing timeout per URL
  }
};

// Feature flags
export const PIPELINE_FEATURE_FLAG = 'ENABLE_NEW_PIPELINE';
export const PIPELINE_DEBUG_FLAG = 'PIPELINE_DEBUG_MODE';

// Environment-based configuration
export function getPipelineConfig(): EventPipelineConfig {
  const config = { ...DEFAULT_PIPELINE_CONFIG };
  
  // Override with environment variables if present
  if (process.env.PIPELINE_PRIORITIZATION_THRESHOLD) {
    config.thresholds.prioritization = parseFloat(process.env.PIPELINE_PRIORITIZATION_THRESHOLD);
  }
  
  if (process.env.PIPELINE_CONFIDENCE_THRESHOLD) {
    config.thresholds.confidence = parseFloat(process.env.PIPELINE_CONFIDENCE_THRESHOLD);
  }
  
  if (process.env.PIPELINE_MAX_CANDIDATES) {
    config.limits.maxCandidates = parseInt(process.env.PIPELINE_MAX_CANDIDATES);
  }
  
  if (process.env.PIPELINE_MAX_EXTRACTIONS) {
    config.limits.maxExtractions = parseInt(process.env.PIPELINE_MAX_EXTRACTIONS);
  }
  
  // Source configuration
  if (process.env.PIPELINE_ENABLE_CSE !== undefined) {
    config.sources.cse = process.env.PIPELINE_ENABLE_CSE === 'true';
  }
  
  if (process.env.PIPELINE_ENABLE_FIRECRAWL !== undefined) {
    config.sources.firecrawl = process.env.PIPELINE_ENABLE_FIRECRAWL === 'true';
  }
  
  if (process.env.PIPELINE_ENABLE_CURATED !== undefined) {
    config.sources.curated = process.env.PIPELINE_ENABLE_CURATED === 'true';
  }
  
  return config;
}

// Check if new pipeline is enabled
export function isNewPipelineEnabled(): boolean {
  return process.env[PIPELINE_FEATURE_FLAG] === 'true';
}

// Check if debug mode is enabled
export function isDebugModeEnabled(): boolean {
  return process.env[PIPELINE_DEBUG_FLAG] === 'true';
}

// Validation function for configuration
export function validateConfig(config: EventPipelineConfig): string[] {
  const errors: string[] = [];
  
  // Validate thresholds
  if (config.thresholds.prioritization < 0 || config.thresholds.prioritization > 1) {
    errors.push('Prioritization threshold must be between 0 and 1');
  }
  
  if (config.thresholds.confidence < 0 || config.thresholds.confidence > 1) {
    errors.push('Confidence threshold must be between 0 and 1');
  }
  
  if (config.thresholds.parseQuality < 0 || config.thresholds.parseQuality > 1) {
    errors.push('Parse quality threshold must be between 0 and 1');
  }
  
  // Validate limits
  if (config.limits.maxCandidates <= 0) {
    errors.push('Max candidates must be greater than 0');
  }
  
  if (config.limits.maxExtractions <= 0) {
    errors.push('Max extractions must be greater than 0');
  }
  
  if (config.limits.maxExtractions > config.limits.maxCandidates) {
    errors.push('Max extractions cannot be greater than max candidates');
  }
  
  // Validate timeouts
  if (config.timeouts.discovery <= 0) {
    errors.push('Discovery timeout must be greater than 0');
  }
  
  if (config.timeouts.prioritization <= 0) {
    errors.push('Prioritization timeout must be greater than 0');
  }
  
  if (config.timeouts.parsing <= 0) {
    errors.push('Parsing timeout must be greater than 0');
  }
  
  // Validate sources
  const hasAnySource = config.sources.cse || config.sources.firecrawl || config.sources.curated;
  if (!hasAnySource) {
    errors.push('At least one discovery source must be enabled');
  }
  
  return errors;
}
