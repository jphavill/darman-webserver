import { describe, expect, it } from 'vitest';
import { formatDisplayDate, formatSprintMs } from './sprint-format';

describe('sprint-format helpers', () => {
  it('formats sprint milliseconds as seconds with three decimals', () => {
    expect(formatSprintMs(9876)).toBe('9.876 s');
  });

  it('returns fallback marker for invalid sprint time', () => {
    expect(formatSprintMs(Number.NaN)).toBe('-');
  });

  it('preserves non-date strings', () => {
    expect(formatDisplayDate('not-a-date')).toBe('not-a-date');
  });
});
