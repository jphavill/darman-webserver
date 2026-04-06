export interface ResolveAltTextOptions {
  altText: string | null | undefined;
  caption: string | null | undefined;
  existingAltText?: string | null;
  filename?: string | null;
  fallback?: string;
}

export function defaultAltTextFromFilename(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, '');
  return stem.replace(/[_-]+/g, ' ').trim() || 'Project image';
}

export function resolveAltTextWithCaptionFallback(options: ResolveAltTextOptions): string {
  const normalizedAltText = normalizeText(options.altText);
  if (normalizedAltText) {
    return normalizedAltText;
  }

  const normalizedCaption = normalizeText(options.caption);
  if (normalizedCaption) {
    return normalizedCaption;
  }

  const normalizedExistingAltText = normalizeText(options.existingAltText);
  if (normalizedExistingAltText) {
    return normalizedExistingAltText;
  }

  const normalizedFilename = normalizeText(options.filename);
  if (normalizedFilename) {
    return defaultAltTextFromFilename(normalizedFilename);
  }

  return options.fallback ?? 'Project image';
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim();
}
