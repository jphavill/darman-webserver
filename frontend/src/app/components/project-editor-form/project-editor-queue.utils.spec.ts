import { describe, expect, it } from 'vitest';
import { defaultImageAltText, moveQueueItemById, toggleQueueHero } from './project-editor-queue.utils';

describe('project-editor-queue.utils', () => {
  it('normalizes default alt text from filename', () => {
    expect(defaultImageAltText('my_project-image.jpg')).toBe('my project image');
    expect(defaultImageAltText('.jpg')).toBe('Project image');
  });

  it('moves queue item by id and respects boundaries', () => {
    const input = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    expect(moveQueueItemById(input, 'b', -1).map((item) => item.id)).toEqual(['b', 'a', 'c']);
    expect(moveQueueItemById(input, 'a', -1)).toBe(input);
    expect(moveQueueItemById(input, 'missing', 1)).toBe(input);
  });

  it('enforces at most one hero when toggled on and clears when toggled off', () => {
    const input = [
      { id: 'a', isHero: false },
      { id: 'b', isHero: true },
      { id: 'c', isHero: false }
    ];

    const toggledOn = toggleQueueHero(input, 'c', true);
    expect(toggledOn).toEqual([
      { id: 'a', isHero: false },
      { id: 'b', isHero: false },
      { id: 'c', isHero: true }
    ]);

    const toggledOff = toggleQueueHero(toggledOn, 'c', false);
    expect(toggledOff).toEqual([
      { id: 'a', isHero: false },
      { id: 'b', isHero: false },
      { id: 'c', isHero: false }
    ]);
  });
});
