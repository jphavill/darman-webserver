import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SelectedRunner } from '../sprint-comparison.models';

@Component({
  selector: 'app-selected-runner-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './selected-runner-list.component.html',
  styleUrl: './selected-runner-list.component.css'
})
export class SelectedRunnerListComponent {
  @Input() runners: SelectedRunner[] = [];

  @Output() readonly removeRunner = new EventEmitter<number>();
  @Output() readonly colorChange = new EventEmitter<{ personId: number; color: string }>();
  @Output() readonly visibilityChange = new EventEmitter<{ personId: number; visible: boolean }>();

  emitVisibilityChange(personId: number, event: Event): void {
    const checked = (event.target as HTMLInputElement | null)?.checked ?? false;
    this.visibilityChange.emit({ personId, visible: checked });
  }

  emitColorChange(personId: number, event: Event): void {
    const color = (event.target as HTMLInputElement | null)?.value;
    if (!color) {
      return;
    }

    this.colorChange.emit({ personId, color });
  }
}
