import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BROWSER_STORAGE } from '../../core/browser/browser-globals';
import { SprintDisplayUnitService } from './sprint-display-unit.service';

describe('SprintDisplayUnitService', () => {
  const createStorageMock = (): Storage => {
    const store: Record<string, string> = {};
    return {
      get length() {
        return Object.keys(store).length;
      },
      clear: () => {
        Object.keys(store).forEach((key) => delete store[key]);
      },
      getItem: (key: string) => store[key] ?? null,
      key: (index: number) => Object.keys(store)[index] ?? null,
      removeItem: (key: string) => {
        delete store[key];
      },
      setItem: (key: string, value: string) => {
        store[key] = value;
      }
    } as Storage;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: BROWSER_STORAGE, useValue: createStorageMock() }]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('defaults to seconds', () => {
    const service = TestBed.inject(SprintDisplayUnitService);
    expect(service.unit()).toBe('seconds');
  });

  it('persists selected display unit', () => {
    const service = TestBed.inject(SprintDisplayUnitService);
    const storage = TestBed.inject(BROWSER_STORAGE);

    service.setUnit('kmh');

    expect(storage.getItem('sprintDisplayUnitPreference')).toBe('kmh');
  });

  it('restores persisted display unit', () => {
    const storage = TestBed.inject(BROWSER_STORAGE);
    storage.setItem('sprintDisplayUnitPreference', 'minPerKm');

    const service = TestBed.inject(SprintDisplayUnitService);

    expect(service.unit()).toBe('minPerKm');
  });
});
