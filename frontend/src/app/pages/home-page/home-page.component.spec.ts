import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { HomePageComponent } from './home-page.component';

describe('HomePageComponent', () => {
  it('sanitizes markdown before exposing overlay HTML', () => {
    const component = TestBed.runInInjectionContext(() => new HomePageComponent());
    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = () => new DOMRect(0, 0, 120, 80);

    component.openProject({
      trigger,
      project: {
        id: 'security-test',
        title: 'Security Test',
        shortDescription: 'Short',
        longDescription: '<script>alert(1)</script><p>Safe content</p>',
        tags: [],
        links: [],
        type: 'software'
      }
    });

    expect(component.activeProjectMarkdown.includes('<script')).toBe(false);
    expect(component.activeProjectMarkdown.includes('Safe content')).toBe(true);
  });

  it('removes overlay-open body class on destroy', () => {
    const component = TestBed.runInInjectionContext(() => new HomePageComponent());
    document.body.classList.add('overlay-open');

    component.ngOnDestroy();

    expect(document.body.classList.contains('overlay-open')).toBe(false);
  });
});
