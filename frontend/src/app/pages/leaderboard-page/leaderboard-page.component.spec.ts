import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { LeaderboardPageComponent } from './leaderboard-page.component';

describe('LeaderboardPageComponent', () => {
  it('creates the component class', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({})),
            snapshot: {
              queryParamMap: convertToParamMap({})
            }
          }
        }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new LeaderboardPageComponent());
    expect(component).toBeTruthy();
  });
});

afterEach(() => {
  TestBed.resetTestingModule();
});
