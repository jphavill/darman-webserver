import { describe, expect, it } from 'vitest';
import { SprintComparisonControlsComponent } from './sprint-comparison-controls.component';

describe('SprintComparisonControlsComponent', () => {
  it('creates the component class', () => {
    const component = new SprintComparisonControlsComponent();
    expect(component).toBeTruthy();
  });

  it('derives selected person ids from selected runners', () => {
    const component = new SprintComparisonControlsComponent();
    component.selectedRunners = [
      { personId: 3, personName: 'A', color: '#fff', visible: true },
      { personId: 9, personName: 'B', color: '#000', visible: true }
    ];

    expect(component.selectedPersonIds).toEqual([3, 9]);
  });

  it('reports max selection status', () => {
    const component = new SprintComparisonControlsComponent();
    component.maxRunners = 2;
    component.selectedRunners = [
      { personId: 3, personName: 'A', color: '#fff', visible: true },
      { personId: 9, personName: 'B', color: '#000', visible: true }
    ];

    expect(component.isMaxSelected).toBe(true);
  });
});
