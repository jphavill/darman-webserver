import { describe, expect, it } from 'vitest';
import { SelectedRunner } from './charts.models';
import { RunnerColorService } from './runner-color.service';

describe('RunnerColorService', () => {
  it('assigns the first palette slot for the first runner', () => {
    const service = new RunnerColorService();

    const assignment = service.createPaletteAssignment([]);

    expect(assignment.colorSource).toBe('palette');
    expect(assignment.paletteSlot).toBe(0);
    expect(assignment.color).toBe('var(--runner-palette-1)');
  });

  it('skips occupied palette slots and ignores custom colors', () => {
    const service = new RunnerColorService();
    const selected: SelectedRunner[] = [
      {
        personId: 1,
        personName: 'A',
        color: 'var(--runner-palette-1)',
        colorSource: 'palette',
        paletteSlot: 0,
        visible: true
      },
      {
        personId: 2,
        personName: 'B',
        color: 'var(--accent)',
        colorSource: 'custom',
        paletteSlot: null,
        visible: true
      }
    ];

    const assignment = service.createPaletteAssignment(selected);

    expect(assignment.paletteSlot).toBe(1);
    expect(assignment.color).toBe('var(--runner-palette-2)');
  });

  it('marks user-selected colors as custom', () => {
    const service = new RunnerColorService();

    const assignment = service.createCustomAssignment('var(--accent)');

    expect(assignment).toEqual({
      color: 'var(--accent)',
      colorSource: 'custom',
      paletteSlot: null
    });
  });

  it('reuses next free palette slot when preferred slot is already taken', () => {
    const service = new RunnerColorService();
    const selected: SelectedRunner[] = [
      {
        personId: 1,
        personName: 'A',
        color: 'var(--runner-palette-1)',
        colorSource: 'palette',
        paletteSlot: 0,
        visible: true
      }
    ];

    const assignment = service.createAssignmentFromPreference(
      {
        color: 'var(--runner-palette-1)',
        colorSource: 'palette',
        paletteSlot: 0
      },
      selected
    );

    expect(assignment.paletteSlot).toBe(1);
    expect(assignment.colorSource).toBe('palette');
  });
});
