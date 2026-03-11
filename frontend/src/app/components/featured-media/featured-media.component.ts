import { Component, Input } from '@angular/core';
import { FeaturedMedia } from '../../models/project.model';

@Component({
  selector: 'app-featured-media',
  standalone: true,
  templateUrl: './featured-media.component.html',
  styleUrls: ['./featured-media.component.css']
})
export class FeaturedMediaComponent {
  @Input({ required: true }) media!: FeaturedMedia;
}
