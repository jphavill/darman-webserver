import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { Photo } from '../../models/photo.model';
import { PhotoApiService } from '../../services/photo-api.service';

@Component({
  selector: 'app-photo-gallery-page',
  standalone: true,
  templateUrl: './photo-gallery-page.component.html',
  styleUrls: ['./photo-gallery-page.component.css']
})
export class PhotoGalleryPageComponent implements OnInit, OnDestroy {
  private readonly photoApi = inject(PhotoApiService);

  photos: Photo[] = [];
  activePhoto: Photo | null = null;
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

  openPhoto(photo: Photo): void {
    this.activePhoto = photo;
    document.body.classList.add('overlay-open');
  }

  closePhoto(): void {
    if (!this.activePhoto) {
      return;
    }

    this.activePhoto = null;
    document.body.classList.remove('overlay-open');
  }

  openFullResolution(): void {
    if (!this.activePhoto) {
      return;
    }

    window.open(this.activePhoto.full_url, '_blank', 'noopener,noreferrer');
  }

  trackByPhoto(index: number, photo: Photo): string {
    return `${photo.id}-${index}`;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.activePhoto) {
      this.closePhoto();
    }
  }

  ngOnDestroy(): void {
    document.body.classList.remove('overlay-open');
  }
}
