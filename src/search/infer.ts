/**
 * Country/Date Inference
 * 
 * Run inference on scraped content before any country/date filter
 */

export function inferCountry(url: string, text: string) {
  if (/\.de(\/|$)/i.test(url)) return 'DE';
  if (/\b(Deutschland|Berlin|München|Frankfurt|Köln|Hamburg|Stuttgart|Leipzig|Düsseldorf)\b/i.test(text)) return 'DE';
  if (/\b(Österreich|Wien)\b/i.test(text)) return 'AT';
  if (/\b(Schweiz|Zürich|Bern|Basel)\b/i.test(text)) return 'CH';
  return null;
}

export function inferDate(text: string) {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const dots = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (dots) {
    const d = dots[1].padStart(2,'0'); const m = dots[2].padStart(2,'0'); const y = dots[3].length===2 ? '20'+dots[3] : dots[3].padStart(4,'0');
    return `${y}-${m}-${d}`;
  }
  return undefined;
}
