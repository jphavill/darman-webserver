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

  updatePhotoPublication(photoId: string, isPublished: boolean): Observable<Photo> {
    return this.http.patch<PhotoApi>(`/api/v1/photos/${photoId}`, { is_published: isPublished }).pipe(map(mapPhotoApiToPhoto));
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
