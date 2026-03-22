import { Injectable, computed, inject, signal } from '@angular/core';
import { BROWSER_STORAGE } from '../../core/browser/browser-globals';
import { SPRINT_DISPLAY_UNITS, SprintDisplayUnit, SprintDisplayUnitMeta, getSprintDisplayUnitMeta } from '../format/sprint-format';

@Injectable({
  providedIn: 'root'
})
export class SprintDisplayUnitService {
  private readonly storage = inject(BROWSER_STORAGE);
  private readonly storageKey = 'sprintDisplayUnitPreference';

  readonly unit = signal<SprintDisplayUnit>('seconds');
  readonly unitMeta = computed<SprintDisplayUnitMeta>(() => getSprintDisplayUnitMeta(this.unit()));

  constructor() {
    this.restore();
  }

  setUnit(unit: SprintDisplayUnit): void {
    this.unit.set(unit);
    this.storage.setItem(this.storageKey, unit);
  }

  private restore(): void {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) {
      return;
    }

    if (SPRINT_DISPLAY_UNITS.includes(raw as SprintDisplayUnit)) {
      this.unit.set(raw as SprintDisplayUnit);
    }
  }
}
