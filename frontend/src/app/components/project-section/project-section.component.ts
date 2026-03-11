import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Project, ProjectOpenRequest } from '../../models/project.model';
import { ProjectPillComponent } from '../project-pill/project-pill.component';

@Component({
  selector: 'app-project-section',
  standalone: true,
  imports: [ProjectPillComponent],
  templateUrl: './project-section.component.html',
  styleUrls: ['./project-section.component.css']
})
export class ProjectSectionComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) projects!: Project[];
  @Output() openProjectRequested = new EventEmitter<ProjectOpenRequest>();

  forwardOpenRequest(request: ProjectOpenRequest): void {
    this.openProjectRequested.emit(request);
  }
}
