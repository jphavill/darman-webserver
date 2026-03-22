import { Component, DestroyRef, effect, inject } from '@angular/core';
import { NgIconComponent } from '@ng-icons/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColumnState,
  ColumnResizedEvent,
  ColDef,
  DateFilterModel,
  GridApi,
  GridSizeChangedEvent,
  GridReadyEvent,
  ICellRendererParams,
  IDatasource,
  IGetRowsParams,
  NumberFilterModel,
  SortModelItem,
  TextFilterModel
} from 'ag-grid-community';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { SprintApiService } from '../../services/sprint-api.service';
import { BestTimeRow, BestTimesQuery, SprintQuery, SprintRow, SprintTextFilterType } from '../../models/sprint.model';
import {
  convertSprintUnitToMs,
  formatDisplayDate,
  formatSprintMs,
  getSprintDisplayUnitMeta
} from '../../shared/format/sprint-format';
import { normalizeDisplayName } from '../../shared/format/name-format';
import { SprintDisplayUnitService } from '../../shared/preferences/sprint-display-unit.service';
import { SprintUnitToggleComponent } from '../../shared/sprint-unit-toggle/sprint-unit-toggle.component';

type SprintGridView = 'leaderboard' | 'advanced';
type LeaderboardRange = 'all' | 'year' | 'month' | 'week';

interface AdvancedGridState {
  filterModel: Record<string, unknown>;
  columnState: ColumnState[];
}

const ADVANCED_GRID_STATE_STORAGE_KEY = 'sprint-grid-advanced-state';

