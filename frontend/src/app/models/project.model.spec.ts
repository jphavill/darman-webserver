import { describe, expect, it } from 'vitest';
import { mapProjectApiToProject } from './project.model';

describe('project model mapper', () => {
  it('maps null image caption to undefined', () => {
    const mapped = mapProjectApiToProject({
      id: 'project-1',
      title: 'Project',
      short_description: 'Short',
      long_description_md: 'Long',
      type: 'software',
      is_published: true,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      tags: [],
      links: [],
      images: [
        {
          id: 'image-1',
          thumb_url: '/media/projects/thumb.webp',
          full_url: '/media/projects/full.webp',
          alt_text: 'Alt',
          caption: null,
          sort_order: 0,
          is_hero: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z'
        }
      ]
    });

    expect(mapped.images[0].caption).toBeUndefined();
  });
});
