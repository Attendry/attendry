/**
 * Google CSE Search Service
 * 
 * Fixes 400 handling and stops claiming "success: true" when it isn't
 */

import { buildSearchQuery } from '@/search/buildQuery';
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
  const q = buildSearchQuery({ baseQuery, userText });

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('q', q.slice(0, 256)); // trim long queries
  url.searchParams.set('key', process.env.CSE_API_KEY!);
  url.searchParams.set('cx', process.env.CSE_CX_ID!);
  url.searchParams.set('num', String(num));
  url.searchParams.set('safe', 'off');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('cr', crCountry);
  url.searchParams.set('gl', gl);
  url.searchParams.set('lr', lr);
  if (dateRestrict) url.searchParams.set('dateRestrict', dateRestrict); // ✅ use this, not tbs

  const fetcher = async () => {
    const res = await fetch(url.toString(), { method: 'GET' });
    const text = await res.text();
    if (!res.ok) {
      // ✅ Treat 4xx as error, don't mark success elsewhere.
      logger.warn({ at: 'cse_search', status: res.status, body: text.slice(0, 1000) });
      
      // Add fallback path that removes optional params on 400
      if (res.status === 400) {
        ['cr','lr'].forEach(k => url.searchParams.delete(k));
        url.searchParams.set('num','10');
        const r2 = await fetch(url.toString());
        if (r2.ok) {
          const data2 = JSON.parse(await r2.text());
          const items = (data2.items ?? []).map((i: any) => i.link).filter(Boolean);
          return { items, raw: data2 };
        }
      }
      
      throw new Error(`CSE error ${res.status}`);
    }
    const data = JSON.parse(text);
    const items = (data.items ?? []).map((i: any) => i.link).filter(Boolean);
    return { items, raw: data };
  };

  return withTimeoutAndRetry(fetcher, { timeoutMs: 15000, maxRetries: 1, backoffMs: 500 });
}
