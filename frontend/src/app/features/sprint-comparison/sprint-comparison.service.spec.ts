import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { SprintComparisonService } from './sprint-comparison.service';

describe('SprintComparisonService', () => {
  let service: SprintComparisonService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SprintComparisonService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(SprintComparisonService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('requests people with a limit query param', () => {
    service.getPeople().subscribe((people) => {
      expect(people).toEqual([{ id: 1, name: 'Alice' }]);
    });

    const request = httpMock.expectOne((req) => req.url === '/api/v1/people' && req.params.get('limit') === '100');
    expect(request.request.method).toBe('GET');
    request.flush([{ id: 1, name: 'alice' }]);
  });

  it('requests locations', () => {
    service.getLocations().subscribe((locations) => {
      expect(locations).toEqual(['Track A']);
    });

    const request = httpMock.expectOne('/api/v1/locations');
    expect(request.request.method).toBe('GET');
    request.flush(['Track A']);
  });

  it('maps comparison API response into app series model', () => {
    service
      .getComparison({ mode: 'progression', personIds: [1, 2], location: 'Track A', runWindow: '20' })
      .subscribe((series) => {
        expect(series).toEqual([
          {
            personId: 1,
            personName: 'Alice',
            points: [{ x: 1, y: 9500 }]
          }
        ]);
      });

    const request = httpMock.expectOne((req) => req.url === '/api/v1/sprints/comparison');
    expect(request.request.params.get('mode')).toBe('progression');
    expect(request.request.params.get('person_ids')).toBe('1,2');
    expect(request.request.params.get('run_window')).toBe('20');
    expect(request.request.params.get('location')).toBe('Track A');
    request.flush({
      mode: 'progression',
      location: 'Track A',
      run_window: '20',
      series: [{ person_id: 1, person_name: 'alice', points: [{ x: 1, y: 9500 }] }]
    });
  });
});
