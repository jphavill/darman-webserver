import { describe, expect, it, vi } from 'vitest';
import { ChartsControlsComponent } from './charts-controls.component';

describe('ChartsControlsComponent', () => {
  it('creates the component class', () => {
    const component = new ChartsControlsComponent();
    expect(component).toBeTruthy();
  });

  it('derives selected person ids from selected runners', () => {
    const component = new ChartsControlsComponent();
    component.selectedRunners = [
      { personId: 3, personName: 'A', color: 'var(--text)', colorSource: 'palette', paletteSlot: 0, visible: true },
      { personId: 9, personName: 'B', color: 'var(--surface)', colorSource: 'custom', paletteSlot: null, visible: true }
    ];

    expect(component.selectedPersonIds).toEqual([3, 9]);
  });

  it('exposes benchmark toggle state', () => {
    const component = new ChartsControlsComponent();
    component.showBenchmarks = true;

    expect(component.showBenchmarks).toBe(true);
  });

  it('toggles benchmarks button state', () => {
    const component = new ChartsControlsComponent();
    const emitSpy = vi.spyOn(component.showBenchmarksChange, 'emit');
    component.showBenchmarks = false;

    component.toggleBenchmarks();

    expect(emitSpy).toHaveBeenCalledWith(true);
  });

  it('shows Time as the daily best mode label', () => {
    const component = new ChartsControlsComponent();

    expect(component.modeOptions).toContainEqual({ value: 'daily_best', label: 'Time' });
  });

  it('switches run window options by mode', () => {
    const component = new ChartsControlsComponent();

    component.mode = 'progression';
    expect(component.runWindowOptions).toEqual([
      { value: 'all', label: 'All' },
      { value: '10', label: 'Last 10' },
      { value: '20', label: 'Last 20' },
      { value: '50', label: 'Last 50' }
    ]);

    component.mode = 'daily_best';
    expect(component.runWindowOptions).toEqual([
      { value: 'all', label: 'All Time' }
    ]);
  });
});
