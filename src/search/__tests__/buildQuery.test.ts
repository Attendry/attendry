import { buildSearchQuery } from '../query';

describe('buildSearchQuery', () => {
  it('uses baseQuery when userText is empty', () => {
    expect(buildSearchQuery({ baseQuery: 'foo bar' })).toBe('(foo bar)');
  });

  it('uses userText when provided', () => {
    expect(buildSearchQuery({ baseQuery: 'foo', userText: 'bar baz' })).toBe('(bar baz)');
  });

  it('wraps only once', () => {
    expect(buildSearchQuery({ baseQuery: '(alpha OR beta)' })).toBe('(alpha OR beta)');
    expect(buildSearchQuery({ baseQuery: 'alpha OR beta' })).toBe('(alpha OR beta)');
  });

  it('sanitizes control chars and odd symbols', () => {
    expect(buildSearchQuery({ baseQuery: 'a\u0000b\u0007c' })).toBe('(abc)');
  });

  it('throws without baseQuery', () => {
    expect(() => buildSearchQuery({ baseQuery: '   ' })).toThrow();
    // @ts-expect-error Missing baseQuery should throw
    expect(() => buildSearchQuery({})).toThrow();
  });

  it('respects maxLen parameter', () => {
    const longQuery = 'a'.repeat(500);
    const result = buildSearchQuery({ baseQuery: longQuery, maxLen: 100 });
    expect(result.length).toBeLessThanOrEqual(102); // 100 + 2 for parentheses
  });

  it('balances parentheses correctly', () => {
    expect(buildSearchQuery({ baseQuery: '((foo))' })).toBe('(foo)');
    expect(buildSearchQuery({ baseQuery: 'foo))' })).toBe('(foo)');
    expect(buildSearchQuery({ baseQuery: '((foo' })).toBe('(foo)');
  });

  it('allows common query characters', () => {
    const query = 'legal OR compliance AND "data protection" site:example.com';
    const result = buildSearchQuery({ baseQuery: query });
    expect(result).toBe(`(${query})`);
  });

  it('removes disallowed characters', () => {
    const query = 'legal@#$%compliance';
    const result = buildSearchQuery({ baseQuery: query });
    expect(result).toBe('(legalcompliance)');
  });
});
