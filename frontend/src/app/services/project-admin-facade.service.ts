import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminAuthStateService } from '../core/admin/admin-auth-state.service';
import { Project, ProjectImage } from '../models/project.model';
import { ProjectApiService } from './project-api.service';

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

  async uploadQueuedImage(projectId: string, image: { file: File; altText: string; caption: string }): Promise<string | null> {
    try {
      const uploaded = await firstValueFrom(
        this.projectApi.uploadProjectImage(projectId, image.file, {
          altText: image.altText.trim() || this.defaultAltText(image.file.name),
          caption: image.caption.trim(),
          isHero: false
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

  saveProjectEdit(event: {
    projectId: string;
    title: string;
    shortDescription: string;
    longDescription: string;
    type: 'software' | 'physical';
  }): void {
    this.errorMessage.set('');
    this.adminStatusMessage.set('');

    this.projectApi
      .updateProject(event.projectId, {
        title: event.title,
        short_description: event.shortDescription,
        long_description_md: event.longDescription,
        type: event.type
      })
      .subscribe({
        next: async () => {
          await this.refreshProjects();
          this.adminStatusMessage.set('Project details saved.');
        },
        error: () => {
          this.errorMessage.set('Unable to save project right now.');
          this.adminStatusMessage.set('');
        }
      });
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

  uploadImage(event: {
    projectId: string;
    file: File;
    altText: string;
    caption: string;
    isHero: boolean;
  }): void {
    this.errorMessage.set('');
    this.adminStatusMessage.set('');

    this.projectApi
      .uploadProjectImage(event.projectId, event.file, {
        altText: event.altText,
        caption: event.caption,
        isHero: event.isHero
      })
      .subscribe({
        next: async () => {
          await this.refreshProjects();
          this.adminStatusMessage.set('Image uploaded.');
        },
        error: () => {
          this.errorMessage.set('Unable to upload image right now.');
          this.adminStatusMessage.set('');
        }
      });
  }

  setHero(projectId: string, image: ProjectImage): void {
    this.projectApi.updateProjectImage(projectId, image.id, true).subscribe({
      next: () => this.refreshProjects(),
      error: () => {
        this.errorMessage.set('Unable to update hero image right now.');
      }
    });
  }

  moveImage(projectId: string, project: Project, imageId: string, direction: -1 | 1): void {
    const images = this.moveItemById(project.images, imageId, direction, (image) => image.id);
    if (images === null) {
      return;
    }

    this.projectApi.reorderProjectImages(projectId, images.map((image) => image.id)).subscribe({
      next: () => this.refreshProjects(),
      error: () => {
        this.errorMessage.set('Unable to reorder images right now.');
      }
    });
  }

  deleteImage(projectId: string, imageId: string): void {
    this.projectApi.deleteProjectImage(projectId, imageId).subscribe({
      next: () => this.refreshProjects(),
      error: () => {
        this.errorMessage.set('Unable to delete image right now.');
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

  private defaultAltText(filename: string): string {
    const stem = filename.replace(/\.[^.]+$/, '');
    return stem.replace(/[_-]+/g, ' ').trim() || 'Project image';
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
