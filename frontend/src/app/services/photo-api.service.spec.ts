import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PhotoApiService } from './photo-api.service';

describe('PhotoApiService', () => {
  let service: PhotoApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PhotoApiService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(PhotoApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('requests published photos by default', () => {
    service.getPhotos().subscribe((response) => {
      expect(response.total).toBe(1);
      expect(response.rows[0].altText).toBe('Alt text');
    });

    const request = httpMock.expectOne((req) => req.url === '/api/v1/photos' && req.params.get('include_unpublished') === 'false');
    request.flush({
      total: 1,
      rows: [
        {
          id: '1',
          alt_text: 'Alt text',
          caption: 'Caption',
          thumb_url: '/thumb.webp',
          full_url: '/full.webp',
          captured_at: '2024-01-01T00:00:00+00:00',
          is_published: true,
          created_at: '2024-01-01T00:00:00+00:00',
          updated_at: '2024-01-01T00:00:00+00:00'
        }
      ]
    });
  });

  it('requests include-unpublished photos when enabled', () => {
    service.getPhotos(120, 0, true).subscribe();

    const request = httpMock.expectOne((req) => req.url === '/api/v1/photos' && req.params.get('include_unpublished') === 'true');
    request.flush({ total: 0, rows: [] });
  });

  it('updates publish state', () => {
    service.updatePhotoPublication('photo-1', false).subscribe((photo) => {
      expect(photo.isPublished).toBe(false);
    });

    const request = httpMock.expectOne('/api/v1/photos/photo-1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ is_published: false });
    request.flush({
      id: 'photo-1',
      alt_text: 'Alt text',
      caption: 'Caption',
      thumb_url: '/thumb.webp',
      full_url: '/full.webp',
      captured_at: '2024-01-01T00:00:00+00:00',
      is_published: false,
      created_at: '2024-01-01T00:00:00+00:00',
      updated_at: '2024-01-02T00:00:00+00:00'
    });
  });
});
