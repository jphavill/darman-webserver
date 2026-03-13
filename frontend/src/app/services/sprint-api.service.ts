import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SprintListResponse, SprintQuery } from '../models/sprint.model';

@Injectable({
  providedIn: 'root'
})
export class SprintApiService {
  private readonly http = inject(HttpClient);

  getSprints(query: SprintQuery): Observable<SprintListResponse> {
    let params = new HttpParams()
      .set('limit', query.limit)
      .set('offset', query.offset);

    if (query.sort_by) {
      params = params.set('sort_by', query.sort_by);
    }
    if (query.sort_dir) {
      params = params.set('sort_dir', query.sort_dir);
    }
    if (query.name) {
      params = params.set('name', query.name);
    }
    if (query.location) {
      params = params.set('location', query.location);
    }
    if (query.date_from) {
      params = params.set('date_from', query.date_from);
    }
    if (query.date_to) {
      params = params.set('date_to', query.date_to);
    }
    if (query.min_time_ms !== undefined) {
      params = params.set('min_time_ms', query.min_time_ms);
    }
    if (query.max_time_ms !== undefined) {
      params = params.set('max_time_ms', query.max_time_ms);
    }

    return this.http.get<SprintListResponse>('/api/v1/sprints', { params });
  }
}
