export function formatSprintMs(ms: number): string {
  if (!Number.isFinite(ms)) {
    return '-';
  }

  return `${(ms / 1000).toFixed(3)} s`;
}

export function formatDisplayDate(value: string): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
}
