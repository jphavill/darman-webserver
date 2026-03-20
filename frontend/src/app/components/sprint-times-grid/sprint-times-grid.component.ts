import { Component, inject } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColumnResizedEvent,
  ColDef,
  DateFilterModel,
  GridApi,
  GridSizeChangedEvent,
  GridReadyEvent,
  IDatasource,
  IGetRowsParams,
  NumberFilterModel,
  SortModelItem,
  TextFilterModel
} from 'ag-grid-community';
import { SprintApiService } from '../../services/sprint-api.service';
import { SprintQuery, SprintRow } from '../../models/sprint.model';

@Component({
  selector: 'app-sprint-times-grid',
  standalone: true,
  imports: [AgGridAngular],
  templateUrl: './sprint-times-grid.component.html',
  styleUrl: './sprint-times-grid.component.css'
})
export class SprintTimesGridComponent {
  private readonly sprintApi = inject(SprintApiService);
  private gridApi?: GridApi<SprintRow>;

  readonly pageSize = 25;
  errorMessage = '';

  readonly defaultColDef: ColDef<SprintRow> = {
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: true,
    minWidth: 140,
    flex: 1
  };

  readonly columnDefs: ColDef<SprintRow>[] = [
    {
      field: 'name',
      headerName: 'Name',
      filter: 'agTextColumnFilter',
      sort: 'asc',
      valueFormatter: (params) => this.formatName(params.value as string)
    },
    {
      field: 'sprint_time_ms',
      headerName: 'Sprint Time',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => this.formatSprintMs(params.value as number)
    },
    {
      field: 'sprint_date',
      headerName: 'Date',
      filter: 'agDateColumnFilter',
      valueFormatter: (params) => this.formatDate(params.value as string)
    },
    { field: 'location', headerName: 'Location', filter: 'agTextColumnFilter' }
  ];

  onGridReady(event: GridReadyEvent<SprintRow>): void {
    this.gridApi = event.api;

    const datasource: IDatasource = {
      getRows: (params: IGetRowsParams) => {
        const query = this.buildQuery(params);
        this.errorMessage = '';

        this.sprintApi.getSprints(query).subscribe({
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

    event.api.setGridOption('datasource', datasource);
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

  private buildQuery(params: IGetRowsParams): SprintQuery {
    const sortModel = params.sortModel as SortModelItem[];
    const filterModel = params.filterModel as Record<string, TextFilterModel | NumberFilterModel | DateFilterModel>;
    const query: SprintQuery = {
      limit: (params.endRow ?? this.pageSize) - (params.startRow ?? 0),
      offset: params.startRow ?? 0
    };

    if (sortModel.length > 0) {
      const sort = sortModel[0];
      if (sort.colId === 'name' || sort.colId === 'sprint_time_ms' || sort.colId === 'sprint_date' || sort.colId === 'location') {
        query.sort_by = sort.colId;
      }
      query.sort_dir = sort.sort === 'asc' ? 'asc' : 'desc';
    }

    const nameFilter = filterModel['name'] as TextFilterModel | undefined;
    if (nameFilter?.filter) {
      query.name = nameFilter.filter;
    }

    const locationFilter = filterModel['location'] as TextFilterModel | undefined;
    if (locationFilter?.filter) {
      query.location = locationFilter.filter;
    }

    const timeFilter = filterModel['sprint_time_ms'] as NumberFilterModel | undefined;
    if (timeFilter?.filter != null) {
      if (timeFilter.type === 'lessThan' || timeFilter.type === 'lessThanOrEqual') {
        query.max_time_ms = timeFilter.filter;
      } else if (timeFilter.type === 'greaterThan' || timeFilter.type === 'greaterThanOrEqual') {
        query.min_time_ms = timeFilter.filter;
      } else if (timeFilter.type === 'equals') {
        query.min_time_ms = timeFilter.filter;
        query.max_time_ms = timeFilter.filter;
      }
    }

    const dateFilter = filterModel['sprint_date'] as DateFilterModel | undefined;
    if (dateFilter?.dateFrom) {
      if (dateFilter.type === 'lessThan' || dateFilter.type === 'lessThanOrEqual') {
        query.date_to = dateFilter.dateFrom;
      } else if (dateFilter.type === 'greaterThan' || dateFilter.type === 'greaterThanOrEqual') {
        query.date_from = dateFilter.dateFrom;
      } else if (dateFilter.type === 'equals') {
        query.date_from = dateFilter.dateFrom;
        query.date_to = dateFilter.dateFrom;
      } else if (dateFilter.type === 'inRange' && dateFilter.dateTo) {
        query.date_from = dateFilter.dateFrom;
        query.date_to = dateFilter.dateTo;
      }
    }

    return query;
  }

  private formatSprintMs(value: number): string {
    if (!Number.isFinite(value)) {
      return '-';
    }
    return `${(value / 1000).toFixed(3)} s`;
  }

  private formatDate(value: string): string {
    if (!value) {
      return '-';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleDateString();
  }

  private formatName(value: string): string {
    if (!value) {
      return '-';
    }

    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  }
}
