export type ParsedEventDate = {
  startISO: string | null;
  endISO: string | null;
  confidence: 'high' | 'low';
};

const ORDINAL_SUFFIX = /(st|nd|rd|th)/gi;
const RANGE_SEPARATOR = /[–—\-~]/;
const MONTHS = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december',
];

export function parseEventDate(input: string | null | undefined): ParsedEventDate {
  if (!input) return { startISO: null, endISO: null, confidence: 'low' };
  const cleaned = input.replace(ORDINAL_SUFFIX, '').replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(RANGE_SEPARATOR).map((part) => part.trim()).filter(Boolean);

  if (parts.length === 2) {
    const left = parseSingleDate(parts[0]);
    const right = parseSingleDate(parts[1], left?.date?.getFullYear());
    if (left?.iso && right?.iso) {
      return {
        startISO: left.iso,
        endISO: right.iso,
        confidence: left.confidence === 'high' && right.confidence === 'high' ? 'high' : 'low',
      };
    }
  }

  const single = parseSingleDate(cleaned);
  if (single?.iso) {
    return { startISO: single.iso, endISO: null, confidence: single.confidence };
  }

  return { startISO: null, endISO: null, confidence: 'low' };
}

type ParsedSingle = {
  date: Date;
  iso: string;
  confidence: 'high' | 'low';
};

function parseSingleDate(fragment: string, inheritYear?: number): ParsedSingle | null {
  const monthRegex = new RegExp(`(${MONTHS.join('|')})`, 'i');
  const monthMatch = fragment.match(monthRegex);
  const dayMatch = fragment.match(/\b(\d{1,2})\b/);
  const yearMatch = fragment.match(/\b(20\d{2})\b/);

  if (!monthMatch && yearMatch && !dayMatch) {
    const year = Number(yearMatch[1]);
    const date = new Date(Date.UTC(year, 0, 1));
    return { date, iso: toISO(date), confidence: 'low' };
  }

  const monthIdx = monthMatch ? MONTHS.indexOf(monthMatch[1].toLowerCase()) : -1;
  if (monthIdx === -1 || !dayMatch) return null;

  const year = Number(yearMatch?.[1] ?? inheritYear ?? new Date().getFullYear());
  const day = Number(dayMatch[1]);
  const date = new Date(Date.UTC(year, monthIdx, day));
  if (Number.isNaN(date.getTime())) return null;

  const confidence: 'high' | 'low' = yearMatch ? 'high' : 'low';
  return { date, iso: toISO(date), confidence };
}

const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' });

function toISO(date: Date): string {
  return formatter.format(date);
}
