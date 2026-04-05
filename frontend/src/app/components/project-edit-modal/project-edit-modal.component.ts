import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Project, ProjectImage } from '../../models/project.model';

export interface ProjectEditSaveRequestedEvent {
  projectId: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  type: 'software' | 'physical';
}

export interface ProjectEditUploadRequestedEvent {
  projectId: string;
  file: File;
  altText: string;
  caption: string;
  isHero: boolean;
}

@Component({
  selector: 'app-project-edit-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './project-edit-modal.component.html',
  styleUrls: ['./project-edit-modal.component.css']
})
export class ProjectEditModalComponent {
  @Input({ required: true }) project!: Project;
  @Input() statusMessage = '';
  @Input() errorMessage = '';

  @Output() closed = new EventEmitter<void>();
  @Output() saveRequested = new EventEmitter<ProjectEditSaveRequestedEvent>();
  @Output() uploadRequested = new EventEmitter<ProjectEditUploadRequestedEvent>();
  @Output() setHeroRequested = new EventEmitter<{ projectId: string; image: ProjectImage }>();
  @Output() moveImageRequested = new EventEmitter<{ projectId: string; imageId: string; direction: -1 | 1 }>();
  @Output() deleteImageRequested = new EventEmitter<{ projectId: string; imageId: string }>();

  editingTitle = '';
  editingShort = '';
  editingLong = '';
  editingType: 'software' | 'physical' = 'software';

  uploadAlt = '';
  uploadCaption = '';
  uploadHero = false;

  ngOnChanges(): void {
    this.editingTitle = this.project.title;
    this.editingShort = this.project.shortDescription;
    this.editingLong = this.project.longDescription;
    this.editingType = this.project.type;
    this.uploadAlt = '';
    this.uploadCaption = '';
    this.uploadHero = false;
  }

  close(): void {
    this.closed.emit();
  }

  save(): void {
    this.saveRequested.emit({
      projectId: this.project.id,
      title: this.editingTitle,
      shortDescription: this.editingShort,
      longDescription: this.editingLong,
      type: this.editingType
    });
  }

  uploadImage(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    this.uploadRequested.emit({
      projectId: this.project.id,
      file,
      altText: this.uploadAlt.trim() || this.defaultAltText(file.name),
      caption: this.uploadCaption.trim(),
      isHero: this.uploadHero
    });

    this.uploadAlt = '';
    this.uploadCaption = '';
    this.uploadHero = false;
    if (input) {
      input.value = '';
    }
  }

  setHero(image: ProjectImage): void {
    this.setHeroRequested.emit({ projectId: this.project.id, image });
  }

  moveImage(imageId: string, direction: -1 | 1): void {
    this.moveImageRequested.emit({ projectId: this.project.id, imageId, direction });
  }

  deleteImage(imageId: string): void {
    this.deleteImageRequested.emit({ projectId: this.project.id, imageId });
  }

  private defaultAltText(filename: string): string {
    const stem = filename.replace(/\.[^.]+$/, '');
    return stem.replace(/[_-]+/g, ' ').trim() || 'Project image';
  }
}
