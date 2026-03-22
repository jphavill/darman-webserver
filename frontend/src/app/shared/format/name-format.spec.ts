import { describe, expect, it } from 'vitest';
import { normalizeDisplayName } from './name-format';

describe('name-format helpers', () => {
  it('capitalizes the first character of a name', () => {
    expect(normalizeDisplayName('alice')).toBe('Alice');
  });

  it('returns an empty string for missing values', () => {
    expect(normalizeDisplayName('')).toBe('');
    expect(normalizeDisplayName(null)).toBe('');
    expect(normalizeDisplayName(undefined)).toBe('');
  });
});
