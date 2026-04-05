
import { Component, OnInit, computed, inject } from '@angular/core';
import {
  AvailableRunner,
  ComparisonMode,
  RunWindow,
  ChartsState
} from '../charts.models';
import { ChartsControlsComponent } from '../charts-controls/charts-controls.component';
import { ChartsChartComponent } from '../charts-chart/charts-chart.component';
import { ChartsStore } from '../charts.store';
import { SprintDisplayUnitService } from '../../../shared/preferences/sprint-display-unit.service';

@Component({
    selector: 'app-charts-page',
    imports: [ChartsControlsComponent, ChartsChartComponent],
    providers: [ChartsStore],
    templateUrl: './charts-page.component.html',
    styleUrl: './charts-page.component.css'
})
export class ChartsPageComponent implements OnInit {
  private readonly store = inject(ChartsStore);
  private readonly sprintDisplayUnit = inject(SprintDisplayUnitService);

  readonly state = computed<ChartsState>(() => this.store.state());
  readonly displayUnit = this.sprintDisplayUnit.unit;

  ngOnInit(): void {
    this.store.loadLookups();
  }

  onModeChange(mode: ComparisonMode): void {
    this.store.onModeChange(mode);
  }

  onLocationChange(location: string | null): void {
    this.store.onLocationChange(location);
  }

  onRunWindowChange(runWindow: RunWindow): void {
    this.store.onRunWindowChange(runWindow);
  }

  onRunnerSearchChange(search: string): void {
    this.store.onRunnerSearchChange(search);
  }

  onShowBenchmarksChange(showBenchmarks: boolean): void {
    this.store.onShowBenchmarksChange(showBenchmarks);
  }

  onAddRunner(runner: AvailableRunner): void {
    this.store.onAddRunner(runner);
  }

  onRemoveRunner(personId: number): void {
    this.store.onRemoveRunner(personId);
  }

  onRunnerColorChange(update: { personId: number; color: string }): void {
    this.store.onRunnerColorChange(update);
  }

  onRunnerVisibilityChange(update: { personId: number; visible: boolean }): void {
    this.store.onRunnerVisibilityChange(update);
  }

  onResetFilters(): void {
    this.store.onResetFilters();
  }
}
