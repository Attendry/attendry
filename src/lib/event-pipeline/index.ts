/**
 * Event Pipeline - Main Entry Point
 * 
 * Exports all pipeline components and provides the main entry point
 */

// Core types
export * from './types';

// Configuration
export * from './config';

// Pipeline stages
export { EventDiscoverer } from './discover';
export { EventPrioritizer } from './prioritize';
export { EventParser } from './parse';
export { EventExtractor } from './extract';
export { EventPublisher } from './publish';
export type { PublishedEvent } from './publish';
export { EventPipeline } from './orchestrator';

// Logging and quality gates
export { PipelineLogger, QualityGates } from './logger';

// Fallback integration
export { PipelineFallback, createPipelineWithFallback, executeNewPipeline } from './fallback';

// Main entry point
export { executeNewPipeline as executeEventPipeline } from './fallback';
