export type ComparisonMode = 'progression' | 'daily_best';
export type RunWindow = 'all' | '10' | '20' | '50';

export interface AvailableRunner {
  id: number;
  name: string;
}

export type RunnerColorSource = 'palette' | 'custom';

export interface SelectedRunner {
  personId: number;
  personName: string;
  color: string;
  colorSource: RunnerColorSource;
  paletteSlot: number | null;
  visible: boolean;
}

export interface ComparisonPoint {
  x: number | string;
  y: number;
  label?: string;
}

export interface ComparisonSeries {
  personId: number;
  personName: string;
  points: ComparisonPoint[];
}

export interface Benchmark {
  id: string;
  label: string;
  equivalent100mMs: number;
}

export interface SprintComparisonState {
  mode: ComparisonMode;
  runWindow: RunWindow;
  location: string | null;
  showBenchmarks: boolean;
  runnerSearch: string;
  availableRunners: AvailableRunner[];
  availableLocations: string[];
  selectedRunners: SelectedRunner[];
  series: ComparisonSeries[];
  loading: boolean;
  error: string | null;
}

export interface ComparisonSeriesApi {
  person_id: number;
  person_name: string;
  points: ComparisonPoint[];
}

export interface SprintComparisonResponseApi {
  mode: ComparisonMode;
  location: string | null;
  run_window: RunWindow;
  series: ComparisonSeriesApi[];
}
