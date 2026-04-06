import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminAuthStateService } from '../core/admin/admin-auth-state.service';
import { Project } from '../models/project.model';
import { resolveAltTextWithCaptionFallback } from '../shared/text/alt-text.utils';
import { ProjectApiService } from './project-api.service';
import {
  ProjectEditImageDraft,
  ProjectEditSaveRequest,
  buildOrderedImageIds,
  buildProjectEditSavePlan,
  finalizeDeletedImageIds,
  resolveHeroImageId
} from './project-edit-save.pipeline';

@Injectable({
  providedIn: 'root'
})
export class ProjectAdminFacadeService {
  private readonly projectApi = inject(ProjectApiService);
  private readonly adminAuthState = inject(AdminAuthStateService);

  readonly canManageProjectContent = computed(() => this.adminAuthState.can('projectsManageContent'));
  readonly canManageProjectPublication = computed(() => this.adminAuthState.can('projectsManagePublication'));
  readonly includeUnpublished = computed(() => this.adminAuthState.can('projectsViewUnpublished'));

  readonly softwareProjects = signal<Project[]>([]);
  readonly physicalProjects = signal<Project[]>([]);
  readonly errorMessage = signal('');
  readonly adminStatusMessage = signal('');
  readonly isCreatingProject = signal(false);
  readonly isSavingProjectEdit = signal(false);
  readonly pendingProjectPublicationUpdates = signal<Set<string>>(new Set());

  readonly allProjects = computed(() => [...this.softwareProjects(), ...this.physicalProjects()]);

  private readonly loadProjectsEffect = effect((onCleanup) => {
    const includeUnpublished = this.includeUnpublished();
    const subscription = this.projectApi.getProjects(undefined, includeUnpublished).subscribe({
      next: (response) => {
        this.errorMessage.set('');
        this.applyProjects(response.rows);
      },
      error: () => {
        this.softwareProjects.set([]);
        this.physicalProjects.set([]);
        this.errorMessage.set('Unable to load projects right now.');
      }
    });

    onCleanup(() => {
      subscription.unsubscribe();
    });
  });

  async refreshProjects(): Promise<void> {
    try {
      const response = await firstValueFrom(this.projectApi.getProjects(undefined, this.includeUnpublished()));
      this.applyProjects(response.rows);
      this.errorMessage.set('');
    } catch {
      this.errorMessage.set('Unable to load projects right now.');
    }
  }

  async createProject(draft: {
    title: string;
    short_description: string;
    long_description_md: string;
    type: 'software' | 'physical';
    is_published: boolean;
    links: { type: 'github' | 'cults3d' | 'website' | 'other'; label: string; url: string }[];
  }): Promise<Project | null> {
    this.errorMessage.set('');
    this.adminStatusMessage.set('Creating project...');
    this.isCreatingProject.set(true);

    try {
      const created = await firstValueFrom(this.projectApi.createProject(draft));
      return created;
    } catch {
      this.errorMessage.set('Unable to create project right now.');
      this.adminStatusMessage.set('');
      return null;
    } finally {
      this.isCreatingProject.set(false);
    }
  }

  async uploadQueuedImage(
    projectId: string,
    image: { file: File; altText: string; caption: string; isHero: boolean }
  ): Promise<string | null> {
    try {
      const caption = image.caption.trim();
      const altText = this.resolveAltText(image.altText, caption, null, image.file);
      const uploaded = await firstValueFrom(
        this.projectApi.uploadProjectImage(projectId, image.file, {
          altText,
          caption,
          isHero: image.isHero
        })
      );
      return uploaded.id;
    } catch {
      return null;
    }
  }

  async reorderUploadedImages(projectId: string, imageIds: string[]): Promise<void> {
    if (imageIds.length <= 1) {
      return;
    }

    await firstValueFrom(this.projectApi.reorderProjectImages(projectId, imageIds));
  }

  /**
   * Save runs in non-destructive phases first and deletes removed images last.
   * Deleting last reduces irreversible partial-failure outcomes when any earlier phase fails.
   */
  async saveProjectEdit(event: ProjectEditSaveRequest): Promise<void> {
    if (this.isSavingProjectEdit()) {
      return;
    }

    this.isSavingProjectEdit.set(true);
    this.errorMessage.set('');
    this.adminStatusMessage.set('Saving project...');

    const currentProject = this.allProjects().find((project) => project.id === event.projectId) ?? null;
    const savePlan = buildProjectEditSavePlan(currentProject, event);

    try {
      await this.updateProjectFields(event);
      await this.syncExistingImageMetadata(event.projectId, event.imageDrafts, savePlan.existingImageById);

      const uploadedIdByDraftId = await this.uploadNewImages(event.projectId, event.imageDrafts);
      const latestProject = await this.loadProjectById(event.projectId);
      const orderedImageIds = buildOrderedImageIds(event.imageDrafts, uploadedIdByDraftId, latestProject);

      await this.syncImageOrder(event.projectId, orderedImageIds);

      const deletedImageIds = finalizeDeletedImageIds(savePlan.candidateDeletedImageIds, latestProject);

      await this.syncHero(event.projectId, event.imageDrafts, uploadedIdByDraftId, latestProject, deletedImageIds);
      await this.deleteRemovedImages(event.projectId, deletedImageIds);

      await this.refreshProjects();
      this.adminStatusMessage.set('Project details saved.');
    } catch {
      await this.refreshProjects();
      this.errorMessage.set('Unable to save project right now.');
      this.adminStatusMessage.set('');
    } finally {
      this.isSavingProjectEdit.set(false);
    }
  }

