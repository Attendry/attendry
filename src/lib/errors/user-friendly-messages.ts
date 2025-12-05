/**
 * User-Friendly Error Messages
 * 
 * Maps technical error messages to user-friendly, actionable messages
 */

export interface ErrorContext {
  action?: string; // What the user was trying to do
  resource?: string; // What resource was involved
  details?: Record<string, any>; // Additional context
}

/**
 * Common error patterns and their user-friendly messages
 */
const errorPatterns: Array<{
  pattern: RegExp;
  message: string;
  action?: string;
}> = [
  // Authentication errors
  {
    pattern: /authentication|unauthorized|login|session/i,
    message: "Please log in to continue. Your session may have expired.",
    action: "Log in"
  },
  {
    pattern: /permission|forbidden|access denied/i,
    message: "You don't have permission to perform this action.",
    action: "Contact your administrator"
  },
  
  // Network errors
  {
    pattern: /network|connection|timeout|fetch failed/i,
    message: "Connection problem. Please check your internet connection and try again.",
    action: "Retry"
  },
  {
    pattern: /rate limit|too many requests/i,
    message: "Too many requests. Please wait a moment and try again.",
    action: "Wait and retry"
  },
  
  // Not found errors
  {
    pattern: /not found|does not exist|missing|404/i,
    message: "We couldn't find what you're looking for. It may have been removed or the link is incorrect.",
    action: "Go back or search again"
  },
  {
    pattern: /event not found|event.*database/i,
    message: "We couldn't find that event. Try adding it to your board first, or search for it again.",
    action: "Search again"
  },
  
  // Validation errors
  {
    pattern: /invalid|validation|required|missing field/i,
    message: "Some information is missing or incorrect. Please check your input and try again.",
    action: "Check your input"
  },
  {
    pattern: /date|time|range/i,
    message: "The date range is invalid. Please make sure the start date is before the end date.",
    action: "Adjust dates"
  },
  
  // Save/Update errors
  {
    pattern: /save failed|could not save|failed to save/i,
    message: "Couldn't save your changes. Please try again, or contact support if the problem persists.",
    action: "Try again"
  },
  {
    pattern: /update failed|could not update/i,
    message: "Couldn't update this item. Please try again.",
    action: "Retry"
  },
  {
    pattern: /delete failed|could not delete/i,
    message: "Couldn't delete this item. Please try again.",
    action: "Retry"
  },
  
  // Search errors
  {
    pattern: /search failed|no results|no events found/i,
    message: "No events found matching your criteria. Try adjusting your search filters or keywords.",
    action: "Modify search"
  },
  {
    pattern: /search.*error|query.*failed/i,
    message: "Search encountered an error. Please try again with different keywords or filters.",
    action: "Try different search"
  },
  
  // Server errors
  {
    pattern: /server error|500|internal error/i,
    message: "Something went wrong on our end. We've been notified and are working on it. Please try again in a moment.",
    action: "Try again later"
  },
  {
    pattern: /service unavailable|503|maintenance/i,
    message: "The service is temporarily unavailable. We're performing maintenance. Please try again soon.",
    action: "Check back later"
  },
  
  // Generic errors
  {
    pattern: /failed|error occurred/i,
    message: "Something went wrong. Please try again, or contact support if the problem continues.",
    action: "Try again"
  }
];

/**
 * Get user-friendly error message from technical error
 */
export function getUserFriendlyMessage(
  error: string | Error | unknown,
  context?: ErrorContext
): { message: string; action?: string } {
  // Extract error message
  let errorMessage = '';
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = String(error.message);
  } else {
    errorMessage = String(error);
  }
  
  // Normalize error message
  errorMessage = errorMessage.toLowerCase().trim();
  
  // Check for matching patterns
  for (const { pattern, message, action } of errorPatterns) {
    if (pattern.test(errorMessage)) {
      // Customize message with context if available
      let finalMessage = message;
      if (context?.action) {
        finalMessage = finalMessage.replace(
          /this action|this item|your changes/i,
          context.action
        );
      }
      if (context?.resource) {
        finalMessage = finalMessage.replace(
          /this item|what you're looking for/i,
          context.resource
        );
      }
      
      return { message: finalMessage, action };
    }
  }
  
  // Default fallback message
  const defaultMessage = context?.action
    ? `Couldn't ${context.action}. Please try again, or contact support if the problem persists.`
    : "Something went wrong. Please try again, or contact support if the problem continues.";
  
  return { message: defaultMessage, action: "Try again" };
}

/**
 * Format error for toast notification
 */
export function formatErrorForToast(
  error: string | Error | unknown,
  context?: ErrorContext
): { title: string; description: string; action?: { label: string; onClick: () => void } } {
  const { message, action } = getUserFriendlyMessage(error, context);
  
  return {
    title: context?.action ? `${context.action} failed` : "Error",
    description: message,
    action: action ? {
      label: action,
      onClick: () => {
        // Default action - can be overridden
        if (typeof window !== 'undefined') {
          if (action.toLowerCase().includes('log in')) {
            window.location.href = '/login';
          } else if (action.toLowerCase().includes('retry')) {
            window.location.reload();
          }
        }
      }
    } : undefined
  };
}

/**
 * Common error messages for specific scenarios
 */
export const CommonErrors = {
  eventNotFound: (eventName?: string) => ({
    message: eventName
      ? `We couldn't find "${eventName}". Try adding it to your board first, or search for it again.`
      : "We couldn't find that event. Try adding it to your board first, or search for it again.",
    action: "Search again"
  }),
  
  saveFailed: (resource?: string) => ({
    message: resource
      ? `Couldn't save ${resource}. Please try again, or contact support if the problem persists.`
      : "Couldn't save your changes. Please try again, or contact support if the problem persists.",
    action: "Try again"
  }),
  
  networkError: () => ({
    message: "Connection problem. Please check your internet connection and try again.",
    action: "Retry"
  }),
  
  authenticationRequired: () => ({
    message: "Please log in to continue. Your session may have expired.",
    action: "Log in"
  }),
  
  noSearchResults: (hasFilters: boolean = false) => ({
    message: hasFilters
      ? "No events found matching your criteria. Try adjusting your search filters or keywords."
      : "No events found. Try using different keywords or adjusting your search.",
    action: "Modify search"
  }),
  
  invalidDateRange: () => ({
    message: "The date range is invalid. Please make sure the start date is before the end date.",
    action: "Adjust dates"
  }),
  
  serverError: () => ({
    message: "Something went wrong on our end. We've been notified and are working on it. Please try again in a moment.",
    action: "Try again later"
  })
};



