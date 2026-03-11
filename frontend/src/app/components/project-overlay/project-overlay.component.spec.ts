import { describe, expect, it } from 'vitest';
import { ProjectOverlayComponent } from './project-overlay.component';

describe('ProjectOverlayComponent', () => {
  it('creates the component class', () => {
    const component = new ProjectOverlayComponent();
    expect(component).toBeTruthy();
  });
});
