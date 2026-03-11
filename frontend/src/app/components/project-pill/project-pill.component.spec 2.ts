import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectPillComponent } from './project-pill.component';

describe('ProjectPillComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectPillComponent]
    })
      .overrideComponent(ProjectPillComponent, { set: { template: '<button type="button"></button>', styles: [] } })
      .compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(ProjectPillComponent);
    fixture.componentInstance.project = {
      id: 'test-project',
      title: 'Test Project',
      shortDescription: 'Short description',
      longDescription: 'Long description',
      thumbnail: '/media/test.webp',
      tags: ['Angular'],
      links: [{ type: 'website', label: 'Visit', url: 'https://example.com' }],
      type: 'software'
    };
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