@Component({
    selector: 'app-sprint-times-grid',
    imports: [AgGridAngular, NgIconComponent, SprintUnitToggleComponent],
    templateUrl: './sprint-times-grid.component.html',
    styleUrl: './sprint-times-grid.component.css'
})
export class SprintTimesGridComponent {
  private readonly sprintApi = inject(SprintApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sprintDisplayUnit = inject(SprintDisplayUnitService);
  private readonly destroyRef = inject(DestroyRef);
  private gridApi?: GridApi<SprintRow>;
  private advancedGridState: AdvancedGridState | null = this.loadAdvancedGridState();
  private pendingAdvancedStateRestore = false;

  readonly pageSize = 25;
  errorMessage = '';
  view: SprintGridView = 'leaderboard';
  leaderboardRange: LeaderboardRange = 'all';

  readonly rangeOptions: Array<{ value: LeaderboardRange; label: string }> = [
    { value: 'all', label: 'All Time' },
    { value: 'year', label: 'Year' },
    { value: 'month', label: 'Month' },
    { value: 'week', label: 'Week' }
  ];

  readonly advancedDefaultColDef: ColDef<SprintRow> = {
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: true,
    minWidth: 140,
    flex: 1
  };

  readonly leaderboardDefaultColDef: ColDef<SprintRow> = {
    sortable: false,
    filter: false,
    floatingFilter: false,
    resizable: true,
    minWidth: 140,
    flex: 1
  };

  readonly advancedColumnDefs: ColDef<SprintRow>[] = [
    {
      field: 'name',
      headerName: 'Name',
      filter: 'agTextColumnFilter',
      filterParams: {
        filterOptions: ['contains', 'notContains'],
        defaultOption: 'contains',
        maxNumConditions: 1
      },
      sort: 'asc',
      valueFormatter: (params) => normalizeDisplayName(params.value as string) || '-'
    },
    {
      field: 'sprintTimeMs',
      headerValueGetter: () => this.getSprintTimeHeaderLabel(),
      filter: 'agNumberColumnFilter',
      filterParams: {
        filterOptions: ['equals', 'greaterThan', 'lessThan', 'inRange'],
        defaultOption: 'equals',
        maxNumConditions: 1
      },
      valueFormatter: (params) => this.formatSprintValue(params.value as number)
    },
    {
      field: 'sprintDate',
      headerName: 'Date',
      filter: 'agDateColumnFilter',
      filterParams: {
        filterOptions: ['equals', 'notEqual', 'lessThan', 'greaterThan', 'inRange'],
        defaultOption: 'equals',
        maxNumConditions: 1
      },
      valueFormatter: (params) => formatDisplayDate(params.value as string)
    },
    {
      field: 'location',
      headerName: 'Location',
      filter: 'agTextColumnFilter',
      filterParams: {
        filterOptions: ['contains', 'notContains'],
        defaultOption: 'contains',
        maxNumConditions: 1
      }
    }
  ];

  readonly leaderboardColumnDefs: ColDef<SprintRow>[] = [
    {
      field: 'name',
      headerName: 'Name',
      cellRenderer: (params: ICellRendererParams<SprintRow, string>) => this.renderLeaderboardNameCell(params)
    },
    {
      field: 'sprintTimeMs',
      headerValueGetter: () => this.getSprintTimeHeaderLabel(),
      valueFormatter: (params) => this.formatSprintValue(params.value as number)
    },
    {
      field: 'sprintDate',
      headerName: 'Date',
      valueFormatter: (params) => formatDisplayDate(params.value as string)
    },
    {
      field: 'location',
      headerName: 'Location'
    }
  ];

  get activeColumnDefs(): ColDef<SprintRow>[] {
    return this.view === 'leaderboard' ? this.leaderboardColumnDefs : this.advancedColumnDefs;
  }

  get activeDefaultColDef(): ColDef<SprintRow> {
    return this.view === 'leaderboard' ? this.leaderboardDefaultColDef : this.advancedDefaultColDef;
  }

  constructor() {
    effect(() => {
      this.sprintDisplayUnit.unit();
      this.refreshSprintTimePresentation();
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const nextView = this.parseViewParam(params.get('view'));
      const nextRange = this.parseRangeParam(params.get('range'));
      const viewChanged = nextView !== this.view;
      const rangeChanged = nextRange !== this.leaderboardRange;

      if (!viewChanged && !rangeChanged) {
        return;
      }

      if (this.view === 'advanced' && nextView === 'leaderboard') {
        this.captureAdvancedGridState();
      }
      if (this.view === 'leaderboard' && nextView === 'advanced') {
        this.pendingAdvancedStateRestore = true;
      }

      this.view = nextView;
      this.leaderboardRange = nextRange;
      this.applyModeToGrid();
    });
  }

  onGridReady(event: GridReadyEvent<SprintRow>): void {
    this.gridApi = event.api;
    this.applyModeToGrid();
    this.sizeColumnsToTable(event.api);
  }

  onGridSizeChanged(event: GridSizeChangedEvent<SprintRow>): void {
    this.sizeColumnsToTable(event.api);
  }

  onColumnResized(event: ColumnResizedEvent<SprintRow>): void {
    if (event.finished && event.source === 'uiColumnDragged') {
      this.sizeColumnsToTable(event.api);
    }
  }

  private sizeColumnsToTable(api: GridApi<SprintRow>): void {
    requestAnimationFrame(() => {
      api.sizeColumnsToFit();
    });
  }

  resetColumnWidths(): void {
    if (!this.gridApi) {
      return;
    }

    this.gridApi.resetColumnState();
    this.sizeColumnsToTable(this.gridApi);
  }

  setView(view: SprintGridView): void {
    if (view === this.view) {
      return;
    }

    if (this.view === 'advanced') {
      this.captureAdvancedGridState();
    }
    if (view === 'advanced') {
      this.pendingAdvancedStateRestore = true;
    }

    this.view = view;
    this.applyModeToGrid();
    this.updateUrlState();
  }

  onLeaderboardRangeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value;
    if (!value) {
      return;
    }

    const parsedRange = this.parseRangeParam(value);
    if (parsedRange === this.leaderboardRange) {
      return;
    }

    this.leaderboardRange = parsedRange;

    if (this.view === 'leaderboard') {
      this.gridApi?.refreshInfiniteCache();
    }

    this.updateUrlState();
  }

