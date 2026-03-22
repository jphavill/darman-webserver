import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { SprintPageComponent } from './sprint-page.component';

describe('SprintPageComponent', () => {
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

    const component = TestBed.runInInjectionContext(() => new SprintPageComponent());
    expect(component).toBeTruthy();
  });
});

afterEach(() => {
  TestBed.resetTestingModule();
});
