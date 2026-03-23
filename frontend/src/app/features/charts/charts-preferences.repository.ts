import { Injectable, inject } from '@angular/core';
import { BROWSER_STORAGE } from '../../core/browser/browser-globals';
import { ComparisonMode, RunWindow, RunnerColorSource } from './charts.models';

export interface PersistedRunnerPreference {
  personId: number;
  visible: boolean;
  color?: string;
  colorSource?: RunnerColorSource;
  paletteSlot?: number | null;
}

export interface PersistedPreferences {
  mode: ComparisonMode;
  runWindow: RunWindow;
  location: string | null;
  showBenchmarks: boolean;
  selectedRunners: PersistedRunnerPreference[];
}

@Injectable({
  providedIn: 'root'
})
export class ChartsPreferencesRepository {
  private readonly storage = inject(BROWSER_STORAGE);
  private readonly colorsStorageKey = 'chartsRunnerColors';
  private readonly preferencesStorageKey = 'chartsPreferences';

  readLegacyRunnerColors(): Record<string, string> {
    try {
      const raw = this.storage.getItem(this.colorsStorageKey);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as Record<string, string>;
      return parsed ?? {};
    } catch {
      return {};
    }
  }

  persistLegacyRunnerColor(personId: number, color: string): void {
    const current = this.readLegacyRunnerColors();
    current[String(personId)] = color;
    this.storage.setItem(this.colorsStorageKey, JSON.stringify(current));
  }

  persistPreferences(preferences: PersistedPreferences): void {
    this.storage.setItem(this.preferencesStorageKey, JSON.stringify(preferences));
  }

  readPreferences(): PersistedPreferences | null {
    try {
      const raw = this.storage.getItem(this.preferencesStorageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedPreferences>;
      if (!parsed.mode || !parsed.runWindow || !Array.isArray(parsed.selectedRunners)) {
        return null;
      }

      return {
        mode: parsed.mode,
        runWindow: parsed.runWindow,
        location: parsed.location ?? null,
        showBenchmarks: parsed.showBenchmarks === true,
        selectedRunners: parsed.selectedRunners
          .map((runner) => ({
            personId: Number(runner.personId),
            visible: runner.visible !== false,
            color: typeof runner.color === 'string' ? runner.color : undefined,
            colorSource: runner.colorSource === 'palette' || runner.colorSource === 'custom' ? runner.colorSource : undefined,
            paletteSlot:
              runner.paletteSlot === null ||
              (typeof runner.paletteSlot === 'number' && Number.isInteger(runner.paletteSlot) && runner.paletteSlot >= 0)
                ? runner.paletteSlot
                : undefined
          }))
          .filter((runner) => Number.isInteger(runner.personId) && runner.personId > 0)
      };
    } catch {
      return null;
    }
  }
}
