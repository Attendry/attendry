/**
 * Search Filter Utilities
 * 
 * Don't over-filter dates when looking for non-event pages
 */

type FilterMode = 'events' | 'knowledge';

export function filterByDate<T extends { starts_at?: string | null }>(
  items: T[],
  opts: { mode: FilterMode; from?: string; to?: string }
): T[] {
  if (!Array.isArray(items) || !items.length) return [];

  if (opts.mode !== 'events') {
    // Knowledge mode keeps everything; date windows don't apply.
    return items;
  }

  // Events-only windowing:
  const { from, to } = opts;
  if (!from && !to) return items;
  const fromMs = from ? Date.parse(from) : -Infinity;
  const toMs = to ? Date.parse(to) : +Infinity;
  return items.filter((it) => {
    const s = it.starts_at ? Date.parse(it.starts_at) : NaN;
    return Number.isFinite(s) && s >= fromMs && s <= toMs;
  });
}

