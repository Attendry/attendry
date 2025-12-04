/**
 * Auto-Expand Date Window Logic
 * 
 * Enhanced to support aggressive expansion when zero or few results are found.
 * Expansion tiers:
 * - 0 results: Expand to 90 days from start date
 * - 1-2 results: Expand to 60 days from start date  
 * - < minSolidHits: Expand to 30 days minimum
 */

import { SearchCfg } from '@/config/search';

export type Window = {
  from: string;
  to: string;
};

export type ExpansionLevel = 'none' | 'small' | 'medium' | 'large';

/**
 * Compute expanded window based on current result count
 * @param win - Original search window
 * @param solidCount - Number of solid hits found (default 0 for maximum expansion)
 * @returns Expanded window
 */
export function computeExpandedWindow(win: Window, solidCount: number = 0): Window {
  const from = new Date(win.from);
  const to = new Date(win.to);
  
  const currentSpanDays = Math.ceil((+to - +from) / (24 * 3600 * 1000)) + 1;
  
  // Determine target expansion based on result count
  let targetDays: number;
  let expansionLevel: ExpansionLevel;
  
  if (solidCount === 0) {
    // Zero results: Aggressive expansion to 90 days
    targetDays = 90;
    expansionLevel = 'large';
  } else if (solidCount < 2) {
    // 1 result: Medium expansion to 60 days
    targetDays = 60;
    expansionLevel = 'medium';
  } else if (solidCount < SearchCfg.minSolidHits) {
    // 2 results but below minimum: Small expansion to 45 days
    targetDays = 45;
    expansionLevel = 'small';
  } else {
    // Already have enough results, no expansion needed
    return win;
  }
  
  // Don't shrink the window, only expand
  if (currentSpanDays >= targetDays) {
    // Already at or beyond target, try next tier up
    if (expansionLevel === 'small' && currentSpanDays < 60) {
      targetDays = 60;
    } else if (expansionLevel === 'medium' && currentSpanDays < 90) {
      targetDays = 90;
    } else if (currentSpanDays < 120) {
      // Ultimate fallback: expand to 120 days (4 months)
      targetDays = 120;
    } else {
      // Already at maximum, return unchanged
      return win;
    }
  }
  
  const newTo = new Date(from);
  newTo.setDate(newTo.getDate() + targetDays - 1);
  
  console.log(`[auto-expand] Expanding window: ${currentSpanDays} days → ${targetDays} days (solidCount: ${solidCount}, level: ${expansionLevel})`);
  
  return {
    from: formatDate(from),
    to: formatDate(newTo)
  };
}

/**
 * Determine if auto-expansion should be attempted
 * @param solidCount - Number of solid hits found
 * @returns true if expansion should be attempted
 */
export function shouldAutoExpand(solidCount: number): boolean {
  return SearchCfg.allowAutoExpand && solidCount < SearchCfg.minSolidHits;
}

/**
 * Get expansion metadata for logging/UI
 */
export function getExpansionInfo(originalWindow: Window, expandedWindow: Window, solidCount: number): {
  expanded: boolean;
  originalDays: number;
  expandedDays: number;
  reason: string;
} {
  const origFrom = new Date(originalWindow.from);
  const origTo = new Date(originalWindow.to);
  const expTo = new Date(expandedWindow.to);
  
  const originalDays = Math.ceil((+origTo - +origFrom) / (24 * 3600 * 1000)) + 1;
  const expandedDays = Math.ceil((+expTo - +origFrom) / (24 * 3600 * 1000)) + 1;
  
  let reason = 'No expansion needed';
  if (solidCount === 0) {
    reason = 'Zero results found - maximum expansion';
  } else if (solidCount < 2) {
    reason = 'Only 1 result found - large expansion';
  } else if (solidCount < SearchCfg.minSolidHits) {
    reason = `Below minimum ${SearchCfg.minSolidHits} results - moderate expansion`;
  }
  
  return {
    expanded: expandedDays > originalDays,
    originalDays,
    expandedDays,
    reason
  };
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
