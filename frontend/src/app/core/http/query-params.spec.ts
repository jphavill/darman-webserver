import { describe, expect, it } from 'vitest';
import { buildHttpParams } from './query-params';

describe('buildHttpParams', () => {
  it('drops nullish and empty values', () => {
    const params = buildHttpParams({
      limit: 25,
      offset: 0,
      mode: 'progression',
      location: null,
      search: ''
    });

    expect(params.get('limit')).toBe('25');
    expect(params.get('offset')).toBe('0');
    expect(params.get('mode')).toBe('progression');
    expect(params.has('location')).toBe(false);
    expect(params.has('search')).toBe(false);
  });
});
