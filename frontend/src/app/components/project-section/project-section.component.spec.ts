import { describe, expect, it } from 'vitest';
import { ProjectSectionComponent } from './project-section.component';

describe('ProjectSectionComponent', () => {
  it('creates the component class', () => {
    const component = new ProjectSectionComponent();
    component.title = 'Projects';
    component.projects = [];
    expect(component).toBeTruthy();
  });
});
