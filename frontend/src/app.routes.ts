import { Routes } from '@angular/router';
import { HomePageComponent } from './app/pages/home-page/home-page.component';
import { PhotosPageComponent } from './app/pages/photos-page/photos-page.component';

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  {
    path: 'leaderboard',
    loadComponent: () => import('./app/pages/leaderboard-page/leaderboard-page.component').then((mod) => mod.LeaderboardPageComponent)
  },
  {
    path: 'charts',
    loadComponent: () =>
      import('./app/features/charts/charts-page/charts-page.component').then(
        (mod) => mod.ChartsPageComponent
      )
  },
  { path: 'photos', component: PhotosPageComponent },
  { path: '**', redirectTo: '' }
];
