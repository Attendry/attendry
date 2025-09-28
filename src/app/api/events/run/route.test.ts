import { POST } from './route';

describe('POST /api/events/run', () => {
  it('accepts empty body and does not crash', async () => {
    const req = new Request('http://test', { method: 'POST', body: JSON.stringify({}) });
    const res = await POST(req);
    expect(res.status).not.toBe(500);
  });

  it('uses userText when provided', async () => {
    const req = new Request('http://test', { method: 'POST', body: JSON.stringify({ userText: 'foo' }) });
    const res = await POST(req);
    const json = await res.json();
    expect(json.effectiveQ).toContain('(foo)');
  });

  it('returns proper error for missing baseQuery', async () => {
    const req = new Request('http://test', { method: 'POST', body: JSON.stringify({ userText: 'test' }) });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('baseQuery_missing');
  });

  it('handles invalid JSON gracefully', async () => {
    const req = new Request('http://test', { method: 'POST', body: 'invalid json' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_request');
  });
});
