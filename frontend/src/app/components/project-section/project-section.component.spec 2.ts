import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectSectionComponent } from './project-section.component';

describe('ProjectSectionComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectSectionComponent]
    })
      .overrideComponent(ProjectSectionComponent, { set: { template: '<section></section>', styles: [] } })
      .compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(ProjectSectionComponent);
    fixture.componentInstance.title = 'Projects';
    fixture.componentInstance.projects = [];
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
