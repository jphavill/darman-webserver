import { SimpleChange } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { Project } from '../../models/project.model';
import { ProjectEditModalComponent } from './project-edit-modal.component';

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    title: 'Project',
    shortDescription: 'Short',
    longDescription: 'Long',
    isPublished: true,
    sortOrder: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    type: 'software',
    tags: [],
    links: [],
    images: [
      {
        id: 'img-1',
        thumbUrl: '/thumb.webp',
        fullUrl: '/full.webp',
        altText: 'Original alt',
        caption: 'Original caption',
        sortOrder: 0,
        isHero: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      }
    ],
    ...overrides
  };
}

describe('ProjectEditModalComponent', () => {
  it('does not reset draft state on non-project input changes', () => {
    const component = new ProjectEditModalComponent();
    component.project = buildProject();
    component.ngOnChanges({
      project: new SimpleChange(null, component.project, true)
    });

    component.patchEditorValue({
      ...component.editorValue,
      title: 'Draft title'
    });
    component.patchImage({ imageId: 'img-1', patch: { caption: 'Draft caption' } });

    component.statusMessage = 'Saving...';
    component.ngOnChanges({
      statusMessage: new SimpleChange('', 'Saving...', false)
    });

    expect(component.editorValue.title).toBe('Draft title');
    expect(component.editorImages[0].caption).toBe('Draft caption');
  });

  it('resets draft state when project input changes', () => {
    const component = new ProjectEditModalComponent();
    component.project = buildProject();
    component.ngOnChanges({
      project: new SimpleChange(null, component.project, true)
    });

    component.patchEditorValue({
      ...component.editorValue,
      title: 'Draft title'
    });

    component.project = buildProject({ title: 'Updated source project' });
    component.ngOnChanges({
      project: new SimpleChange(null, component.project, false)
    });

    expect(component.editorValue.title).toBe('Updated source project');
  });

  it('shows queue limit error when selected files exceed max images', () => {
    const component = new ProjectEditModalComponent();
    component.project = buildProject({ images: [] });
    component.ngOnChanges({
      project: new SimpleChange(null, component.project, true)
    });

    const files = Array.from({ length: 13 }, (_, index) => new File(['x'], `photo-${index}.jpg`, { type: 'image/jpeg' }));
    component.uploadImages(files);

    expect(component.editorImages.length).toBe(12);
    expect(component.uploadErrorMessage).toBe('You can only queue up to 12 images per project.');
  });
});
