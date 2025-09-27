/**
 * Country/Date Inference
 * 
 * Run inference on scraped content before any country/date filter
 */

export function inferCountryFrom(url: string, text: string) {
  if (/\.de(\/|$)/i.test(url)) return 'DE';
  if (/\b(Deutschland|Berlin|München|Frankfurt|Köln|Hamburg|Stuttgart|Leipzig|Düsseldorf)\b/i.test(text)) return 'DE';
  return null;
}

export function inferDateFrom(text: string) {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const dmy = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (dmy) {
    const d = dmy[1].padStart(2,'0'), m = dmy[2].padStart(2,'0');
    const y = dmy[3].length === 2 ? '20'+dmy[3] : dmy[3];
    return `${y}-${m}-${d}`;
  }
  return undefined;
}
