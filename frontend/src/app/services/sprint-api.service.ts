import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { buildHttpParams } from '../core/http/query-params';
import {
  BestTimesQuery,
  BestTimesResponse,
  BestTimesResponseApi,
  SprintListResponse,
  SprintListResponseApi,
  SprintQuery,
  mapBestTimeRowApiToBestTimeRow,
  mapSprintRowApiToSprintRow
} from '../models/sprint.model';

@Injectable({
  providedIn: 'root'
})
export class SprintApiService {
  private readonly http = inject(HttpClient);

  getSprints(query: SprintQuery): Observable<SprintListResponse> {
    const params = buildHttpParams(query);

    return this.http.get<SprintListResponseApi>('/api/v1/sprints', { params }).pipe(
      map((response) => ({
        total: response.total,
        rows: response.rows.map(mapSprintRowApiToSprintRow)
      }))
    );
  }

  getBestTimes(query: BestTimesQuery): Observable<BestTimesResponse> {
    const params = buildHttpParams(query);

    return this.http.get<BestTimesResponseApi>('/api/v1/sprints/best', { params }).pipe(
      map((response) => ({
        total: response.total,
        rows: response.rows.map(mapBestTimeRowApiToBestTimeRow)
      }))
    );
  }
}
