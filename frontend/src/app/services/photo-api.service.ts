import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PhotoListResponse } from '../models/photo.model';

@Injectable({
  providedIn: 'root'
})
export class PhotoApiService {
  private readonly http = inject(HttpClient);

  getPhotos(limit = 120, offset = 0): Observable<PhotoListResponse> {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http.get<PhotoListResponse>('/api/v1/photos', { params });
  }
}
