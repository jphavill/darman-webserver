import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, switchMap, tap } from 'rxjs';
import { AdminAuthStateService } from './admin-auth-state.service';
import { AdminFeatureFlag, AdminSessionResponseApi, mapAdminSessionResponseApi } from './admin.models';

@Injectable({
  providedIn: 'root'
})
export class AdminSessionService {
  private readonly http = inject(HttpClient);
  private readonly authState = inject(AdminAuthStateService);

  private readonly isLoggingInSignal = signal(false);
  private readonly loginErrorSignal = signal('');
  private readonly logoutErrorSignal = signal('');

  readonly isLoggingIn = computed(() => this.isLoggingInSignal());
  readonly loginError = computed(() => this.loginErrorSignal());
  readonly logoutError = computed(() => this.logoutErrorSignal());
  readonly isAuthenticated = this.authState.isAuthenticated;
  readonly featureFlags = this.authState.featureFlags;

  constructor() {
    this.refreshSession().subscribe();
  }

  can(flag: AdminFeatureFlag): boolean {
    return this.authState.can(flag);
  }

  login(token: string): Observable<boolean> {
    const trimmedToken = token.trim();

    if (!trimmedToken) {
      this.loginErrorSignal.set('Enter an API key to continue.');
      return of(false);
    }

    this.isLoggingInSignal.set(true);
    this.loginErrorSignal.set('');

    return this.http
      .post<AdminSessionResponseApi>('/api/v1/system/admin/session', { api_key: trimmedToken })
      .pipe(
        map(mapAdminSessionResponseApi),
        tap((session) => {
          this.authState.setSession(session.featureFlags);
          this.logoutErrorSignal.set('');
        }),
        map(() => true),
        catchError((error: HttpErrorResponse) => {
          this.authState.clearSession();
          this.loginErrorSignal.set(this.mapLoginError(error));
          return of(false);
        }),
        finalize(() => {
          this.isLoggingInSignal.set(false);
        })
      );
  }

  refreshSession(): Observable<boolean> {
    return this.http
      .get<AdminSessionResponseApi>('/api/v1/system/admin/session')
      .pipe(
        map(mapAdminSessionResponseApi),
        tap((session) => {
          this.authState.setSession(session.featureFlags);
          this.logoutErrorSignal.set('');
        }),
        map(() => true),
        catchError(() => {
          this.authState.clearSession();
          return of(false);
        })
      );
  }

  logout(): void {
    this.loginErrorSignal.set('');
    this.logoutErrorSignal.set('');

    this.http
      .delete('/api/v1/system/admin/session')
      .pipe(
        map(() => true),
        catchError(() => of(false)),
        switchMap((deleteSucceeded) =>
          this.refreshSession().pipe(
            map((sessionIsActive) => ({ deleteSucceeded, sessionIsActive }))
          )
        )
      )
      .subscribe({
        next: ({ deleteSucceeded, sessionIsActive }) => {
          if (sessionIsActive) {
            this.logoutErrorSignal.set('Unable to log out. Please try again.');
            return;
          }

          if (!deleteSucceeded) {
            this.logoutErrorSignal.set('Could not confirm logout with server.');
            return;
          }

          this.logoutErrorSignal.set('');
        },
        error: () => {
          this.logoutErrorSignal.set('Could not confirm logout with server.');
        }
    });
  }

  clearLoginError(): void {
    this.loginErrorSignal.set('');
    this.logoutErrorSignal.set('');
  }

  private mapLoginError(error: HttpErrorResponse): string {
    if (error.status === 401) {
      return 'Invalid API key.';
    }

    if (error.status === 503) {
      return 'Admin login is unavailable right now.';
    }

    return 'Unable to log in right now.';
  }
}
