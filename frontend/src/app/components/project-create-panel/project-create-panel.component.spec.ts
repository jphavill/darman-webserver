import { describe, expect, it, vi } from 'vitest';
import { ProjectCreatePanelComponent } from './project-create-panel.component';

describe('ProjectCreatePanelComponent', () => {
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
