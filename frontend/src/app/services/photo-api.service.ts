import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { buildHttpParams } from '../core/http/query-params';
import { Photo, PhotoApi, PhotoListResponse, PhotoListResponseApi, mapPhotoApiToPhoto } from '../models/photo.model';

export interface PhotoUploadPayload {
  caption: string;
  altText?: string;
  capturedAt?: string;
  clientLastModified?: string;
  isPublished?: boolean;
}

export interface PhotoUpdatePayload {
  caption?: string;
  altText?: string;
  isPublished?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PhotoApiService {
  private readonly http = inject(HttpClient);

  getPhotos(limit = 120, offset = 0, includeUnpublished = false): Observable<PhotoListResponse> {
    const params = buildHttpParams({ limit, offset, include_unpublished: includeUnpublished });

    return this.http.get<PhotoListResponseApi>('/api/v1/photos', { params }).pipe(
      map((response) => ({
        total: response.total,
        rows: response.rows.map(mapPhotoApiToPhoto)
      }))
    );
  }

  updatePhoto(photoId: string, payload: PhotoUpdatePayload): Observable<Photo> {
    const body: Record<string, string | boolean> = {};

    if (typeof payload.caption === 'string') {
      body['caption'] = payload.caption;
    }

    if (typeof payload.altText === 'string') {
      body['alt_text'] = payload.altText;
    }

    if (typeof payload.isPublished === 'boolean') {
      body['is_published'] = payload.isPublished;
    }

    return this.http.patch<PhotoApi>(`/api/v1/photos/${photoId}`, body).pipe(map(mapPhotoApiToPhoto));
  }

  deletePhoto(photoId: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/photos/${photoId}`);
  }

  uploadPhoto(file: File, payload: PhotoUploadPayload): Observable<Photo> {
    const form = new FormData();
    form.set('file', file);
    form.set('caption', payload.caption);
    form.set('alt_text', payload.altText?.trim() ?? '');

    if (payload.capturedAt) {
      form.set('captured_at', payload.capturedAt);
    }

    if (payload.clientLastModified) {
      form.set('client_last_modified', payload.clientLastModified);
    }

    form.set('is_published', String(payload.isPublished ?? true));
    return this.http.post<PhotoApi>('/api/v1/photos', form).pipe(map(mapPhotoApiToPhoto));
  }
}
