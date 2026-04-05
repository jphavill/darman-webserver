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

  it('uploads a photo with multipart form data', () => {
    const file = new File(['abc'], 'sample.jpg', { type: 'image/jpeg' });

    service
      .uploadPhoto(file, {
        caption: 'Ridge sunrise',
        altText: '',
        capturedAt: '2026-04-05T17:30:00.000Z',
        clientLastModified: '2026-03-20T02:16:45.000Z',
        isPublished: false
      })
      .subscribe((photo) => {
        expect(photo.caption).toBe('Ridge sunrise');
      });

    const request = httpMock.expectOne('/api/v1/photos');
    expect(request.request.method).toBe('POST');
    const body = request.request.body as FormData;
    expect(body.get('caption')).toBe('Ridge sunrise');
    expect(body.get('alt_text')).toBe('');
    expect(body.get('captured_at')).toBe('2026-04-05T17:30:00.000Z');
    expect(body.get('client_last_modified')).toBe('2026-03-20T02:16:45.000Z');
    expect(body.get('is_published')).toBe('false');

    request.flush({
      id: 'photo-2',
      alt_text: 'Ridge sunrise',
      caption: 'Ridge sunrise',
      thumb_url: '/thumb-2.webp',
      full_url: '/full-2.webp',
      captured_at: '2026-04-05T17:30:00+00:00',
      is_published: false,
      created_at: '2026-04-05T17:31:00+00:00',
      updated_at: '2026-04-05T17:31:00+00:00'
    });
  });
});
