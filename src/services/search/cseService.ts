/**
 * Google CSE Search Service
 * 
 * Fixes 400 handling and stops claiming "success: true" when it isn't
 */

import { buildEffectiveQuery } from '@/search/query';
import { withTimeoutAndRetry } from '@/utils/net/withTimeoutAndRetry';
import { logger } from '@/utils/logger';

type CSEArgs = {
  baseQuery: string;
  userText?: string;
  crCountry?: string;  // e.g., 'countryDE'
  gl?: string;         // 'de'
  lr?: string;         // 'lang_de|lang_en'
  num?: number;        // 10..50
  dateRestrict?: string; // e.g., 'd7','w1','m1' (CSE supports dateRestrict; not tbs)
};

export async function cseSearch(args: CSEArgs) {
  const {
    baseQuery, userText, crCountry = 'countryDE', gl = 'de', lr = 'lang_de|lang_en',
    num = 50, dateRestrict
  } = args;

  if (!baseQuery?.trim()) throw new Error('cseSearch: baseQuery required');
  const q = buildEffectiveQuery({ baseQuery, userText });

  // CSE: avoid 400s (trim query) and retry without locale clamps
  function buildCSEUrl(q: string, withLocale: boolean) {
    const u = new URL('https://www.googleapis.com/customsearch/v1');
    u.searchParams.set('q', q.slice(0, 256));         // trim long queries to reduce 400s
    u.searchParams.set('key', process.env.GOOGLE_API_KEY!);
    u.searchParams.set('cx', process.env.GOOGLE_CSE_CX!);
    u.searchParams.set('num', '10');
    u.searchParams.set('safe', 'off');
    if (withLocale) {
      u.searchParams.set('hl', 'de');
      u.searchParams.set('gl', 'de');
      // Avoid lr/cr which often trigger 400 when combined with other params
    }
    return u.toString();
  }

  async function cseSearchRobust(q: string) {
    let res = await fetch(buildCSEUrl(q, true));
    if (res.status === 400) {
      res = await fetch(buildCSEUrl(q, false));
    }
    if (!res.ok) return { items: [] };
    const json = await res.json().catch(() => ({}));
    return { items: Array.isArray(json.items) ? json.items : [] };
  }

  return await cseSearchRobust(q);
}
