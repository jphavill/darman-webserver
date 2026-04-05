import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminAuthStateService } from '../../core/admin/admin-auth-state.service';
import { ProjectApiService } from '../../services/project-api.service';
import { HomePageComponent } from './home-page.component';

function buildProjectApiMock(overrides: Partial<Record<keyof ProjectApiService, unknown>> = {}) {
  return {
    getProjects: vi.fn().mockReturnValue(of({ total: 0, rows: [] })),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    reorderProjects: vi.fn(),
    uploadProjectImage: vi.fn(),
    reorderProjectImages: vi.fn(),
    updateProjectImage: vi.fn(),
    deleteProjectImage: vi.fn(),
    ...overrides
  };
}

describe('HomePageComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads projects into software and physical sections', async () => {
    const apiMock = buildProjectApiMock({
      getProjects: vi.fn().mockReturnValue(
        of({
          total: 2,
          rows: [
            {
              id: 'a',
              title: 'Software project',
              shortDescription: 'short',
              longDescription: 'long',
              type: 'software',
              isPublished: true,
              sortOrder: 0,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
              images: [],
              links: [],
              tags: []
            },
            {
              id: 'b',
              title: 'Physical project',
              shortDescription: 'short',
              longDescription: 'long',
              type: 'physical',
              isPublished: true,
              sortOrder: 0,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
              images: [],
              links: [],
              tags: []
            }
          ]
        })
      )
    });

    TestBed.configureTestingModule({
      providers: [AdminAuthStateService, { provide: ProjectApiService, useValue: apiMock }]
    });

    const component = TestBed.runInInjectionContext(() => new HomePageComponent());

    await vi.waitFor(() => {
      expect(component.softwareProjects().length).toBe(1);
      expect(component.physicalProjects().length).toBe(1);
    });
  });

  it('disallows raw html while rendering markdown', () => {
    TestBed.configureTestingModule({
      providers: [AdminAuthStateService, { provide: ProjectApiService, useValue: buildProjectApiMock() }]
    });

    const component = TestBed.runInInjectionContext(() => new HomePageComponent());
    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = () => new DOMRect(0, 0, 120, 80);

    component.openProject({
      trigger,
      project: {
        id: 'security-test',
        title: 'Security Test',
        shortDescription: 'Short',
        longDescription: '<p>Should not render</p>\n\n**Safe markdown**',
        images: [],
        tags: [],
        links: [],
        type: 'software',
        isPublished: true,
        sortOrder: 0,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      }
    });

    expect(component.activeProjectMarkdown.includes('<p>Should not render</p>')).toBe(false);
    expect(component.activeProjectMarkdown.includes('Safe markdown')).toBe(true);
  });

  it('removes overlay-open body class on destroy', () => {
    TestBed.configureTestingModule({
      providers: [AdminAuthStateService, { provide: ProjectApiService, useValue: buildProjectApiMock() }]
    });

    const component = TestBed.runInInjectionContext(() => new HomePageComponent());
    document.body.classList.add('overlay-open');

    component.ngOnDestroy();

    expect(document.body.classList.contains('overlay-open')).toBe(false);
  });

  it('exposes content admin controls only with project content flag', () => {
    const authState = new AdminAuthStateService();

    TestBed.configureTestingModule({
      providers: [
        { provide: AdminAuthStateService, useValue: authState },
        { provide: ProjectApiService, useValue: buildProjectApiMock() }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new HomePageComponent());
    expect(component.canManageProjectContent()).toBe(false);

    authState.setSession({
      photosViewUnpublished: true,
      photosManagePublication: true,
      projectsViewUnpublished: true,
      projectsManagePublication: true,
      projectsManageContent: true
    });

    expect(component.canManageProjectContent()).toBe(true);
  });

  it('clears create form and opens edit mode when uploads partially fail', async () => {
    const apiMock = buildProjectApiMock({
      createProject: vi.fn().mockReturnValue(
        of({
          id: 'new-project',
          title: 'Created',
          shortDescription: 'Short',
          longDescription: 'Long',
          type: 'software',
          isPublished: true,
          sortOrder: 0,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          images: [],
          links: [],
          tags: []
        })
      ),
      uploadProjectImage: vi
        .fn()
        .mockReturnValueOnce(of({ id: 'img-1' }))
        .mockImplementationOnce(() => {
          throw new Error('upload failed');
        }),
      reorderProjectImages: vi.fn().mockReturnValue(of([])),
      getProjects: vi.fn().mockReturnValue(
        of({
          total: 1,
          rows: [
            {
              id: 'new-project',
              title: 'Created',
              shortDescription: 'Short',
              longDescription: 'Long',
              type: 'software',
              isPublished: true,
              sortOrder: 0,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
              images: [],
              links: [],
              tags: []
            }
          ]
        })
      )
    });

    TestBed.configureTestingModule({
      providers: [AdminAuthStateService, { provide: ProjectApiService, useValue: apiMock }]
    });

    const component = TestBed.runInInjectionContext(() => new HomePageComponent());
    const clearSuccessfulQueuedImages = vi.fn();
    const resetForm = vi.fn();
    const setSubmissionState = vi.fn();
    component.createPanel = {
      clearSuccessfulQueuedImages,
      resetForm,
      setSubmissionState
    } as unknown as HomePageComponent['createPanel'];

    await component.createProject({
      draft: {
        title: 'Created',
        short_description: 'Short',
        long_description_md: 'Long',
        type: 'software',
        is_published: true,
        links: []
      },
      queuedImages: [
        {
          id: 'q1',
          file: new File(['one'], 'one.jpg', { type: 'image/jpeg' }),
          previewUrl: 'blob:one',
          altText: 'one',
          caption: ''
        },
        {
          id: 'q2',
          file: new File(['two'], 'two.jpg', { type: 'image/jpeg' }),
          previewUrl: 'blob:two',
          altText: 'two',
          caption: ''
        }
      ]
    });

    expect(clearSuccessfulQueuedImages).toHaveBeenCalledWith(new Set(['q2']));
    expect(resetForm).toHaveBeenCalled();
    expect(component.editingProjectId()).toBe('new-project');
  });
});
