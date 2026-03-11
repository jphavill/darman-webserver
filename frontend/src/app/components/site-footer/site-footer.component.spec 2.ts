import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SiteFooterComponent } from './site-footer.component';

describe('SiteFooterComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SiteFooterComponent]
    })
      .overrideComponent(SiteFooterComponent, { set: { template: '<footer></footer>', styles: [] } })
      .compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(SiteFooterComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
