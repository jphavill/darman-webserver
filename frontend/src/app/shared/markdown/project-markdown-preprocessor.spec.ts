import { describe, expect, it } from 'vitest';
import { ProjectImage } from '../../models/project.model';
import { preprocessProjectMarkdown } from './project-markdown-preprocessor';

function buildImage(overrides: Partial<ProjectImage> = {}): ProjectImage {
  return {
    id: 'image-1',
    thumbUrl: 'https://cdn.example.com/thumb.jpg',
    fullUrl: 'https://cdn.example.com/full.jpg',
    altText: 'Render target',
    caption: 'Default caption',
    sortOrder: 0,
    isHero: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides
  };
}

describe('project markdown preprocessor', () => {
  it('replaces image tokens with trusted figure markup', () => {
    const markdown = preprocessProjectMarkdown('Before [image:image-1 align=right caption="Inline caption" width=320] after', [
      buildImage()
    ]);

    expect(markdown).toContain('Before');
    expect(markdown).toContain('after');
    expect(markdown).toContain('<figure class="md-image md-image-right" style="max-width: 320px;">');
    expect(markdown).toContain('<img src="https://cdn.example.com/full.jpg" alt="Render target" loading="lazy" />');
    expect(markdown).toContain('<figcaption>Inline caption</figcaption>');
  });

  it('renders multiple image tokens in one pass and preserves order', () => {
    const markdown = preprocessProjectMarkdown(
      'Start [image:image-1 align=left width=240] middle [image:image-2 align=right caption="Second"] end',
      [
        buildImage({ id: 'image-1', fullUrl: 'https://cdn.example.com/one.jpg', altText: 'One' }),
        buildImage({ id: 'image-2', fullUrl: 'https://cdn.example.com/two.jpg', altText: 'Two' })
      ]
    );

    expect(markdown).toContain('Start ');
    expect(markdown).toContain(' middle ');
    expect(markdown).toContain(' end');
    expect(markdown).toContain('<figure class="md-image md-image-left" style="max-width: 240px;"><img src="https://cdn.example.com/one.jpg" alt="One" loading="lazy" /><figcaption>Default caption</figcaption></figure>');
    expect(markdown).toContain('<figure class="md-image md-image-right"><img src="https://cdn.example.com/two.jpg" alt="Two" loading="lazy" /><figcaption>Second</figcaption></figure>');
    expect(markdown.indexOf('one.jpg')).toBeLessThan(markdown.indexOf('two.jpg'));
  });

  it('falls back to thumbUrl when fullUrl is unavailable', () => {
    const markdown = preprocessProjectMarkdown('[image:image-1]', [buildImage({ fullUrl: '' })]);

    expect(markdown).toContain('<img src="https://cdn.example.com/thumb.jpg" alt="Render target" loading="lazy" />');
  });

  it('removes tokens with unknown image ids', () => {
    const markdown = preprocessProjectMarkdown('Content [image:missing-id] tail', [buildImage()]);

    expect(markdown).toContain('Content  tail');
    expect(markdown).not.toContain('[image:missing-id]');
    expect(markdown).not.toContain('<figure');
  });

  it('keeps malformed and incomplete tokens as escaped text', () => {
    const malformed = preprocessProjectMarkdown('Text [image:] tail', [buildImage()]);
    const incomplete = preprocessProjectMarkdown('Text [image:image-1 align=right', [buildImage()]);

    expect(malformed).toContain('Text [image:] tail');
    expect(malformed).not.toContain('<figure');
    expect(incomplete).toContain('Text [image:image-1 align=right');
    expect(incomplete).not.toContain('<figure');
  });

  it('normalizes width and alignment attributes', () => {
    const normalized = preprocessProjectMarkdown('[image:image-1 align=LEFT width=320.5]', [buildImage()]);
    const invalid = preprocessProjectMarkdown('[image:image-1 align=diagonal width=12ch]', [buildImage()]);

    expect(normalized).toContain('<figure class="md-image md-image-left" style="max-width: 320.5px;">');
    expect(invalid).toContain('<figure class="md-image md-image-full">');
    expect(invalid).not.toContain('max-width');
  });

  it('does not leak attribute parser state across repeated calls', () => {
    const withAttributes = preprocessProjectMarkdown('[image:image-1 align=right width=280 caption="One"]', [buildImage()]);
    const withoutAttributes = preprocessProjectMarkdown('[image:image-1]', [buildImage()]);

    expect(withAttributes).toContain('<figure class="md-image md-image-right" style="max-width: 280px;">');
    expect(withAttributes).toContain('<figcaption>One</figcaption>');
    expect(withoutAttributes).toContain('<figure class="md-image md-image-full">');
    expect(withoutAttributes).toContain('<figcaption>Default caption</figcaption>');
    expect(withoutAttributes).not.toContain('max-width');
  });

  it('does not replace token-like text that appears in content or captions', () => {
    const markdown = preprocessProjectMarkdown(
      'PROJECT_IMAGE_TOKEN_0 [image:image-1 caption="PROJECT_IMAGE_TOKEN_0"] trailing PROJECT_IMAGE_TOKEN_1',
      [buildImage()]
    );

    expect(markdown).toContain('PROJECT_IMAGE_TOKEN_0');
    expect(markdown).toContain('PROJECT_IMAGE_TOKEN_1');
    expect(markdown).toContain('<figcaption>PROJECT_IMAGE_TOKEN_0</figcaption>');
    expect(markdown).toContain('<figure class="md-image md-image-full">');
  });

  it('escapes user supplied html and figure attributes', () => {
    const markdown = preprocessProjectMarkdown(
      '<p>unsafe</p> [image:image-1 caption="Hi <script>alert(1)</script>"]',
      [buildImage({ altText: 'A "quote" & <tag>' })]
    );

    expect(markdown).toContain('&lt;p&gt;unsafe&lt;/p&gt;');
    expect(markdown).toContain('alt="A &quot;quote&quot; &amp; &lt;tag&gt;"');
    expect(markdown).toContain('<figcaption>Hi &lt;script&gt;alert(1)&lt;/script&gt;</figcaption>');
  });
});
