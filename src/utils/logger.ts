/**
 * Logger Utility
 * 
 * Provides structured logging for search operations
 */

export const logger = {
  info: (data: any) => console.log(JSON.stringify(data, null, 2)),
  warn: (data: any) => console.warn(JSON.stringify(data, null, 2)),
  error: (data: any) => console.error(JSON.stringify(data, null, 2)),
};
