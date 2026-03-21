import { describe, expect, it } from 'vitest';
import { SelectedRunnerListComponent } from './selected-runner-list.component';

describe('SelectedRunnerListComponent', () => {
  it('creates the component class', () => {
    const component = new SelectedRunnerListComponent();
    expect(component).toBeTruthy();
  });

  it('starts with an empty runner list', () => {
    const component = new SelectedRunnerListComponent();
    expect(component.runners).toEqual([]);
  });
});
