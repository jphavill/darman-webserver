import { NgStyle } from '@angular/common';
import { Component, HostListener, OnDestroy, computed, effect, inject, signal, DOCUMENT } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
import { AdminAuthStateService } from '../../core/admin/admin-auth-state.service';
import { Photo } from '../../models/photo.model';
import { WINDOW } from '../../core/browser/browser-globals';
import { PhotoApiService } from '../../services/photo-api.service';
import { PhotoMetadataService } from '../../services/photo-metadata.service';

type QueuedUploadStatus = 'queued' | 'uploading' | 'uploaded' | 'failed';

interface QueuedPhotoUpload {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
  altText: string;
  capturedAtLocal: string;
  captureDateSource: string;
  isPublished: boolean;
  status: QueuedUploadStatus;
  errorMessage: string;
}

let photoUploadSequence = 0;

@Component({
    selector: 'app-photos-page',
    imports: [NgStyle, FormsModule, NgIconComponent],
    templateUrl: './photos-page.component.html',
    styleUrls: ['./photos-page.component.css']
})
export class PhotosPageComponent implements OnDestroy {
  private readonly photoApi = inject(PhotoApiService);
  private readonly adminAuthState = inject(AdminAuthStateService);
  private readonly photoMetadata = inject(PhotoMetadataService);
  private readonly window = inject(WINDOW);
  private readonly document = inject(DOCUMENT);
  private readonly masonryRowHeight = 8;
  private readonly masonryGap = 16;
  private readonly fallbackAspectRatio = 4 / 3;
  private readonly thumbAspectRatios = new Map<string, number>();
  private readonly pendingPhotoUpdates = signal<Set<string>>(new Set());
  private readonly isUploadingBatch = signal(false);
  private readonly maxQueuedUploads = 20;

  readonly canManagePublication = computed(() => this.adminAuthState.can('photosManagePublication'));
  private readonly shouldIncludeUnpublished = computed(() => this.adminAuthState.can('photosViewUnpublished'));
  private readonly loadPhotosEffect = effect((onCleanup) => {
    const includeUnpublished = this.shouldIncludeUnpublished();
    const subscription = this.fetchPhotos(includeUnpublished);

    onCleanup(() => {
      subscription.unsubscribe();
    });
  });

  photos: Photo[] = [];
  queuedUploads: QueuedPhotoUpload[] = [];
  activePhoto: Photo | null = null;
  activePhotoImageStyle: Record<string, number> = {};
  errorMessage = '';
  uploadStatusMessage = '';

  canQueueMoreUploads(): boolean {
    return this.queuedUploads.length < this.maxQueuedUploads;
  }

  canStartUploadBatch(): boolean {
    return this.queuedUploads.some((upload) => upload.status === 'queued' || upload.status === 'failed');
  }

  isBatchUploadRunning(): boolean {
    return this.isUploadingBatch();
  }

  onUploadSelection(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const files = input?.files;

    if (!files || files.length === 0) {
      return;
    }

    void this.addQueuedUploads(Array.from(files));

    if (input) {
      input.value = '';
    }
  }

  removeQueuedUpload(uploadId: string): void {
    if (this.isUploadingBatch()) {
      return;
    }

    const upload = this.queuedUploads.find((item) => item.id === uploadId);
    if (upload) {
      this.revokePreviewUrl(upload.previewUrl);
    }

    this.queuedUploads = this.queuedUploads.filter((item) => item.id !== uploadId);
  }

  clearCompletedUploads(): void {
    if (this.isUploadingBatch()) {
      return;
    }

    const remaining: QueuedPhotoUpload[] = [];
    for (const upload of this.queuedUploads) {
      if (upload.status === 'uploaded') {
        this.revokePreviewUrl(upload.previewUrl);
        continue;
      }
      remaining.push(upload);
    }

    this.queuedUploads = remaining;
  }

  toggleQueuedPublish(uploadId: string): void {
    if (this.isUploadingBatch()) {
      return;
    }

    const upload = this.queuedUploads.find((item) => item.id === uploadId);
    if (!upload) {
      return;
    }

    this.patchQueuedUpload(uploadId, { isPublished: !upload.isPublished });
  }

