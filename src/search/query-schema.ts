import { z } from 'zod';
import { logger } from '../utils/logger';

const ISO_ALPHA2_CODES = new Set<string>([
  'ad','ae','af','ag','ai','al','am','ao','aq','ar','as','at','au','aw','ax','az',
  'ba','bb','bd','be','bf','bg','bh','bi','bj','bl','bm','bn','bo','bq','br','bs','bt','bv','bw','by','bz',
  'ca','cc','cd','cf','cg','ch','ci','ck','cl','cm','cn','co','cr','cu','cv','cw','cx','cy','cz',
  'de','dj','dk','dm','do','dz',
  'ec','ee','eg','eh','er','es','et',
  'fi','fj','fk','fm','fo','fr',
  'ga','gb','gd','ge','gf','gg','gh','gi','gl','gm','gn','gp','gq','gr','gs','gt','gu','gw','gy',
  'hk','hm','hn','hr','ht','hu',
  'id','ie','il','im','in','io','iq','ir','is','it',
  'je','jm','jo','jp',
  'ke','kg','kh','ki','km','kn','kp','kr','kw','ky','kz',
  'la','lb','lc','li','lk','lr','ls','lt','lu','lv','ly',
  'ma','mc','md','me','mf','mg','mh','mk','ml','mm','mn','mo','mp','mq','mr','ms','mt','mu','mv','mw','mx','my','mz',
  'na','nc','ne','nf','ng','ni','nl','no','np','nr','nu','nz',
  'om',
  'pa','pe','pf','pg','ph','pk','pl','pm','pn','pr','ps','pt','pw','py',
  'qa',
  're','ro','rs','ru','rw',
  'sa','sb','sc','sd','se','sg','sh','si','sj','sk','sl','sm','sn','so','sr','ss','st','sv','sx','sy','sz',
  'tc','td','tf','tg','th','tj','tk','tl','tm','tn','to','tr','tt','tv','tw','tz',
  'ua','ug','um','us','uy','uz',
  'va','vc','ve','vg','vi','vn','vu',
  'wf','ws',
  'ye','yt',
  'za','zm','zw'
]);

const WHITESPACE_REGEX = /\s+/g;
const DIACRITIC_REGEX = /\p{Diacritic}/gu;

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const QuerySchema = z.object({
  query: z.string().min(1, 'query is required'),
  intent: z
    .enum(['event', 'speaker', 'company', 'topic', 'generic'])
    .default('generic'),
  country: z
    .string()
    .min(2, 'country code required')
    .max(2, 'country must be ISO-3166-1 alpha-2')
    .transform((value) => value.trim().toLowerCase()),
  region: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  language_pref: z
    .array(z.string().min(2).max(5))
    .optional()
    .transform((value) => value?.map((lang) => lang.trim().toLowerCase()) || undefined),
  date_range: z
    .object({
      from: z
        .string()
        .optional()
        .refine((val) => !val || dateRegex.test(val), {
          message: 'date_range.from must be ISO-8601 (YYYY-MM-DD)',
        }),
      to: z
        .string()
        .optional()
        .refine((val) => !val || dateRegex.test(val), {
          message: 'date_range.to must be ISO-8601 (YYYY-MM-DD)',
        }),
    })
    .optional()
    .refine(
      (value) => {
        if (!value?.from || !value?.to) return true;
        return value.from <= value.to;
      },
      { message: 'date_range.from must be <= date_range.to' }
    ),
  freshness_days: z
    .number()
    .int()
    .positive()
    .max(365 * 5)
    .optional(),
  page_limit: z.number().int().positive().max(100).default(10),
  top_k_lex: z.number().int().positive().max(200).default(50),
  top_k_sem: z.number().int().positive().max(200).default(50),
  top_k_rerank: z.number().int().positive().max(100).default(20),
  sources_allowlist: z
    .array(z.string().min(1))
    .optional()
    .transform((value) => value?.map((item) => item.trim().toLowerCase()) || undefined),
  sources_blocklist: z
    .array(z.string().min(1))
    .optional()
    .transform((value) => value?.map((item) => item.trim().toLowerCase()) || undefined),
});

export type QuerySchema = z.input<typeof QuerySchema>;
export type NormalizedQueryBase = z.infer<typeof QuerySchema>;

export type NormalizedQuery = NormalizedQueryBase & {
  query_normalised: string;
  query_ascii: string;
  query_original: string;
  correlationId?: string;
};

function collapseWhitespace(value: string): string {
  return value.replace(WHITESPACE_REGEX, ' ').trim();
}

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(DIACRITIC_REGEX, '');
}

export function normalizeQuery(input: unknown, opts?: { correlationId?: string }): NormalizedQuery {
  const parsed = QuerySchema.parse(input);

  if (!ISO_ALPHA2_CODES.has(parsed.country)) {
    throw new Error(`Unsupported country code: ${parsed.country}`);
  }

  const queryOriginal = parsed.query;
  const queryNormalised = collapseWhitespace(queryOriginal);
  const queryAscii = stripDiacritics(queryNormalised);

  const normalised: NormalizedQuery = {
    ...parsed,
    query: queryNormalised,
    query_normalised: queryNormalised,
    query_ascii: queryAscii,
    query_original: queryOriginal,
    correlationId: opts?.correlationId,
  };

  logger.info({
    at: 'search.normalizeQuery',
    correlationId: opts?.correlationId,
    country: normalised.country,
    languages: normalised.language_pref,
    dateRange: normalised.date_range,
    freshnessDays: normalised.freshness_days,
  });

  return normalised;
}

export { QuerySchema as querySchema };

