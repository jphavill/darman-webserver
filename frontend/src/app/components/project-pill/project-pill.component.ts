import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Project, ProjectOpenRequest } from '../../models/project.model';

@Component({
  selector: 'app-project-pill',
  standalone: true,
  templateUrl: './project-pill.component.html',
  styleUrls: ['./project-pill.component.css']
})
export class ProjectPillComponent {
  @Input({ required: true }) project!: Project;
  @Output() openProjectRequested = new EventEmitter<ProjectOpenRequest>();

  requestOpen(event: MouseEvent): void {
    const trigger = event.currentTarget as HTMLElement | null;
    if (!trigger) {
      return;
    }

    this.openProjectRequested.emit({
      project: this.project,
      trigger
    });
  }
}
