/**
 * Safe Query Builder (explicit-only)
 * - Requires opts.baseQuery
 * - Never touches globals
 * - Single-wrap behavior
 * - Sanitizes inputs
 */

export type BuildQueryOpts = {
  baseQuery: string;     // required
  userText?: string;     // optional
  maxLen?: number;       // optional length cap
};

const DEFAULT_MAXLEN = 300;

function sanitize(raw: string, maxLen = DEFAULT_MAXLEN): string {
  if (!raw) return '';
  let s = raw
    .replace(/[\u0000-\u001F\u007F]+/g, '')   // control chars
    .replace(/\s+/g, ' ')                      // collapse whitespace
    .trim();

  if (s.length > maxLen) s = s.slice(0, maxLen).trim();

  // allow-list characters commonly used in queries
  s = s.replace(/[^A-Za-z0-9 '"()/:._*\-+|]/g, '');

  // quick balance guards
  const opens = (s.match(/\(/g) || []).length;
  const closes = (s.match(/\)/g) || []).length;
  if (closes > opens) {
    let excess = closes - opens;
    while (excess-- > 0 && s.endsWith(')')) s = s.slice(0, -1);
  }
  if (opens > closes) {
    let excess = opens - closes;
    while (excess-- > 0 && s.startsWith('(')) s = s.slice(1);
  }

  // collapse outer duplicates: "((foo))" -> "(foo)"
  s = s.replace(/^\(+/, '(').replace(/\)+$/, ')');
  return s;
}

function wrapOnce(q: string): string {
  const t = q.trim();
  return t.startsWith('(') && t.endsWith(')') ? t : `(${t})`;
}

// DO NOT read env or globals here – only use opts.
export function buildSearchQuery(opts: BuildQueryOpts): string {
  if (!opts?.baseQuery?.trim()) throw new Error('buildSearchQuery: baseQuery missing');
  const bq = opts.baseQuery.trim();
  const ut = (opts.userText ?? '').trim();
  if (ut) return ut.startsWith('(') && ut.endsWith(')') ? ut : `(${ut})`;
  return bq.startsWith('(') && bq.endsWith(')') ? bq : `(${bq})`;
}
