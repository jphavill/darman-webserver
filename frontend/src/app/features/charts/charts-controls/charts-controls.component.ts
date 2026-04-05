
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';
import {
  AvailableRunner,
  ComparisonMode,
  RunWindow,
  SelectedRunner
} from '../charts.models';
import { RunnerSelectorComponent } from '../runner-selector/runner-selector.component';
import { SprintUnitToggleComponent } from '../../../shared/sprint-unit-toggle/sprint-unit-toggle.component';

@Component({
    selector: 'app-charts-controls',
    imports: [FormsModule, RunnerSelectorComponent, NgIconComponent, SprintUnitToggleComponent],
    templateUrl: './charts-controls.component.html',
    styleUrl: './charts-controls.component.css'
})
export class ChartsControlsComponent {
  @Input() mode: ComparisonMode = 'progression';
  @Input() runWindow: RunWindow = 'all';
  @Input() location: string | null = null;
  @Input() showBenchmarks = false;
  @Input() runnerSearch = '';
  @Input() availableRunners: AvailableRunner[] = [];
  @Input() availableLocations: string[] = [];
  @Input() selectedRunners: SelectedRunner[] = [];

  @Output() readonly modeChange = new EventEmitter<ComparisonMode>();
  @Output() readonly runWindowChange = new EventEmitter<RunWindow>();
  @Output() readonly locationChange = new EventEmitter<string | null>();
  @Output() readonly showBenchmarksChange = new EventEmitter<boolean>();
  @Output() readonly runnerSearchChange = new EventEmitter<string>();
  @Output() readonly addRunner = new EventEmitter<AvailableRunner>();
  @Output() readonly removeRunner = new EventEmitter<number>();
  @Output() readonly runnerColorChange = new EventEmitter<{ personId: number; color: string }>();
  @Output() readonly runnerVisibilityChange = new EventEmitter<{ personId: number; visible: boolean }>();
  @Output() readonly resetFilters = new EventEmitter<void>();

  readonly modeOptions: Array<{ value: ComparisonMode; label: string }> = [
    { value: 'progression', label: 'Per Run' },
    { value: 'daily_best', label: 'Time' }
  ];

  readonly progressionRunWindowOptions: Array<{ value: RunWindow; label: string }> = [
    { value: 'all', label: 'All' },
    { value: '10', label: 'Last 10' },
    { value: '20', label: 'Last 20' },
    { value: '50', label: 'Last 50' }
  ];

  get runWindowOptions(): Array<{ value: RunWindow; label: string }> {
    if (this.mode === 'progression') {
      return this.progressionRunWindowOptions;
    }
    return [{ value: 'all', label: 'All Time' }];
  }

  get selectedPersonIds(): number[] {
    return this.selectedRunners.map((runner) => runner.personId);
  }

  toggleBenchmarks(): void {
    this.showBenchmarksChange.emit(!this.showBenchmarks);
  }

  onRunnerVisibilityChange(personId: number, event: Event): void {
    const visible = (event.target as HTMLInputElement | null)?.checked ?? false;
    this.runnerVisibilityChange.emit({ personId, visible });
  }

  onRunnerColorChange(personId: number, event: Event): void {
    const color = (event.target as HTMLInputElement | null)?.value;
    if (!color) {
      return;
    }

    this.runnerColorChange.emit({ personId, color });
  }
}
