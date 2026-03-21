export interface SprintRowApi {
  id: number;
  name: string;
  sprint_time_ms: number;
  sprint_date: string;
  location: string;
  created_at: string;
}

export interface SprintRow {
  id: number;
  name: string;
  sprintTimeMs: number;
  sprintDate: string;
  location: string;
  createdAt: string;
}

export interface SprintListResponseApi {
  rows: SprintRowApi[];
  total: number;
}

export interface SprintListResponse {
  rows: SprintRow[];
  total: number;
}

export interface SprintQuery {
  limit: number;
  offset: number;
  sort_by?: 'name' | 'sprint_time_ms' | 'sprint_date' | 'location' | 'created_at';
  sort_dir?: 'asc' | 'desc';
  name?: string;
  location?: string;
  date_from?: string;
  date_to?: string;
  min_time_ms?: number;
  max_time_ms?: number;
}

export function mapSprintRowApiToSprintRow(row: SprintRowApi): SprintRow {
  return {
    id: row.id,
    name: row.name,
    sprintTimeMs: row.sprint_time_ms,
    sprintDate: row.sprint_date,
    location: row.location,
    createdAt: row.created_at
  };
}
