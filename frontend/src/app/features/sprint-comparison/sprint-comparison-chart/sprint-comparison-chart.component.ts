import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { ECharts, EChartsOption, init } from 'echarts';
import {
  Benchmark,
  ComparisonMode,
  ComparisonSeries,
  SelectedRunner
} from '../sprint-comparison.models';
import { BENCHMARKS } from '../benchmarks.constants';
import {
  SprintDisplayUnit,
  convertSprintMsToUnit,
  formatSprintAxisValue,
  formatSprintValue,
  getSprintDisplayUnitMeta
} from '../../../shared/format/sprint-format';
import { resolveThemeToken, THEME_TOKENS } from '../../../shared/theme/theme-tokens';

interface ProgressionDatum {
  value: number;
  attempt: number;
  attemptLabel: string;
}

interface YAxisBounds {
  min: number;
  max: number;
  interval: number;
}

interface BenchmarkLabelConfig {
  benchmarkId: string;
  label: string;
  position: 'insideEndTop' | 'insideEndBottom';
}

@Component({
  selector: 'app-sprint-comparison-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sprint-comparison-chart.component.html',
  styleUrl: './sprint-comparison-chart.component.css'
})
export class SprintComparisonChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() mode: ComparisonMode = 'progression';
  @Input() series: ComparisonSeries[] = [];
  @Input() selectedRunners: SelectedRunner[] = [];
  @Input() showBenchmarks = false;
  @Input() displayUnit: SprintDisplayUnit = 'seconds';
  @Input() loading = false;
  @Input() error: string | null = null;

  @ViewChild('chartContainer') private chartContainer?: ElementRef<HTMLDivElement>;

  private chart?: ECharts;
  private resizeObserver?: ResizeObserver;
  private readonly benchmarks = BENCHMARKS;

  get hasSelectedRunners(): boolean {
    return this.selectedRunners.length > 0;
  }

  get hasData(): boolean {
    return this.visibleSeries.some((item) => item.points.length > 0);
  }

  get legendRunners(): SelectedRunner[] {
    const plottedIds = new Set(this.visibleSeries.map((item) => item.personId));
    return this.selectedRunners.filter((runner) => runner.visible && plottedIds.has(runner.personId));
  }

  get xAxisLabel(): string {
    return this.mode === 'progression' ? 'Attempt Number (latest-aligned)' : 'Date';
  }

  ngAfterViewInit(): void {
    if (!this.chartContainer) {
      return;
    }

    this.chart = init(this.chartContainer.nativeElement);
    this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
    this.resizeObserver.observe(this.chartContainer.nativeElement);
    this.renderChart();
  }

  ngOnChanges(_: SimpleChanges): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.dispose();
  }

  private get visibleSeries(): ComparisonSeries[] {
    const visibleIds = new Set(this.selectedRunners.filter((runner) => runner.visible).map((runner) => runner.personId));
    return this.series.filter((series) => visibleIds.has(series.personId));
  }

  private renderChart(): void {
    if (!this.chart) {
      return;
    }
    if (this.loading || this.error || !this.hasSelectedRunners || !this.hasData) {
      this.chart.clear();
      return;
    }
    this.chart.setOption(this.buildOption(), true);
  }

  private buildOption(): EChartsOption {
    if (this.mode === 'progression') {
      return this.buildProgressionOption();
    }
    return this.buildDailyBestOption();
  }

  private buildProgressionOption(): EChartsOption {
    const benchmarkLabelConfigs = this.getBenchmarkLabelConfigs();
    const maxPoints = Math.max(...this.visibleSeries.map((item) => item.points.length));
    const categories = Array.from({ length: maxPoints }, (_, index) => `${index + 1}`);
    const yAxisBounds = this.getYAxisBounds();

    const runnerSeries = this.visibleSeries.map((item) => {
      const color = this.getRunnerColor(item.personId);
      const offset = maxPoints - item.points.length;
      const data: Array<ProgressionDatum | null> = Array.from({ length: maxPoints }, () => null);

      item.points.forEach((point, index) => {
        const attempt = typeof point.x === 'number' ? point.x : index + 1;
        data[offset + index] = {
          value: this.toDisplayValue(point.y),
          attempt,
          attemptLabel: point.label ?? `Attempt ${attempt}`
        };
      });

      return {
        type: 'line',
        name: item.personName,
        smooth: false,
        showSymbol: true,
        connectNulls: false,
        lineStyle: { width: 3, color },
        itemStyle: { color },
        data
      };
    });

    const benchmarkSeries = this.buildBenchmarkSeries(benchmarkLabelConfigs);

    return {
      animationDuration: 250,
      grid: this.getChartGrid(benchmarkLabelConfigs),
      tooltip: {
        trigger: 'axis',
        formatter: (rawParams) => {
          const params = Array.isArray(rawParams) ? rawParams : [rawParams];
          const rows = params
            .filter((item) => item.data)
            .map((item) => {
              const datum = item.data as ProgressionDatum;
              return `${item.marker} ${item.seriesName}: Attempt ${datum.attempt} - ${formatSprintValue(datum.value, this.displayUnit)}`;
            });

          if (rows.length === 0) {
            return 'No data';
          }
          return rows.join('<br/>');
        }
      },
      xAxis: this.buildXAxis(categories),
      yAxis: this.buildYAxis(yAxisBounds),
      series: benchmarkSeries ? [...runnerSeries, benchmarkSeries] : runnerSeries
    };
  }

  private buildDailyBestOption(): EChartsOption {
    const benchmarkLabelConfigs = this.getBenchmarkLabelConfigs();
    const dateSet = new Set<string>();
    this.visibleSeries.forEach((item) => {
      item.points.forEach((point) => dateSet.add(String(point.x)));
    });
    const dates = Array.from(dateSet).sort();
    const yAxisBounds = this.getYAxisBounds();

    const runnerSeries = this.visibleSeries.map((item) => {
      const color = this.getRunnerColor(item.personId);
      const pointByDate = new Map(item.points.map((point) => [String(point.x), this.toDisplayValue(point.y)]));
      return {
        type: 'line',
        name: item.personName,
        smooth: false,
        showSymbol: true,
        connectNulls: false,
        lineStyle: { width: 3, color },
        itemStyle: { color },
        data: dates.map((date) => pointByDate.get(date) ?? null)
      };
    });

    const benchmarkSeries = this.buildBenchmarkSeries(benchmarkLabelConfigs);

    return {
      animationDuration: 250,
      grid: this.getChartGrid(benchmarkLabelConfigs),
      tooltip: {
        trigger: 'axis',
        formatter: (rawParams) => {
          const params = Array.isArray(rawParams) ? rawParams : [rawParams];
            const dateLabel = String((params[0] as { axisValueLabel?: string } | undefined)?.axisValueLabel ?? params[0]?.name ?? '');
            const rows = params
              .filter((item) => item.data != null)
              .map((item) => `${item.marker} ${item.seriesName}: ${formatSprintValue(Number(item.data), this.displayUnit)}`);
            return [dateLabel, ...rows].join('<br/>');
          }
      },
      xAxis: this.buildXAxis(dates),
      yAxis: this.buildYAxis(yAxisBounds),
      series: benchmarkSeries ? [...runnerSeries, benchmarkSeries] : runnerSeries
    };
  }

  private getChartGrid(benchmarkLabelConfigs: BenchmarkLabelConfig[]): object {
    const baseRight = 24;
    const widestLabel = benchmarkLabelConfigs.reduce((widest, item) => Math.max(widest, this.measureTextWidth(item.label)), 0);
    const rightPadding = baseRight + Math.min(18, Math.max(4, Math.round(widestLabel * 0.15)));
    return { left: 24, right: rightPadding, top: 48, bottom: 28, containLabel: true };
  }

  private buildXAxis(data: string[]): object {
    return {
      type: 'category',
      name: this.xAxisLabel,
      nameLocation: 'middle',
      nameGap: 34,
      axisLabel: { color: resolveThemeToken(THEME_TOKENS.textSoft, 'var(--text-soft)') },
      axisLine: { lineStyle: { color: resolveThemeToken(THEME_TOKENS.borderStrong, 'var(--border-strong)') } },
      data
    };
  }

  private buildYAxis(yAxisBounds: YAxisBounds): object {
    return {
      type: 'value',
      name: getSprintDisplayUnitMeta(this.displayUnit).chartAxisLabel,
      nameLocation: 'end',
      nameGap: 24,
      min: yAxisBounds.min,
      max: yAxisBounds.max,
      interval: yAxisBounds.interval,
      axisLabel: {
        color: resolveThemeToken(THEME_TOKENS.textSoft, 'var(--text-soft)'),
        formatter: (value: number) => formatSprintAxisValue(value, this.displayUnit)
      },
      splitLine: { lineStyle: { color: resolveThemeToken(THEME_TOKENS.chartGridLine, 'var(--chart-grid-line)') } }
    };
  }

  private getYAxisBounds(): YAxisBounds {
    const runnerValues = this.visibleSeries.flatMap((item) => item.points.map((point) => this.toDisplayValue(point.y)));
    const benchmarkValues = this.activeBenchmarks.map((benchmark) => this.toDisplayValue(benchmark.equivalent100mMs));
    const values = [...runnerValues, ...benchmarkValues];
    const targetTickCount = 6;

    if (values.length === 0) {
      const interval = this.displayUnit === 'minPerKm'
        ? this.getDefaultYAxisMax() / (targetTickCount - 1)
        : this.getNiceAxisInterval(this.getDefaultYAxisMax() / (targetTickCount - 1));
      return {
        min: 0,
        max: interval * (targetTickCount - 1),
        interval
      };
    }

    let min = Math.min(...values);
    let max = Math.max(...values);

    if (min === max) {
      const singlePad = Math.max(this.getMinimumAxisPadding(), Math.abs(min) * 0.05);
      min = Math.max(0, min - singlePad);
      max += singlePad;
    } else {
      const pad = Math.max(this.getMinimumAxisPadding(), (max - min) * 0.08);
      min = Math.max(0, min - pad);
      max += pad;
    }

    const rawInterval = (max - min) / (targetTickCount - 1);
    const interval = this.displayUnit === 'minPerKm'
      ? Math.max(rawInterval, this.getMinimumAxisPadding())
      : this.getNiceAxisInterval(rawInterval);

    const snappedMin = this.roundAxisValue(Math.max(0, Math.floor(min / interval) * interval));
    let snappedMax = this.roundAxisValue(Math.ceil(max / interval) * interval);

    if (snappedMax <= snappedMin) {
      snappedMax = this.roundAxisValue(snappedMin + interval);
    }

    return {
      min: snappedMin,
      max: snappedMax,
      interval
    };
  }

  private getNiceAxisInterval(rawInterval: number): number {
    const niceIntervals = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];
    for (const interval of niceIntervals) {
      if (rawInterval <= interval) {
        return interval;
      }
    }
    return 100;
  }

  private roundAxisValue(value: number): number {
    return Number(value.toFixed(10));
  }

  private getDefaultYAxisMax(): number {
    if (this.displayUnit === 'kmh') {
      return 60;
    }
    if (this.displayUnit === 'minPerKm') {
      return 3;
    }
    return 20;
  }

  private getMinimumAxisPadding(): number {
    if (this.displayUnit === 'kmh') {
      return 0.2;
    }
    if (this.displayUnit === 'minPerKm') {
      return 0.01;
    }
    return 0.02;
  }

  private buildBenchmarkSeries(labelConfigs: BenchmarkLabelConfig[]): object | null {
    if (!this.showBenchmarks || this.activeBenchmarks.length === 0) {
      return null;
    }

    const labelById = new Map(labelConfigs.map((config) => [config.benchmarkId, config]));

    return {
      type: 'line',
      name: 'Benchmarks',
      data: [],
      symbol: 'none',
      lineStyle: { opacity: 0 },
      itemStyle: { opacity: 0 },
      tooltip: { show: false },
      emphasis: { disabled: true },
      markLine: {
        silent: true,
        symbol: ['none', 'none'],
        lineStyle: {
          type: 'dotted',
          width: 1.5,
          color: resolveThemeToken(THEME_TOKENS.chartBenchmarkLine, 'var(--chart-benchmark-line)')
        },
        label: {
          show: true,
          position: 'insideEndTop',
          distance: 6,
          color: resolveThemeToken(THEME_TOKENS.textSoft, 'var(--text-soft)'),
          formatter: (params: { name?: string }) => params.name ?? ''
        },
        data: this.activeBenchmarks.map((benchmark) => {
          const config = labelById.get(benchmark.id);
          return {
            name: config?.label ?? benchmark.label,
            yAxis: this.toDisplayValue(benchmark.equivalent100mMs),
            label: {
              position: config?.position ?? 'insideEndTop'
            }
          };
        })
      }
    };
  }

  private getBenchmarkLabelConfigs(): BenchmarkLabelConfig[] {
    if (!this.showBenchmarks || this.activeBenchmarks.length === 0) {
      return [];
    }

    const narrowChart = this.getChartWidth() < 560;
    const maxLabelLength = narrowChart ? 10 : 16;

    return this.activeBenchmarks.map((benchmark) => ({
      benchmarkId: benchmark.id,
      label: this.abbreviateBenchmarkLabel(benchmark.label, maxLabelLength),
      position: 'insideEndTop'
    }));
  }

  private getChartWidth(): number {
    return this.chart?.getWidth() ?? this.chartContainer?.nativeElement.clientWidth ?? 0;
  }

  private abbreviateBenchmarkLabel(label: string, maxLength: number): string {
    if (label.length <= maxLength) {
      return label;
    }
    return `${label.slice(0, Math.max(1, maxLength - 3))}...`;
  }

  private measureTextWidth(text: string): number {
    const fallbackWidthPerChar = 7;
    if (typeof document === 'undefined') {
      return text.length * fallbackWidthPerChar;
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      return text.length * fallbackWidthPerChar;
    }

    const computedStyle = this.chartContainer ? window.getComputedStyle(this.chartContainer.nativeElement) : null;
    const fontSize = computedStyle?.fontSize ?? '12px';
    const fontFamily = computedStyle?.fontFamily ?? 'sans-serif';
    context.font = `${fontSize} ${fontFamily}`;
    return context.measureText(text).width;
  }

  private get activeBenchmarks(): Benchmark[] {
    return this.showBenchmarks ? this.benchmarks : [];
  }

  private getRunnerColor(personId: number): string {
    return this.selectedRunners.find((runner) => runner.personId === personId)?.color ?? resolveThemeToken(THEME_TOKENS.accent, 'var(--accent)');
  }

  private toDisplayValue(ms: number): number {
    return convertSprintMsToUnit(ms, this.displayUnit);
  }
}
