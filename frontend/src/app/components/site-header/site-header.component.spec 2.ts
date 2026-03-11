import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SiteHeaderComponent } from './site-header.component';

describe('SiteHeaderComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SiteHeaderComponent]
    })
      .overrideComponent(SiteHeaderComponent, { set: { template: '<header></header>', styles: [] } })
      .compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(SiteHeaderComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
