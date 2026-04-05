import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotoApiService } from '../../services/photo-api.service';
import { PhotosPageComponent } from './photos-page.component';

describe('PhotosPageComponent', () => {
  const photo = {
    id: '1',
    altText: 'Alt text',
    caption: 'Caption',
    thumbUrl: '/thumb.webp',
    fullUrl: '/full.webp',
    capturedAt: '2024-01-01',
    isPublished: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  };

  it('loads photos on init', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PhotoApiService,
          useValue: {
            getPhotos: vi.fn().mockReturnValue(of({ rows: [photo], total: 1 }))
          }
        }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new PhotosPageComponent());
    await vi.waitFor(() => {
      expect(component.photos).toEqual([photo]);
    });
  });

  it('opens and closes a photo overlay', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PhotoApiService,
          useValue: {
            getPhotos: vi.fn().mockReturnValue(of({ rows: [], total: 0 }))
          }
        }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new PhotosPageComponent());
    component.openPhoto(photo);
    expect(component.activePhoto?.id).toBe('1');

    component.closePhoto();
    expect(component.activePhoto).toBeNull();
  });
});
  afterEach(() => {
    TestBed.resetTestingModule();
  });
