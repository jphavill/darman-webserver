import { ProjectImage } from '../../models/project.model';

const IMAGE_TOKEN_START = '[image:';
const WIDTH_PATTERN = /^\d+(?:\.\d+)?(?:px|%|rem|em|vw)?$/;

type ImageAlignment = 'left' | 'right' | 'full';

interface ImageTokenAttributes {
  align: ImageAlignment;
  caption: string;
  width: string;
}

interface ParsedImageToken {
  key: string;
  rawAttributes: string;
}

/**
 * Security model for project markdown:
 * - author-provided markdown text is always HTML-escaped,
 * - only image-token generated figure markup is emitted as trusted HTML,
 * - the escaped + injected result is then passed to ngx-markdown.
 */
export function preprocessProjectMarkdown(markdown: string, images: ProjectImage[]): string {
  const imageById = new Map(images.map((image) => [image.id, image]));
  let processedMarkdown = '';
  let cursor = 0;

  while (cursor < markdown.length) {
    const tokenStart = markdown.indexOf(IMAGE_TOKEN_START, cursor);
    if (tokenStart === -1) {
      processedMarkdown += escapeHtml(markdown.slice(cursor));
      break;
    }

    processedMarkdown += escapeHtml(markdown.slice(cursor, tokenStart));

    const tokenEnd = markdown.indexOf(']', tokenStart + IMAGE_TOKEN_START.length);
    if (tokenEnd === -1) {
      processedMarkdown += escapeHtml(markdown.slice(tokenStart));
      break;
    }

    const tokenContent = markdown.slice(tokenStart + IMAGE_TOKEN_START.length, tokenEnd);
    const parsedToken = parseImageToken(tokenContent);
    const rawToken = markdown.slice(tokenStart, tokenEnd + 1);

    if (!parsedToken) {
      processedMarkdown += escapeHtml(rawToken);
      cursor = tokenEnd + 1;
      continue;
    }

    const image = imageById.get(parsedToken.key);
    if (image) {
      const attributes = parseImageAttributes(parsedToken.rawAttributes);
      const imageMarkup = buildImageFigureMarkup(image, attributes);
      if (imageMarkup) {
        processedMarkdown += imageMarkup;
      }
    }

    cursor = tokenEnd + 1;
  }

  return processedMarkdown;
}

function parseImageToken(rawTokenContent: string): ParsedImageToken | null {
  if (!rawTokenContent || /\s/.test(rawTokenContent[0])) {
    return null;
  }

  const firstWhitespaceIndex = rawTokenContent.search(/\s/);
  if (firstWhitespaceIndex === -1) {
    return {
      key: rawTokenContent,
      rawAttributes: ''
    };
  }

  return {
    key: rawTokenContent.slice(0, firstWhitespaceIndex),
    rawAttributes: rawTokenContent.slice(firstWhitespaceIndex)
  };
}

function parseImageAttributes(rawAttributes: string): ImageTokenAttributes {
  const parsed: ImageTokenAttributes = {
    align: 'full',
    caption: '',
    width: ''
  };

  const attributePattern = /(\w+)=("[^"]*"|[^\s"]+)/g;
  for (const match of rawAttributes.matchAll(attributePattern)) {
    const attributeName = (match[1] ?? '').toLowerCase();
    const rawValue = (match[2] ?? '').trim();
    const value = stripWrappingQuotes(rawValue);

    if (attributeName === 'align') {
      parsed.align = normalizeAlignment(value);
    } else if (attributeName === 'caption') {
      parsed.caption = value;
    } else if (attributeName === 'width') {
      parsed.width = normalizeWidth(value);
    }
  }

  return parsed;
}

function buildImageFigureMarkup(image: ProjectImage, attributes: ImageTokenAttributes): string {
  const source = (image.fullUrl || image.thumbUrl || '').trim();
  if (!source) {
    return '';
  }

  const altText = (image.altText || 'Project image').trim() || 'Project image';
  const caption = (attributes.caption || image.caption || '').trim();
  const widthStyle = attributes.width ? ` style="max-width: ${escapeHtml(attributes.width)};"` : '';
  const figureClass = `md-image md-image-${attributes.align}`;
  const figcaption = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '';

  return `<figure class="${figureClass}"${widthStyle}><img src="${escapeHtml(source)}" alt="${escapeHtml(altText)}" loading="lazy" />${figcaption}</figure>`;
}

function normalizeAlignment(value: string): ImageAlignment {
  const normalized = value.toLowerCase();
  if (normalized === 'left' || normalized === 'right' || normalized === 'full') {
    return normalized;
  }

  return 'full';
}

function normalizeWidth(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!WIDTH_PATTERN.test(normalized)) {
    return '';
  }

  return /^\d+(?:\.\d+)?$/.test(normalized) ? `${normalized}px` : normalized;
}

function stripWrappingQuotes(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  return value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
