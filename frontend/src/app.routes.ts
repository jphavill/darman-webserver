import { Routes } from '@angular/router';
import { HomePageComponent } from './app/pages/home-page/home-page.component';
import { PhotoGalleryPageComponent } from './app/pages/photo-gallery-page/photo-gallery-page.component';

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  {
    path: 'sprint',
    loadComponent: () => import('./app/pages/sprint-page/sprint-page.component').then((mod) => mod.SprintPageComponent)
  },
  {
    path: 'results/comparison',
    loadComponent: () =>
      import('./app/features/sprint-comparison/sprint-comparison-page/sprint-comparison-page.component').then(
        (mod) => mod.SprintComparisonPageComponent
      )
  },
  { path: 'photogallery', component: PhotoGalleryPageComponent },
  { path: '**', redirectTo: '' }
];
