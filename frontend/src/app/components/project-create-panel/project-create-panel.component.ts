import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectCreatePayload } from '../../models/project.model';

export interface ProjectCreateQueuedImage {
  id: string;
  file: File;
  previewUrl: string;
  altText: string;
  caption: string;
}

export interface ProjectCreateRequestedEvent {
  draft: ProjectCreatePayload;
  queuedImages: ProjectCreateQueuedImage[];
}

let queueImageSequence = 0;

@Component({
  selector: 'app-project-create-panel',
  standalone: true,
  imports: [FormsModule],
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

  onCreateImageSelection(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const files = input?.files;
    if (!files || files.length === 0) {
      return;
    }

    this.addImages(Array.from(files));

    if (input) {
      input.value = '';
    }
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
        caption: ''
      });
    }
  }

  moveImage(imageId: string, direction: -1 | 1): void {
    const currentIndex = this.imageQueue.findIndex((image) => image.id === imageId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= this.imageQueue.length) {
      return;
    }

    const nextQueue = [...this.imageQueue];
    [nextQueue[currentIndex], nextQueue[nextIndex]] = [nextQueue[nextIndex], nextQueue[currentIndex]];
    this.imageQueue = nextQueue;
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
    const stem = filename.replace(/\.[^.]+$/, '');
    return stem.replace(/[_-]+/g, ' ').trim() || 'Project image';
  }

  private nextQueueImageId(): string {
    queueImageSequence += 1;
    return `queued-image-${queueImageSequence}`;
  }

  private makePreviewUrl(file: File): string {
    if (typeof URL.createObjectURL === 'function') {
      return URL.createObjectURL(file);
    }
    return '';
  }

  private revokePreviewUrl(url: string): void {
    if (url && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }
}
