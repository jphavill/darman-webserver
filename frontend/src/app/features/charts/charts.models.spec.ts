import { describe, expect, it } from 'vitest';
import {
  Benchmark,
  AvailableRunner,
  ComparisonSeries,
  ChartsResponseApi
} from './charts.models';

describe('charts models', () => {
  it('supports available runner fixtures', () => {
    const runner: AvailableRunner = { id: 7, name: 'Mina' };

    expect(runner.id).toBe(7);
    expect(runner.name).toBe('Mina');
  });

  it('supports comparison series fixtures', () => {
    const series: ComparisonSeries = {
      personId: 7,
      personName: 'Mina',
      points: [{ x: 1, y: 9350 }]
    };

    expect(series.points[0]?.y).toBe(9350);
  });

  it('supports API response fixtures', () => {
    const response: ChartsResponseApi = {
      mode: 'progression',
      location: null,
      run_window: 'all',
      series: [{ person_id: 7, person_name: 'Mina', points: [{ x: 1, y: 9350 }] }]
    };

    expect(response.series[0]?.person_name).toBe('Mina');
  });

  it('supports benchmark fixtures', () => {
    const benchmark: Benchmark = {
      id: 'cat',
      label: 'Cat',
      equivalent100mMs: 9300
    };

    expect(benchmark.label).toBe('Cat');
    expect(benchmark.equivalent100mMs).toBe(9300);
  });
});
