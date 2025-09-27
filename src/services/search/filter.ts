/**
 * Search Filter Utilities
 * 
 * Don't over-filter dates when looking for non-event pages
 */

export function filterByDate(items: any[], opts: { from?: string; to?: string; allowUndated?: boolean; industry?: string; mode?: string }) {
  // If you truly want events-only, keep current behavior.
  // Otherwise, allow undated pages.
  const eventsMode = opts.mode === 'events';
  const allowUndated = !eventsMode;
  
  if (!opts.from && !opts.to) {
    return items; // No date filtering
  }
  
  return items.filter(item => {
    if (eventsMode) {
      // your existing from/to logic
      if (!item.date) return false;
      const itemDate = new Date(item.date);
      const fromDate = opts.from ? new Date(opts.from) : null;
      const toDate = opts.to ? new Date(opts.to) : null;
      
      if (fromDate && itemDate < fromDate) return false;
      if (toDate && itemDate > toDate) return false;
      
      return true;
    }
    // Knowledge mode keeps undated
    return true;
  });
}

