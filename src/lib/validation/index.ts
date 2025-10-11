/**
 * Validation Module Index
 * 
 * This file exports all validation utilities, schemas, and error classes
 * for use throughout the Attendry application.
 */

// Export schemas
export * from './schemas';

// Export middleware and utilities
export { 
  createValidationMiddleware, 
  generateRequestId, 
  withErrorHandling 
} from './middleware';

// Export error classes and handlers
export { 
  ValidationError, 
  isValidationError 
} from './errors';

// Re-export commonly used types
export type {
  EventSearchRequest,
  EventExtractionRequest,
  SpeakerExtractionRequest,
  EventDiscoveryRequest,
  ProfileSaveRequest,
  WatchlistAddRequest,
  WatchlistRemoveRequest,
  ConfigSaveRequest,
  CronJobRequest,
  ChatRequest,
  TestUserCreateRequest,
  SessionFixRequest,
  EventData,
  SearchResultItem,
  UserProfile,
  WatchlistItem,
  SearchConfig,
  HealthCheckResponse,
  ApiResponse,
  ValidationErrorResponse,
} from './schemas';

// Re-export commonly used error classes
export {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
  InternalServerError,
  BusinessLogicError,
} from './errors';

// Re-export commonly used utilities
export {
  validateRequest,
  validateRequestAsync,
  handleValidationError,
  handleApiError,
  safeJsonParse,
  validateQueryParams,
  createValidatedRouteHandler,
} from './middleware';

export {
  formatZodError,
  extractErrorDetails,
} from './errors';
