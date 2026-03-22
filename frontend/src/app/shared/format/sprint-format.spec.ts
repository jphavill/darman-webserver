import { describe, expect, it } from 'vitest';
import {
  convertSprintMsToUnit,
  convertSprintUnitToMs,
  formatDisplayDate,
  formatSprintAxisValue,
  formatSprintMs,
  formatSprintValue,
  getSprintDisplayUnitMeta
} from './sprint-format';

describe('sprint-format helpers', () => {
  it('formats sprint milliseconds as seconds with three decimals', () => {
    expect(formatSprintMs(9876)).toBe('9.876 s');
  });

  it('formats sprint milliseconds in kilometers per hour', () => {
    expect(formatSprintMs(10000, 'kmh')).toBe('36.00 km/h');
  });

  it('formats sprint milliseconds in minutes per kilometer', () => {
    expect(formatSprintMs(10000, 'minPerKm')).toBe('1:40 min/km');
  });

  it('returns fallback marker for invalid sprint time', () => {
    expect(formatSprintMs(Number.NaN)).toBe('-');
  });

  it('converts between ms and km/h', () => {
    const speed = convertSprintMsToUnit(10000, 'kmh');
    expect(speed).toBeCloseTo(36, 6);
    expect(convertSprintUnitToMs(speed, 'kmh')).toBeCloseTo(10000, 6);
  });

  it('formats raw unit values', () => {
    expect(formatSprintValue(36, 'kmh')).toBe('36.00 km/h');
    expect(formatSprintValue(2.55, 'minPerKm')).toBe('2:33 min/km');
  });

  it('formats axis values without unit suffix', () => {
    expect(formatSprintAxisValue(36, 'kmh')).toBe('36.00');
    expect(formatSprintAxisValue(2.55, 'minPerKm')).toBe('2:33');
  });

  it('returns metadata for sprint display units', () => {
    expect(getSprintDisplayUnitMeta('minPerKm').tableHeaderLabel).toBe('Pace (min/km)');
  });

  it('preserves non-date strings', () => {
    expect(formatDisplayDate('not-a-date')).toBe('not-a-date');
  });

  it('formats date-only values as calendar dates without timezone shift', () => {
    expect(formatDisplayDate('2026-03-19')).toBe(new Date(2026, 2, 19).toLocaleDateString());
  });

});
