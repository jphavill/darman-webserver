export const THEME_TOKENS = {
  textSoft: '--text-soft',
  borderStrong: '--border-strong',
  accent: '--accent',
  chartGridLine: '--chart-grid-line',
  chartBenchmarkLine: '--chart-benchmark-line'
} as const;

export const RUNNER_PALETTE_TOKENS = [
  '--runner-palette-1',
  '--runner-palette-2',
  '--runner-palette-3',
  '--runner-palette-4',
  '--runner-palette-5',
  '--runner-palette-6',
  '--runner-palette-7',
  '--runner-palette-8'
] as const;

export function resolveThemeToken(token: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallback;
  }

  const resolved = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return resolved || fallback;
}

export function resolveRunnerPalette(fallbackPalette: readonly string[]): string[] {
  const resolvedPalette = RUNNER_PALETTE_TOKENS.map((token) => resolveThemeToken(token, '')).filter((color) => color.length > 0);
  return resolvedPalette.length > 0 ? resolvedPalette : [...fallbackPalette];
}
