import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeHtml } from '@angular/platform-browser';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-project-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './project-overlay.component.html',
  styleUrls: ['./project-overlay.component.css']
})
export class ProjectOverlayComponent {
  @Input() activeProject: Project | null = null;
  @Input() overlayVisible = false;
  @Input() isExpanded = false;
  @Input() expandedStyle: Record<string, string> = {};
  @Input() activeProjectMarkdown: SafeHtml = '';

  @Output() closeRequested = new EventEmitter<void>();

  requestClose(): void {
    this.closeRequested.emit();
  }
}
