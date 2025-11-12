/**
 * Auto-Expand Date Window Logic
 * Expands search window from 7 → 14 days if insufficient solid hits
 */

import { SearchCfg } from '@/config/search';

export type Window = {
  from: string;  // YYYY-MM-DD
  to: string;    // YYYY-MM-DD
};

/**
 * Compute expanded window (7 days → 14 days)
 * Only expands if current window is < 14 days
 */
export function computeExpandedWindow(win: Window): Window {
  const from = new Date(win.from);
  const to = new Date(win.to);
  
  // Calculate current span in days
  const spanDays = Math.ceil((+to - +from) / (24 * 3600 * 1000)) + 1;
  
  // Already 14+ days, don't expand further
  if (spanDays >= 14) {
    return win;
  }
  
  // Expand to 14 days from start date
  const newTo = new Date(from);
  newTo.setDate(newTo.getDate() + 13); // +13 days = 14-day span inclusive
  
  return {
    from: formatDate(from),
    to: formatDate(newTo)
  };
}

/**
 * Check if we should auto-expand based on solid hit count
 */
export function shouldAutoExpand(solidCount: number): boolean {
  return SearchCfg.allowAutoExpand && solidCount < SearchCfg.minSolidHits;
}

/**
 * Format Date to YYYY-MM-DD
 */
function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD to Date
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Calculate span in days between two dates
 */
export function calculateSpanDays(win: Window): number {
  const from = parseDate(win.from);
  const to = parseDate(win.to);
  return Math.ceil((+to - +from) / (24 * 3600 * 1000)) + 1;
}

