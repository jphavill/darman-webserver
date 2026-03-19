import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import {
  AvailableRunner,
  ComparisonMode,
  ComparisonSeries,
  RunWindow,
  SprintComparisonResponseApi
} from './sprint-comparison.models';

@Injectable({
  providedIn: 'root'
})
export class SprintComparisonService {
  private readonly http = inject(HttpClient);

  getPeople(): Observable<AvailableRunner[]> {
    return this.http.get<AvailableRunner[]>('/api/v1/people', {
      params: new HttpParams().set('limit', 100)
    });
  }

  getLocations(): Observable<string[]> {
    return this.http.get<string[]>('/api/v1/locations');
  }

  getComparison(params: {
    mode: ComparisonMode;
    personIds: number[];
    location: string | null;
    runWindow: RunWindow;
  }): Observable<ComparisonSeries[]> {
    let query = new HttpParams()
      .set('mode', params.mode)
      .set('person_ids', params.personIds.join(','))
      .set('run_window', params.runWindow);

    if (params.location) {
      query = query.set('location', params.location);
    }

    return this.http
      .get<SprintComparisonResponseApi>('/api/v1/sprints/comparison', { params: query })
      .pipe(
        map((response) =>
          response.series.map(
            (series): ComparisonSeries => ({
              personId: series.person_id,
              personName: series.person_name,
              points: series.points
            })
          )
        )
      );
  }
}
