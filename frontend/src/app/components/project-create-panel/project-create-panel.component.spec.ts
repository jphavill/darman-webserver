import { describe, expect, it, vi } from 'vitest';
import { ProjectCreatePanelComponent } from './project-create-panel.component';

describe('ProjectCreatePanelComponent', () => {
  it('shows queue limit error when selected files exceed max images', () => {
    const component = new ProjectCreatePanelComponent();
    const files = Array.from({ length: 13 }, (_, index) => new File(['x'], `project-${index}.jpg`, { type: 'image/jpeg' }));

    component.addImages(files);

    expect(component.imageQueue.length).toBe(12);
    expect(component.errorMessage).toBe('You can only queue up to 12 images per project.');
  });

  it('revokes blob urls for successful uploads when retaining failed queue images', () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:one').mockReturnValueOnce('blob:two');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const component = new ProjectCreatePanelComponent();
    const files = [
      new File(['one'], 'one.jpg', { type: 'image/jpeg' }),
      new File(['two'], 'two.jpg', { type: 'image/jpeg' })
    ];

    component.addImages(files);
    const failedImageId = component.imageQueue[1].id;

    component.clearSuccessfulQueuedImages(new Set([failedImageId]));

    expect(revokeSpy).toHaveBeenCalledWith('blob:one');
    expect(revokeSpy).not.toHaveBeenCalledWith('blob:two');
    expect(component.imageQueue.map((image) => image.id)).toEqual([failedImageId]);

    createSpy.mockRestore();
    revokeSpy.mockRestore();
  });
});
