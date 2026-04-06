import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAuthStateService } from '../core/admin/admin-auth-state.service';
import { Project } from '../models/project.model';
import { ProjectApiService } from './project-api.service';
import { ProjectAdminFacadeService } from './project-admin-facade.service';

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
    images: [
      {
        id: 'img-existing',
        thumbUrl: '/thumb.webp',
        fullUrl: '/full.webp',
        altText: 'Existing alt',
        caption: 'Existing caption',
        sortOrder: 0,
        isHero: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      }
    ],
    tags: [],
    links: [],
    type: 'software',
    ...overrides
  };
}

describe('ProjectAdminFacadeService', () => {
  let service: ProjectAdminFacadeService;
  let projectApiMock: {
    getProjects: ReturnType<typeof vi.fn>;
    updateProject: ReturnType<typeof vi.fn>;
    deleteProjectImage: ReturnType<typeof vi.fn>;
    updateProjectImage: ReturnType<typeof vi.fn>;
    uploadProjectImage: ReturnType<typeof vi.fn>;
    reorderProjectImages: ReturnType<typeof vi.fn>;
    createProject: ReturnType<typeof vi.fn>;
    reorderProjects: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    projectApiMock = {
      getProjects: vi.fn().mockReturnValue(of({ total: 1, rows: [buildProject()] })),
      updateProject: vi.fn().mockReturnValue(of(buildProject())),
      deleteProjectImage: vi.fn().mockReturnValue(of(void 0)),
      updateProjectImage: vi.fn().mockReturnValue(of({ id: 'img-existing' })),
      uploadProjectImage: vi.fn().mockReturnValue(of({ id: 'img-uploaded' })),
      reorderProjectImages: vi.fn().mockReturnValue(of([])),
      createProject: vi.fn(),
      reorderProjects: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        AdminAuthStateService,
        ProjectAdminFacadeService,
        { provide: ProjectApiService, useValue: projectApiMock }
      ]
    });

    service = TestBed.inject(ProjectAdminFacadeService);
    service.softwareProjects.set([buildProject()]);
    service.physicalProjects.set([]);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('uses caption as alt text when draft alt text is whitespace', async () => {
    await service.saveProjectEdit({
      projectId: 'project-1',
      title: 'Project',
      shortDescription: 'Short',
      longDescription: 'Long',
      type: 'software',
      isPublished: true,
      imageDrafts: [
        {
          draftId: 'existing',
          existingImageId: 'img-existing',
          file: null,
          altText: '   ',
          caption: 'Existing caption updated',
          isHero: false
        },
        {
          draftId: 'new-file',
          existingImageId: null,
          file: new File(['new'], 'new-upload.jpg', { type: 'image/jpeg' }),
          altText: '   ',
          caption: 'Uploaded caption',
          isHero: true
        }
      ]
    });

    expect(projectApiMock.updateProjectImage).toHaveBeenCalledWith('project-1', 'img-existing', {
      altText: 'Existing caption updated',
      caption: 'Existing caption updated'
    });
    expect(projectApiMock.uploadProjectImage).toHaveBeenCalledWith(
      'project-1',
      expect.any(File),
      expect.objectContaining({ altText: 'Uploaded caption', caption: 'Uploaded caption' })
    );
  });

  it('uploads and reorders before deleting removed images', async () => {
    service.softwareProjects.set([
      buildProject({
        images: [
          {
            id: 'img-existing',
            thumbUrl: '/thumb.webp',
            fullUrl: '/full.webp',
            altText: 'Existing alt',
            caption: 'Existing caption',
            sortOrder: 0,
            isHero: true,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01'
          },
          {
            id: 'img-delete-me',
            thumbUrl: '/thumb-2.webp',
            fullUrl: '/full-2.webp',
            altText: 'Delete me',
            caption: 'Delete me',
            sortOrder: 1,
            isHero: false,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01'
          }
        ]
      })
    ]);

    projectApiMock.getProjects.mockReturnValue(
      of({
        total: 1,
        rows: [
          buildProject({
            images: [
              {
                id: 'img-existing',
                thumbUrl: '/thumb.webp',
                fullUrl: '/full.webp',
                altText: 'Existing alt',
                caption: 'Existing caption',
                sortOrder: 0,
                isHero: true,
                createdAt: '2026-01-01',
                updatedAt: '2026-01-01'
              },
              {
                id: 'img-delete-me',
                thumbUrl: '/thumb-2.webp',
                fullUrl: '/full-2.webp',
                altText: 'Delete me',
                caption: 'Delete me',
                sortOrder: 1,
                isHero: false,
                createdAt: '2026-01-01',
                updatedAt: '2026-01-01'
              },
              {
                id: 'img-uploaded',
                thumbUrl: '/thumb-3.webp',
                fullUrl: '/full-3.webp',
                altText: 'Uploaded caption',
                caption: 'Uploaded caption',
                sortOrder: 2,
                isHero: false,
                createdAt: '2026-01-01',
                updatedAt: '2026-01-01'
              }
            ]
          })
        ]
      })
    );

    await service.saveProjectEdit({
      projectId: 'project-1',
      title: 'Project',
      shortDescription: 'Short',
      longDescription: 'Long',
      type: 'software',
      isPublished: true,
      imageDrafts: [
        {
          draftId: 'existing',
          existingImageId: 'img-existing',
          file: null,
          altText: 'Existing alt',
          caption: 'Existing caption',
          isHero: false
        },
        {
          draftId: 'new-file',
          existingImageId: null,
          file: new File(['new'], 'new-upload.jpg', { type: 'image/jpeg' }),
          altText: '',
          caption: 'Uploaded caption',
          isHero: true
        }
      ]
    });

    const uploadCallOrder = projectApiMock.uploadProjectImage.mock.invocationCallOrder[0];
    const reorderCallOrder = projectApiMock.reorderProjectImages.mock.invocationCallOrder[0];
    const deleteCallOrder = projectApiMock.deleteProjectImage.mock.invocationCallOrder[0];
    expect(projectApiMock.reorderProjectImages).toHaveBeenCalledWith('project-1', [
      'img-existing',
      'img-uploaded',
      'img-delete-me'
    ]);
    expect(uploadCallOrder).toBeLessThan(deleteCallOrder);
    expect(reorderCallOrder).toBeLessThan(deleteCallOrder);
  });

  it('refreshes before delete and skips stale delete ids no longer persisted', async () => {
    service.softwareProjects.set([
      buildProject({
        images: [
          {
            id: 'img-existing',
            thumbUrl: '/thumb.webp',
            fullUrl: '/full.webp',
            altText: 'Existing alt',
            caption: 'Existing caption',
            sortOrder: 0,
            isHero: true,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01'
          },
          {
            id: 'img-delete-me',
            thumbUrl: '/thumb-2.webp',
            fullUrl: '/full-2.webp',
            altText: 'Delete me',
            caption: 'Delete me',
            sortOrder: 1,
            isHero: false,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01'
          }
        ]
      })
    ]);

    projectApiMock.getProjects.mockReset();
    projectApiMock.getProjects
      .mockReturnValueOnce(
        of({
          total: 1,
          rows: [
            buildProject({
              images: [
                {
                  id: 'img-existing',
                  thumbUrl: '/thumb.webp',
                  fullUrl: '/full.webp',
                  altText: 'Existing alt',
                  caption: 'Existing caption',
                  sortOrder: 0,
                  isHero: true,
                  createdAt: '2026-01-01',
                  updatedAt: '2026-01-01'
                }
              ]
            })
          ]
        })
      )
      .mockReturnValue(of({ total: 1, rows: [buildProject()] }));

    await service.saveProjectEdit({
      projectId: 'project-1',
      title: 'Project',
      shortDescription: 'Short',
      longDescription: 'Long',
      type: 'software',
      isPublished: true,
      imageDrafts: [
        {
          draftId: 'existing',
          existingImageId: 'img-existing',
          file: null,
          altText: 'Existing alt',
          caption: 'Existing caption',
          isHero: true
        }
      ]
    });

    expect(projectApiMock.deleteProjectImage).not.toHaveBeenCalled();
  });

  it('refreshes projects and clears saving state when save fails', async () => {
    projectApiMock.updateProject.mockReturnValueOnce(throwError(() => new Error('boom')));
    const initialGetProjectsCalls = projectApiMock.getProjects.mock.calls.length;

    await service.saveProjectEdit({
      projectId: 'project-1',
      title: 'Project',
      shortDescription: 'Short',
      longDescription: 'Long',
      type: 'software',
      isPublished: true,
      imageDrafts: []
    });

    expect(projectApiMock.getProjects.mock.calls.length).toBeGreaterThan(initialGetProjectsCalls);
    expect(service.errorMessage()).toBe('Unable to save project right now.');
    expect(service.isSavingProjectEdit()).toBe(false);
  });

  it('blocks concurrent edit saves while one is pending', async () => {
    const pendingUpdate = new Subject<Project>();
    projectApiMock.updateProject.mockReturnValueOnce(pendingUpdate.asObservable());

    const firstSave = service.saveProjectEdit({
      projectId: 'project-1',
      title: 'Project',
      shortDescription: 'Short',
      longDescription: 'Long',
      type: 'software',
      isPublished: true,
      imageDrafts: []
    });
    const secondSave = service.saveProjectEdit({
      projectId: 'project-1',
      title: 'Project',
      shortDescription: 'Short',
      longDescription: 'Long',
      type: 'software',
      isPublished: true,
      imageDrafts: []
    });

    expect(projectApiMock.updateProject).toHaveBeenCalledTimes(1);

    pendingUpdate.next(buildProject());
    pendingUpdate.complete();

    await firstSave;
    await secondSave;
    expect(service.isSavingProjectEdit()).toBe(false);
  });
});
