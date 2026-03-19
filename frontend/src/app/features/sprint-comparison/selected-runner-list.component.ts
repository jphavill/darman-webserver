import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SelectedRunner } from './sprint-comparison.models';

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
}
