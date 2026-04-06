import { defaultAltTextFromFilename } from '../../shared/text/alt-text.utils';

export interface QueueLikeImage {
  id: string;
  isHero: boolean;
}

export function defaultImageAltText(filename: string): string {
  return defaultAltTextFromFilename(filename);
}

export function moveQueueItemById<T extends { id: string }>(items: T[], itemId: string, direction: -1 | 1): T[] {
  const currentIndex = items.findIndex((item) => item.id === itemId);
  const nextIndex = currentIndex + direction;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  [nextItems[currentIndex], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[currentIndex]];
  return nextItems;
}

export function toggleQueueHero<T extends QueueLikeImage>(items: T[], imageId: string, isHero: boolean): T[] {
  return items.map((image) => {
    if (isHero) {
      return { ...image, isHero: image.id === imageId };
    }

    if (image.id === imageId) {
      return { ...image, isHero: false };
    }

    return image;
  });
}

export function createObjectUrlForPreview(file: File): string {
  if (typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(file);
  }

  return '';
}

export function revokeObjectUrlForPreview(url: string): void {
  if (url && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}
