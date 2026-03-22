import { normalizeDisplayName } from '../shared/format/name-format';

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

export interface BestTimeRowApi {
  person_id: number;
  sprint_entry_id: number;
  name: string;
  best_time_ms: number;
  sprint_date: string;
  location: string;
  updated_at: string;
}

export interface BestTimeRow {
  personId: number;
  sprintEntryId: number;
  name: string;
  bestTimeMs: number;
  sprintDate: string;
  location: string;
  updatedAt: string;
}

export interface BestTimesResponseApi {
  rows: BestTimeRowApi[];
  total: number;
}

export interface BestTimesResponse {
  rows: BestTimeRow[];
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
  name_filter_type?: SprintTextFilterType;
  location?: string;
  location_filter_type?: SprintTextFilterType;
  date_from?: string;
  date_to?: string;
  min_time_ms?: number;
  max_time_ms?: number;
}

export interface BestTimesQuery {
  limit: number;
  offset: number;
  sort_by?: 'name' | 'best_time_ms' | 'sprint_date' | 'location' | 'updated_at';
  sort_dir?: 'asc' | 'desc';
  name?: string;
  name_filter_type?: SprintTextFilterType;
  location?: string;
  location_filter_type?: SprintTextFilterType;
  date_from?: string;
  date_to?: string;
}

export type SprintTextFilterType =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEqual'
  | 'startsWith'
  | 'endsWith'
  | 'blank'
  | 'notBlank';

export function mapSprintRowApiToSprintRow(row: SprintRowApi): SprintRow {
  return {
    id: row.id,
    name: normalizeDisplayName(row.name),
    sprintTimeMs: row.sprint_time_ms,
    sprintDate: row.sprint_date,
    location: row.location,
    createdAt: row.created_at
  };
}

export function mapBestTimeRowApiToBestTimeRow(row: BestTimeRowApi): BestTimeRow {
  return {
    personId: row.person_id,
    sprintEntryId: row.sprint_entry_id,
    name: normalizeDisplayName(row.name),
    bestTimeMs: row.best_time_ms,
    sprintDate: row.sprint_date,
    location: row.location,
    updatedAt: row.updated_at
  };
}
