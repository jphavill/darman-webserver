import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AvailableRunner,
  ComparisonMode,
  RunWindow,
  RunnerColorSource,
  SelectedRunner,
  SprintComparisonState
} from './sprint-comparison.models';
import {
  PersistedPreferences,
  SprintComparisonPreferencesRepository
} from './sprint-comparison-preferences.repository';
import { RunnerColorService } from './runner-color.service';
import { SprintComparisonService } from './sprint-comparison.service';

@Injectable()
export class SprintComparisonStore {
  private readonly api = inject(SprintComparisonService);
  private readonly preferencesRepository = inject(SprintComparisonPreferencesRepository);
  private readonly runnerColorService = inject(RunnerColorService);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<SprintComparisonState>({
    mode: 'progression',
    runWindow: 'all',
    location: null,
    showBenchmarks: false,
    runnerSearch: '',
    availableRunners: [],
    availableLocations: [],
    selectedRunners: [],
    series: [],
    loading: false,
    error: null
  });

  loadLookups(): void {
    this.patchState({ loading: true, error: null });

    forkJoin({
      people: this.api.getPeople(),
      locations: this.api.getLocations()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ people, locations }) => {
          this.patchState({
            availableRunners: people,
            availableLocations: locations,
            loading: false
          });
          this.restorePreferences();

          if (this.state().selectedRunners.length > 0) {
            this.fetchComparison();
          }
        },
        error: () => {
          this.patchState({
            loading: false,
            error: 'Unable to load runners and locations right now.'
          });
        }
      });
  }

  onModeChange(mode: ComparisonMode): void {
    this.patchState({ mode });
    this.persistPreferences();
    this.fetchComparison();
  }

  onLocationChange(location: string | null): void {
    this.patchState({ location });
    this.persistPreferences();
    this.fetchComparison();
  }

  onRunWindowChange(runWindow: RunWindow): void {
    this.patchState({ runWindow });
    this.persistPreferences();
    this.fetchComparison();
  }

  onRunnerSearchChange(search: string): void {
    this.patchState({ runnerSearch: search });
  }

  onShowBenchmarksChange(showBenchmarks: boolean): void {
    this.patchState({ showBenchmarks });
    this.persistPreferences();
  }

  onAddRunner(runner: AvailableRunner): void {
    const state = this.state();
    if (state.selectedRunners.some((item) => item.personId === runner.id)) {
      return;
    }

    const colorAssignment = this.runnerColorService.createPaletteAssignment(state.selectedRunners);
    const selectedRunners: SelectedRunner[] = [
      ...state.selectedRunners,
      {
        personId: runner.id,
        personName: runner.name,
        color: colorAssignment.color,
        colorSource: colorAssignment.colorSource,
        paletteSlot: colorAssignment.paletteSlot,
        visible: true
      }
    ];

    this.patchState({ selectedRunners });
    this.persistPreferences();
    this.fetchComparison();
  }

  onRemoveRunner(personId: number): void {
    const selectedRunners = this.state().selectedRunners.filter((runner) => runner.personId !== personId);
    this.patchState({ selectedRunners });
    this.persistPreferences();
    this.fetchComparison();
  }

  onRunnerColorChange(update: { personId: number; color: string }): void {
    const customAssignment = this.runnerColorService.createCustomAssignment(update.color);
    const selectedRunners = this.state().selectedRunners.map((runner) =>
      runner.personId === update.personId
        ? {
            ...runner,
            color: customAssignment.color,
            colorSource: customAssignment.colorSource,
            paletteSlot: customAssignment.paletteSlot
          }
        : runner
    );

    this.patchState({ selectedRunners });
    this.preferencesRepository.persistLegacyRunnerColor(update.personId, update.color);
    this.persistPreferences();
  }

  onRunnerVisibilityChange(update: { personId: number; visible: boolean }): void {
    const selectedRunners = this.state().selectedRunners.map((runner) =>
      runner.personId === update.personId ? { ...runner, visible: update.visible } : runner
    );

    this.patchState({ selectedRunners });
    this.persistPreferences();
  }

  onClearSelections(): void {
    this.patchState({ selectedRunners: [], series: [] });
    this.persistPreferences();
  }

  onResetFilters(): void {
    this.patchState({ mode: 'progression', location: null, runWindow: 'all' });
    this.persistPreferences();
    this.fetchComparison();
  }

  private fetchComparison(): void {
    const state = this.state();
    if (state.selectedRunners.length === 0) {
      this.patchState({ series: [], error: null, loading: false });
      return;
    }

    this.patchState({ loading: true, error: null });

    this.api
      .getComparison({
        mode: state.mode,
        personIds: state.selectedRunners.map((runner) => runner.personId),
        location: state.location,
        runWindow: state.mode === 'progression' ? state.runWindow : 'all'
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (series) => {
          this.patchState({ series, loading: false });
        },
        error: () => {
          this.patchState({
            loading: false,
            error: 'Unable to load sprint comparison data right now.',
            series: []
          });
        }
      });
  }

  private restorePreferences(): void {
    const preferences = this.preferencesRepository.readPreferences();
    if (!preferences) {
      return;
    }

    const state = this.state();
    const legacyColors = this.preferencesRepository.readLegacyRunnerColors();
    const runnerById = new Map(state.availableRunners.map((runner) => [runner.id, runner]));
    const selectedRunners = preferences.selectedRunners
      .reduce<SelectedRunner[]>((restored, item) => {
        const runner = runnerById.get(item.personId);
        if (!runner) {
          return restored;
        }

        const colorAssignment = this.runnerColorService.createAssignmentFromPreference(
          {
            color: item.color,
            colorSource: this.asRunnerColorSource(item.colorSource),
            paletteSlot: item.paletteSlot
          },
          restored,
          legacyColors[String(item.personId)]
        );

        restored.push({
          personId: runner.id,
          personName: runner.name,
          color: colorAssignment.color,
          colorSource: colorAssignment.colorSource,
          paletteSlot: colorAssignment.paletteSlot,
          visible: item.visible
        });

        return restored;
      }, []);

    this.patchState({
      mode: preferences.mode,
      runWindow: preferences.runWindow,
      location: preferences.location,
      showBenchmarks: preferences.showBenchmarks,
      selectedRunners
    });
  }

  private persistPreferences(): void {
    const state = this.state();
    const preferences: PersistedPreferences = {
      mode: state.mode,
      runWindow: state.runWindow,
      location: state.location,
      showBenchmarks: state.showBenchmarks,
      selectedRunners: state.selectedRunners.map((runner) => ({
        personId: runner.personId,
        visible: runner.visible,
        color: runner.color,
        colorSource: runner.colorSource,
        paletteSlot: runner.paletteSlot
      }))
    };

    this.preferencesRepository.persistPreferences(preferences);
  }

  private patchState(patch: Partial<SprintComparisonState>): void {
    this.state.update((current) => ({ ...current, ...patch }));
  }

  private asRunnerColorSource(value: RunnerColorSource | undefined): RunnerColorSource | undefined {
    return value === 'palette' || value === 'custom' ? value : undefined;
  }
}
