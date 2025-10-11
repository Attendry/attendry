import { POST } from './route';

function buildRequest(body: Record<string, unknown>) {
  return new Request('http://test', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('POST /api/events/run', () => {
  it('accepts empty body and does not crash', async () => {
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).not.toBe(500);
  });

  it('uses userText when provided', async () => {
    const req = buildRequest({ userText: 'foo' });
    const res = await POST(req);
    const json = await res.json();
    expect(json.effectiveQ).toContain('(foo)');
  });

  it('never returns 400 for missing baseQuery - uses fallback', async () => {
    const req = buildRequest({ userText: 'test' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.baseQuerySource).toBeDefined();
    expect(['config.searchConfig.baseQuery', 'industry.default', 'safe.default']).toContain(json.baseQuerySource);
  });

  it('uses body baseQuery when provided', async () => {
    const req = buildRequest({ baseQuery: '(foo OR bar)' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.baseQuerySource).toBe('body.baseQuery');
    expect(json.effectiveQ).toBe('(foo OR bar)');
  });

  it('handles invalid JSON gracefully', async () => {
    const req = new Request('http://test', { method: 'POST', body: 'invalid json' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_request');
  });

  it('returns demo fallback when pipeline returns no events', async () => {
    const req = buildRequest({ userText: 'no results please', country: 'DE' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.events)).toBe(true);
    expect(json.events.length).toBeGreaterThan(0);
    expect(json.provider).toBeDefined();
  });
});
