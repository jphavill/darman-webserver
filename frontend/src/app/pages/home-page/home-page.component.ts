import { Component, DOCUMENT, HostListener, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { ProjectCreatePanelComponent, ProjectCreateRequestedEvent } from '../../components/project-create-panel/project-create-panel.component';
import {
  ProjectEditModalComponent,
  ProjectEditSaveRequestedEvent
} from '../../components/project-edit-modal/project-edit-modal.component';
import { SiteFooterComponent } from '../../components/site-footer/site-footer.component';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';
import { ProjectOverlayComponent } from '../../components/project-overlay/project-overlay.component';
import { ProjectSectionComponent } from '../../components/project-section/project-section.component';
import { WINDOW } from '../../core/browser/browser-globals';
import { Project, ProjectOpenRequest } from '../../models/project.model';
import { ProjectAdminFacadeService } from '../../services/project-admin-facade.service';
import { preprocessProjectMarkdown } from '../../shared/markdown/project-markdown-preprocessor';

@Component({
  selector: 'app-home-page',
  imports: [
    SiteHeaderComponent,
    ProjectSectionComponent,
    SiteFooterComponent,
    ProjectOverlayComponent,
    ProjectCreatePanelComponent,
    ProjectEditModalComponent
  ],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css']
})
export class HomePageComponent implements OnDestroy {
  private readonly window = inject(WINDOW);
  private readonly document = inject(DOCUMENT);
  private readonly projectAdmin = inject(ProjectAdminFacadeService);

  @ViewChild(ProjectCreatePanelComponent) createPanel: ProjectCreatePanelComponent | null = null;

  readonly softwareProjects = this.projectAdmin.softwareProjects;
  readonly physicalProjects = this.projectAdmin.physicalProjects;
  readonly errorMessage = this.projectAdmin.errorMessage;
  readonly adminStatusMessage = this.projectAdmin.adminStatusMessage;
  readonly isSavingProjectEdit = this.projectAdmin.isSavingProjectEdit;
  readonly canManageProjectContent = this.projectAdmin.canManageProjectContent;
  readonly canManageProjectPublication = this.projectAdmin.canManageProjectPublication;
  readonly pendingProjectPublicationUpdates = this.projectAdmin.pendingProjectPublicationUpdates;
  readonly allProjects = this.projectAdmin.allProjects;

  overlayVisible = false;
  isExpanded = false;
  activeProject: Project | null = null;
  activeProjectMarkdown = '';
  expandedStyle: Record<string, string> = {};
  editingProjectId = signal<string | null>(null);
  readonly editingProject = computed(() => {
    const projectId = this.editingProjectId();
    if (!projectId) {
      return null;
    }
    return this.allProjects().find((project) => project.id === projectId) ?? null;
  });

  private originRect: DOMRect | null = null;
  private openTrigger: HTMLElement | null = null;
  private readonly animationMs = 320;

  openProject(request: ProjectOpenRequest): void {
    this.openTrigger = request.trigger;
    this.originRect = request.trigger.getBoundingClientRect();
    this.activeProject = request.project;
    this.activeProjectMarkdown = preprocessProjectMarkdown(request.project.longDescription, request.project.images);
    this.overlayVisible = true;
    this.isExpanded = false;
    this.expandedStyle = this.rectToStyle(this.originRect, false);

    this.document.body.classList.add('overlay-open');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.isExpanded = true;
        this.expandedStyle = this.rectToStyle(this.getTargetRect(), true);
      });
    });
  }

  closeProject(): void {
    if (!this.overlayVisible || !this.activeProject) {
      return;
    }

    this.isExpanded = false;
    this.expandedStyle = this.rectToStyle(this.originRect ?? this.getTargetRect(), true);

    this.window.setTimeout(() => {
      this.overlayVisible = false;
      this.activeProject = null;
      this.activeProjectMarkdown = '';
      this.document.body.classList.remove('overlay-open');

      if (this.openTrigger) {
        this.openTrigger.focus();
      }

      this.openTrigger = null;
      this.originRect = null;
    }, this.animationMs);
  }

  async createProject(event: ProjectCreateRequestedEvent): Promise<void> {
    if (!this.createPanel) {
      return;
    }

    this.createPanel.setSubmissionState(true, 'Creating project...');
    const created = await this.projectAdmin.createProject(event.draft);

    if (!created) {
      this.createPanel.setSubmissionState(false, '', this.errorMessage());
      return;
    }

    const failedIds = new Set<string>();
    const uploadedImageIds: string[] = [];

    for (let index = 0; index < event.queuedImages.length; index += 1) {
      const queuedImage = event.queuedImages[index];
      this.projectAdmin.adminStatusMessage.set(`Uploading image ${index + 1}/${event.queuedImages.length}...`);
      this.createPanel.setSubmissionState(true, this.projectAdmin.adminStatusMessage());

      const uploadedId = await this.projectAdmin.uploadQueuedImage(created.id, queuedImage);
      if (uploadedId) {
        uploadedImageIds.push(uploadedId);
      } else {
        failedIds.add(queuedImage.id);
      }
    }

    try {
      await this.projectAdmin.reorderUploadedImages(created.id, uploadedImageIds);
    } catch {
      this.projectAdmin.errorMessage.set('Project created, but image ordering failed. You can reorder from Edit.');
    }

    this.createPanel.clearSuccessfulQueuedImages(failedIds);
    await this.projectAdmin.refreshProjects();

    if (failedIds.size > 0) {
      this.createPanel.resetForm();
      this.startEditById(created.id);
      this.projectAdmin.errorMessage.set(
        `Project created, but ${failedIds.size} image upload(s) failed. Re-upload failed images from Edit.`
      );
      this.createPanel.setSubmissionState(false, '', this.projectAdmin.errorMessage());
      return;
    }

    this.createPanel.resetForm();
    this.projectAdmin.adminStatusMessage.set('Project created successfully.');
    this.createPanel.setSubmissionState(false, this.projectAdmin.adminStatusMessage());
  }

  startEdit(project: Project): void {
    this.editingProjectId.set(project.id);
  }

  cancelEdit(): void {
    this.editingProjectId.set(null);
  }

  async saveEdit(event: ProjectEditSaveRequestedEvent): Promise<void> {
    await this.projectAdmin.saveProjectEdit(event);
  }

  toggleProjectPublication(event: { project: Project; isPublished: boolean }): void {
    this.projectAdmin.toggleProjectPublication(event);
  }

  moveProjectFromPill(event: { project: Project; direction: -1 | 1 }): void {
    this.projectAdmin.moveProject(event.project.type, event.project.id, event.direction);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.editingProjectId()) {
      this.cancelEdit();
      return;
    }

    if (this.overlayVisible) {
      this.closeProject();
    }
  }

  private startEditById(projectId: string): void {
    const target = this.allProjects().find((project) => project.id === projectId);
    if (target) {
      this.startEdit(target);
    }
  }

  private rectToStyle(rect: DOMRect, withTransition: boolean): Record<string, string> {
    const mobile = this.window.innerWidth <= 768;

    return {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      borderRadius: mobile ? '0px' : withTransition ? '28px' : '22px',
      transition: withTransition
        ? `top ${this.animationMs}ms cubic-bezier(0.2, 0.8, 0.2, 1), left ${this.animationMs}ms cubic-bezier(0.2, 0.8, 0.2, 1), width ${this.animationMs}ms cubic-bezier(0.2, 0.8, 0.2, 1), height ${this.animationMs}ms cubic-bezier(0.2, 0.8, 0.2, 1), border-radius ${this.animationMs}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
        : 'none'
    };
  }

  private getTargetRect(): DOMRect {
    const vw = this.window.innerWidth;
    const vh = this.window.innerHeight;
    const mobile = vw <= 768;

    if (mobile) {
      return new DOMRect(0, 0, vw, vh);
    }

    const width = Math.min(860, vw - 48);
    const height = Math.min(740, vh - 48);

    return new DOMRect((vw - width) / 2, (vh - height) / 2, width, height);
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove('overlay-open');
    this.createPanel?.clearImageQueue();
  }
}
