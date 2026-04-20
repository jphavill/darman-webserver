import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';
import { MarkdownComponent } from 'ngx-markdown';
import { Project } from '../../models/project.model';

@Component({
    selector: 'app-project-overlay',
    imports: [CommonModule, NgIconComponent, MarkdownComponent],
    templateUrl: './project-overlay.component.html',
    styleUrls: ['./project-overlay.component.css']
})
export class ProjectOverlayComponent {
  @Input() activeProject: Project | null = null;
  @Input() overlayVisible = false;
  @Input() isExpanded = false;
  @Input() expandedStyle: Record<string, string> = {};
  @Input() activeProjectMarkdown = '';

  @Output() closeRequested = new EventEmitter<void>();

  requestClose(): void {
    this.closeRequested.emit();
  }
}
