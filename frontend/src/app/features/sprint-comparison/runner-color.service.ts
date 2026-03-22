import { Injectable } from '@angular/core';
import { resolveRunnerPalette } from '../../shared/theme/theme-tokens';

@Injectable({
  providedIn: 'root'
})
export class RunnerColorService {
  private readonly fallbackPalette = [
    'var(--runner-palette-1)',
    'var(--runner-palette-2)',
    'var(--runner-palette-3)',
    'var(--runner-palette-4)',
    'var(--runner-palette-5)',
    'var(--runner-palette-6)'
  ] as const;

  colorForRunner(personId: number, persistedColors: Record<string, string>): string {
    const persisted = persistedColors[String(personId)];
    if (persisted) {
      return persisted;
    }

    const palette = resolveRunnerPalette(this.fallbackPalette);
    return palette[personId % palette.length];
  }
}
