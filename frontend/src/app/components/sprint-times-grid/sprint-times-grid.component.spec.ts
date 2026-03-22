import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BROWSER_STORAGE } from '../../core/browser/browser-globals';
import { SprintApiService } from '../../services/sprint-api.service';
import { SprintDisplayUnitService } from '../../shared/preferences/sprint-display-unit.service';
import { SprintTimesGridComponent } from './sprint-times-grid.component';

describe('SprintTimesGridComponent', () => {
  const setup = () => {
    const router = { navigate: vi.fn() };
    const storage: Storage = {
      get length() {
        return 0;
      },
      clear: () => {},
      getItem: () => null,
      key: () => null,
      removeItem: () => {},
      setItem: () => {}
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: BROWSER_STORAGE, useValue: storage },
        {
          provide: SprintApiService,
          useValue: {
            getSprints: vi.fn(),
            getBestTimes: vi.fn()
          }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({})),
            snapshot: {
              queryParamMap: convertToParamMap({})
            }
          }
        },
        {
          provide: Router,
          useValue: router
        }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new SprintTimesGridComponent());
    return { component, router };
  };

  it('defaults to leaderboard all-time mode', () => {
    const { component } = setup();

    expect(component.view).toBe('leaderboard');
    expect(component.leaderboardRange).toBe('all');
  });

  it('writes view and range to query params when controls change', () => {
    const { component, router } = setup();

    component.setView('advanced');
    component.onLeaderboardRangeChange({ target: { value: 'month' } } as unknown as Event);

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { view: 'advanced', range: 'month' },
        queryParamsHandling: 'merge',
        replaceUrl: true
      })
    );
  });

  it('builds calendar month window for leaderboard query', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T12:00:00Z'));
    const { component } = setup();

    component.leaderboardRange = 'month';
    const query = (
      component as { buildLeaderboardQuery: (params: { startRow: number; endRow: number }) => Record<string, string | number | undefined> }
    ).buildLeaderboardQuery({ startRow: 0, endRow: 25 });

    expect(query.date_from).toBe('2026-03-01');
    expect(query.date_to).toBe('2026-03-21');
    expect(query.sort_by).toBe('best_time_ms');
    expect(query.sort_dir).toBe('asc');
    vi.useRealTimers();
  });

  it('maps sprint time sort direction for km/h display', () => {
    const { component } = setup();
    const unitService = TestBed.inject(SprintDisplayUnitService);
    unitService.setUnit('kmh');

    const query = (
      component as {
        buildAdvancedQuery: (params: {
          sortModel: Array<{ colId: string; sort: 'asc' | 'desc' }>;
          filterModel: Record<string, unknown>;
          startRow: number;
          endRow: number;
        }) => Record<string, string | number | undefined>;
      }
    ).buildAdvancedQuery({
      sortModel: [{ colId: 'sprintTimeMs', sort: 'asc' }],
      filterModel: {},
      startRow: 0,
      endRow: 25
    });

    expect(query.sort_by).toBe('sprint_time_ms');
    expect(query.sort_dir).toBe('desc');
  });
});

afterEach(() => {
  TestBed.resetTestingModule();
});
