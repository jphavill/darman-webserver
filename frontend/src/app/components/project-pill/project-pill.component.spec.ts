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
      isPublished: true,
      sortOrder: 0,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      images: [],
      tags: ['Angular'],
      links: [{ type: 'website', label: 'Visit', url: 'https://example.com' }],
      type: 'software'
    };
    expect(component).toBeTruthy();
  });

  it('emits publication toggles', () => {
    const component = new ProjectPillComponent();
    component.project = {
      id: 'test-project',
      title: 'Test Project',
      shortDescription: 'Short description',
      longDescription: 'Long description',
      isPublished: true,
      sortOrder: 0,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      images: [],
      tags: [],
      links: [],
      type: 'software'
    };

    let emitted: { projectId: string; isPublished: boolean } | null = null;
    component.publicationToggled.subscribe((event) => {
      emitted = { projectId: event.project.id, isPublished: event.isPublished };
    });

    const changeEvent = {
      stopPropagation: () => undefined,
      target: { checked: false }
    } as unknown as Event;

    component.updatePublication(changeEvent);

    expect(emitted).toEqual({ projectId: 'test-project', isPublished: false });
  });

  it('does not emit move when direction is disabled', () => {
    const component = new ProjectPillComponent();
    component.project = {
      id: 'test-project',
      title: 'Test Project',
      shortDescription: 'Short description',
      longDescription: 'Long description',
      isPublished: true,
      sortOrder: 0,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      images: [],
      tags: [],
      links: [],
      type: 'software'
    };
    component.canMoveUp = false;

    let moveCount = 0;
    component.moveRequested.subscribe(() => {
      moveCount += 1;
    });

    const clickEvent = { stopPropagation: () => undefined } as MouseEvent;
    component.requestMove(-1, clickEvent);

    expect(moveCount).toBe(0);
  });
});
