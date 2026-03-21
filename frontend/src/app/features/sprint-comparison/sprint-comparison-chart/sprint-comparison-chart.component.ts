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
import { ComparisonMode, ComparisonSeries, SelectedRunner } from '../sprint-comparison.models';
import { formatSprintMs } from '../../../shared/format/sprint-format';

interface ProgressionDatum {
  value: number;
  attempt: number;
  attemptLabel: string;
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
  @Input() loading = false;
  @Input() error: string | null = null;

  @ViewChild('chartContainer') private chartContainer?: ElementRef<HTMLDivElement>;

  private chart?: ECharts;
  private resizeObserver?: ResizeObserver;

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
    const maxPoints = Math.max(...this.visibleSeries.map((item) => item.points.length));
    const categories = Array.from({ length: maxPoints }, (_, index) => `${index + 1}`);

    return {
      animationDuration: 250,
      grid: { left: 24, right: 24, top: 48, bottom: 28, containLabel: true },
      tooltip: {
        trigger: 'axis',
        formatter: (rawParams) => {
          const params = Array.isArray(rawParams) ? rawParams : [rawParams];
          const rows = params
            .filter((item) => item.data)
            .map((item) => {
              const datum = item.data as ProgressionDatum;
              return `${item.marker} ${item.seriesName}: Attempt ${datum.attempt} - ${formatSprintMs(datum.value)}`;
            });

          if (rows.length === 0) {
            return 'No data';
          }
          return rows.join('<br/>');
        }
      },
      xAxis: {
        type: 'category',
        name: this.xAxisLabel,
        nameLocation: 'middle',
        nameGap: 34,
        axisLabel: { color: '#b5beca' },
        axisLine: { lineStyle: { color: '#4a5664' } },
        data: categories
      },
      yAxis: {
        type: 'value',
        name: 'Sprint Time',
        nameLocation: 'end',
        nameGap: 24,
        axisLabel: {
          color: '#b5beca',
          formatter: (value: number) => formatSprintMs(value)
        },
        splitLine: { lineStyle: { color: '#2d3440' } }
      },
      series: this.visibleSeries.map((item) => {
        const color = this.getRunnerColor(item.personId);
        const offset = maxPoints - item.points.length;
        const data: Array<ProgressionDatum | null> = Array.from({ length: maxPoints }, () => null);

        item.points.forEach((point, index) => {
          const attempt = typeof point.x === 'number' ? point.x : index + 1;
          data[offset + index] = {
            value: point.y,
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
      })
    };
  }

  private buildDailyBestOption(): EChartsOption {
    const dateSet = new Set<string>();
    this.visibleSeries.forEach((item) => {
      item.points.forEach((point) => dateSet.add(String(point.x)));
    });
    const dates = Array.from(dateSet).sort();

    return {
      animationDuration: 250,
      grid: { left: 84, right: 24, top: 48, bottom: 56, containLabel: true },
      tooltip: {
        trigger: 'axis',
        formatter: (rawParams) => {
          const params = Array.isArray(rawParams) ? rawParams : [rawParams];
          const dateLabel = String((params[0] as { axisValueLabel?: string } | undefined)?.axisValueLabel ?? params[0]?.name ?? '');
          const rows = params
            .filter((item) => item.data != null)
            .map((item) => `${item.marker} ${item.seriesName}: ${formatSprintMs(Number(item.data))}`);
          return [dateLabel, ...rows].join('<br/>');
        }
      },
      xAxis: {
        type: 'category',
        name: this.xAxisLabel,
        nameLocation: 'middle',
        nameGap: 34,
        axisLabel: { color: '#b5beca' },
        axisLine: { lineStyle: { color: '#4a5664' } },
        data: dates
      },
      yAxis: {
        type: 'value',
        name: 'Sprint Time',
        nameLocation: 'end',
        nameGap: 24,
        axisLabel: {
          color: '#b5beca',
          formatter: (value: number) => formatSprintMs(value)
        },
        splitLine: { lineStyle: { color: '#2d3440' } }
      },
      series: this.visibleSeries.map((item) => {
        const color = this.getRunnerColor(item.personId);
        const pointByDate = new Map(item.points.map((point) => [String(point.x), point.y]));
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
      })
    };
  }

  private getRunnerColor(personId: number): string {
    return this.selectedRunners.find((runner) => runner.personId === personId)?.color ?? '#8fb8e8';
  }
}