  async uploadQueuedPhotos(): Promise<void> {
    if (this.isUploadingBatch() || !this.canStartUploadBatch()) {
      return;
    }

    this.isUploadingBatch.set(true);
    this.uploadStatusMessage = 'Uploading photos...';
    this.errorMessage = '';

    let uploadedCount = 0;
    let failedCount = 0;

    for (const upload of this.queuedUploads) {
      if (upload.status === 'uploaded') {
        continue;
      }

      const caption = upload.caption.trim();
      if (!caption) {
        failedCount += 1;
        this.patchQueuedUpload(upload.id, {
          status: 'failed',
          errorMessage: 'Caption is required.'
        });
        continue;
      }

      this.patchQueuedUpload(upload.id, {
        status: 'uploading',
        errorMessage: ''
      });

      try {
        await firstValueFrom(
          this.photoApi.uploadPhoto(upload.file, {
            caption,
            altText: upload.altText.trim(),
            capturedAt: this.toIsoTimestamp(upload.capturedAtLocal),
            clientLastModified: this.fileLastModifiedToIso(upload.file),
            isPublished: upload.isPublished
          })
        );
        uploadedCount += 1;
        this.patchQueuedUpload(upload.id, { status: 'uploaded', errorMessage: '' });
      } catch {
        failedCount += 1;
        this.patchQueuedUpload(upload.id, {
          status: 'failed',
          errorMessage: 'Upload failed. Check image type/size and try again.'
        });
      }
    }

    await this.reloadPhotos();

    if (failedCount === 0) {
      this.uploadStatusMessage = `Uploaded ${uploadedCount} photo${uploadedCount === 1 ? '' : 's'}.`;
    } else {
      this.uploadStatusMessage = `Uploaded ${uploadedCount}, failed ${failedCount}.`;
      this.errorMessage = 'Some uploads failed. You can edit and retry failed items.';
    }

    this.isUploadingBatch.set(false);
  }

  openPhoto(photo: Photo, event?: Event): void {
    this.activePhoto = photo;
    const aspectRatio = this.getAspectRatioFromEvent(event) ?? this.thumbAspectRatios.get(photo.id) ?? this.fallbackAspectRatio;
    this.activePhotoImageStyle = this.buildModalImageStyle(aspectRatio);
    this.document.body.classList.add('overlay-open');
  }

  closePhoto(): void {
    if (!this.activePhoto) {
      return;
    }

    this.activePhoto = null;
    this.activePhotoImageStyle = {};
    this.document.body.classList.remove('overlay-open');
  }

  openFullResolution(): void {
    if (!this.activePhoto) {
      return;
    }

    this.window.open(this.activePhoto.fullUrl, '_blank', 'noopener,noreferrer');
  }

  isUpdatingPhoto(photoId: string): boolean {
    return this.pendingPhotoUpdates().has(photoId);
  }

  updatePhotoPublished(photo: Photo, event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const nextValue = input?.checked;

    if (typeof nextValue !== 'boolean' || this.isUpdatingPhoto(photo.id) || nextValue === photo.isPublished) {
      return;
    }

    const previousValue = photo.isPublished;
    this.patchPhotoPublication(photo.id, nextValue);
    this.markPhotoPending(photo.id, true);

    this.photoApi.updatePhotoPublication(photo.id, nextValue).subscribe({
      next: (updatedPhoto) => {
        this.patchPhoto(updatedPhoto);
        this.markPhotoPending(photo.id, false);
        this.errorMessage = '';
      },
      error: () => {
        this.patchPhotoPublication(photo.id, previousValue);
        this.markPhotoPending(photo.id, false);
        this.errorMessage = 'Unable to update photo visibility right now.';
      }
    });
  }

  onThumbLoad(event: Event, photo: Photo): void {
    const image = event.target as HTMLImageElement | null;

    if (!image) {
      return;
    }

    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      this.thumbAspectRatios.set(photo.id, image.naturalWidth / image.naturalHeight);
    }

