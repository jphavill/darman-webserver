import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { ProjectCreatePayload } from '../../models/project.model';
import { ProjectEditorFormComponent, ProjectEditorFormValue } from '../project-editor-form/project-editor-form.component';
import {
  createObjectUrlForPreview,
  defaultImageAltText,
  moveQueueItemById,
  revokeObjectUrlForPreview,
  toggleQueueHero
} from '../project-editor-form/project-editor-queue.utils';

export interface ProjectCreateQueuedImage {
  id: string;
  file: File;
  previewUrl: string;
  altText: string;
  caption: string;
  isHero: boolean;
}

export interface ProjectCreateRequestedEvent {
  draft: ProjectCreatePayload;
  queuedImages: ProjectCreateQueuedImage[];
}

let queueImageSequence = 0;

@Component({
  selector: 'app-project-create-panel',
  standalone: true,
  imports: [ProjectEditorFormComponent],
  templateUrl: './project-create-panel.component.html',
  styleUrls: ['./project-create-panel.component.css']
})
export class ProjectCreatePanelComponent implements OnDestroy {
  private readonly maxImages = 12;

  @Output() createRequested = new EventEmitter<ProjectCreateRequestedEvent>();

  projectType: 'software' | 'physical' = 'software';
  isSubmitting = false;
  statusMessage = '';
  errorMessage = '';

  draft: ProjectCreatePayload = this.defaultDraft();
  imageQueue: ProjectCreateQueuedImage[] = [];

  get canSelectMoreImages(): boolean {
    return this.imageQueue.length < this.maxImages;
  }

  get editorValue(): ProjectEditorFormValue {
    return {
      title: this.draft.title,
      type: this.projectType,
      isPublished: this.draft.is_published,
      shortDescription: this.draft.short_description,
      longDescription: this.draft.long_description_md
    };
  }

  onEditorValueChange(value: ProjectEditorFormValue): void {
    this.draft.title = value.title;
    this.projectType = value.type;
    this.draft.is_published = value.isPublished;
    this.draft.short_description = value.shortDescription;
    this.draft.long_description_md = value.longDescription;
  }

  onCreateImageSelection(files: File[]): void {
    if (files.length === 0) {
      return;
    }

    this.addImages(files);
  }

  addImages(files: File[]): void {
    const available = Math.max(this.maxImages - this.imageQueue.length, 0);
    const accepted = files.slice(0, available);

    if (accepted.length < files.length) {
      this.errorMessage = 'You can only queue up to 12 images per project.';
    } else {
      this.errorMessage = '';
    }

    for (const file of accepted) {
      this.imageQueue.push({
        id: this.nextQueueImageId(),
        file,
        previewUrl: this.makePreviewUrl(file),
        altText: this.defaultAltText(file.name),
        caption: '',
        isHero: false
      });
    }
  }

  setQueueHero(event: { imageId: string; isHero: boolean }): void {
    this.imageQueue = toggleQueueHero(this.imageQueue, event.imageId, event.isHero);
  }

  patchImage(event: { imageId: string; patch: { altText?: string; caption?: string } }): void {
    this.imageQueue = this.imageQueue.map((image) => (image.id === event.imageId ? { ...image, ...event.patch } : image));
  }

  moveImage(imageId: string, direction: -1 | 1): void {
    this.imageQueue = moveQueueItemById(this.imageQueue, imageId, direction);
  }

  removeImage(imageId: string): void {
    const image = this.imageQueue.find((item) => item.id === imageId);
    if (image) {
      this.revokePreviewUrl(image.previewUrl);
    }
    this.imageQueue = this.imageQueue.filter((item) => item.id !== imageId);
  }

  submit(): void {
    this.draft.type = this.projectType;
    this.createRequested.emit({
      draft: {
        ...this.draft,
        links: [...this.draft.links]
      },
      queuedImages: this.imageQueue.map((image) => ({ ...image }))
    });
  }

  setSubmissionState(isSubmitting: boolean, statusMessage: string, errorMessage = ''): void {
    this.isSubmitting = isSubmitting;
    this.statusMessage = statusMessage;
    this.errorMessage = errorMessage;
  }

  resetForm(): void {
    this.clearImageQueue();
    this.projectType = 'software';
    this.draft = this.defaultDraft();
    this.statusMessage = '';
    this.errorMessage = '';
  }

  clearSuccessfulQueuedImages(failedQueueImageIds: ReadonlySet<string>): void {
    const failed: ProjectCreateQueuedImage[] = [];

    for (const image of this.imageQueue) {
      if (failedQueueImageIds.has(image.id)) {
        failed.push(image);
      } else {
        this.revokePreviewUrl(image.previewUrl);
      }
    }

    this.imageQueue = failed;
  }

  clearImageQueue(): void {
    for (const image of this.imageQueue) {
      this.revokePreviewUrl(image.previewUrl);
    }
    this.imageQueue = [];
  }

  ngOnDestroy(): void {
    this.clearImageQueue();
  }

  private defaultDraft(): ProjectCreatePayload {
    return {
      title: '',
      short_description: '',
      long_description_md: '',
      type: 'software',
      is_published: false,
      links: []
    };
  }

  private defaultAltText(filename: string): string {
    return defaultImageAltText(filename);
  }

  private nextQueueImageId(): string {
    queueImageSequence += 1;
    return `queued-image-${queueImageSequence}`;
  }

  private makePreviewUrl(file: File): string {
    return createObjectUrlForPreview(file);
  }

  private revokePreviewUrl(url: string): void {
    revokeObjectUrlForPreview(url);
  }
}
