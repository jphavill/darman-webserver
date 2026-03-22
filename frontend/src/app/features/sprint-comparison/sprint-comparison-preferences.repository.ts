import { Injectable, inject } from '@angular/core';
import { BROWSER_STORAGE } from '../../core/browser/browser-globals';
import { ComparisonMode, RunWindow } from './sprint-comparison.models';

export interface PersistedPreferences {
  mode: ComparisonMode;
  runWindow: RunWindow;
  location: string | null;
  showBenchmarks: boolean;
  selectedRunners: Array<{ personId: number; visible: boolean }>;
}

@Injectable({
  providedIn: 'root'
})
export class SprintComparisonPreferencesRepository {
  private readonly storage = inject(BROWSER_STORAGE);
  private readonly colorsStorageKey = 'sprintComparisonRunnerColors';
  private readonly preferencesStorageKey = 'sprintComparisonPreferences';

  readRunnerColors(): Record<string, string> {
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

  persistRunnerColor(personId: number, color: string): void {
    const current = this.readRunnerColors();
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
            visible: runner.visible !== false
          }))
          .filter((runner) => Number.isInteger(runner.personId) && runner.personId > 0)
      };
    } catch {
      return null;
    }
  }
}
