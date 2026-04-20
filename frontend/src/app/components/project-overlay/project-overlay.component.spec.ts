import { describe, expect, it } from 'vitest';
import { ProjectOverlayComponent } from './project-overlay.component';

describe('ProjectOverlayComponent', () => {
  it('creates the component class', () => {
    const component = new ProjectOverlayComponent();
    expect(component).toBeTruthy();
  });

  it('preserves generated figure markup through the overlay markdown render path', () => {
    const component = new ProjectOverlayComponent();
    component.activeProjectMarkdown =
      'Lead copy <figure class="md-image md-image-right"><img src="/media/full.webp" alt="Inline alt" loading="lazy" /><figcaption>Inline caption</figcaption></figure> tail copy';

    const markdownContainer = document.createElement('div');
    markdownContainer.className = 'project-markdown';
    markdownContainer.innerHTML = component.activeProjectMarkdown;

    const inlineFigure = markdownContainer.querySelector('figure.md-image.md-image-right');
    const caption = markdownContainer.querySelector('figcaption');

    expect(markdownContainer.textContent).toContain('Lead copy');
    expect(markdownContainer.textContent).toContain('tail copy');
    expect(inlineFigure).toBeTruthy();
    expect(caption?.textContent).toContain('Inline caption');
  });
});
