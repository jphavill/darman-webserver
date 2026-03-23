import { Injectable } from '@angular/core';
import { RunnerColorSource, SelectedRunner } from './charts.models';
import { resolveRunnerPalette } from '../../shared/theme/theme-tokens';

export interface RunnerColorAssignment {
  color: string;
  colorSource: RunnerColorSource;
  paletteSlot: number | null;
}

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
    'var(--runner-palette-6)',
    'var(--runner-palette-7)',
    'var(--runner-palette-8)'
  ] as const;

  createPaletteAssignment(selectedRunners: SelectedRunner[]): RunnerColorAssignment {
    const palette = this.getPalette();
    const slot = this.getNextAvailableSlot(selectedRunners, palette.length);
    return {
      color: palette[slot],
      colorSource: 'palette',
      paletteSlot: slot
    };
  }

  createCustomAssignment(color: string): RunnerColorAssignment {
    return {
      color,
      colorSource: 'custom',
      paletteSlot: null
    };
  }

  createAssignmentFromPreference(
    preferred: {
      color?: string;
      colorSource?: RunnerColorSource;
      paletteSlot?: number | null;
    },
    selectedRunners: SelectedRunner[],
    legacyColor?: string
  ): RunnerColorAssignment {
    const palette = this.getPalette();
    const requestedSlot = this.findPreferredSlot(preferred.color, preferred.paletteSlot ?? null, palette);
    const slotTaken = requestedSlot === null ? true : this.isPaletteSlotTaken(selectedRunners, requestedSlot, palette.length);

    if (preferred.colorSource === 'custom' && preferred.color) {
      return this.createCustomAssignment(preferred.color);
    }

    if (preferred.colorSource === 'palette' && requestedSlot !== null && !slotTaken) {
      return {
        color: palette[requestedSlot],
        colorSource: 'palette',
        paletteSlot: requestedSlot
      };
    }

    if (!preferred.colorSource && preferred.color) {
      const paletteSlot = this.findPaletteSlotByColor(preferred.color, palette);
      if (paletteSlot !== null && !this.isPaletteSlotTaken(selectedRunners, paletteSlot, palette.length)) {
        return {
          color: palette[paletteSlot],
          colorSource: 'palette',
          paletteSlot
        };
      }

      if (paletteSlot === null) {
        return this.createCustomAssignment(preferred.color);
      }
    }

    if (legacyColor) {
      const paletteSlot = this.findPaletteSlotByColor(legacyColor, palette);
      if (paletteSlot !== null && !this.isPaletteSlotTaken(selectedRunners, paletteSlot, palette.length)) {
        return {
          color: palette[paletteSlot],
          colorSource: 'palette',
          paletteSlot
        };
      }
      if (paletteSlot === null) {
        return this.createCustomAssignment(legacyColor);
      }
    }

    return this.createPaletteAssignment(selectedRunners);
  }

  private getPalette(): string[] {
    return resolveRunnerPalette(this.fallbackPalette);
  }

  private getNextAvailableSlot(selectedRunners: SelectedRunner[], paletteLength: number): number {
    for (let slot = 0; slot < paletteLength; slot += 1) {
      if (!this.isPaletteSlotTaken(selectedRunners, slot, paletteLength)) {
        return slot;
      }
    }

    return 0;
  }

  private isPaletteSlotTaken(selectedRunners: SelectedRunner[], slot: number, paletteLength: number): boolean {
    return selectedRunners.some(
      (runner) =>
        runner.colorSource === 'palette' &&
        runner.paletteSlot !== null &&
        runner.paletteSlot >= 0 &&
        runner.paletteSlot < paletteLength &&
        runner.paletteSlot === slot
    );
  }

  private findPreferredSlot(color: string | undefined, paletteSlot: number | null, palette: string[]): number | null {
    if (typeof paletteSlot === 'number' && Number.isInteger(paletteSlot) && paletteSlot >= 0 && paletteSlot < palette.length) {
      return paletteSlot;
    }

    if (!color) {
      return null;
    }

    return this.findPaletteSlotByColor(color, palette);
  }

  private findPaletteSlotByColor(color: string, palette: string[]): number | null {
    const normalized = color.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const paletteMatch = palette.findIndex((paletteColor) => paletteColor.trim().toLowerCase() === normalized);
    if (paletteMatch >= 0) {
      return paletteMatch;
    }

    const tokenMatch = normalized.match(/^var\(--runner-palette-(\d+)\)$/);
    if (!tokenMatch) {
      return null;
    }

    const slot = Number(tokenMatch[1]) - 1;
    return Number.isInteger(slot) && slot >= 0 && slot < palette.length ? slot : null;
  }
}
