import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RunnerColorService {
  private readonly defaultPalette = ['#58a6ff', '#e05654', '#4ac07a', '#f5a63d', '#8ecaf0', '#f27f98'];

  colorForRunner(personId: number, persistedColors: Record<string, string>): string {
    const persisted = persistedColors[String(personId)];
    if (persisted) {
      return persisted;
    }

    return this.defaultPalette[personId % this.defaultPalette.length];
  }
}