  toggleProjectPublication(event: { project: Project; isPublished: boolean }): void {
    const { project, isPublished } = event;

    if (isPublished === project.isPublished || this.pendingProjectPublicationUpdates().has(project.id)) {
      return;
    }

    this.markProjectPublicationPending(project.id, true);
    this.errorMessage.set('');

    this.projectApi.updateProject(project.id, { is_published: isPublished }).subscribe({
      next: async () => {
        await this.refreshProjects();
        this.markProjectPublicationPending(project.id, false);
      },
      error: () => {
        this.errorMessage.set('Unable to update project visibility right now.');
        this.markProjectPublicationPending(project.id, false);
      }
    });
  }

  moveProject(type: 'software' | 'physical', projectId: string, direction: -1 | 1): void {
    const projects = type === 'software' ? [...this.softwareProjects()] : [...this.physicalProjects()];
    const nextProjects = this.moveItemById(projects, projectId, direction, (project) => project.id);
    if (nextProjects === null) {
      return;
    }

    this.projectApi.reorderProjects(type, nextProjects.map((project) => project.id)).subscribe({
      next: () => this.refreshProjects(),
      error: () => {
        this.errorMessage.set('Unable to reorder projects right now.');
      }
    });
  }

  private markProjectPublicationPending(projectId: string, isPending: boolean): void {
    const next = new Set(this.pendingProjectPublicationUpdates());

    if (isPending) {
      next.add(projectId);
    } else {
      next.delete(projectId);
    }

    this.pendingProjectPublicationUpdates.set(next);
  }

  private async updateProjectFields(event: ProjectEditSaveRequest): Promise<void> {
    await firstValueFrom(
      this.projectApi.updateProject(event.projectId, {
        title: event.title,
        short_description: event.shortDescription,
        long_description_md: event.longDescription,
        type: event.type,
        is_published: event.isPublished
      })
    );
  }

  private async syncExistingImageMetadata(
    projectId: string,
    imageDrafts: ProjectEditImageDraft[],
    existingImageById: Map<string, { altText: string; caption?: string }>
  ): Promise<void> {
    for (const draft of imageDrafts) {
      if (!draft.existingImageId || draft.file) {
        continue;
      }

      const existing = existingImageById.get(draft.existingImageId);
      if (!existing) {
        continue;
      }

      const nextCaption = draft.caption.trim();
      const nextAltText = this.resolveAltText(draft.altText, nextCaption, existing.altText, null);
      const currentCaption = existing.caption ?? '';

      if (nextAltText === existing.altText && nextCaption === currentCaption) {
        continue;
      }

      await firstValueFrom(
        this.projectApi.updateProjectImage(projectId, draft.existingImageId, {
          altText: nextAltText,
          caption: nextCaption
        })
      );
    }
  }

  private async uploadNewImages(
    projectId: string,
    imageDrafts: ProjectEditImageDraft[]
  ): Promise<Map<string, string>> {
    const uploadedIdByDraftId = new Map<string, string>();

    for (const draft of imageDrafts) {
      if (!draft.file) {
        continue;
      }

      const caption = draft.caption.trim();
      const altText = this.resolveAltText(draft.altText, caption, null, draft.file);
      const uploaded = await firstValueFrom(
        this.projectApi.uploadProjectImage(projectId, draft.file, {
          altText,
          caption,
          isHero: false
        })
      );

      uploadedIdByDraftId.set(draft.draftId, uploaded.id);
    }

    return uploadedIdByDraftId;
  }

  private async syncImageOrder(projectId: string, orderedImageIds: string[]): Promise<void> {
    if (orderedImageIds.length > 1) {
      await firstValueFrom(this.projectApi.reorderProjectImages(projectId, orderedImageIds));
    }
  }

  private async syncHero(
    projectId: string,
    imageDrafts: ProjectEditImageDraft[],
    uploadedIdByDraftId: ReadonlyMap<string, string>,
    latestProject: Project | null,
    deletedImageIds: string[]
  ): Promise<void> {
    const heroImageId = resolveHeroImageId(imageDrafts, uploadedIdByDraftId);
    const existingHeroImageId = latestProject?.images.find((image) => image.isHero)?.id ?? null;

    if (heroImageId) {
      await firstValueFrom(this.projectApi.updateProjectImage(projectId, heroImageId, { isHero: true }));
      return;
    }

    if (existingHeroImageId && !deletedImageIds.includes(existingHeroImageId)) {
      await firstValueFrom(this.projectApi.updateProjectImage(projectId, existingHeroImageId, { isHero: false }));
    }
  }

  private async deleteRemovedImages(projectId: string, deletedImageIds: string[]): Promise<void> {
    for (const imageId of deletedImageIds) {
      await firstValueFrom(this.projectApi.deleteProjectImage(projectId, imageId));
    }
  }

  private async loadProjectById(projectId: string): Promise<Project | null> {
    const response = await firstValueFrom(this.projectApi.getProjects(undefined, this.includeUnpublished()));
    return response.rows.find((project) => project.id === projectId) ?? null;
  }

  private resolveAltText(altText: string, caption: string, existingAltText: string | null, file: File | null): string {
    return resolveAltTextWithCaptionFallback({
      altText,
      caption,
      existingAltText,
      filename: file?.name,
      fallback: 'Project image'
    });
  }

  private applyProjects(projects: Project[]): void {
    this.softwareProjects.set(projects.filter((project) => project.type === 'software'));
    this.physicalProjects.set(projects.filter((project) => project.type === 'physical'));
  }

  private moveItemById<T>(items: T[], id: string, direction: -1 | 1, getId: (item: T) => string): T[] | null {
    const currentIndex = items.findIndex((item) => getId(item) === id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= items.length) {
      return null;
    }

    const nextItems = [...items];
    [nextItems[currentIndex], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[currentIndex]];
    return nextItems;
  }
}
