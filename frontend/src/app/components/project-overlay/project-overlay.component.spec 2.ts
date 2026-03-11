import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectOverlayComponent } from './project-overlay.component';

describe('ProjectOverlayComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectOverlayComponent]
    })
      .overrideComponent(ProjectOverlayComponent, { set: { template: '<div></div>', styles: [] } })
      .compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(ProjectOverlayComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
