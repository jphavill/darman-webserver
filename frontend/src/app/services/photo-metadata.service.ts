import { Injectable } from '@angular/core';

export interface DetectedCaptureDate {
  value: string;
  source: string;
}

@Injectable({
  providedIn: 'root'
})
export class PhotoMetadataService {
  private exifrModulePromise: Promise<typeof import('exifr')> | null = null;

  async detectCapturedAtLocal(file: File): Promise<DetectedCaptureDate> {
    const fromMetadata = await this.detectCapturedAtFromMetadata(file);
    if (fromMetadata) {
      return {
        value: this.toDateTimeLocalValue(fromMetadata),
        source: 'Auto from file metadata'
      };
    }

    if (Number.isFinite(file.lastModified) && file.lastModified > 0) {
      return {
        value: this.toDateTimeLocalValue(new Date(file.lastModified)),
        source: 'Auto from file modified time'
      };
    }

    return {
      value: '',
      source: 'No date found (optional field)'
    };
  }

  private async detectCapturedAtFromMetadata(file: File): Promise<Date | null> {
    try {
      const exifr = await this.loadExifr();
      const parsed = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate', 'DateTimeDigitized', 'DateTime']);

      for (const key of ['DateTimeOriginal', 'CreateDate', 'DateTimeDigitized', 'DateTime']) {
        const value = parsed?.[key];
        const date = this.coerceMetadataDate(value);
        if (date) {
          return date;
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  private async loadExifr(): Promise<typeof import('exifr')> {
    if (!this.exifrModulePromise) {
      this.exifrModulePromise = import('exifr');
    }

    return this.exifrModulePromise;
  }

  private coerceMetadataDate(value: unknown): Date | null {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return value;
    }

    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const exifMatch = normalized.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/);
    if (exifMatch) {
      const [, year, month, day, hour, minute, second] = exifMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
      if (Number.isFinite(parsed.getTime())) {
        return parsed;
      }
    }

    const fallback = new Date(normalized);
    if (Number.isFinite(fallback.getTime())) {
      return fallback;
    }

    return null;
  }

  private toDateTimeLocalValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }
}
