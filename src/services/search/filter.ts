/**
 * Search Filter Utilities
 * 
 * Don't over-filter dates when looking for non-event pages
 */

type FilterMode = 'events' | 'knowledge';

export function filterByDate(items: any[], opts: {
  mode: FilterMode;
  from?: string;
  to?: string;
}) {
  if (!Array.isArray(items) || !items.length) return [];

  if (opts.mode !== 'events') {
    // Knowledge mode → keep everything; date isn't required
    return items;
  }

  // Events mode → your existing within-range logic
  return items.filter(item => {
    if (!item.date) return false;
    const itemDate = new Date(item.date);
    const fromDate = opts.from ? new Date(opts.from) : null;
    const toDate = opts.to ? new Date(opts.to) : null;
    
    if (fromDate && itemDate < fromDate) return false;
    if (toDate && itemDate > toDate) return false;
    
    return true;
  });
}

