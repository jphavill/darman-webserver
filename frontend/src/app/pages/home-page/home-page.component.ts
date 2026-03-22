
import { Component, HostListener, OnDestroy, SecurityContext, inject, DOCUMENT } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';
import { physicalProjects, softwareProjects } from '../../data/projects.data';
import { Project, ProjectOpenRequest } from '../../models/project.model';
import { SiteFooterComponent } from '../../components/site-footer/site-footer.component';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';
import { ProjectOverlayComponent } from '../../components/project-overlay/project-overlay.component';
import { ProjectSectionComponent } from '../../components/project-section/project-section.component';
import { WINDOW } from '../../core/browser/browser-globals';

@Component({
    selector: 'app-home-page',
    imports: [SiteHeaderComponent, ProjectSectionComponent, SiteFooterComponent, ProjectOverlayComponent],
    templateUrl: './home-page.component.html',
    styleUrls: ['./home-page.component.css']
})
export class HomePageComponent implements OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly window = inject(WINDOW);
  private readonly document = inject(DOCUMENT);

  readonly softwareProjects = softwareProjects;
  readonly physicalProjects = physicalProjects;

  overlayVisible = false;
  isExpanded = false;
  activeProject: Project | null = null;
  activeProjectMarkdown = '';
  expandedStyle: Record<string, string> = {};

  private originRect: DOMRect | null = null;
  private openTrigger: HTMLElement | null = null;
  private readonly animationMs = 320;

  openProject(request: ProjectOpenRequest): void {
    this.openTrigger = request.trigger;
    this.originRect = request.trigger.getBoundingClientRect();
    this.activeProject = request.project;
    this.activeProjectMarkdown = this.markdownToHtml(request.project.longDescription);
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

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.overlayVisible) {
      this.closeProject();
    }
  }

  private markdownToHtml(markdown: string): string {
    const html = marked.parse(markdown) as string;
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
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
  }
}
