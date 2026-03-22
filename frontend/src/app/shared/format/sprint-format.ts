export type SprintDisplayUnit = 'seconds' | 'kmh' | 'minPerKm';

export interface SprintDisplayUnitMeta {
  value: SprintDisplayUnit;
  label: string;
  shortLabel: string;
  tableHeaderLabel: string;
  chartAxisLabel: string;
}

const SPRINT_DISPLAY_UNIT_META: Record<SprintDisplayUnit, SprintDisplayUnitMeta> = {
  seconds: {
    value: 'seconds',
    label: 'Seconds',
    shortLabel: 's',
    tableHeaderLabel: 'Sprint Time (s)',
    chartAxisLabel: 'Sprint Time (s)'
  },
  kmh: {
    value: 'kmh',
    label: 'Speed (km/h)',
    shortLabel: 'km/h',
    tableHeaderLabel: 'Speed (km/h)',
    chartAxisLabel: 'Speed (km/h)'
  },
  minPerKm: {
    value: 'minPerKm',
    label: 'Pace (min/km)',
    shortLabel: 'min/km',
    tableHeaderLabel: 'Pace (min/km)',
    chartAxisLabel: 'Pace (min/km)'
  }
};

export const SPRINT_DISPLAY_UNITS: SprintDisplayUnit[] = ['seconds', 'kmh', 'minPerKm'];

export function getSprintDisplayUnitMeta(unit: SprintDisplayUnit): SprintDisplayUnitMeta {
  return SPRINT_DISPLAY_UNIT_META[unit];
}

export function convertSprintMsToUnit(ms: number, unit: SprintDisplayUnit): number {
  if (!Number.isFinite(ms) || ms <= 0) {
    return Number.NaN;
  }

  if (unit === 'seconds') {
    return ms / 1000;
  }
  if (unit === 'kmh') {
    return 360000 / ms;
  }
  return ms / 6000;
}

export function convertSprintUnitToMs(value: number, unit: SprintDisplayUnit): number {
  if (!Number.isFinite(value) || value <= 0) {
    return Number.NaN;
  }

  if (unit === 'seconds') {
    return value * 1000;
  }
  if (unit === 'kmh') {
    return 360000 / value;
  }
  return value * 6000;
}

export function formatSprintValue(value: number, unit: SprintDisplayUnit): string {
  if (!Number.isFinite(value)) {
    return '-';
  }

  const axisValue = formatSprintAxisValue(value, unit);

  if (unit === 'seconds') {
    return `${axisValue} s`;
  }
  if (unit === 'kmh') {
    return `${axisValue} km/h`;
  }
  return `${axisValue} min/km`;
}

export function formatSprintMs(ms: number, unit: SprintDisplayUnit = 'seconds'): string {
  return formatSprintValue(convertSprintMsToUnit(ms, unit), unit);
}

export function formatSprintAxisValue(value: number, unit: SprintDisplayUnit): string {
  if (!Number.isFinite(value)) {
    return '-';
  }

  if (unit === 'seconds') {
    return value.toFixed(3);
  }
  if (unit === 'kmh') {
    return value.toFixed(2);
  }
  return formatMinutesPerKilometer(value);
}

function formatMinutesPerKilometer(minutesPerKilometer: number): string {
  const totalSeconds = Math.round(minutesPerKilometer * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatDisplayDate(value: string): string {
  if (!value) {
    return '-';
  }

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const monthIndex = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, monthIndex, day).toLocaleDateString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
}
