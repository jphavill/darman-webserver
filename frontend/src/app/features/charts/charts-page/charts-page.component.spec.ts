import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartsService } from '../charts.service';
import { ChartsStore } from '../charts.store';
import { ChartsPageComponent } from './charts-page.component';

describe('ChartsPageComponent', () => {
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

  const createApiMock = () => ({
    getPeople: vi.fn(),
    getLocations: vi.fn(),
    getComparison: vi.fn()
  });

  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('loads people and locations on init', () => {
    const apiMock = createApiMock();
    apiMock.getPeople.mockReturnValue(of([{ id: 1, name: 'Alice' }]));
    apiMock.getLocations.mockReturnValue(of(['Track A']));
    apiMock.getComparison.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [ChartsStore, { provide: ChartsService, useValue: apiMock }]
    });
    const component = TestBed.runInInjectionContext(() => new ChartsPageComponent());

    component.ngOnInit();

    expect(apiMock.getPeople).toHaveBeenCalled();
    expect(apiMock.getLocations).toHaveBeenCalled();
    expect(component.state().availableRunners).toEqual([{ id: 1, name: 'Alice' }]);
    expect(component.state().availableLocations).toEqual(['Track A']);
    expect(component.state().loading).toBe(false);
  });

  it('adds a runner and requests comparison data', () => {
    const apiMock = createApiMock();
    apiMock.getPeople.mockReturnValue(of([]));
    apiMock.getLocations.mockReturnValue(of([]));
    apiMock.getComparison.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [ChartsStore, { provide: ChartsService, useValue: apiMock }]
    });
    const component = TestBed.runInInjectionContext(() => new ChartsPageComponent());

    component.onAddRunner({ id: 2, name: 'Bob' });

    expect(component.state().selectedRunners).toHaveLength(1);
    expect(component.state().selectedRunners[0]?.personId).toBe(2);
    expect(component.state().selectedRunners[0]?.colorSource).toBe('palette');
    expect(component.state().selectedRunners[0]?.paletteSlot).toBe(0);
    expect(apiMock.getComparison).toHaveBeenCalledWith({
      mode: 'progression',
      personIds: [2],
      location: null,
      runWindow: 'all'
    });
  });

  it('updates runner color and persists it', () => {
    const apiMock = createApiMock();
    apiMock.getPeople.mockReturnValue(of([]));
    apiMock.getLocations.mockReturnValue(of([]));
    apiMock.getComparison.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [ChartsStore, { provide: ChartsService, useValue: apiMock }]
    });
    const component = TestBed.runInInjectionContext(() => new ChartsPageComponent());
    component.onAddRunner({ id: 2, name: 'Bob' });

    component.onRunnerColorChange({ personId: 2, color: 'var(--accent)' });

    expect(component.state().selectedRunners[0]?.color).toBe('var(--accent)');
    expect(component.state().selectedRunners[0]?.colorSource).toBe('custom');
    expect(component.state().selectedRunners[0]?.paletteSlot).toBeNull();
    expect(localStorage.getItem('chartsRunnerColors')).toContain('"2":"var(--accent)"');
  });

  it('assigns unique palette slots and reuses freed slots after custom color changes', () => {
    const apiMock = createApiMock();
    apiMock.getPeople.mockReturnValue(of([]));
    apiMock.getLocations.mockReturnValue(of([]));
    apiMock.getComparison.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [ChartsStore, { provide: ChartsService, useValue: apiMock }]
    });
    const component = TestBed.runInInjectionContext(() => new ChartsPageComponent());

    component.onAddRunner({ id: 2, name: 'Bob' });
    component.onAddRunner({ id: 3, name: 'Alice' });

    expect(component.state().selectedRunners.map((runner) => runner.paletteSlot)).toEqual([0, 1]);

    component.onRunnerColorChange({ personId: 2, color: 'var(--accent)' });
    component.onAddRunner({ id: 4, name: 'Nina' });

    expect(component.state().selectedRunners.find((runner) => runner.personId === 4)?.paletteSlot).toBe(0);
  });

  it('updates benchmark toggle and persists preferences', () => {
    const apiMock = createApiMock();
    apiMock.getPeople.mockReturnValue(of([]));
    apiMock.getLocations.mockReturnValue(of([]));
    apiMock.getComparison.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [ChartsStore, { provide: ChartsService, useValue: apiMock }]
    });
    const component = TestBed.runInInjectionContext(() => new ChartsPageComponent());

    component.onShowBenchmarksChange(true);

    expect(component.state().showBenchmarks).toBe(true);
    expect(localStorage.getItem('chartsPreferences')).toContain('"showBenchmarks":true');
  });
});
