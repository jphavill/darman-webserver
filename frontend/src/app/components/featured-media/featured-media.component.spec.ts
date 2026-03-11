import { describe, expect, it } from 'vitest';
import { FeaturedMediaComponent } from './featured-media.component';

describe('FeaturedMediaComponent', () => {
  it('creates the component class', () => {
    const component = new FeaturedMediaComponent();
    component.media = {
      url: '/media/example.webp',
      alt: 'Example',
      caption: 'Example image'
    };
    expect(component).toBeTruthy();
  });
});
