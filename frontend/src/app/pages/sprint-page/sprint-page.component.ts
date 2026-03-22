import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { SprintTimesGridComponent } from '../../components/sprint-times-grid/sprint-times-grid.component';

@Component({
  selector: 'app-sprint-page',
  standalone: true,
  imports: [AsyncPipe, SprintTimesGridComponent],
  templateUrl: './sprint-page.component.html',
  styleUrls: ['./sprint-page.component.css']
})
export class SprintPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly pageTitle$ = this.route.queryParamMap.pipe(
    map((params) => (params.get('view') === 'advanced' ? 'All Data' : 'Leaderboard'))
  );
}
