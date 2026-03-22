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

  it('uses month axis label in time year mode', () => {
    const component = new SprintComparisonChartComponent();
    component.mode = 'daily_best';
    component.runWindow = 'year';

    expect(component.xAxisLabel).toBe('Month');
  });

  it('aggregates time year mode to monthly bests', () => {
    const component = new SprintComparisonChartComponent();
    component.mode = 'daily_best';
    component.runWindow = 'year';
    component.selectedRunners = [{ personId: 1, personName: 'Alice', color: 'var(--text)', colorSource: 'palette', paletteSlot: 0, visible: true }];
    component.series = [
      {
        personId: 1,
        personName: 'Alice',
        points: [
          { x: '2026-01-01', y: 10000 },
          { x: '2026-01-20', y: 9800 },
          { x: '2026-02-02', y: 9700 }
        ]
      }
    ];

    const option = (component as any).buildDailyBestOption();
    const [runnerSeries] = option.series as Array<{ data: Array<number | null> }>;

    expect((option.xAxis as { data: string[] }).data).toEqual(['2026-01', '2026-02']);
    expect(runnerSeries.data).toEqual([9.8, 9.7]);
  });

  it('shows data presence based on visible series only', () => {
    const component = new SprintComparisonChartComponent();
    component.selectedRunners = [
      { personId: 1, personName: 'Alice', color: 'var(--text)', colorSource: 'palette', paletteSlot: 0, visible: true },
      { personId: 2, personName: 'Bob', color: 'var(--accent)', colorSource: 'palette', paletteSlot: 1, visible: false }
    ];
    component.series = [
      { personId: 1, personName: 'Alice', points: [{ x: 1, y: 9800 }] },
      { personId: 2, personName: 'Bob', points: [{ x: 1, y: 10000 }] }
    ];

    expect(component.hasData).toBe(true);
    expect(component.legendRunners).toEqual([
      { personId: 1, personName: 'Alice', color: 'var(--text)', colorSource: 'palette', paletteSlot: 0, visible: true }
    ]);
  });

  it('adds benchmark lines when enabled', () => {
    const component = new SprintComparisonChartComponent();
    component.mode = 'progression';
    component.selectedRunners = [{ personId: 1, personName: 'Alice', color: 'var(--text)', colorSource: 'palette', paletteSlot: 0, visible: true }];
    component.series = [{ personId: 1, personName: 'Alice', points: [{ x: 1, y: 9800 }] }];
    component.showBenchmarks = true;

    const option = (component as any).buildProgressionOption();
    const series = option.series as Array<{ name?: string; markLine?: { data?: unknown[] } }>;
    const benchmarkSeries = series.find((item) => item.name === 'Benchmarks');

    expect(benchmarkSeries).toBeTruthy();
    expect(benchmarkSeries?.markLine?.data).toHaveLength(3);
  });

  it('scales y-axis to include benchmarks when enabled', () => {
    const component = new SprintComparisonChartComponent();
    component.mode = 'progression';
    component.selectedRunners = [{ personId: 1, personName: 'Alice', color: 'var(--text)', colorSource: 'palette', paletteSlot: 0, visible: true }];
    component.series = [{ personId: 1, personName: 'Alice', points: [{ x: 1, y: 9800 }] }];

    const withoutBenchmarks = (component as any).buildProgressionOption();
    const noBenchMax = (withoutBenchmarks.yAxis as { max: number }).max;

    component.showBenchmarks = true;
    const withBenchmarks = (component as any).buildProgressionOption();
    const benchMax = (withBenchmarks.yAxis as { max: number }).max;

    expect(benchMax).toBeGreaterThan(noBenchMax);
  });

  it('updates y-axis label for selected display unit', () => {
    const component = new SprintComparisonChartComponent();
    component.displayUnit = 'kmh';
    component.selectedRunners = [{ personId: 1, personName: 'Alice', color: 'var(--text)', colorSource: 'palette', paletteSlot: 0, visible: true }];
    component.series = [{ personId: 1, personName: 'Alice', points: [{ x: 1, y: 10000 }] }];

    const option = (component as any).buildProgressionOption();

    expect((option.yAxis as { name: string }).name).toBe('Speed (km/h)');
  });

  it('keeps km/h y-axis range tight around sprint data', () => {
    const component = new SprintComparisonChartComponent();
    component.displayUnit = 'kmh';
    component.mode = 'progression';
    component.selectedRunners = [{ personId: 1, personName: 'Alice', color: 'var(--text)', colorSource: 'palette', paletteSlot: 0, visible: true }];
  component.series = [{ personId: 1, personName: 'Alice', points: [{ x: 1, y: 10000 }] }];

    const option = (component as any).buildProgressionOption();
    const yAxis = option.yAxis as { min: number; max: number };

    expect(yAxis.min).toBeGreaterThan(30);
    expect(yAxis.max).toBeLessThan(40);
  });
});
