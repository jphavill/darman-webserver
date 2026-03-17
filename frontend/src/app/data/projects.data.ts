import { FeaturedMedia, Project } from '../models/project.model';

const sharedThumbnail = '/media/gopr4391-enhanced-nr-f2880260d7b3.webp';

export const featuredMedia: FeaturedMedia = {
  url: sharedThumbnail,
  alt: 'Featured project photo',
  caption: 'This image is served directly by Caddy from the /media host folder.'
};

export const softwareProjects: Project[] = [
  {
    id: 'first-project',
    title: 'My First Project',
    shortDescription: 'A starter API project that shaped my backend foundations.',
    longDescription: `## Why I built it

I wanted to learn what a complete project lifecycle looked like from concept to deployment.

## Highlights

- Built a Python API with structured routing and persistence.
- Added simple tests and deployment automation.
- Documented setup for faster future project starts.`,
    thumbnail: sharedThumbnail,
    tags: ['Python', 'API'],
    links: [
      { type: 'github', label: 'View on GitHub', url: 'https://github.com/jphavill' },
      { type: 'website', label: 'Live Demo', url: 'https://www.jasonhavill.com' }
    ],
    type: 'software'
  },
  {
    id: 'web-application',
    title: 'Web Application',
    shortDescription: 'A full-stack app focused on clean UX and reliable deployment.',
    longDescription: `## Overview

This project combines a modern frontend with API services and production deployment practices.

## Stack

- Angular frontend
- Python backend
- PostgreSQL
- Cloudflare Tunnel + Caddy`,
    thumbnail: sharedThumbnail,
    tags: ['TypeScript', 'Angular'],
    links: [{ type: 'github', label: 'Source Code', url: 'https://github.com/jphavill/darman-webserver' }],
    type: 'software'
  }
];

export const physicalProjects: Project[] = [
  {
    id: 'custom-print',
    title: 'Custom 3D Print',
    shortDescription: 'Functional print designed for durability and quick iteration cycles.',
    longDescription: `## Process

I modeled the part for real-world tolerances and iterated through several prototypes.

## Notes

- Optimized wall thickness and infill for strength.
- Tuned supports for fast post-processing.
- Published files for community remixing.`,
    thumbnail: sharedThumbnail,
    tags: ['Fusion 360', 'Prusa', 'PLA'],
    links: [{ type: 'cults3d', label: 'STL on Cults3D', url: 'https://cults3d.com' }],
    type: 'physical'
  },
  {
    id: 'mechanical-design',
    title: 'Mechanical Design',
    shortDescription: 'Assembly-driven CAD project for fit, motion, and manufacturing clarity.',
    longDescription: `## Engineering focus

This project emphasizes parametric design and clear assembly intent.

## Deliverables

- Organized parts and constraints
- Revision-ready dimensions
- Visual communication renders`,
    thumbnail: sharedThumbnail,
    tags: ['Onshape', 'SOLIDWORKS'],
    links: [{ type: 'website', label: 'Project Page', url: 'https://www.jasonhavill.com' }],
    type: 'physical'
  }
];
