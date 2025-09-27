/**
 * Explicit Query Builder
 * 
 * Removes globals and ensures baseQuery is always passed explicitly
 */

export function buildSearchQuery(opts: { baseQuery: string; userText?: string }): string {
  if (!opts?.baseQuery?.trim()) throw new Error('baseQuery missing');
  return `(${opts.baseQuery.trim()})`; // no postfix
}
