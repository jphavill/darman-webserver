export interface Project {
  id: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  thumbnail?: string;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  images: ProjectImage[];
  tags: string[];
  links: ProjectLink[];
  type: 'software' | 'physical';
}

export interface ProjectLink {
  id?: string;
  type: 'github' | 'cults3d' | 'website' | 'other';
  label: string;
  url: string;
  sortOrder?: number;
}

export interface ProjectImage {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  altText: string;
  caption?: string;
  sortOrder: number;
  isHero: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectOpenRequest {
  project: Project;
  trigger: HTMLElement;
}

export interface ProjectApi {
  id: string;
  title: string;
  short_description: string;
  long_description_md: string;
  type: 'software' | 'physical';
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  tags: string[];
  links: ProjectLinkApi[];
  images: ProjectImageApi[];
}

export interface ProjectListResponseApi {
  rows: ProjectApi[];
  total: number;
}

export interface ProjectListResponse {
  rows: Project[];
  total: number;
}

export interface ProjectLinkApi {
  id: string;
  type: 'github' | 'cults3d' | 'website' | 'other';
  label: string;
  url: string;
  sort_order: number;
}

export interface ProjectImageApi {
  id: string;
  thumb_url: string;
  full_url: string;
  alt_text: string;
  caption: string | null;
  sort_order: number;
  is_hero: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreatePayload {
  title: string;
  short_description: string;
  long_description_md: string;
  type: 'software' | 'physical';
  is_published: boolean;
  links: { type: 'github' | 'cults3d' | 'website' | 'other'; label: string; url: string }[];
}

export interface ProjectImageUploadPayload {
  altText: string;
  caption?: string;
  isHero: boolean;
}

export function mapProjectApiToProject(project: ProjectApi): Project {
  const images = [...project.images]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => ({
      id: image.id,
      thumbUrl: image.thumb_url,
      fullUrl: image.full_url,
      altText: image.alt_text,
      caption: image.caption ?? undefined,
      sortOrder: image.sort_order,
      isHero: image.is_hero,
      createdAt: image.created_at,
      updatedAt: image.updated_at
    }));

  const hero = images.find((image) => image.isHero) ?? images[0];

  return {
    id: project.id,
    title: project.title,
    shortDescription: project.short_description,
    longDescription: project.long_description_md,
    thumbnail: hero?.thumbUrl,
    isPublished: project.is_published,
    sortOrder: project.sort_order,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    images,
    tags: project.tags ?? [],
    links: [...project.links]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((link) => ({
        id: link.id,
        type: link.type,
        label: link.label,
        url: link.url,
        sortOrder: link.sort_order
      })),
    type: project.type
  };
}
