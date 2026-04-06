import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectApiService } from './project-api.service';

describe('ProjectApiService', () => {
  let service: ProjectApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProjectApiService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(ProjectApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('maps project image update payload fields', () => {
    service
      .updateProjectImage('project-1', 'image-1', {
        isHero: true,
        altText: 'Updated alt',
        caption: 'Updated caption'
      })
      .subscribe((image) => {
        expect(image.id).toBe('image-1');
      });

    const request = httpMock.expectOne('/api/v1/projects/project-1/images/image-1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      is_hero: true,
      alt_text: 'Updated alt',
      caption: 'Updated caption'
    });

    request.flush({
      id: 'image-1',
      thumb_url: '/thumb.webp',
      full_url: '/full.webp',
      alt_text: 'Updated alt',
      caption: 'Updated caption',
      sort_order: 0,
      is_hero: true,
      created_at: '2026-01-01T00:00:00+00:00',
      updated_at: '2026-01-01T00:00:00+00:00'
    });
  });

  it('omits undefined project image update fields', () => {
    service.updateProjectImage('project-2', 'image-2', { caption: '' }).subscribe();

    const request = httpMock.expectOne('/api/v1/projects/project-2/images/image-2');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ caption: '' });
    request.flush({
      id: 'image-2',
      thumb_url: '/thumb.webp',
      full_url: '/full.webp',
      alt_text: 'Original',
      caption: '',
      sort_order: 0,
      is_hero: false,
      created_at: '2026-01-01T00:00:00+00:00',
      updated_at: '2026-01-01T00:00:00+00:00'
    });
  });
});
