import { describe, expect, it, vi } from 'vitest';
import { SprintComparisonControlsComponent } from './sprint-comparison-controls.component';

describe('SprintComparisonControlsComponent', () => {
  it('creates the component class', () => {
    const component = new SprintComparisonControlsComponent();
    expect(component).toBeTruthy();
  });

  it('derives selected person ids from selected runners', () => {
    const component = new SprintComparisonControlsComponent();
    component.selectedRunners = [
      { personId: 3, personName: 'A', color: 'var(--text)', colorSource: 'palette', paletteSlot: 0, visible: true },
      { personId: 9, personName: 'B', color: 'var(--surface)', colorSource: 'custom', paletteSlot: null, visible: true }
    ];

    expect(component.selectedPersonIds).toEqual([3, 9]);
  });

  it('exposes benchmark toggle state', () => {
    const component = new SprintComparisonControlsComponent();
    component.showBenchmarks = true;

    expect(component.showBenchmarks).toBe(true);
  });

  it('toggles benchmarks button state', () => {
    const component = new SprintComparisonControlsComponent();
    const emitSpy = vi.spyOn(component.showBenchmarksChange, 'emit');
    component.showBenchmarks = false;

    component.toggleBenchmarks();

    expect(emitSpy).toHaveBeenCalledWith(true);
  });
});
