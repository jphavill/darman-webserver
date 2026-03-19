import { FeaturedMedia, Project } from '../models/project.model';

const sharedThumbnail = '/media/gopr4391-enhanced-nr-f2880260d7b3.webp';

export const featuredMedia: FeaturedMedia = {
  url: sharedThumbnail,
  alt: 'Featured project photo',
  caption: 'This image is served directly by Caddy from the /media host folder.'
};

export const softwareProjects: Project[] = [];

export const physicalProjects: Project[] = [];
