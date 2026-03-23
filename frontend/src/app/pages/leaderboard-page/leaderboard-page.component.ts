import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { LeaderboardComponent } from '../../components/leaderboard/leaderboard.component';

@Component({
    selector: 'app-leaderboard-page',
    imports: [AsyncPipe, LeaderboardComponent],
    templateUrl: './leaderboard-page.component.html',
    styleUrls: ['./leaderboard-page.component.css']
})
export class LeaderboardPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly pageTitle$ = this.route.queryParamMap.pipe(
    map((params) => (params.get('view') === 'advanced' ? 'All Data' : 'Leaderboard'))
  );
}
