import { Routes } from '@angular/router';
import { HomePageComponent } from './app/pages/home-page/home-page.component';
import { PhotoGalleryPageComponent } from './app/pages/photo-gallery-page/photo-gallery-page.component';
import { SprintPageComponent } from './app/pages/sprint-page/sprint-page.component';

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'sprint', component: SprintPageComponent },
  { path: 'photogallery', component: PhotoGalleryPageComponent },
  { path: '**', redirectTo: '' }
];
