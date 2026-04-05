import { NgStyle } from '@angular/common';
import { Component, HostListener, OnDestroy, computed, effect, inject, signal, DOCUMENT } from '@angular/core';
import { NgIconComponent } from '@ng-icons/core';
import { AdminAuthStateService } from '../../core/admin/admin-auth-state.service';
import { Photo } from '../../models/photo.model';
import { WINDOW } from '../../core/browser/browser-globals';
import { PhotoApiService } from '../../services/photo-api.service';

@Component({
    selector: 'app-photos-page',
    imports: [NgStyle, NgIconComponent],
    templateUrl: './photos-page.component.html',
    styleUrls: ['./photos-page.component.css']
})
export class PhotosPageComponent implements OnDestroy {
  private readonly photoApi = inject(PhotoApiService);
  private readonly adminAuthState = inject(AdminAuthStateService);
  private readonly window = inject(WINDOW);
  private readonly document = inject(DOCUMENT);
  private readonly masonryRowHeight = 8;
  private readonly masonryGap = 16;
  private readonly fallbackAspectRatio = 4 / 3;
  private readonly thumbAspectRatios = new Map<string, number>();
  private readonly pendingPhotoUpdates = signal<Set<string>>(new Set());

  readonly canManagePublication = computed(() => this.adminAuthState.can('photosManagePublication'));
  private readonly shouldIncludeUnpublished = computed(() => this.adminAuthState.can('photosViewUnpublished'));
  private readonly loadPhotosEffect = effect((onCleanup) => {
    const includeUnpublished = this.shouldIncludeUnpublished();
    const subscription = this.photoApi.getPhotos(120, 0, includeUnpublished).subscribe({
      next: (response) => {
        this.errorMessage = '';
        this.photos = response.rows;
      },
      error: () => {
        this.photos = [];
        this.errorMessage = 'Unable to load photos right now.';
      }
    });

    onCleanup(() => {
      subscription.unsubscribe();
    });
  });

  photos: Photo[] = [];
  activePhoto: Photo | null = null;
  activePhotoImageStyle: Record<string, number> = {};
  errorMessage = '';

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

  ngOnDestroy(): void {
    this.document.body.classList.remove('overlay-open');
  }
}
