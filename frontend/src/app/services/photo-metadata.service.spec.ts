import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotoMetadataService } from './photo-metadata.service';

function toLocalInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

describe('PhotoMetadataService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('prefers metadata capture date when available', async () => {
    const service = TestBed.runInInjectionContext(() => new PhotoMetadataService());
    const parse = vi.fn().mockResolvedValue({ DateTimeOriginal: '2026:04:05 10:30:00' });
    vi.spyOn(service as any, 'loadExifr').mockResolvedValue({ parse });

    const file = new File(['a'], 'metadata.jpg', { type: 'image/jpeg', lastModified: 0 });
    const detected = await service.detectCapturedAtLocal(file);

    expect(detected).toEqual({
      value: '2026-04-05T10:30',
      source: 'Auto from file metadata'
    });
  });

  it('falls back to file modified time when metadata is absent', async () => {
    const service = TestBed.runInInjectionContext(() => new PhotoMetadataService());
    const parse = vi.fn().mockResolvedValue({});
    vi.spyOn(service as any, 'loadExifr').mockResolvedValue({ parse });

    const file = new File(['a'], 'fallback.jpg', { type: 'image/jpeg', lastModified: Date.UTC(2026, 3, 6, 9, 15, 0) });
    const detected = await service.detectCapturedAtLocal(file);

    expect(detected).toEqual({
      value: toLocalInputValue(new Date(Date.UTC(2026, 3, 6, 9, 15, 0))),
      source: 'Auto from file modified time'
    });
  });

  it('falls back to modified time when metadata parsing throws', async () => {
    const service = TestBed.runInInjectionContext(() => new PhotoMetadataService());
    vi.spyOn(service as any, 'loadExifr').mockResolvedValue({
      parse: vi.fn().mockRejectedValue(new Error('parse failed'))
    });

    const file = new File(['a'], 'error.jpg', { type: 'image/jpeg', lastModified: Date.UTC(2026, 3, 7, 8, 0, 0) });
    const detected = await service.detectCapturedAtLocal(file);

    expect(detected).toEqual({
      value: toLocalInputValue(new Date(Date.UTC(2026, 3, 7, 8, 0, 0))),
      source: 'Auto from file modified time'
    });
  });

  it('returns empty value when neither metadata nor modified time is usable', async () => {
    const service = TestBed.runInInjectionContext(() => new PhotoMetadataService());
    vi.spyOn(service as any, 'loadExifr').mockResolvedValue({ parse: vi.fn().mockResolvedValue(null) });

    const file = new File(['a'], 'none.jpg', { type: 'image/jpeg', lastModified: 0 });
    const detected = await service.detectCapturedAtLocal(file);

    expect(detected).toEqual({
      value: '',
      source: 'No date found (optional field)'
    });
  });
});
