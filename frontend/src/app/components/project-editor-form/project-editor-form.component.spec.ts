import { ProjectEditorFormComponent } from './project-editor-form.component';
import { describe, expect, it, vi } from 'vitest';

describe('ProjectEditorFormComponent', () => {
  it('emits patched form values', () => {
    const component = new ProjectEditorFormComponent();
    component.value = {
      title: 'Original',
      type: 'software',
      isPublished: false,
      shortDescription: 'Short',
      longDescription: 'Long'
    };
    const emitSpy = vi.spyOn(component.valueChange, 'emit');

    component.patchValue({ title: 'Updated' });

    expect(emitSpy).toHaveBeenCalledWith({
      title: 'Updated',
      type: 'software',
      isPublished: false,
      shortDescription: 'Short',
      longDescription: 'Long'
    });
  });

  it('emits selected files and clears file input value', () => {
    const component = new ProjectEditorFormComponent();
    const emitSpy = vi.spyOn(component.filesSelected, 'emit');
    const file = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    const input = {
      files: [file],
      value: 'selected-file'
    } as unknown as HTMLInputElement;

    component.onFileSelection({ target: input } as Event);

    expect(emitSpy).toHaveBeenCalledWith([file]);
    expect(input.value).toBe('');
  });

  it('emits image patch and hero/move/delete events', () => {
    const component = new ProjectEditorFormComponent();
    const patchSpy = vi.spyOn(component.imagePatched, 'emit');
    const heroSpy = vi.spyOn(component.setHeroRequested, 'emit');
    const moveSpy = vi.spyOn(component.moveRequested, 'emit');
    const deleteSpy = vi.spyOn(component.deleteRequested, 'emit');

    component.patchImage('img-1', { caption: 'Updated caption' });
    component.requestSetHero({ id: 'img-1', previewUrl: '', altText: 'Alt', caption: 'Caption', isHero: false });
    component.requestMove('img-1', 1);
    component.requestDelete('img-1');

    expect(patchSpy).toHaveBeenCalledWith({ imageId: 'img-1', patch: { caption: 'Updated caption' } });
    expect(heroSpy).toHaveBeenCalledWith({ imageId: 'img-1', isHero: true });
    expect(moveSpy).toHaveBeenCalledWith({ imageId: 'img-1', direction: 1 });
    expect(deleteSpy).toHaveBeenCalledWith('img-1');
  });
});
