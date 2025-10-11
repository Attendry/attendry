import { stageCounter, logSuppressedSamples, type Reason } from '../src/lib/obs/triage-metrics';

type Item = { id: string; title?: string | null; url?: string | null; score?: number | null; reason?: string | null };

const sampleInput: Item[] = [
  { id: 'good', title: 'Compliance Summit 2025', url: 'https://events.example.com/compliance-summit-2025', score: 0.9, reason: 'gemini' },
  { id: 'dupe', title: 'Compliance Summit 2025', url: 'https://events.example.com/compliance-summit-2025', score: 0.85, reason: 'gemini' },
  { id: 'missing', title: null, url: null, score: null, reason: 'missing_fields' },
  { id: 'low', title: 'Corporate Training', url: 'https://events.example.com/corp-training', score: 0.2, reason: 'heuristic_low' },
  { id: 'alt', title: 'Data Privacy Webinar', url: 'https://events.example.com/data-privacy-webinar', score: 0.55, reason: 'heuristic_mid' }
];

function mockPipeline(items: Item[]) {
  const reasons: Reason[] = [];
  const uniqueUrls = new Map<string, Item>();
  const deduped: Item[] = [];

  for (const item of items) {
    const key = item.url ?? item.id;
    if (!key) continue;
    if (uniqueUrls.has(key)) {
      const reason = reasons.find(r => r.key === 'duplicate');
      if (reason) {
        reason.count += 1;
        reason.samples.push(item);
      } else {
        reasons.push({ key: 'duplicate', count: 1, samples: [item] });
      }
      continue;
    }
    uniqueUrls.set(key, item);
    deduped.push(item);
  }

  stageCounter('dedupe', items, deduped, reasons);
  logSuppressedSamples('dedupe', reasons);

  const filtered = deduped.filter(item => item.url && item.title);
  const dropReasons: Reason[] = deduped
    .filter(item => !filtered.includes(item))
    .map(item => ({ key: 'missing_fields', count: 1, samples: [item] }));

  stageCounter('filter:required', deduped, filtered, dropReasons);
  logSuppressedSamples('filter:required', dropReasons);

  const scored = filtered.filter(item => (item.score ?? 0) >= 0.3);
  const scoreReasons: Reason[] = filtered
    .filter(item => !scored.includes(item))
    .map(item => ({ key: 'low_score', count: 1, samples: [item] }));

  stageCounter('filter:score', filtered, scored, scoreReasons);
  logSuppressedSamples('filter:score', scoreReasons);

  stageCounter('final', scored, scored, [{ key: 'final', count: scored.length, samples: scored.slice(0, 3) }]);
  return scored;
}

const finalItems = mockPipeline(sampleInput);
console.log('Mock pipeline finished with', finalItems.length, 'items');

