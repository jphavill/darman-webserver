import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';
import {
  AvailableRunner,
  ComparisonMode,
  RunWindow,
  SelectedRunner
} from '../sprint-comparison.models';
import { RunnerSelectorComponent } from '../runner-selector/runner-selector.component';
import { SelectedRunnerListComponent } from '../selected-runner-list/selected-runner-list.component';
import { SprintUnitToggleComponent } from '../../../shared/sprint-unit-toggle/sprint-unit-toggle.component';

@Component({
  selector: 'app-sprint-comparison-controls',
  standalone: true,
  imports: [CommonModule, FormsModule, RunnerSelectorComponent, SelectedRunnerListComponent, NgIconComponent, SprintUnitToggleComponent],
  templateUrl: './sprint-comparison-controls.component.html',
  styleUrl: './sprint-comparison-controls.component.css'
})
export class SprintComparisonControlsComponent {
  @Input() mode: ComparisonMode = 'progression';
  @Input() runWindow: RunWindow = 'all';
  @Input() location: string | null = null;
  @Input() showBenchmarks = false;
  @Input() runnerSearch = '';
  @Input() availableRunners: AvailableRunner[] = [];
  @Input() availableLocations: string[] = [];
  @Input() selectedRunners: SelectedRunner[] = [];
  @Input() maxRunners = 4;

  @Output() readonly modeChange = new EventEmitter<ComparisonMode>();
  @Output() readonly runWindowChange = new EventEmitter<RunWindow>();
  @Output() readonly locationChange = new EventEmitter<string | null>();
  @Output() readonly showBenchmarksChange = new EventEmitter<boolean>();
  @Output() readonly runnerSearchChange = new EventEmitter<string>();
  @Output() readonly addRunner = new EventEmitter<AvailableRunner>();
  @Output() readonly removeRunner = new EventEmitter<number>();
  @Output() readonly runnerColorChange = new EventEmitter<{ personId: number; color: string }>();
  @Output() readonly runnerVisibilityChange = new EventEmitter<{ personId: number; visible: boolean }>();
  @Output() readonly clearSelections = new EventEmitter<void>();
  @Output() readonly resetFilters = new EventEmitter<void>();

  readonly modeOptions: Array<{ value: ComparisonMode; label: string }> = [
    { value: 'progression', label: 'Per Run' },
    { value: 'daily_best', label: 'Daily Best' }
  ];

  readonly runWindowOptions: Array<{ value: RunWindow; label: string }> = [
    { value: 'all', label: 'All' },
    { value: '10', label: 'Last 10' },
    { value: '20', label: 'Last 20' },
    { value: '50', label: 'Last 50' }
  ];

  get selectedPersonIds(): number[] {
    return this.selectedRunners.map((runner) => runner.personId);
  }

  get isMaxSelected(): boolean {
    return this.selectedRunners.length >= this.maxRunners;
  }

  toggleBenchmarks(): void {
    this.showBenchmarksChange.emit(!this.showBenchmarks);
  }
}
