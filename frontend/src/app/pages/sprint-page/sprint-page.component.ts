import { Component } from '@angular/core';
import { SprintTimesGridComponent } from '../../components/sprint-times-grid/sprint-times-grid.component';

@Component({
  selector: 'app-sprint-page',
  standalone: true,
  imports: [SprintTimesGridComponent],
  templateUrl: './sprint-page.component.html',
  styleUrls: ['./sprint-page.component.css']
})
export class SprintPageComponent {}