  private applyModeToGrid(): void {
    if (!this.gridApi) {
      return;
    }

    this.gridApi.setGridOption('columnDefs', this.activeColumnDefs);
    this.gridApi.setGridOption('defaultColDef', this.activeDefaultColDef);
    this.gridApi.setFilterModel(null);
    this.gridApi.applyColumnState({
      defaultState: {
        sort: null
      }
    });
    this.setDatasource();

    if (this.view === 'advanced' && this.pendingAdvancedStateRestore) {
      this.restoreAdvancedGridState();
    }

    this.sizeColumnsToTable(this.gridApi);
  }

  private setDatasource(): void {
    if (!this.gridApi) {
      return;
    }

    const datasource: IDatasource = {
      getRows: (params: IGetRowsParams) => {
        this.errorMessage = '';

        const request$ =
          this.view === 'leaderboard'
            ? this.sprintApi
                .getBestTimes(this.buildLeaderboardQuery(params))
                .pipe(map((response) => ({ total: response.total, rows: response.rows.map((row) => this.mapBestTimeRow(row)) })))
            : this.sprintApi.getSprints(this.buildAdvancedQuery(params));

        request$.subscribe({
          next: (response) => {
            params.successCallback(response.rows, response.total);
          },
          error: () => {
            this.errorMessage = 'Unable to load sprint data right now.';
            params.failCallback();
          }
        });
      }
    };

    this.gridApi.setGridOption('datasource', datasource);
  }

  private buildAdvancedQuery(params: IGetRowsParams): SprintQuery {
    const sortModel = params.sortModel as SortModelItem[];
    const filterModel = params.filterModel as Record<string, TextFilterModel | NumberFilterModel | DateFilterModel>;
    const query: SprintQuery = {
      limit: (params.endRow ?? this.pageSize) - (params.startRow ?? 0),
      offset: params.startRow ?? 0
    };

    if (sortModel.length > 0) {
      const sort = sortModel[0];
      if (sort.colId === 'name' || sort.colId === 'location') {
        query.sort_by = sort.colId;
      }
      if (sort.colId === 'sprintTimeMs') {
        query.sort_by = 'sprint_time_ms';
        query.sort_dir = this.mapSprintTimeSortDirection(sort.sort === 'asc' ? 'asc' : 'desc');
      } else {
        query.sort_dir = sort.sort === 'asc' ? 'asc' : 'desc';
      }
      if (sort.colId === 'sprintDate') {
        query.sort_by = 'sprint_date';
      }
    }

    this.applyTextFilterToQuery(
      filterModel['name'] as TextFilterModel | undefined,
      (value) => {
        query.name = value;
      },
      (type) => {
        query.name_filter_type = type;
      }
    );

    this.applyTextFilterToQuery(
      filterModel['location'] as TextFilterModel | undefined,
      (value) => {
        query.location = value;
      },
      (type) => {
        query.location_filter_type = type;
      }
    );

    const timeFilter = filterModel['sprintTimeMs'] as NumberFilterModel | undefined;
    if (timeFilter?.filter != null) {
      this.applySprintTimeFilterToQuery(timeFilter, query);
    }

    const dateFilter = filterModel['sprintDate'] as DateFilterModel | undefined;
    this.applyDateFilterToQuery(dateFilter, query);

    return query;
  }

  private buildLeaderboardQuery(params: IGetRowsParams): BestTimesQuery {
    const query: BestTimesQuery = {
      limit: (params.endRow ?? this.pageSize) - (params.startRow ?? 0),
      offset: params.startRow ?? 0,
      sort_by: 'best_time_ms',
      sort_dir: 'asc'
    };

    const today = new Date();
    const startDate = this.getCalendarWindowStart(today, this.leaderboardRange);
    if (startDate) {
      query.date_from = this.toDateParam(startDate);
      query.date_to = this.toDateParam(today);
    }

    return query;
  }

