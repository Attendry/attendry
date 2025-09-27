/**
 * Search Filter Utilities
 * 
 * Don't over-filter dates when looking for non-event pages
 */

export function filterByDate(items: any[], opts: { from?: string; to?: string; allowUndated?: boolean }) {
  const allowUndated = opts.allowUndated ?? true; // ✅ default true
  
  if (!opts.from && !opts.to) {
    return items; // No date filtering
  }
  
  return items.filter(item => {
    // If item has no date and we allow undated, keep it
    if (!item.date && allowUndated) {
      return true;
    }
    
    // If item has no date and we don't allow undated, drop it
    if (!item.date && !allowUndated) {
      return false;
    }
    
    // Apply date range filtering for items with dates
    const itemDate = new Date(item.date);
    const fromDate = opts.from ? new Date(opts.from) : null;
    const toDate = opts.to ? new Date(opts.to) : null;
    
    if (fromDate && itemDate < fromDate) return false;
    if (toDate && itemDate > toDate) return false;
    
    return true;
  });
}
