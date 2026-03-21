import { describe, expect, it } from 'vitest';
import { SprintComparisonChartComponent } from './sprint-comparison-chart.component';

describe('SprintComparisonChartComponent', () => {
  it('creates the component class', () => {
    const component = new SprintComparisonChartComponent();
    expect(component).toBeTruthy();
  });

  it('returns progression x-axis label in progression mode', () => {
    const component = new SprintComparisonChartComponent();
    component.mode = 'progression';

    expect(component.xAxisLabel).toBe('Attempt Number (latest-aligned)');
  });

  it('shows data presence based on visible series only', () => {
    const component = new SprintComparisonChartComponent();
    component.selectedRunners = [
      { personId: 1, personName: 'Alice', color: '#111111', visible: true },
      { personId: 2, personName: 'Bob', color: '#222222', visible: false }
    ];
    component.series = [
      { personId: 1, personName: 'Alice', points: [{ x: 1, y: 9800 }] },
      { personId: 2, personName: 'Bob', points: [{ x: 1, y: 10000 }] }
    ];

    expect(component.hasData).toBe(true);
    expect(component.legendRunners).toEqual([
      { personId: 1, personName: 'Alice', color: '#111111', visible: true }
    ]);
  });
});
