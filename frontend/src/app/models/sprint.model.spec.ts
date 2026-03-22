import { describe, expect, it } from 'vitest';
import { mapBestTimeRowApiToBestTimeRow, mapSprintRowApiToSprintRow } from './sprint.model';

describe('sprint model mappers', () => {
  it('normalizes sprint row names from the API', () => {
    const row = mapSprintRowApiToSprintRow({
      id: 1,
      name: 'alice',
      sprint_time_ms: 10123,
      sprint_date: '2026-01-01',
      location: 'Track A',
      created_at: '2026-01-01T00:00:00Z'
    });

    expect(row.name).toBe('Alice');
  });

  it('normalizes best-time row names from the API', () => {
    const row = mapBestTimeRowApiToBestTimeRow({
      person_id: 5,
      sprint_entry_id: 10,
      name: 'mika',
      best_time_ms: 9321,
      sprint_date: '2026-01-01',
      location: 'Track B',
      updated_at: '2026-01-01T00:00:00Z'
    });

    expect(row.name).toBe('Mika');
  });
});
