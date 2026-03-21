import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { buildHttpParams } from '../core/http/query-params';
import { PhotoListResponse, PhotoListResponseApi, mapPhotoApiToPhoto } from '../models/photo.model';

@Injectable({
  providedIn: 'root'
})
export class PhotoApiService {
  private readonly http = inject(HttpClient);

  getPhotos(limit = 120, offset = 0): Observable<PhotoListResponse> {
    const params = buildHttpParams({ limit, offset });

    return this.http.get<PhotoListResponseApi>('/api/v1/photos', { params }).pipe(
      map((response) => ({
        total: response.total,
        rows: response.rows.map(mapPhotoApiToPhoto)
      }))
    );
  }
}
