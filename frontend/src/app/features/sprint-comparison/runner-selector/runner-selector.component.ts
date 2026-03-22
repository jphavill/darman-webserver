import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WINDOW } from '../../../core/browser/browser-globals';
import { AvailableRunner } from '../sprint-comparison.models';

@Component({
  selector: 'app-runner-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './runner-selector.component.html',
  styleUrl: './runner-selector.component.css'
})
export class RunnerSelectorComponent {
  private readonly window = inject(WINDOW);

  @Input() runners: AvailableRunner[] = [];
  @Input() selectedPersonIds: number[] = [];
  @Input() searchTerm = '';

  dropdownOpen = false;

  @Output() readonly searchTermChange = new EventEmitter<string>();
  @Output() readonly addRunner = new EventEmitter<AvailableRunner>();

  get filteredRunners(): AvailableRunner[] {
    const normalizedSearch = this.searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return this.runners;
    }
    return this.runners.filter((runner) => runner.name.toLowerCase().includes(normalizedSearch));
  }

  get addCandidate(): AvailableRunner | null {
    const normalizedSearch = this.searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return null;
    }

    const unselectedMatches = this.filteredRunners.filter((runner) => !this.isSelected(runner));
    const exactMatch = unselectedMatches.find((runner) => runner.name.toLowerCase() === normalizedSearch);
    if (exactMatch) {
      return exactMatch;
    }
    if (unselectedMatches.length === 1) {
      return unselectedMatches[0];
    }
    return null;
  }

  isSelected(runner: AvailableRunner): boolean {
    return this.selectedPersonIds.includes(runner.id);
  }

  canAdd(runner: AvailableRunner): boolean {
    return !this.isSelected(runner);
  }

  addFromSearch(): void {
    const candidate = this.addCandidate;
    if (!candidate || !this.canAdd(candidate)) {
      return;
    }

    this.addRunner.emit(candidate);
    this.searchTermChange.emit('');
    this.dropdownOpen = false;
  }

  onEnterKey(event: Event): void {
    event.preventDefault();
    this.addFromSearch();
  }

  openDropdown(): void {
    this.dropdownOpen = true;
  }

  closeDropdown(): void {
    this.window.setTimeout(() => {
      this.dropdownOpen = false;
    }, 100);
  }

  onSearchTermChange(value: string): void {
    this.searchTermChange.emit(value);
    this.dropdownOpen = true;
  }

  selectFromDropdown(runner: AvailableRunner): void {
    if (!this.canAdd(runner)) {
      return;
    }

    this.addRunner.emit(runner);
    this.searchTermChange.emit('');
    this.dropdownOpen = false;
  }
}
