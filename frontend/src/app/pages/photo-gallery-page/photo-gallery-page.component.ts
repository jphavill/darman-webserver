import { DOCUMENT, NgStyle } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { NgIconComponent } from '@ng-icons/core';
import { Photo } from '../../models/photo.model';
import { WINDOW } from '../../core/browser/browser-globals';
import { PhotoApiService } from '../../services/photo-api.service';

@Component({
  selector: 'app-photo-gallery-page',
  standalone: true,
  imports: [NgStyle, NgIconComponent],
  templateUrl: './photo-gallery-page.component.html',
  styleUrls: ['./photo-gallery-page.component.css']
})
export class PhotoGalleryPageComponent implements OnInit, OnDestroy {
  private readonly photoApi = inject(PhotoApiService);
  private readonly window = inject(WINDOW);
  private readonly document = inject(DOCUMENT);
  private readonly masonryRowHeight = 8;
  private readonly masonryGap = 16;
  private readonly fallbackAspectRatio = 4 / 3;
  private readonly thumbAspectRatios = new Map<string, number>();

  photos: Photo[] = [];
  activePhoto: Photo | null = null;
  activePhotoImageStyle: Record<string, number> = {};
  errorMessage = '';

  ngOnInit(): void {
    this.photoApi.getPhotos().subscribe({
      next: (response) => {
        this.photos = response.rows;
      },
      error: () => {
        this.errorMessage = 'Unable to load photos right now.';
      }
    });
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

  trackByPhoto(index: number, photo: Photo): string {
    return `${photo.id}-${index}`;
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

  ngOnDestroy(): void {
    this.document.body.classList.remove('overlay-open');
  }
}
