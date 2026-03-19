import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvailableRunner } from './sprint-comparison.models';

@Component({
  selector: 'app-runner-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './runner-selector.component.html',
  styleUrl: './runner-selector.component.css'
})
export class RunnerSelectorComponent {
  @Input() runners: AvailableRunner[] = [];
  @Input() selectedPersonIds: number[] = [];
  @Input() searchTerm = '';
  @Input() maxSelected = 4;

  @Output() readonly searchTermChange = new EventEmitter<string>();
  @Output() readonly addRunner = new EventEmitter<AvailableRunner>();

  get filteredRunners(): AvailableRunner[] {
    const normalizedSearch = this.searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return this.runners;
    }
    return this.runners.filter((runner) => runner.name.toLowerCase().includes(normalizedSearch));
  }

  isSelected(runner: AvailableRunner): boolean {
    return this.selectedPersonIds.includes(runner.id);
  }

  canAdd(runner: AvailableRunner): boolean {
    return !this.isSelected(runner) && this.selectedPersonIds.length < this.maxSelected;
  }
}
