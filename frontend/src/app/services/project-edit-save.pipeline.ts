import { Project, ProjectImage } from '../models/project.model';

export interface ProjectEditImageDraft {
  draftId: string;
  existingImageId: string | null;
  file: File | null;
  altText: string;
  caption: string;
  isHero: boolean;
}

export interface ProjectEditSaveRequest {
  projectId: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  type: 'software' | 'physical';
  isPublished: boolean;
  imageDrafts: ProjectEditImageDraft[];
}

export interface ProjectEditSavePlan {
  existingImageById: Map<string, ProjectImage>;
  candidateDeletedImageIds: string[];
}

export function buildProjectEditSavePlan(currentProject: Project | null, request: ProjectEditSaveRequest): ProjectEditSavePlan {
  const persistedImages = currentProject?.images ?? [];
  const persistedImageIds = new Set(persistedImages.map((image) => image.id));
  const retainedExistingImageIds = new Set(
    request.imageDrafts
      .map((draft) => draft.existingImageId)
      .filter((imageId): imageId is string => typeof imageId === 'string')
  );

  const candidateDeletedImageIds = [...persistedImageIds].filter((imageId) => !retainedExistingImageIds.has(imageId));

  return {
    existingImageById: new Map(persistedImages.map((image) => [image.id, image])),
    candidateDeletedImageIds
  };
}

export function buildOrderedImageIds(
  imageDrafts: { draftId: string; existingImageId: string | null }[],
  uploadedIdByDraftId: ReadonlyMap<string, string>,
  latestProject: Project | null
): string[] {
  if (!latestProject) {
    return [];
  }

  const desiredImageIds = imageDrafts
    .map((draft) => draft.existingImageId ?? uploadedIdByDraftId.get(draft.draftId) ?? null)
    .filter((imageId): imageId is string => typeof imageId === 'string');

  const latestPersistedImageIds = latestProject.images.map((image) => image.id);
  const latestPersistedSet = new Set(latestPersistedImageIds);
  const seen = new Set<string>();
  const orderedRetainedImageIds: string[] = [];

  for (const imageId of desiredImageIds) {
    if (!latestPersistedSet.has(imageId) || seen.has(imageId)) {
      continue;
    }

    orderedRetainedImageIds.push(imageId);
    seen.add(imageId);
  }

  const trailingPersistedImageIds = latestPersistedImageIds.filter((imageId) => !seen.has(imageId));
  return [...orderedRetainedImageIds, ...trailingPersistedImageIds];
}

export function resolveHeroImageId(
  imageDrafts: { draftId: string; existingImageId: string | null; isHero: boolean }[],
  uploadedIdByDraftId: ReadonlyMap<string, string>
): string | null {
  const heroDraft = imageDrafts.find((draft) => draft.isHero);
  if (!heroDraft) {
    return null;
  }

  return heroDraft.existingImageId ?? uploadedIdByDraftId.get(heroDraft.draftId) ?? null;
}

export function finalizeDeletedImageIds(candidateDeletedImageIds: string[], latestProject: Project | null): string[] {
  if (!latestProject) {
    return [];
  }

  const latestPersistedImageIds = new Set(latestProject.images.map((image) => image.id));
  return candidateDeletedImageIds.filter((imageId) => latestPersistedImageIds.has(imageId));
}