    this.setTileRowSpan(image);
  }

  onActivePhotoLoad(event: Event): void {
    const image = event.target as HTMLImageElement | null;

    if (!image || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      return;
    }

    this.activePhotoImageStyle = this.buildModalImageStyle(image.naturalWidth / image.naturalHeight);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.recalculateMasonryLayout();

    if (this.activePhoto) {
      const aspectRatio = this.getCurrentModalAspectRatio();
      this.activePhotoImageStyle = this.buildModalImageStyle(aspectRatio);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.activePhoto) {
      this.closePhoto();
    }
  }

  private recalculateMasonryLayout(): void {
    const images = this.document.querySelectorAll<HTMLImageElement>('.photo-masonry .photo-tile img');

    images.forEach((image) => {
      if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
        this.setTileRowSpan(image);
      }
    });
  }

  private setTileRowSpan(image: HTMLImageElement): void {
    const tile = image.closest('.photo-tile') as HTMLElement | null;

    if (!tile || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      return;
    }

    const renderedHeight = (tile.clientWidth * image.naturalHeight) / image.naturalWidth;

    if (!renderedHeight) {
      return;
    }

    const rowSpan = Math.ceil((renderedHeight + this.masonryGap) / (this.masonryRowHeight + this.masonryGap));
    tile.style.setProperty('--row-span', `${Math.max(rowSpan, 1)}`);
  }

  private buildModalImageStyle(aspectRatio: number): Record<string, number> {
    const normalizedAspectRatio = aspectRatio > 0 ? aspectRatio : this.fallbackAspectRatio;
    const isMobile = this.window.innerWidth <= 700;
    const viewportWidth = this.window.innerWidth;
    const viewportHeight = this.window.innerHeight;
    const maxWidth = viewportWidth * (isMobile ? 0.94 : 0.96);
    const maxHeight = (viewportHeight * (isMobile ? 0.9 : 0.92)) - 72;
    const safeMaxHeight = Math.max(maxHeight, 1);

    let width = Math.min(maxWidth, safeMaxHeight * normalizedAspectRatio);
    let height = width / normalizedAspectRatio;

    if (height > safeMaxHeight) {
      height = safeMaxHeight;
      width = height * normalizedAspectRatio;
    }

    return {
      'width.px': Math.max(Math.floor(width), 1),
      'height.px': Math.max(Math.floor(height), 1)
    };
  }

  private getAspectRatioFromEvent(event?: Event): number | null {
    if (!event) {
      return null;
    }

    const tile = event.currentTarget as HTMLElement | null;
    const image = tile?.querySelector('img') as HTMLImageElement | null;

    if (!image || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      return null;
    }

    return image.naturalWidth / image.naturalHeight;
  }

  private getCurrentModalAspectRatio(): number {
    const styledWidth = this.activePhotoImageStyle['width.px'];
    const styledHeight = this.activePhotoImageStyle['height.px'];

    if (styledWidth && styledHeight) {
      return styledWidth / styledHeight;
    }

    if (this.activePhoto) {
      return this.thumbAspectRatios.get(this.activePhoto.id) ?? this.fallbackAspectRatio;
    }

    return this.fallbackAspectRatio;
  }

  private patchPhoto(updatedPhoto: Photo): void {
    this.photos = this.photos.map((photo) => (photo.id === updatedPhoto.id ? updatedPhoto : photo));
  }

  private patchPhotoPublication(photoId: string, isPublished: boolean): void {
    this.photos = this.photos.map((photo) => (photo.id === photoId ? { ...photo, isPublished } : photo));
  }

  private markPhotoPending(photoId: string, isPending: boolean): void {
    const next = new Set(this.pendingPhotoUpdates());

    if (isPending) {
      next.add(photoId);
    } else {
      next.delete(photoId);
    }

    this.pendingPhotoUpdates.set(next);
  }

  private async addQueuedUploads(files: File[]): Promise<void> {
    const available = Math.max(this.maxQueuedUploads - this.queuedUploads.length, 0);
    const accepted = files.slice(0, available);
    const nextUploads = [...this.queuedUploads];

    if (accepted.length < files.length) {
      this.errorMessage = `You can queue up to ${this.maxQueuedUploads} uploads at a time.`;
    } else {
      this.errorMessage = '';
    }

    for (const file of accepted) {
      nextUploads.push({
        id: this.nextUploadId(),
        file,
        previewUrl: this.createPreviewUrl(file),
        caption: this.defaultCaption(file.name),
        altText: '',
        capturedAtLocal: '',
        captureDateSource: 'Detecting metadata...',
        isPublished: true,
        status: 'queued',
        errorMessage: ''
      });
    }

    this.queuedUploads = nextUploads;

    await Promise.all(
      accepted.map(async (file) => {
        const uploadId = nextUploads.find((item) => item.file === file)?.id;
        if (!uploadId) {
          return;
        }

        const detected = await this.photoMetadata.detectCapturedAtLocal(file);
        this.patchQueuedUpload(uploadId, {
          capturedAtLocal: detected.value,
          captureDateSource: detected.source
        });
      })
    );
  }

  private fetchPhotos(includeUnpublished: boolean) {
    return this.photoApi.getPhotos(120, 0, includeUnpublished).subscribe({
      next: (response) => {
        this.errorMessage = '';
        this.photos = response.rows;
      },
      error: () => {
        this.photos = [];
        this.errorMessage = 'Unable to load photos right now.';
      }
    });
  }

  private async reloadPhotos(): Promise<void> {
    try {
      const response = await firstValueFrom(this.photoApi.getPhotos(120, 0, this.shouldIncludeUnpublished()));
      this.photos = response.rows;
    } catch {
      this.errorMessage = 'Unable to refresh photos right now.';
    }
  }

  private patchQueuedUpload(uploadId: string, patch: Partial<QueuedPhotoUpload>): void {
    this.queuedUploads = this.queuedUploads.map((upload) => {
      if (upload.id !== uploadId) {
        return upload;
      }

      return {
        ...upload,
        ...patch
      };
    });
  }

  private toIsoTimestamp(value: string): string | undefined {
    const normalized = value.trim();
    if (!normalized) {
      return undefined;
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }

    return parsed.toISOString();
  }

  private fileLastModifiedToIso(file: File): string | undefined {
    if (!Number.isFinite(file.lastModified) || file.lastModified <= 0) {
      return undefined;
    }

    return new Date(file.lastModified).toISOString();
  }

  private defaultCaption(filename: string): string {
    const stem = filename.replace(/\.[^.]+$/, '');
    return stem.replace(/[_-]+/g, ' ').trim() || 'Photo';
  }

  private nextUploadId(): string {
    photoUploadSequence += 1;
    return `photo-upload-${photoUploadSequence}`;
  }

  private createPreviewUrl(file: File): string {
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

  private clearQueuedUploads(): void {
    for (const upload of this.queuedUploads) {
      this.revokePreviewUrl(upload.previewUrl);
    }

    this.queuedUploads = [];
  }

  ngOnDestroy(): void {
    this.clearQueuedUploads();
    this.document.body.classList.remove('overlay-open');
  }
}
