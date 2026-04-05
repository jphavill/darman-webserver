import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Project, ProjectOpenRequest } from '../../models/project.model';
import { ProjectPillComponent } from '../project-pill/project-pill.component';

@Component({
    selector: 'app-project-section',
    imports: [ProjectPillComponent],
    templateUrl: './project-section.component.html',
    styleUrls: ['./project-section.component.css']
})
export class ProjectSectionComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) projects!: Project[];
  @Input() adminCanManagePublication = false;
  @Input() adminCanManageContent = false;
  @Input() publicationPendingProjectIds: ReadonlySet<string> = new Set();

  @Output() openProjectRequested = new EventEmitter<ProjectOpenRequest>();
  @Output() editRequested = new EventEmitter<Project>();
  @Output() moveRequested = new EventEmitter<{ project: Project; direction: -1 | 1 }>();
  @Output() publicationToggled = new EventEmitter<{ project: Project; isPublished: boolean }>();
}
