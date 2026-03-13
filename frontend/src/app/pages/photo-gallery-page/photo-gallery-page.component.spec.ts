import { describe, expect, it } from 'vitest';
import { PhotoGalleryPageComponent } from './photo-gallery-page.component';

describe('PhotoGalleryPageComponent', () => {
  it('creates the component class', () => {
    const component = new PhotoGalleryPageComponent();
    expect(component.featuredMedia).toBeTruthy();
  });
});
