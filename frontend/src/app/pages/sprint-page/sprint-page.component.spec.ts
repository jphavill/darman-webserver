import { describe, expect, it } from 'vitest';
import { SprintPageComponent } from './sprint-page.component';

describe('SprintPageComponent', () => {
  it('creates the component class', () => {
    const component = new SprintPageComponent();
    expect(component).toBeTruthy();
  });
});
