import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import {
  AvailableRunner,
  ComparisonMode,
  RunWindow,
  SprintComparisonState
} from '../sprint-comparison.models';
import { SprintComparisonControlsComponent } from '../sprint-comparison-controls/sprint-comparison-controls.component';
import { SprintComparisonChartComponent } from '../sprint-comparison-chart/sprint-comparison-chart.component';
import { SprintComparisonStore } from '../sprint-comparison.store';

@Component({
  selector: 'app-sprint-comparison-page',
  standalone: true,
  imports: [CommonModule, SprintComparisonControlsComponent, SprintComparisonChartComponent],
  providers: [SprintComparisonStore],
  templateUrl: './sprint-comparison-page.component.html',
  styleUrl: './sprint-comparison-page.component.css'
})
export class SprintComparisonPageComponent implements OnInit {
  private readonly store = inject(SprintComparisonStore);

  readonly state = computed<SprintComparisonState>(() => this.store.state());
  readonly maxRunnerCount = this.store.maxRunnerCount;

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

  onClearSelections(): void {
    this.store.onClearSelections();
  }

  onResetFilters(): void {
    this.store.onResetFilters();
  }
}
