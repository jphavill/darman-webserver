export interface Project {
  id: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  thumbnail?: string;
  tags: string[];
  links: ProjectLink[];
  type: 'software' | 'physical';
}

export interface ProjectLink {
  type: 'github' | 'cults3d' | 'website';
  label: string;
  url: string;
}

export interface ProjectOpenRequest {
  project: Project;
  trigger: HTMLElement;
}
