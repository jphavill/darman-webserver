import { Component } from '@angular/core';
import { FeaturedMediaComponent } from '../../components/featured-media/featured-media.component';
import { featuredMedia } from '../../data/projects.data';

@Component({
  selector: 'app-photo-gallery-page',
  standalone: true,
  imports: [FeaturedMediaComponent],
  templateUrl: './photo-gallery-page.component.html',
  styleUrls: ['./photo-gallery-page.component.css']
})
export class PhotoGalleryPageComponent {
  readonly featuredMedia = featuredMedia;
}
