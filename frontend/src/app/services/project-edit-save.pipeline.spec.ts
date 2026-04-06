import { describe, expect, it } from 'vitest';
import { Project } from '../models/project.model';
import { buildOrderedImageIds } from './project-edit-save.pipeline';

describe('project-edit-save.pipeline', () => {
  it('includes all persisted image ids in reorder payload, appending removed ids at the end', () => {
    const latestProject = {
      images: [{ id: 'img-existing' }, { id: 'img-delete-me' }, { id: 'img-uploaded' }]
    } as Project;

    const imageDrafts = [
      { draftId: 'draft-existing', existingImageId: 'img-existing' },
      { draftId: 'draft-uploaded', existingImageId: null }
    ];
    const uploadedIdByDraftId = new Map<string, string>([['draft-uploaded', 'img-uploaded']]);

    expect(buildOrderedImageIds(imageDrafts, uploadedIdByDraftId, latestProject)).toEqual([
      'img-existing',
      'img-uploaded',
      'img-delete-me'
    ]);
  });

  it('keeps unknown persisted ids in the payload tail to satisfy backend exact-set validation', () => {
    const latestProject = {
      images: [{ id: 'img-a' }, { id: 'img-foreign' }, { id: 'img-b' }]
    } as Project;

    const imageDrafts = [{ draftId: 'draft-a', existingImageId: 'img-a' }];
    const uploadedIdByDraftId = new Map<string, string>();

    expect(buildOrderedImageIds(imageDrafts, uploadedIdByDraftId, latestProject)).toEqual([
      'img-a',
      'img-foreign',
      'img-b'
    ]);
  });

  it('returns empty when latest project is unavailable', () => {
    const imageDrafts = [{ draftId: 'draft-a', existingImageId: 'img-a' }];
    const uploadedIdByDraftId = new Map<string, string>();

    expect(buildOrderedImageIds(imageDrafts, uploadedIdByDraftId, null)).toEqual([]);
  });
});
