import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Project } from '../../models/project.model';
import {
  ProjectEditorFormComponent,
  ProjectEditorFormValue,
  ProjectEditorImageItem
} from '../project-editor-form/project-editor-form.component';
import {
  createObjectUrlForPreview,
  defaultImageAltText,
  moveQueueItemById,
  revokeObjectUrlForPreview,
  toggleQueueHero
} from '../project-editor-form/project-editor-queue.utils';
import { ProjectEditImageDraft } from '../../services/project-edit-save.pipeline';

export interface ProjectEditSaveRequestedEvent {
  projectId: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  type: 'software' | 'physical';
  isPublished: boolean;
  imageDrafts: ProjectEditImageDraft[];
}

interface ProjectEditImageEditorItem extends ProjectEditorImageItem {
  file: File | null;
  existingImageId: string | null;
}

let editQueuedImageSequence = 0;

@Component({
  selector: 'app-project-edit-modal',
  standalone: true,
  imports: [ProjectEditorFormComponent],
  templateUrl: './project-edit-modal.component.html',
  styleUrls: ['./project-edit-modal.component.css']
})
export class ProjectEditModalComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) project!: Project;
  @Input() statusMessage = '';
  @Input() errorMessage = '';
  @Input() isSaving = false;

  @Output() closed = new EventEmitter<void>();
  @Output() saveRequested = new EventEmitter<ProjectEditSaveRequestedEvent>();

  editorValue: ProjectEditorFormValue = {
    title: '',
    shortDescription: '',
    longDescription: '',
    type: 'software',
    isPublished: false
  };
  editorImages: ProjectEditImageEditorItem[] = [];
  uploadErrorMessage = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['project']) {
      return;
    }

    this.clearQueuedPreviews();
    this.editorValue = {
      title: this.project.title,
      shortDescription: this.project.shortDescription,
      longDescription: this.project.longDescription,
      type: this.project.type,
      isPublished: this.project.isPublished
    };
    this.editorImages = this.project.images.map((image) => ({
      id: image.id,
      previewUrl: image.thumbUrl,
      altText: image.altText,
      caption: image.caption ?? '',
      isHero: image.isHero,
      file: null,
      existingImageId: image.id
    }));
    this.uploadErrorMessage = '';
  }

  close(): void {
    if (this.isSaving) {
      return;
    }

    this.clearQueuedPreviews();
    this.closed.emit();
  }

  save(): void {
    if (this.isSaving) {
      return;
    }

    this.saveRequested.emit({
      projectId: this.project.id,
      title: this.editorValue.title,
      shortDescription: this.editorValue.shortDescription,
      longDescription: this.editorValue.longDescription,
      type: this.editorValue.type,
      isPublished: this.editorValue.isPublished,
      imageDrafts: this.editorImages.map((image) => ({
        draftId: image.id,
        existingImageId: image.existingImageId,
        file: image.file,
        altText: image.altText,
        caption: image.caption,
        isHero: image.isHero
      }))
    });
  }

  patchEditorValue(value: ProjectEditorFormValue): void {
    this.editorValue = value;
  }

  uploadImages(files: File[]): void {
    if (files.length === 0) {
      return;
    }

    const available = Math.max(12 - this.editorImages.length, 0);
    const accepted = files.slice(0, available);

    if (accepted.length < files.length) {
      this.uploadErrorMessage = 'You can only queue up to 12 images per project.';
    } else {
      this.uploadErrorMessage = '';
    }

    for (const file of accepted) {
      this.editorImages.push({
        id: this.nextQueueImageId(),
        previewUrl: this.makePreviewUrl(file),
        altText: this.defaultAltText(file.name),
        caption: '',
        isHero: false,
        file,
        existingImageId: null
      });
    }
  }

  setHero(event: { imageId: string; isHero: boolean }): void {
    this.editorImages = toggleQueueHero(this.editorImages, event.imageId, event.isHero);
  }

  patchImage(event: { imageId: string; patch: { altText?: string; caption?: string } }): void {
    this.editorImages = this.editorImages.map((image) => (image.id === event.imageId ? { ...image, ...event.patch } : image));
  }

  moveImage(event: { imageId: string; direction: -1 | 1 }): void {
    this.editorImages = moveQueueItemById(this.editorImages, event.imageId, event.direction);
  }

  deleteImage(imageId: string): void {
    const image = this.editorImages.find((item) => item.id === imageId);
    if (image?.file) {
      this.revokePreviewUrl(image.previewUrl);
    }
    this.editorImages = this.editorImages.filter((image) => image.id !== imageId);
  }

  ngOnDestroy(): void {
    this.clearQueuedPreviews();
  }

  private defaultAltText(filename: string): string {
    return defaultImageAltText(filename);
  }

  private nextQueueImageId(): string {
    editQueuedImageSequence += 1;
    return `edit-queued-image-${editQueuedImageSequence}`;
  }

  private makePreviewUrl(file: File): string {
    return createObjectUrlForPreview(file);
  }

  private revokePreviewUrl(url: string): void {
    revokeObjectUrlForPreview(url);
  }

  private clearQueuedPreviews(): void {
    for (const image of this.editorImages) {
      if (image.file) {
        this.revokePreviewUrl(image.previewUrl);
      }
    }
  }
}