  private mapBestTimeRow(row: BestTimeRow): SprintRow {
    return {
      id: row.sprintEntryId,
      name: row.name,
      sprintTimeMs: row.bestTimeMs,
      sprintDate: row.sprintDate,
      location: row.location,
      createdAt: row.updatedAt
    };
  }

  private getCalendarWindowStart(currentDate: Date, range: LeaderboardRange): Date | null {
    const date = new Date(currentDate);
    date.setHours(0, 0, 0, 0);

    if (range === 'week') {
      const dayOfWeek = date.getDay();
      const daysFromMonday = (dayOfWeek + 6) % 7;
      date.setDate(date.getDate() - daysFromMonday);
      return date;
    }

    if (range === 'month') {
      date.setDate(1);
      return date;
    }

    if (range === 'year') {
      date.setMonth(0, 1);
      return date;
    }

    return null;
  }

  private toDateParam(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private captureAdvancedGridState(): void {
    if (!this.gridApi || this.view !== 'advanced') {
      return;
    }

    this.advancedGridState = {
      filterModel: this.gridApi.getFilterModel() as Record<string, unknown>,
      columnState: this.gridApi.getColumnState()
    };
    this.persistAdvancedGridState();
  }

  private restoreAdvancedGridState(): void {
    if (!this.gridApi || this.view !== 'advanced') {
      return;
    }

    const state = this.advancedGridState;
    this.pendingAdvancedStateRestore = false;

    if (!state) {
      return;
    }

    requestAnimationFrame(() => {
      if (!this.gridApi || this.view !== 'advanced') {
        return;
      }

      this.gridApi.applyColumnState({ state: state.columnState, applyOrder: true });
      this.gridApi.setFilterModel(state.filterModel);
      this.gridApi.onFilterChanged();
    });
  }

  private updateUrlState(): void {
    const queryParams: Record<string, string | null> = {
      view: this.view,
      range: this.leaderboardRange === 'all' ? null : this.leaderboardRange
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private refreshSprintTimePresentation(): void {
    if (!this.gridApi) {
      return;
    }

    this.gridApi.refreshHeader();
    this.gridApi.refreshCells({ columns: ['sprintTimeMs'], force: true });
  }

  private parseViewParam(value: string | null): SprintGridView {
    return value === 'advanced' ? 'advanced' : 'leaderboard';
  }

  private parseRangeParam(value: string | null): LeaderboardRange {
    if (value === 'week' || value === 'month' || value === 'year') {
      return value;
    }
    return 'all';
  }

  private loadAdvancedGridState(): AdvancedGridState | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = window.sessionStorage.getItem(ADVANCED_GRID_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AdvancedGridState;
    } catch {
      return null;
    }
  }

  private persistAdvancedGridState(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (!this.advancedGridState) {
      window.sessionStorage.removeItem(ADVANCED_GRID_STATE_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(ADVANCED_GRID_STATE_STORAGE_KEY, JSON.stringify(this.advancedGridState));
  }

  private getSprintTimeHeaderLabel(): string {
    return getSprintDisplayUnitMeta(this.sprintDisplayUnit.unit()).tableHeaderLabel;
  }

  private formatSprintValue(ms: number): string {
    return formatSprintMs(ms, this.sprintDisplayUnit.unit());
  }

  private mapSprintTimeSortDirection(direction: 'asc' | 'desc'): 'asc' | 'desc' {
    return this.sprintDisplayUnit.unit() === 'kmh' ? (direction === 'asc' ? 'desc' : 'asc') : direction;
  }

  private applySprintTimeFilterToQuery(timeFilter: NumberFilterModel, query: SprintQuery): void {
    const unit = this.sprintDisplayUnit.unit();
    const minMs = convertSprintUnitToMs(timeFilter.filter as number, unit);
    const maxMs = convertSprintUnitToMs((timeFilter.filterTo as number | undefined) ?? Number.NaN, unit);

    if (!Number.isFinite(minMs)) {
      return;
    }

    if (timeFilter.type === 'equals') {
      query.min_time_ms = minMs;
      query.max_time_ms = minMs;
      return;
    }

    if (timeFilter.type === 'inRange' && Number.isFinite(maxMs)) {
      query.min_time_ms = Math.min(minMs, maxMs);
      query.max_time_ms = Math.max(minMs, maxMs);
      return;
    }

    if (unit === 'kmh') {
      if (timeFilter.type === 'lessThan' || timeFilter.type === 'lessThanOrEqual') {
        query.min_time_ms = minMs;
      } else if (timeFilter.type === 'greaterThan' || timeFilter.type === 'greaterThanOrEqual') {
        query.max_time_ms = minMs;
      }
      return;
    }

    if (timeFilter.type === 'lessThan' || timeFilter.type === 'lessThanOrEqual') {
      query.max_time_ms = minMs;
    } else if (timeFilter.type === 'greaterThan' || timeFilter.type === 'greaterThanOrEqual') {
      query.min_time_ms = minMs;
    }
  }

  private applyDateFilterToQuery(dateFilter: DateFilterModel | undefined, query: SprintQuery): void {
    const dateFrom = this.normalizeDateFilterValue(dateFilter?.dateFrom);
    if (!dateFrom || !dateFilter?.type) {
      return;
    }

    if (dateFilter.type === 'lessThan') {
      query.date_to = this.offsetDateParam(dateFrom, -1);
      return;
    }

    if (dateFilter.type === 'lessThanOrEqual') {
      query.date_to = dateFrom;
      return;
    }

    if (dateFilter.type === 'greaterThan') {
      query.date_from = this.offsetDateParam(dateFrom, 1);
      return;
    }

    if (dateFilter.type === 'greaterThanOrEqual') {
      query.date_from = dateFrom;
      return;
    }

    if (dateFilter.type === 'equals') {
      query.date_from = dateFrom;
      query.date_to = dateFrom;
      return;
    }

    if (dateFilter.type === 'notEqual') {
      query.date_not = dateFrom;
      return;
    }

    const dateTo = this.normalizeDateFilterValue(dateFilter.dateTo);
    if (dateFilter.type === 'inRange' && dateTo) {
      if (dateFrom <= dateTo) {
        query.date_from = dateFrom;
        query.date_to = dateTo;
      } else {
        query.date_from = dateTo;
        query.date_to = dateFrom;
      }
    }
  }

  private normalizeDateFilterValue(value: unknown): string | null {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        return null;
      }
      return this.toDateParam(value);
    }

    if (typeof value !== 'string') {
      return null;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
      return trimmedValue;
    }

    const parsedDate = new Date(trimmedValue);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return this.toDateParam(parsedDate);
  }

  private offsetDateParam(dateParam: string, offsetDays: number): string {
    const [year, month, day] = dateParam.split('-').map((part) => Number(part));
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + offsetDays);
    return this.toDateParam(date);
  }

  private renderLeaderboardNameCell(params: ICellRendererParams<SprintRow, string>): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'leaderboard-name-cell';

    const label = document.createElement('span');
    label.textContent = `${this.getLeaderboardMedalPrefix(params.node?.rowIndex)}${normalizeDisplayName(params.value) || '-'}`;
    wrapper.append(label);

    return wrapper;
  }

  private getLeaderboardMedalPrefix(rowIndex: number | null | undefined): string {
    if (rowIndex === 0) {
      return '🥇 ';
    }
    if (rowIndex === 1) {
      return '🥈 ';
    }
    if (rowIndex === 2) {
      return '🥉 ';
    }
    return '';
  }

  private applyTextFilterToQuery(
    filter: TextFilterModel | undefined,
    setValue: (value: string) => void,
    setType: (type: SprintTextFilterType) => void
  ): void {
    const filterType = filter?.type as SprintTextFilterType | undefined;
    if (!filterType) {
      return;
    }

    setType(filterType);
    if (filterType !== 'blank' && filterType !== 'notBlank' && filter?.filter) {
      setValue(filter.filter);
    }
  }
}
