import { describe, expect, it } from 'vitest';
import { ProjectPillComponent } from './project-pill.component';

describe('ProjectPillComponent', () => {
  it('creates the component class', () => {
    const component = new ProjectPillComponent();
    component.project = {
      id: 'test-project',
      title: 'Test Project',
      shortDescription: 'Short description',
      longDescription: 'Long description',
      thumbnail: '/media/test.webp',
      tags: ['Angular'],
      links: [{ type: 'website', label: 'Visit', url: 'https://example.com' }],
      type: 'software'
    };
    expect(component).toBeTruthy();
  });
});
