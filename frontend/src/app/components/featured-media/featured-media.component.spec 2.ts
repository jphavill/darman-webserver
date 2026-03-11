import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { FeaturedMediaComponent } from './featured-media.component';

describe('FeaturedMediaComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeaturedMediaComponent]
    })
      .overrideComponent(FeaturedMediaComponent, { set: { template: '<section></section>', styles: [] } })
      .compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(FeaturedMediaComponent);
    fixture.componentInstance.media = {
      url: '/media/example.webp',
      alt: 'Example',
      caption: 'Example image'
    };
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
