import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { SprintDisplayUnit } from '../format/sprint-format';
import { SprintDisplayUnitService } from '../preferences/sprint-display-unit.service';

interface SprintUnitOption {
  value: SprintDisplayUnit;
  shortLabel: string;
  ariaLabel: string;
}

@Component({
  selector: 'app-sprint-unit-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sprint-unit-toggle.component.html',
  styleUrl: './sprint-unit-toggle.component.css'
})
export class SprintUnitToggleComponent {
  private readonly sprintDisplayUnit = inject(SprintDisplayUnitService);

  readonly options: SprintUnitOption[] = [
    { value: 'seconds', shortLabel: 's', ariaLabel: 'Show sprint times in seconds' },
    { value: 'kmh', shortLabel: 'km/h', ariaLabel: 'Show sprint times in kilometers per hour' },
    { value: 'minPerKm', shortLabel: 'min/km', ariaLabel: 'Show sprint times in minutes per kilometer' }
  ];

  get activeUnit(): SprintDisplayUnit {
    return this.sprintDisplayUnit.unit();
  }

  setUnit(unit: SprintDisplayUnit): void {
    this.sprintDisplayUnit.setUnit(unit);
  }
}
