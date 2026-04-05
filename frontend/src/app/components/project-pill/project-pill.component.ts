import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIconComponent } from '@ng-icons/core';
import { Project, ProjectOpenRequest } from '../../models/project.model';

@Component({
  selector: 'app-project-pill',
  standalone: true,
  imports: [NgIconComponent],
  templateUrl: './project-pill.component.html',
  styleUrls: ['./project-pill.component.css']
})
export class ProjectPillComponent {
  @Input({ required: true }) project!: Project;
  @Input() adminCanManagePublication = false;
  @Input() adminCanManageContent = false;
  @Input() publicationUpdatePending = false;
  @Input() canMoveUp = true;
  @Input() canMoveDown = true;

  @Output() openProjectRequested = new EventEmitter<ProjectOpenRequest>();
  @Output() editRequested = new EventEmitter<Project>();
  @Output() moveRequested = new EventEmitter<{ project: Project; direction: -1 | 1 }>();
  @Output() publicationToggled = new EventEmitter<{ project: Project; isPublished: boolean }>();

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

  requestEdit(event: MouseEvent): void {
    event.stopPropagation();
    this.editRequested.emit(this.project);
  }

  requestMove(direction: -1 | 1, event: MouseEvent): void {
    event.stopPropagation();

    if ((direction < 0 && !this.canMoveUp) || (direction > 0 && !this.canMoveDown)) {
      return;
    }

    this.moveRequested.emit({ project: this.project, direction });
  }

  updatePublication(event: Event): void {
    event.stopPropagation();
    const input = event.target as HTMLInputElement | null;
    const isPublished = input?.checked;

    if (typeof isPublished !== 'boolean') {
      return;
    }

    this.publicationToggled.emit({ project: this.project, isPublished });
  }
}
