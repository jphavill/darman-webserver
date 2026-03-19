import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  AvailableRunner,
  ComparisonMode,
  RunWindow,
  SelectedRunner,
  SprintComparisonState
} from './sprint-comparison.models';
import { SprintComparisonService } from './sprint-comparison.service';
import { SprintComparisonControlsComponent } from './sprint-comparison-controls.component';
import { SprintComparisonChartComponent } from './sprint-comparison-chart.component';

interface PersistedPreferences {
  mode: ComparisonMode;
  runWindow: RunWindow;
  location: string | null;
  selectedRunners: Array<{ personId: number; visible: boolean }>;
}

@Component({
  selector: 'app-sprint-comparison-page',
  standalone: true,
  imports: [CommonModule, SprintComparisonControlsComponent, SprintComparisonChartComponent],
  templateUrl: './sprint-comparison-page.component.html',
  styleUrl: './sprint-comparison-page.component.css'
})
export class SprintComparisonPageComponent implements OnInit {
  private readonly sprintComparisonApi = inject(SprintComparisonService);

  readonly maxRunnerCount = 4;
  private readonly defaultPalette = ['#58a6ff', '#e05654', '#4ac07a', '#f5a63d', '#8ecaf0', '#f27f98'];
  private readonly colorsStorageKey = 'sprintComparisonRunnerColors';
  private readonly preferencesStorageKey = 'sprintComparisonPreferences';

  state: SprintComparisonState = {
    mode: 'progression',
    runWindow: 'all',
    location: null,
    runnerSearch: '',
    availableRunners: [],
    availableLocations: [],
    selectedRunners: [],
    series: [],
    loading: false,
    error: null
  };

  ngOnInit(): void {
    this.loadLookups();
  }

  onModeChange(mode: ComparisonMode): void {
    this.state.mode = mode;
    this.persistPreferences();
    this.fetchComparison();
  }

  onLocationChange(location: string | null): void {
    this.state.location = location;
    this.persistPreferences();
    this.fetchComparison();
  }

  onRunWindowChange(runWindow: RunWindow): void {
    this.state.runWindow = runWindow;
    this.persistPreferences();
    this.fetchComparison();
  }

  onRunnerSearchChange(search: string): void {
    this.state.runnerSearch = search;
  }

  onAddRunner(runner: AvailableRunner): void {
    if (this.state.selectedRunners.some((item) => item.personId === runner.id)) {
      return;
    }
    if (this.state.selectedRunners.length >= this.maxRunnerCount) {
      return;
    }

    this.state.selectedRunners = [
      ...this.state.selectedRunners,
      {
        personId: runner.id,
        personName: runner.name,
        color: this.getRunnerColor(runner.id),
        visible: true
      }
    ];
    this.persistPreferences();
    this.fetchComparison();
  }

  onRemoveRunner(personId: number): void {
    this.state.selectedRunners = this.state.selectedRunners.filter((runner) => runner.personId !== personId);
    this.persistPreferences();
    this.fetchComparison();
  }

  onRunnerColorChange(update: { personId: number; color: string }): void {
    this.state.selectedRunners = this.state.selectedRunners.map((runner) =>
      runner.personId === update.personId ? { ...runner, color: update.color } : runner
    );
    this.persistRunnerColor(update.personId, update.color);
  }

  onRunnerVisibilityChange(update: { personId: number; visible: boolean }): void {
    this.state.selectedRunners = this.state.selectedRunners.map((runner) =>
      runner.personId === update.personId ? { ...runner, visible: update.visible } : runner
    );
    this.persistPreferences();
  }

  onClearSelections(): void {
    this.state.selectedRunners = [];
    this.state.series = [];
    this.persistPreferences();
  }

  onResetFilters(): void {
    this.state.mode = 'progression';
    this.state.location = null;
    this.state.runWindow = 'all';
    this.persistPreferences();
    this.fetchComparison();
  }

  private loadLookups(): void {
    this.state.loading = true;
    this.state.error = null;

    forkJoin({
      people: this.sprintComparisonApi.getPeople(),
      locations: this.sprintComparisonApi.getLocations()
    }).subscribe({
      next: ({ people, locations }) => {
        this.state.availableRunners = people;
        this.state.availableLocations = locations;
        this.restorePreferences();
        this.state.loading = false;

        if (this.state.selectedRunners.length > 0) {
          this.fetchComparison();
        }
      },
      error: () => {
        this.state.loading = false;
        this.state.error = 'Unable to load runners and locations right now.';
      }
    });
  }

  private fetchComparison(): void {
    if (this.state.selectedRunners.length === 0) {
      this.state.series = [];
      this.state.error = null;
      this.state.loading = false;
      return;
    }

    this.state.loading = true;
    this.state.error = null;

    this.sprintComparisonApi
      .getComparison({
        mode: this.state.mode,
        personIds: this.state.selectedRunners.map((runner) => runner.personId),
        location: this.state.location,
        // Run window is intentionally applied only for progression mode in v1.
        runWindow: this.state.mode === 'progression' ? this.state.runWindow : 'all'
      })
      .subscribe({
        next: (series) => {
          this.state.series = series;
          this.state.loading = false;
        },
        error: () => {
          this.state.loading = false;
          this.state.error = 'Unable to load sprint comparison data right now.';
          this.state.series = [];
        }
      });
  }

  private restorePreferences(): void {
    const preferences = this.readPreferences();
    if (preferences) {
      this.state.mode = preferences.mode;
      this.state.runWindow = preferences.runWindow;
      this.state.location = preferences.location;

      const runnerById = new Map(this.state.availableRunners.map((runner) => [runner.id, runner]));
      this.state.selectedRunners = preferences.selectedRunners
        .map((item) => {
          const runner = runnerById.get(item.personId);
          if (!runner) {
            return null;
          }
          return {
            personId: runner.id,
            personName: runner.name,
            color: this.getRunnerColor(runner.id),
            visible: item.visible
          } satisfies SelectedRunner;
        })
        .filter((runner): runner is SelectedRunner => runner !== null)
        .slice(0, this.maxRunnerCount);
    }
  }

  private getRunnerColor(personId: number): string {
    const persistedColors = this.readRunnerColors();
    const persisted = persistedColors[String(personId)];
    if (persisted) {
      return persisted;
    }

    const paletteIndex = personId % this.defaultPalette.length;
    return this.defaultPalette[paletteIndex];
  }

  private persistRunnerColor(personId: number, color: string): void {
    const current = this.readRunnerColors();
    current[String(personId)] = color;
    localStorage.setItem(this.colorsStorageKey, JSON.stringify(current));
  }

  private readRunnerColors(): Record<string, string> {
    try {
      const raw = localStorage.getItem(this.colorsStorageKey);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as Record<string, string>;
      return parsed ?? {};
    } catch {
      return {};
    }
  }

  private persistPreferences(): void {
    const preferences: PersistedPreferences = {
      mode: this.state.mode,
      runWindow: this.state.runWindow,
      location: this.state.location,
      selectedRunners: this.state.selectedRunners.map((runner) => ({
        personId: runner.personId,
        visible: runner.visible
      }))
    };
    localStorage.setItem(this.preferencesStorageKey, JSON.stringify(preferences));
  }

  private readPreferences(): PersistedPreferences | null {
    try {
      const raw = localStorage.getItem(this.preferencesStorageKey);
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
